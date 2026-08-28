import z from '@deepseek-ai/schemastery'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { credentialRef } from '@deepseek-ai/dsh-credentials'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { GiteaClient, normalizeBaseUrl } from './gitea-client.js'
import { runHandler, formatToolResult } from './handlers.js'
import { stripSecretsFromConfig, credentialRefStatus } from './secrets.js'
import { buildGitSnapshot, isGitDir } from './git-local.js'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { rememberSessionGitDirs, resolveSessionGitDir, sessionIdsFromExec, sessionCwdFromExec, repoCwdFromTool, candidateGitDirsFromExec, candidateGitDirsFromSessionJsonl, selectChipRepoDir } from './session-git.js'

export const name = 'dsh-gitea'
export const inject = ['tools', 'credentials', 'settings', 'webServer']

const NS = 'dsh-gitea'
const execFileAsync = promisify(execFile)


function writeJson(res, code, body) {
  try {
    res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
    res.end(JSON.stringify(body))
  } catch { /* socket closed */ }
}

function readBody(req, maxBytes = 256 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    req.on('data', (c) => {
      size += c.length
      if (size > maxBytes) { reject(new Error('body too large')); req.destroy(); return }
      chunks.push(c)
    })
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

function isTrustedSettingsRequest(request) {
  return request.headers['sec-fetch-site'] !== 'cross-site'
}

export const Config = z.object({
  baseUrl: z.string().default('')
    .description('Gitea or Forgejo instance URL, e.g. https://gitea.example.com'),
  tokenEnv: z.string().default('GITEA_TOKEN')
    .description('DSH credential name holding the API token.'),
  defaultOwner: z.string().default('')
    .description('Default repository owner when the tool omits owner/repo.'),
  defaultRepo: z.string().default('')
    .description('Default repository name when the tool omits owner/repo.'),
  gitWrapper: z.string().default('')
    .description('Git wrapper binary (e.g. git-deepseek-harness) used for write operations. Empty disables worktree add/remove.'),
  dodReminder: z.boolean().default(false)
    .description('DoD reminder: after a tool run that changed git files, remind if no issue/PR reference was made. Default off, never blocks.'),
  timeoutMs: z.number().default(30000)
    .description('HTTP timeout in milliseconds.'),
})

const GITEA_RECORD = {
  type: 'object',
  additionalProperties: false,
  properties: {
    number: { type: 'number' },
    title: { type: 'string' },
    name: { type: 'string' },
    merged: { type: 'boolean' },
    state: { type: 'string' },
    id: { type: 'number' },
    body: { type: 'string' },
    html_url: { type: 'string' },
    full_name: { type: 'string' },
    created_at: { type: 'string' },
    updated_at: { type: 'string' },
    user_login: { type: 'string' },
    login: { type: 'string' },
    path: { type: 'string' },
    branch: { type: 'string' },
    dirty: { type: 'boolean' },
    head: { type: 'string' },
    current: { type: 'boolean' },
    repoDir: { type: 'string' },
  },
}

export const OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    ok: { type: 'boolean' },
    error: { type: 'string' },
    data: {
      oneOf: [
        { type: 'array', items: GITEA_RECORD },
        GITEA_RECORD,
      ],
    },
  },
}

const TOOL_DEFS = [
  {
    name: 'gitea_issue_create',
    description: 'Create a Gitea/Forgejo issue in a repository.',
    parameters: {
      title: { type: 'string', required: true, description: 'Issue title.' },
      body: { type: 'string', description: 'Issue body.' },
      owner: { type: 'string', description: 'Repository owner.' },
      repo: { type: 'string', description: 'Repository name.' },
    },
  },
  {
    name: 'gitea_issue_list',
    description: 'List Gitea/Forgejo issues in a repository.',
    parameters: {
      state: { type: 'string', description: 'Filter: open, closed, or all.' },
      limit: { type: 'number', description: 'Maximum items to return.' },
      page: { type: 'number', description: 'Page number.' },
      owner: { type: 'string', description: 'Repository owner.' },
      repo: { type: 'string', description: 'Repository name.' },
    },
  },
  {
    name: 'gitea_issue_get',
    description: 'Get a Gitea/Forgejo issue by number.',
    parameters: {
      number: { type: 'number', required: true, description: 'Issue number.' },
      owner: { type: 'string', description: 'Repository owner.' },
      repo: { type: 'string', description: 'Repository name.' },
    },
  },
  {
    name: 'gitea_issue_comment',
    description: 'Add a comment to a Gitea/Forgejo issue.',
    parameters: {
      number: { type: 'number', required: true, description: 'Issue number.' },
      body: { type: 'string', required: true, description: 'Comment text.' },
      owner: { type: 'string', description: 'Repository owner.' },
      repo: { type: 'string', description: 'Repository name.' },
    },
  },
  {
    name: 'gitea_issue_close',
    description: 'Close a Gitea/Forgejo issue.',
    parameters: {
      number: { type: 'number', required: true, description: 'Issue number.' },
      owner: { type: 'string', description: 'Repository owner.' },
      repo: { type: 'string', description: 'Repository name.' },
    },
  },
  {
    name: 'gitea_pr_create',
    description: 'Create a Gitea/Forgejo pull request.',
    parameters: {
      title: { type: 'string', required: true, description: 'Pull request title.' },
      head: { type: 'string', required: true, description: 'Head branch.' },
      base: { type: 'string', required: true, description: 'Base branch.' },
      body: { type: 'string', description: 'Pull request body.' },
      owner: { type: 'string', description: 'Repository owner.' },
      repo: { type: 'string', description: 'Repository name.' },
    },
  },
  {
    name: 'gitea_pr_list',
    description: 'List Gitea/Forgejo pull requests.',
    parameters: {
      state: { type: 'string', description: 'Filter: open, closed, or all.' },
      limit: { type: 'number', description: 'Maximum items to return.' },
      page: { type: 'number', description: 'Page number.' },
      owner: { type: 'string', description: 'Repository owner.' },
      repo: { type: 'string', description: 'Repository name.' },
    },
  },
  {
    name: 'gitea_pr_get',
    description: 'Get a Gitea/Forgejo pull request by number.',
    parameters: {
      number: { type: 'number', required: true, description: 'Pull request number.' },
      owner: { type: 'string', description: 'Repository owner.' },
      repo: { type: 'string', description: 'Repository name.' },
    },
  },
  {
    name: 'gitea_pr_comment',
    description: 'Add a comment to a Gitea/Forgejo pull request.',
    parameters: {
      number: { type: 'number', required: true, description: 'Pull request number.' },
      body: { type: 'string', required: true, description: 'Comment text.' },
      owner: { type: 'string', description: 'Repository owner.' },
      repo: { type: 'string', description: 'Repository name.' },
    },
  },
  {
    name: 'gitea_pr_merge',
    description: 'Merge a Gitea/Forgejo pull request. Requires confirm: true (boolean).',
    parameters: {
      number: { type: 'number', required: true, description: 'Pull request number.' },
      confirm: { type: 'boolean', description: 'Must be true to merge.' },
      Do: { type: 'string', description: 'Merge style: merge, rebase, or squash.' },
      owner: { type: 'string', description: 'Repository owner.' },
      repo: { type: 'string', description: 'Repository name.' },
    },
  },
  {
    name: 'gitea_pr_files',
    description: 'List files changed in a pull request.',
    parameters: {
      number: { type: 'number', required: true, description: 'Pull request number.' },
      limit: { type: 'number', description: 'Maximum items to return.' },
      page: { type: 'number', description: 'Page number.' },
      owner: { type: 'string', description: 'Repository owner.' },
      repo: { type: 'string', description: 'Repository name.' },
    },
  },
  {
    name: 'gitea_pr_reviews',
    description: 'List reviews on a pull request.',
    parameters: {
      number: { type: 'number', required: true, description: 'Pull request number.' },
      limit: { type: 'number', description: 'Maximum items to return.' },
      page: { type: 'number', description: 'Page number.' },
      owner: { type: 'string', description: 'Repository owner.' },
      repo: { type: 'string', description: 'Repository name.' },
    },
  },
  {
    name: 'gitea_pr_submit_review',
    description: 'Submit a review on a pull request (event: APPROVED, REQUEST_CHANGES, COMMENT, PENDING).',
    parameters: {
      number: { type: 'number', required: true, description: 'Pull request number.' },
      event: { type: 'string', required: true, description: 'Review event: APPROVED, REQUEST_CHANGES, COMMENT.' },
      body: { type: 'string', description: 'Review comment.' },
      owner: { type: 'string', description: 'Repository owner.' },
      repo: { type: 'string', description: 'Repository name.' },
    },
  },
  {
    name: 'gitea_pr_line_comment',
    description: 'Add a line comment to a pull request diff.',
    parameters: {
      number: { type: 'number', required: true, description: 'Pull request number.' },
      body: { type: 'string', required: true, description: 'Comment text.' },
      path: { type: 'string', required: true, description: 'File path in the diff.' },
      line: { type: 'number', description: 'Line number in the diff.' },
      owner: { type: 'string', description: 'Repository owner.' },
      repo: { type: 'string', description: 'Repository name.' },
    },
  },
  {
    name: 'gitea_pr_merge_status',
    description: 'Check whether a pull request is mergeable.',
    parameters: {
      number: { type: 'number', required: true, description: 'Pull request number.' },
      owner: { type: 'string', description: 'Repository owner.' },
      repo: { type: 'string', description: 'Repository name.' },
    },
  },
  {
    name: 'gitea_repo_search',
    description: 'Search repositories on the configured Gitea/Forgejo instance.',
    parameters: {
      q: { type: 'string', required: true, description: 'Search query.' },
      limit: { type: 'number', description: 'Maximum items to return.' },
    },
  },
  {
    name: 'gitea_repo_contents',
    description: 'Get file or directory contents in a repository.',
    parameters: {
      path: { type: 'string', required: true, description: 'File or directory path.' },
      ref: { type: 'string', description: 'Branch, tag, or commit SHA.' },
      owner: { type: 'string', description: 'Repository owner.' },
      repo: { type: 'string', description: 'Repository name.' },
    },
  },
  {
    name: 'gitea_repo_branches',
    description: 'List branches in a repository.',
    parameters: {
      limit: { type: 'number', description: 'Maximum items to return.' },
      page: { type: 'number', description: 'Page number.' },
      owner: { type: 'string', description: 'Repository owner.' },
      repo: { type: 'string', description: 'Repository name.' },
    },
  },
  {
    name: 'gitea_repo_commits',
    description: 'List commits in a repository.',
    parameters: {
      sha: { type: 'string', description: 'Branch or commit SHA.' },
      limit: { type: 'number', description: 'Maximum items to return.' },
      page: { type: 'number', description: 'Page number.' },
      owner: { type: 'string', description: 'Repository owner.' },
      repo: { type: 'string', description: 'Repository name.' },
    },
  },
  {
    name: 'gitea_repo_compare',
    description: 'Compare two commits/branches in a repository.',
    parameters: {
      range: { type: 'string', required: true, description: 'Range like base...head.' },
      owner: { type: 'string', description: 'Repository owner.' },
      repo: { type: 'string', description: 'Repository name.' },
    },
  },
  {
    name: 'gitea_repo_tags',
    description: 'List tags in a repository.',
    parameters: {
      limit: { type: 'number', description: 'Maximum items to return.' },
      page: { type: 'number', description: 'Page number.' },
      owner: { type: 'string', description: 'Repository owner.' },
      repo: { type: 'string', description: 'Repository name.' },
    },
  },
  {
    name: 'gitea_release_list',
    description: 'List releases in a repository.',
    parameters: {
      limit: { type: 'number', description: 'Maximum items to return.' },
      page: { type: 'number', description: 'Page number.' },
      owner: { type: 'string', description: 'Repository owner.' },
      repo: { type: 'string', description: 'Repository name.' },
    },
  },
  {
    name: 'gitea_release_create',
    description: 'Create a release in a repository.',
    parameters: {
      tag_name: { type: 'string', required: true, description: 'Tag name.' },
      name: { type: 'string', description: 'Release name.' },
      body: { type: 'string', description: 'Release notes.' },
      owner: { type: 'string', description: 'Repository owner.' },
      repo: { type: 'string', description: 'Repository name.' },
    },
  },
  {
    name: 'gitea_release_delete',
    description: 'Delete a release. Requires confirm: true (boolean).',
    parameters: {
      release_id: { type: 'number', required: true, description: 'Release id.' },
      confirm: { type: 'boolean', description: 'Must be true to delete.' },
      owner: { type: 'string', description: 'Repository owner.' },
      repo: { type: 'string', description: 'Repository name.' },
    },
  },
  {
    name: 'gitea_wiki_pages',
    description: 'List wiki pages in a repository.',
    parameters: {
      limit: { type: 'number', description: 'Maximum items to return.' },
      page: { type: 'number', description: 'Page number.' },
      owner: { type: 'string', description: 'Repository owner.' },
      repo: { type: 'string', description: 'Repository name.' },
    },
  },
  {
    name: 'gitea_org_repos',
    description: 'List repositories of an organization.',
    parameters: {
      org: { type: 'string', required: true, description: 'Organization name.' },
      limit: { type: 'number', description: 'Maximum items to return.' },
      page: { type: 'number', description: 'Page number.' },
    },
  },
  {
    name: 'gitea_notifications',
    description: 'List notifications for the authenticated user.',
    parameters: {
      status: { type: 'string', description: 'Filter: unread, read, or all.' },
      limit: { type: 'number', description: 'Maximum items to return.' },
      page: { type: 'number', description: 'Page number.' },
    },
  },
  {
    name: 'gitea_project_health',
    description: 'Build a read-only project health report: open PRs, open/stale issues, stale branches, and API errors.',
    parameters: {
      owner: { type: 'string', description: 'Repository owner.' },
      repo: { type: 'string', description: 'Repository name.' },
      staleDays: { type: 'number', description: 'Stale threshold in days (default 14).' },
    },
  },
  {
    name: 'gitea_review_inbox',
    description: 'Classify open PRs: awaiting my review, my PRs awaiting review, and merge-ready PRs.',
    parameters: {
      user: { type: 'string', required: true, description: 'User login to classify against.' },
      owner: { type: 'string', description: 'Repository owner.' },
      repo: { type: 'string', description: 'Repository name.' },
    },
  },
  {
    name: 'gitea_ci_explain',
    description: 'Extract the first meaningful error from a failed CI job log (with size cap). Read-only.',
    parameters: {
      job: { type: 'object', additionalProperties: true, description: 'Failed job: { id, name, status, log, head_sha }.' },
    },
  },
  {
    name: 'gitea_pr_summary',
    description: 'Build a read-only PR change/risk summary: files, areas, tests, migration/security risks, review state, mergeability.',
    parameters: {
      number: { type: 'number', required: true, description: 'Pull request number.' },
      owner: { type: 'string', description: 'Repository owner.' },
      repo: { type: 'string', description: 'Repository name.' },
    },
  },
  {
    name: 'gitea_issue_duplicates',
    description: 'Find likely duplicate issues by title/body similarity (ranked, non-destructive).',
    parameters: {
      title: { type: 'string', required: true, description: 'Proposed issue title.' },
      body: { type: 'string', description: 'Proposed issue body.' },
      threshold: { type: 'number', description: 'Similarity threshold (default 0.3).' },
      owner: { type: 'string', description: 'Repository owner.' },
      repo: { type: 'string', description: 'Repository name.' },
    },
  },
  {
    name: 'gitea_batch_issue_ops',
    description: 'Batch-apply labels/assignee to selected issues. Dry-run by default; set apply: true to commit.',
    parameters: {
      numbers: { type: 'array', items: { type: 'number' }, description: 'Issue numbers to target.' },
      label: { type: 'string', description: 'Label name to set.' },
      assignee: { type: 'string', description: 'Assignee login to set.' },
      apply: { type: 'boolean', description: 'Set true to apply (dry-run otherwise).' },
      owner: { type: 'string', description: 'Repository owner.' },
      repo: { type: 'string', description: 'Repository name.' },
    },
  },
  {
    name: 'gitea_merge_readiness',
    description: 'Check PR merge readiness: description, conflicts, approval, tests, migrations. Never merges.',
    parameters: {
      number: { type: 'number', required: true, description: 'Pull request number.' },
      owner: { type: 'string', description: 'Repository owner.' },
      repo: { type: 'string', description: 'Repository name.' },
    },
  },
  {
    name: 'gitea_release_notes',
    description: 'Build release notes from merged PRs and propose a semver bump (preview only, never publishes).',
    parameters: {
      fromTag: { type: 'string', description: 'Base tag.' },
      toTag: { type: 'string', description: 'Target tag.' },
      owner: { type: 'string', description: 'Repository owner.' },
      repo: { type: 'string', description: 'Repository name.' },
    },
  },
  {
    name: 'gitea_triage_digest',
    description: 'Build a daily triage digest: PRs without review, stale issues, stale branches, and a priority action. Read-only.',
    parameters: {
      owner: { type: 'string', description: 'Repository owner.' },
      repo: { type: 'string', description: 'Repository name.' },
      staleDays: { type: 'number', description: 'Stale threshold in days (default 14).' },
    },
  },
  {
    name: 'gitea_whoami',
    description: 'Show the Gitea/Forgejo user for the configured API token.',
    parameters: {},
  },
  {
    name: 'gitea_worktree_list',
    description: 'List git worktrees for the working copy.',
    parameters: {
      path: { type: 'string', description: 'Git working copy. Falls back to the session workspace.' },
    },
  },
  {
    name: 'gitea_worktree_add',
    description: 'Create a git worktree at worktreePath.',
    parameters: {
      worktreePath: { type: 'string', required: true, description: 'Path for the new worktree.' },
      branch: { type: 'string', description: 'Existing branch to check out.' },
      createBranch: { type: 'string', description: 'Create this branch in the new worktree.' },
      path: { type: 'string', description: 'Main working copy. Falls back to the session workspace.' },
    },
  },
  {
    name: 'gitea_worktree_use',
    description: 'Pin this session git header to worktreePath. Does not change Settings.',
    parameters: {
      worktreePath: { type: 'string', required: true, description: 'Worktree path to make current.' },
    },
  },
  {
    name: 'gitea_worktree_remove',
    description: 'Remove a git worktree. Requires confirm: true (boolean).',
    parameters: {
      worktreePath: { type: 'string', required: true, description: 'Worktree path to remove.' },
      confirm: { type: 'boolean', description: 'Must be true to remove.' },
      path: { type: 'string', description: 'Main working copy. Falls back to the session workspace.' },
    },
  },
  {
    name: 'gitea_issue_update',
    description: 'Update a Gitea/Forgejo issue (title, body, state).',
    parameters: {
      number: { type: 'number', required: true, description: 'Issue number.' },
      title: { type: 'string', description: 'New title.' },
      body: { type: 'string', description: 'New body.' },
      state: { type: 'string', description: 'New state: open or closed.' },
      owner: { type: 'string', description: 'Repository owner.' },
      repo: { type: 'string', description: 'Repository name.' },
    },
  },
  {
    name: 'gitea_issue_search',
    description: 'Search issues across the Gitea/Forgejo instance.',
    parameters: {
      q: { type: 'string', required: true, description: 'Search query.' },
      repo: { type: 'string', description: 'Restrict to owner/repo.' },
      state: { type: 'string', description: 'open, closed, or all.' },
      limit: { type: 'number', description: 'Maximum items to return.' },
      page: { type: 'number', description: 'Page number.' },
      type: { type: 'string', description: 'issues or pulls.' },
      labels: { type: 'string', description: 'Comma-separated labels filter.' },
    },
  },
  {
    name: 'gitea_label_list',
    description: 'List labels in a repository.',
    parameters: {
      limit: { type: 'number', description: 'Maximum items to return.' },
      page: { type: 'number', description: 'Page number.' },
      owner: { type: 'string', description: 'Repository owner.' },
      repo: { type: 'string', description: 'Repository name.' },
    },
  },
  {
    name: 'gitea_label_create',
    description: 'Create a label in a repository.',
    parameters: {
      name: { type: 'string', required: true, description: 'Label name.' },
      color: { type: 'string', required: true, description: 'Hex color without #.' },
      description: { type: 'string', description: 'Label description.' },
      owner: { type: 'string', description: 'Repository owner.' },
      repo: { type: 'string', description: 'Repository name.' },
    },
  },
  {
    name: 'gitea_label_delete',
    description: 'Delete a label from a repository.',
    parameters: {
      label_id: { type: 'number', required: true, description: 'Label id.' },
      owner: { type: 'string', description: 'Repository owner.' },
      repo: { type: 'string', description: 'Repository name.' },
    },
  },
  {
    name: 'gitea_issue_set_labels',
    description: 'Replace the labels on an issue.',
    parameters: {
      number: { type: 'number', required: true, description: 'Issue number.' },
      labels: { type: 'array', items: { type: 'number' }, required: true, description: 'Label ids to set.' },
      owner: { type: 'string', description: 'Repository owner.' },
      repo: { type: 'string', description: 'Repository name.' },
    },
  },
  {
    name: 'gitea_milestone_list',
    description: 'List milestones in a repository.',
    parameters: {
      state: { type: 'string', description: 'open, closed, or all.' },
      limit: { type: 'number', description: 'Maximum items to return.' },
      page: { type: 'number', description: 'Page number.' },
      owner: { type: 'string', description: 'Repository owner.' },
      repo: { type: 'string', description: 'Repository name.' },
    },
  },
  {
    name: 'gitea_milestone_create',
    description: 'Create a milestone in a repository.',
    parameters: {
      title: { type: 'string', required: true, description: 'Milestone title.' },
      description: { type: 'string', description: 'Milestone description.' },
      due_on: { type: 'string', description: 'Due date (RFC3339).' },
      owner: { type: 'string', description: 'Repository owner.' },
      repo: { type: 'string', description: 'Repository name.' },
    },
  },
  {
    name: 'gitea_issue_set_assignee',
    description: 'Set the assignee of an issue.',
    parameters: {
      number: { type: 'number', required: true, description: 'Issue number.' },
      assignee: { type: 'string', required: true, description: 'User login to assign.' },
      owner: { type: 'string', description: 'Repository owner.' },
      repo: { type: 'string', description: 'Repository name.' },
    },
  },
  {
    name: 'gitea_issue_lint',
    description: 'Check issue quality before creation: coverage of required sections (problem, impact, priority, DoD, boundaries, dependencies, verification plan). Non-blocking.',
    parameters: {
      title: { type: 'string', required: true, description: 'Issue title (used to detect preset).' },
      body: { type: 'string', required: true, description: 'Issue body text.' },
      preset: { type: 'string', description: 'Preset: bug, feature, or chore. Auto-detected from title when omitted.' },
    },
  },
]

export function parseConfig(raw) {
  return Config(stripSecretsFromConfig(raw ?? {}))
}

export async function readGitOrigin(cwd = process.cwd()) {
  try {
    const { stdout } = await execFileAsync('git', ['remote', 'get-url', 'origin'], { cwd })
    return String(stdout || '').trim()
  } catch {
    return ''
  }
}

export function apply(ctx, config) {
  const baseConfig = parseConfig(config)
  let getConfig = () => baseConfig
  const live = () => parseConfig(getConfig())
  let settingsScope

  ctx.inject(['settings'], (sctx) => {
    const scope = sctx.settings.register(NS, Config, { base: baseConfig })
    settingsScope = scope
    getConfig = () => parseConfig(scope.get() ?? baseConfig)
    sctx.effect(() => () => {
      settingsScope = undefined
      getConfig = () => baseConfig
    })
  })

  async function tokenConfigured(tokenEnv) {
    const status = credentialRefStatus(tokenEnv)
    if (!status.ok) return false
    try {
      if (typeof ctx.credentials.describe === 'function') {
        const described = await ctx.credentials.describe(credentialRef(status.name))
        return !!(described && described.configured)
      }
      const resolved = await ctx.credentials.resolve(credentialRef(status.name))
      return !!(resolved && resolved.value)
    } catch {
      return false
    }
  }

  async function configResponse() {
    const cfg = live()
    const status = credentialRefStatus(cfg.tokenEnv)
    return {
      ok: true,
      config: cfg,
      tokenConfigured: await tokenConfigured(cfg.tokenEnv),
      tokenEnvError: status.ok ? '' : status.error,
    }
  }

  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: '/dsh-gitea/config',
    handler: async (req, res) => {
      if (req.method === 'GET') {
        writeJson(res, 200, await configResponse())
        return
      }
      if (req.method !== 'POST') {
        writeJson(res, 405, { ok: false, error: { code: 'method', message: 'GET or POST' } })
        return
      }
      if (!isTrustedSettingsRequest(req)) {
        writeJson(res, 403, { ok: false, error: { code: 'forbidden', message: 'same-origin only' } })
        return
      }
      if (!settingsScope) {
        writeJson(res, 503, { ok: false, error: { code: 'settings', message: 'settings not ready' } })
        return
      }
      let raw
      try { raw = await readBody(req) } catch (e) {
        writeJson(res, 400, { ok: false, error: { code: 'body', message: e.message } })
        return
      }
      let payload
      try { payload = JSON.parse(raw.toString('utf8') || '{}') } catch {
        writeJson(res, 400, { ok: false, error: { code: 'json', message: 'invalid json' } })
        return
      }
      if (payload && typeof payload.config === 'object') payload = payload.config
      let parsed
      try { parsed = parseConfig(payload) } catch (e) {
        writeJson(res, 400, { ok: false, error: { code: 'schema', message: String(e?.message || e) } })
        return
      }
      const cred = credentialRefStatus(parsed.tokenEnv)
      if (!cred.ok) {
        writeJson(res, 400, { ok: false, error: { code: 'tokenEnv', message: cred.error } })
        return
      }
      try {
        await settingsScope.update(parsed)
        writeJson(res, 200, await configResponse())
      } catch (e) {
        writeJson(res, 500, { ok: false, error: { code: 'save', message: String(e?.message || e) } })
      }
    },
  }), 'dsh-gitea: /config')

  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: '/dsh-gitea/git-status',
    handler: async (req, res) => {
      if (req.method !== 'GET') {
        writeJson(res, 405, { ok: false, error: { code: 'method', message: 'GET' } })
        return
      }
      let cwd = ''
      let sessionId = ''
      try {
        const url = new URL(req.url, 'http://dsh.local')
        cwd = url.searchParams.get('cwd') || ''
        sessionId = url.searchParams.get('sessionId') || ''
      } catch { cwd = ''; sessionId = '' }
      const repoDir = await selectChipRepoDir(
        { cwd, sessionId },
        (dir) => isGitDir(dir, execFileAsync),
        pinGitFromSessionLog,
      )
      writeJson(res, 200, await buildGitSnapshot({ repoDir, execFile: execFileAsync }))
    },
  }), 'dsh-gitea: /git-status')

  async function resolveToken(tokenEnv) {
    try {
      const resolved = await ctx.credentials.resolve(credentialRef(tokenEnv))
      if (resolved?.value) return resolved.value
    } catch { /* credential may be unset */ }
    return ''
  }

  async function makeDeps(remoteUrl) {
    const cfg = live()
    const token = await resolveToken(cfg.tokenEnv)
    const baseUrl = normalizeBaseUrl(cfg.baseUrl)
    const client = new GiteaClient({
      baseUrl,
      token,
      timeoutMs: cfg.timeoutMs,
    })
    return {
      client,
      settings: cfg,
      remoteUrl,
      configured: { baseUrl, token },
      execFile: execFileAsync,
    }
  }

  for (const def of TOOL_DEFS) {
    ctx.tools.register(
      defineTool({
        name: def.name,
        description: def.description,
        parameters: def.parameters,
        output: {
          schema: OUTPUT_SCHEMA,
          render: (_args, value) => formatToolResult(def.name, value),
        },
        execute: async (args, exec) => {
          const sessionCwd = sessionCwdFromExec(exec)
          const cwd = repoCwdFromTool({ args, sessionCwd })
          const remoteUrl = cwd ? await readGitOrigin(cwd) : ''
          const deps = await makeDeps(remoteUrl)
          deps.cwd = cwd
          const result = await runHandler(def.name, args, deps)
          try { await pinGitFromExec({ ...exec, arguments: args }, result) } catch { /* never break a gitea tool */ }
          return result
        },
      }),
    )
  }

  async function pinFirstGitDir(ids, dirs) {
    if (!ids.length) return
    for (const dir of dirs) {
      if (await isGitDir(dir, execFileAsync)) {
        rememberSessionGitDirs(ids, dir)
        return dir
      }
    }
  }

  async function pinGitFromExec(exec, result) {
    await pinFirstGitDir(sessionIdsFromExec(exec), candidateGitDirsFromExec(exec, result))
  }

  const sessionLogInflight = new Map()
  async function pinGitFromSessionLog(sessionId) {
    const id = String(sessionId || '').trim()
    if (!id) return
    if (resolveSessionGitDir({ sessionId: id })) return
    if (sessionLogInflight.has(id)) return sessionLogInflight.get(id)
    const job = (async () => {
      const file = await findSessionLogFile(id)
      if (!file) return
      const text = await readSessionLogText(file)
      await pinFirstGitDir([id], candidateGitDirsFromSessionJsonl(text))
    })()
    sessionLogInflight.set(id, job)
    try { await job } catch { /* chip poll must never throw */ }
    finally { sessionLogInflight.delete(id) }
  }

  async function findSessionLogFile(sessionId) {
    const home = process.env.DSH_HOME || path.join(os.homedir(), '.dsh')
    const root = path.join(home, 'sessions')
    const walk = async (dir, depth) => {
      if (depth > 4) return ''
      let entries = []
      try { entries = await fs.readdir(dir, { withFileTypes: true }) } catch { return '' }
      for (const ent of entries) {
        const full = path.join(dir, ent.name)
        if (!ent.isDirectory()) continue
        if (ent.name === sessionId) {
          for (const name of ['session.jsonl.zstd', 'session.jsonl']) {
            const candidate = path.join(full, name)
            try { await fs.access(candidate); return candidate } catch { /* next name */ }
          }
        }
        const nested = await walk(full, depth + 1)
        if (nested) return nested
      }
      return ''
    }
    return walk(root, 0)
  }

  async function readSessionLogText(file) {
    if (String(file).endsWith('.zstd')) {
      try {
        const { stdout } = await execFileAsync('zstdcat', [file], { maxBuffer: 32 * 1024 * 1024 })
        return String(stdout || '')
      } catch {
        const { stdout } = await execFileAsync('zstd', ['-dc', file], { maxBuffer: 32 * 1024 * 1024 })
        return String(stdout || '')
      }
    }
    return String(await fs.readFile(file, 'utf8'))
  }

  ctx.on('tools/execute', async (exec, next) => {
    const result = await next()
    try { await pinGitFromExec(exec, result) } catch { /* never break another tool */ }
    // DoD reminder (default off): если меняли git-файлы без ссылки на issue/PR
    if (live().dodReminder) {
      try {
        const { checkDoD } = await import('./dod-reminder.js')
        const text = JSON.stringify(exec?.arguments || {}) + ' ' + JSON.stringify(result?.value || '')
        const reminder = checkDoD({ changedGitFiles: /git|commit|push|worktree|add|rm|mv/i.test(text), references: [], text })
        if (reminder.reminder) {
          const note = { type: 'text', text: reminder.message }
          if (result && Array.isArray(result.value)) result.value.push(note)
          else if (result) result.value = [result.value, note]
        }
      } catch { /* never break another tool */ }
    }
    return result
  })
}
