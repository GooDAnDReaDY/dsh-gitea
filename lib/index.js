import z from '@deepseek-ai/schemastery'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { credentialRef } from '@deepseek-ai/dsh-credentials'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { GiteaClient, normalizeBaseUrl } from './gitea-client.js'
import { runHandler, formatToolResult } from './handlers.js'
import { stripSecretsFromConfig, credentialRefStatus } from './secrets.js'
import { buildGitSnapshot, isGitDir } from './git-local.js'
import { EventStore } from './events-store.js'
import { BgScheduler } from './bg-scheduler.js'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { rememberSessionGitDirs, resolveSessionGitDir, sessionIdsFromExec, sessionCwdFromExec, repoCwdFromTool, candidateGitDirsFromExec, candidateGitDirsFromSessionJsonl, selectChipRepoDir } from './session-git.js'
import { addJob, listJobs, runJob } from './scheduler.js'

export const name = '@goodandready/dsh-gitea'
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
  tokenEnv: z.string().role('credential-ref').default('GITEA_TOKEN')
    .description('DSH credential name holding the API token.'),
  defaultOwner: z.string().default('')
    .description('Default repository owner when the tool omits owner/repo.'),
  defaultRepo: z.string().default('')
    .description('Default repository name when the tool omits owner/repo.'),
  gitWrapper: z.string().default('')
    .description('Git wrapper binary (e.g. git-deepseek-harness) used for write operations. Empty disables worktree add/remove.'),
  dodReminder: z.boolean().default(false)
    .description('DoD reminder: after a tool run that changed git files, remind if no issue/PR reference was made. Default off, never blocks.'),
  bgSchedulerEnabled: z.boolean().default(false)
    .description('Background scheduler: periodically runs triage/health and sends digest. Default off.'),
  bgSchedulerIntervalMin: z.number().default(60)
    .description('Background scheduler interval in minutes (default 60).'),
  bgSchedulerOwner: z.string().default('')
    .description('Owner for background triage (default from defaultOwner).'),
  bgSchedulerRepo: z.string().default('')
    .description('Repo for background triage (default from defaultRepo).'),
  bgSchedulerWebhook: z.string().default('')
    .description('Optional webhook URL to deliver the digest to (external channel). Empty = only in-memory events.'),
  notifyWebhook: z.string().default('')
    .description('Webhook URL for push notifications (new PR, failed CI). Empty disables push.'),
  forceHttpsUrls: z.boolean().default(false)
    .description('When DSH is served over HTTPS but Gitea answers with http:// links (reverse proxy), rewrite html_url to https. Default off.'),
  webhookSecretEnv: z.string().role('credential-ref').default('')
    .description('DSH credential name holding the secret for verifying X-Gitea-Signature on POST /dsh-gitea/webhook.'),
  webhookSecret: z.string().default('')
    .description('Deprecated: use webhookSecretEnv credential ref.'),
  instances: z.array(z.object({
    name: z.string(),
    baseUrl: z.string(),
    tokenEnv: z.string().role('credential-ref'),
  })).default([])
    .description('Additional Gitea instances: name, baseUrl, credential name. Tools accept instance param; default is primary (baseUrl/tokenEnv).'),
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
  additionalProperties: true,
  properties: {
    ok: { type: 'boolean' },
    error: { type: 'string' },
    data: { type: 'json' },
  },
}

const TOOL_DEFS = [
  // ---- Consolidated Facade Tools ----
  {
    name: 'gitea_labels',
    description: 'Manage labels in a repository or issue (list, create, delete, set).',
    parameters: {
      action: { type: 'string', required: true, description: 'Action: list, create, delete, or set.' },
      name: { type: 'string', description: 'Label name (create).' },
      color: { type: 'string', description: 'Hex color without # (create).' },
      description: { type: 'string', description: 'Label description (create).' },
      label_id: { type: 'number', description: 'Label id (delete).' },
      number: { type: 'number', description: 'Issue number (set).' },
      labels: { type: 'array', items: { type: 'number' }, description: 'Numeric label ids to assign (set).' },
      limit: { type: 'number', description: 'Maximum items to return (list).' },
      page: { type: 'number', description: 'Page number (list).' },
      owner: { type: 'string', description: 'Repository owner.' },
      repo: { type: 'string', description: 'Repository name.' },
    },
  },
  {
    name: 'gitea_milestones',
    description: 'Manage milestones in a repository (list, create, update, delete).',
    parameters: {
      action: { type: 'string', required: true, description: 'Action: list, create, update, or delete.' },
      title: { type: 'string', description: 'Milestone title (create/update).' },
      description: { type: 'string', description: 'Milestone description (create/update).' },
      due_on: { type: 'string', description: 'Due date in RFC3339 format (create/update).' },
      state: { type: 'string', description: 'Milestone state: open or closed (update).' },
      milestone_id: { type: 'number', description: 'Milestone id (update/delete).' },
      confirm: { type: 'boolean', description: 'Must be true to delete a milestone.' },
      limit: { type: 'number', description: 'Maximum items to return (list).' },
      page: { type: 'number', description: 'Page number (list).' },
      owner: { type: 'string', description: 'Repository owner.' },
      repo: { type: 'string', description: 'Repository name.' },
    },
  },
  {
    name: 'gitea_releases',
    description: 'Manage releases in a repository (list, create, update, delete, plan, notes).',
    parameters: {
      action: { type: 'string', required: true, description: 'Action: list, create, update, delete, plan, or notes.' },
      tag_name: { type: 'string', description: 'Git tag name (create).' },
      name: { type: 'string', description: 'Release name/title (create/update).' },
      body: { type: 'string', description: 'Release body/changelog (create/update).' },
      release_id: { type: 'number', description: 'Release id (update/delete).' },
      confirm: { type: 'boolean', description: 'Must be true to delete a release.' },
      fromTag: { type: 'string', description: 'Base tag for notes preview (notes).' },
      toTag: { type: 'string', description: 'Target tag for notes preview (notes).' },
      limit: { type: 'number', description: 'Maximum items to return (list).' },
      page: { type: 'number', description: 'Page number (list).' },
      owner: { type: 'string', description: 'Repository owner.' },
      repo: { type: 'string', description: 'Repository name.' },
    },
  },
  {
    name: 'gitea_ci',
    description: 'Inspect and manage CI Actions runs and jobs (status, jobs, rerun, explain).',
    parameters: {
      action: { type: 'string', required: true, description: 'Action: status, jobs, rerun, or explain.' },
      branch: { type: 'string', description: 'Filter runs by branch (status).' },
      sha: { type: 'string', description: 'Filter runs by commit SHA (status).' },
      run_id: { type: 'number', description: 'Actions run id (jobs).' },
      job_id: { type: 'number', description: 'Actions job id (rerun).' },
      confirm: { type: 'boolean', description: 'Must be true to rerun a job.' },
      job: { type: 'object', additionalProperties: true, description: 'Failed job object { id, name, status, log, head_sha } (explain).' },
      limit: { type: 'number', description: 'Maximum items to return (status).' },
      page: { type: 'number', description: 'Page number (status).' },
      owner: { type: 'string', description: 'Repository owner.' },
      repo: { type: 'string', description: 'Repository name.' },
    },
  },
  {
    name: 'gitea_branches',
    description: 'Manage branches in a repository (list, create, delete).',
    parameters: {
      action: { type: 'string', required: true, description: 'Action: list, create, or delete.' },
      branch_name: { type: 'string', description: 'New branch name (create).' },
      branch: { type: 'string', description: 'Branch name to delete (delete).' },
      ref: { type: 'string', description: 'Source ref/commit (create, default main).' },
      confirm: { type: 'boolean', description: 'Must be true to delete a branch.' },
      limit: { type: 'number', description: 'Maximum items to return (list).' },
      page: { type: 'number', description: 'Page number (list).' },
      owner: { type: 'string', description: 'Repository owner.' },
      repo: { type: 'string', description: 'Repository name.' },
    },
  },
  {
    name: 'gitea_tags',
    description: 'Manage tags in a repository (list, create, delete).',
    parameters: {
      action: { type: 'string', required: true, description: 'Action: list, create, or delete.' },
      tag_name: { type: 'string', description: 'New tag name (create).' },
      tag: { type: 'string', description: 'Tag name to delete (delete).' },
      target: { type: 'string', description: 'Target ref or commit SHA (create, default main).' },
      confirm: { type: 'boolean', description: 'Must be true to delete a tag.' },
      limit: { type: 'number', description: 'Maximum items to return (list).' },
      page: { type: 'number', description: 'Page number (list).' },
      owner: { type: 'string', description: 'Repository owner.' },
      repo: { type: 'string', description: 'Repository name.' },
    },
  },
  {
    name: 'gitea_webhooks',
    description: 'Manage webhooks in a repository (list, create, delete).',
    parameters: {
      action: { type: 'string', required: true, description: 'Action: list, create, or delete.' },
      url: { type: 'string', description: 'Webhook target URL (create).' },
      type: { type: 'string', description: 'Webhook type (create, default gitea).' },
      events: { type: 'array', items: { type: 'string' }, description: 'Events to trigger webhook (create).' },
      hook_id: { type: 'number', description: 'Webhook id to delete (delete).' },
      confirm: { type: 'boolean', description: 'Must be true to delete a webhook.' },
      owner: { type: 'string', description: 'Repository owner.' },
      repo: { type: 'string', description: 'Repository name.' },
    },
  },
  {
    name: 'gitea_org',
    description: 'Manage organizations and team repositories (list, repos, members, teams, create_repo).',
    parameters: {
      action: { type: 'string', required: true, description: 'Action: list, repos, members, teams, or create_repo.' },
      org: { type: 'string', description: 'Organization name (required for repos, members, teams, create_repo).' },
      name: { type: 'string', description: 'Repository name (create_repo).' },
      description: { type: 'string', description: 'Repository description (create_repo).' },
      private: { type: 'boolean', description: 'Private repository (create_repo, default true).' },
      limit: { type: 'number', description: 'Maximum items to return.' },
      page: { type: 'number', description: 'Page number.' },
    },
  },
  {
    name: 'gitea_wiki',
    description: 'Manage repository wiki pages (list, get).',
    parameters: {
      action: { type: 'string', required: true, description: 'Action: list or get.' },
      pageName: { type: 'string', description: 'Wiki page title or slug (get).' },
      limit: { type: 'number', description: 'Maximum items to return (list).' },
      page: { type: 'number', description: 'Page number (list).' },
      owner: { type: 'string', description: 'Repository owner.' },
      repo: { type: 'string', description: 'Repository name.' },
    },
  },

  // ---- Issues & Pull Requests ----
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
    name: 'gitea_issue_flow',
    description: 'Issue-to-branch-worktree-PR flow: plan a branch name and worktree path for an issue, or create the PR from a head branch.',
    parameters: {
      action: { type: 'string', required: true, description: 'plan or create.' },
      issue: { type: 'number', required: true, description: 'Issue number.' },
      title: { type: 'string', description: 'Issue title (for branch slug).' },
      type: { type: 'string', description: 'Branch type prefix: feat, fix, chore, docs (default feat).' },
      head: { type: 'string', description: 'Head branch (required for create).' },
      base: { type: 'string', description: 'Base branch (default main).' },
      owner: { type: 'string', description: 'Repository owner.' },
      repo: { type: 'string', description: 'Repository name.' },
    },
  },
  {
    name: 'gitea_issue_templates',
    description: 'List and validate standardized Gitea YAML issue templates from .gitea/ISSUE_TEMPLATE/.',
    parameters: {
      dir: { type: 'string', description: 'Optional custom template directory path.' },
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
    name: 'gitea_pr_summary',
    description: 'Build a read-only PR change/risk summary: files, areas, tests, migration/security risks, review state, mergeability.',
    parameters: {
      number: { type: 'number', required: true, description: 'Pull request number.' },
      owner: { type: 'string', description: 'Repository owner.' },
      repo: { type: 'string', description: 'Repository name.' },
    },
  },
  {
    name: 'gitea_pr_review',
    description: 'Hybrid AI-style PR review: rule-based diff analysis (risks, areas, tests, migrations, merge status) with verdict and questions. Read-only.',
    parameters: {
      number: { type: 'number', required: true, description: 'Pull request number.' },
      owner: { type: 'string', description: 'Repository owner.' },
      repo: { type: 'string', description: 'Repository name.' },
    },
  },
  {
    name: 'gitea_pr_impact',
    description: 'Build a PR impact map: files, areas, issue references (sourced), author, state. No invented dependencies.',
    parameters: {
      number: { type: 'number', required: true, description: 'Pull request number.' },
      owner: { type: 'string', description: 'Repository owner.' },
      repo: { type: 'string', description: 'Repository name.' },
    },
  },
  {
    name: 'gitea_pr_template_check',
    description: 'Check a PR body against the PR template sections and whether the risk checklist applies.',
    parameters: {
      body: { type: 'string', required: true, description: 'PR body text.' },
      labels: { type: 'array', items: { type: 'string' }, description: 'PR labels for risk detection.' },
    },
  },
  {
    name: 'gitea_pr_policy',
    description: 'Read and validate the repository PR policy (.gitea/pr-policy.yml), optionally evaluate against changed files.',
    parameters: {
      files: { type: 'array', items: { type: 'string' }, description: 'Changed file paths to evaluate.' },
      owner: { type: 'string', description: 'Repository owner.' },
      repo: { type: 'string', description: 'Repository name.' },
    },
  },
  {
    name: 'gitea_auto_merge',
    description: 'Merge a PR automatically when the merge gate is green (description, no conflicts, APPROVED, tests, migrations). Requires confirm: true (boolean).',
    parameters: {
      number: { type: 'number', required: true, description: 'Pull request number.' },
      confirm: { type: 'boolean', description: 'Must be true to actually merge.' },
      owner: { type: 'string', description: 'Repository owner.' },
      repo: { type: 'string', description: 'Repository name.' },
    },
  },
  {
    name: 'gitea_pr_rebase',
    description: 'Auto-rebase a PR branch onto fresh main via git wrapper. Dry-run by default; confirm: true rebases and pushes (conflicts are reported for manual resolution).',
    parameters: {
      number: { type: 'number', required: true, description: 'Pull request number.' },
      confirm: { type: 'boolean', description: 'Set true to actually rebase and push.' },
      branch: { type: 'string', description: 'Local branch name (default: PR head).' },
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

  // ---- Workflow, Reviews & Maintenance ----
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
    name: 'gitea_review_escalate',
    description: 'Find high-priority PRs waiting >N days without review; optionally ping reviewers (comment). Dry-run by default; confirm: true writes.',
    parameters: {
      staleDays: { type: 'number', description: 'Days without review before escalation (default 7).' },
      confirm: { type: 'boolean', description: 'Set true to post escalation comments.' },
      owner: { type: 'string', description: 'Repository owner.' },
      repo: { type: 'string', description: 'Repository name.' },
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
    name: 'gitea_triage_digest',
    description: 'Build a daily triage digest: PRs without review, stale issues, stale branches, and a priority action. Read-only.',
    parameters: {
      owner: { type: 'string', description: 'Repository owner.' },
      repo: { type: 'string', description: 'Repository name.' },
      staleDays: { type: 'number', description: 'Stale threshold in days (default 14).' },
    },
  },
  {
    name: 'gitea_duty_report',
    description: 'Repository duty officer: read-only snapshot of new PRs, PRs without review, and stale issues with actions. No writes.',
    parameters: {
      owner: { type: 'string', description: 'Repository owner.' },
      repo: { type: 'string', description: 'Repository name.' },
      lastCheckAt: { type: 'string', description: 'ISO timestamp of the last check (for new-PR detection).' },
      staleDays: { type: 'number', description: 'Stale threshold in days (default 14).' },
    },
  },
  {
    name: 'gitea_label_bootstrap',
    description: 'Idempotently sync the canonical label set into a repository. Dry-run by default; apply: true creates missing labels, never deletes foreign ones.',
    parameters: {
      apply: { type: 'boolean', description: 'Set true to create missing labels (dry-run otherwise).' },
      owner: { type: 'string', description: 'Repository owner.' },
      repo: { type: 'string', description: 'Repository name.' },
    },
  },
  {
    name: 'gitea_label_auto',
    description: 'Label-driven workflow automation: apply rules to an issue by its labels (type/risk/signal) and return preview actions. No writes.',
    parameters: {
      number: { type: 'number', required: true, description: 'Issue number.' },
      owner: { type: 'string', description: 'Repository owner.' },
      repo: { type: 'string', description: 'Repository name.' },
    },
  },
  {
    name: 'gitea_scheduled_checks',
    description: 'Scheduled project checks: list/add/run recurring read-only checks with history. Dry-run by default; no writes without approval.',
    parameters: {
      action: { type: 'string', required: true, description: 'list, add, or run.' },
      name: { type: 'string', description: 'Job name (required for add/run).' },
      schedule: { type: 'string', description: 'hourly, daily, or weekly (default daily).' },
      checkType: { type: 'string', description: 'health, triage, or inbox.' },
      dryRun: { type: 'boolean', description: 'Run without side effects (default true).' },
      owner: { type: 'string', description: 'Repository owner.' },
      repo: { type: 'string', description: 'Repository name.' },
    },
  },
  {
    name: 'gitea_repo_bootstrap',
    description: 'Create a repository from a safe template (README, gitignore, CI, issue/PR templates). Dry-run by default; apply: true creates it.',
    parameters: {
      name: { type: 'string', required: true, description: 'Repository name.' },
      description: { type: 'string', description: 'Repository description.' },
      private: { type: 'boolean', description: 'Private repo (default true).' },
      apply: { type: 'boolean', description: 'Set true to create (dry-run otherwise).' },
    },
  },
  {
    name: 'gitea_repo_analytics',
    description: 'Read-only repository analytics: open/closed issues, PR metrics, average cycle time.',
    parameters: {
      owner: { type: 'string', description: 'Repository owner.' },
      repo: { type: 'string', description: 'Repository name.' },
    },
  },
  {
    name: 'gitea_mirror_public',
    description: 'Prepare a public GitHub mirror plan (sanitize history, push steps). Read-only plan; actual push is a separate step.',
    parameters: {
      source: { type: 'string', description: 'Source (default gitea).' },
      target: { type: 'string', description: 'Target (default github).' },
    },
  },

  // ---- Repository Search & Content ----
  {
    name: 'gitea_repo_search',
    description: 'Search repositories on the configured Gitea/Forgejo instance.',
    parameters: {
      q: { type: 'string', required: true, description: 'Search query.' },
      limit: { type: 'number', description: 'Maximum items to return.' },
    },
  },
  {
    name: 'gitea_code_search',
    description: 'Search code across a Gitea repository (contents) via the Gitea API. Prefer local codegraph/fff MCP when the repo is cloned on this host; use this when the repo lives only in Gitea or you need server-side search.',
    parameters: {
      q: { type: 'string', required: true, description: 'Search query (code content).' },
      branch: { type: 'string', description: 'Branch/ref to search in.' },
      limit: { type: 'number', description: 'Maximum results (default 20).' },
      owner: { type: 'string', description: 'Repository owner.' },
      repo: { type: 'string', description: 'Repository name.' },
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

  // ---- Notifications & Users ----
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
    name: 'gitea_notifications_mark_read',
    description: 'Mark notifications as read. Requires confirm: true (boolean).',
    parameters: {
      confirm: { type: 'boolean', description: 'Must be true to mark read.' },
    },
  },
  {
    name: 'gitea_user_search',
    description: 'Search users on the instance.',
    parameters: {
      q: { type: 'string', required: true, description: 'Search query.' },
      limit: { type: 'number', description: 'Maximum items to return.' },
    },
  },
  {
    name: 'gitea_whoami',
    description: 'Show the Gitea/Forgejo user for the configured API token.',
    parameters: {},
  },
  {
    name: 'gitea_flavor',
    description: 'Detect the instance flavor (gitea/forgejo) via /version and report feature differences.',
    parameters: {},
  },

  // ---- Local Git Tools ----
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
    name: 'gitea_git_graph',
    description: 'Fetch visual topological Git commit graph with lanes, branch/tag refs, and optional Gitea Actions CI statuses.',
    parameters: {
      limit: { type: 'number', description: 'Maximum commits to return (default 100).' },
      cwd: { type: 'string', description: 'Working directory (defaults to session cwd).' },
      withCiStatus: { type: 'boolean', description: 'Fetch CI status for latest commits from Gitea (default true).' },
      owner: { type: 'string', description: 'Repository owner.' },
      repo: { type: 'string', description: 'Repository name.' },
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
    const cfg = { ...live() }
    delete cfg.webhookSecret
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
      const current = live()
      const merged = { ...current, ...payload }
      delete merged.webhookSecret
      let parsed
      try { parsed = parseConfig(merged) } catch (e) {
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

  // Приём webhook событий Gitea (для панели уведомлений)
  const eventsStore = new EventStore(50)
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: '/dsh-gitea/webhook',
    handler: async (req, res) => {
      if (req.method !== 'POST') {
        writeJson(res, 405, { ok: false, error: { code: 'method', message: 'POST' } })
        return
      }
      try {
        const raw = await readBody(req, 1024 * 1024)
        const bodyText = raw.toString('utf8')
        const { verifySignature } = await import('./webhook-signature.js')
        const cfg = live()
        const secretEnv = cfg.webhookSecretEnv || ''
        const secret = secretEnv ? await resolveToken(secretEnv) : (cfg.webhookSecret || '')
        if (!secret) {
          writeJson(res, 401, { ok: false, error: { code: 'signature', message: 'webhook secret not configured' } })
          return
        }
        const signature = String(req.headers['x-gitea-signature'] || req.headers['x-hub-signature-256'] || '')
          .replace(/^sha256=/, '')
        if (!verifySignature(secret, bodyText, signature)) {
          writeJson(res, 401, { ok: false, error: { code: 'signature', message: 'invalid webhook signature' } })
          return
        }
        const payload = JSON.parse(bodyText || '{}')
        const event = String(req.headers['x-gitea-event'] || req.headers['x-github-event'] || '')
        const action = String(payload.action || '')
        const ev = eventsStore.fromWebhook({ event, action, payload })
        eventsStore.push(ev)
        // push-уведомление для критичных событий (новый PR / failed CI)
        try {
          const { pushNotify } = await import('./push-notify.js')
          await pushNotify(ev, { webhookUrl: live().notifyWebhook })
        } catch { /* уведомление не должно ронять webhook */ }
        writeJson(res, 200, { ok: true, event: ev.type })
      } catch (e) {
        writeJson(res, 400, { ok: false, error: { code: 'webhook', message: String(e?.message || e) } })
      }
    },
  }), 'dsh-gitea: /webhook')

  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: '/dsh-gitea/events',
    handler: async (req, res) => {
      if (req.method !== 'GET') {
        writeJson(res, 405, { ok: false, error: { code: 'method', message: 'GET' } })
        return
      }
      writeJson(res, 200, { ok: true, data: eventsStore.list() })
    },
  }), 'dsh-gitea: /events')

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
      const snap = await buildGitSnapshot({ repoDir, execFile: execFileAsync, maxAgeMs: 2500 })
      // обогатить чип статусом PR/CI (если настроен Gitea)
      try {
        const cfg = live()
        const token = await resolveToken(cfg.tokenEnv)
        if (cfg.baseUrl && token && snap?.ok && snap.repoName) {
          const client2 = new GiteaClient({ baseUrl: cfg.baseUrl, token, timeoutMs: cfg.timeoutMs })
          const { enrichChip } = await import('./chip-pr-ci.js')
          const enriched = await enrichChip({
            branch: snap.branch,
            headSha: snap.head || '',
            owner: cfg.defaultOwner || '',
            repo: snap.repoName,
          }, { client: client2 })
          if (enriched.ok) snap.pr = enriched.data
        }
      } catch { /* чип никогда не должен падать из-за обогащения */ }
      writeJson(res, 200, snap)
    },
  }), 'dsh-gitea: /git-status')

  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: '/dsh-gitea/git-graph',
    handler: async (req, res) => {
      if (req.method !== 'GET') {
        writeJson(res, 405, { ok: false, error: { code: 'method', message: 'GET' } })
        return
      }
      let cwd = ''
      let sessionId = ''
      let limit = 100
      try {
        const url = new URL(req.url, 'http://dsh.local')
        cwd = url.searchParams.get('cwd') || ''
        sessionId = url.searchParams.get('sessionId') || ''
        limit = parseInt(url.searchParams.get('limit') || '100', 10) || 100
      } catch { cwd = ''; sessionId = '' }
      const repoDir = await selectChipRepoDir(
        { cwd, sessionId },
        (dir) => isGitDir(dir, execFileAsync),
        pinGitFromSessionLog,
      )
      if (!repoDir) {
        writeJson(res, 200, { ok: false, error: 'Not a git repository' })
        return
      }
      const { fetchCommitGraph } = await import('./graph.js')
      const graphRes = await fetchCommitGraph({ gitWrapper: 'git', cwd: repoDir, limit, execFile: execFileAsync })
      if (graphRes.ok && Array.isArray(graphRes.data?.commits)) {
        try {
          const cfg = live()
          const token = await resolveToken(cfg.tokenEnv)
          const snap = await buildGitSnapshot({ repoDir, execFile: execFileAsync })
          if (cfg.baseUrl && token && snap?.repoName) {
            const client2 = new GiteaClient({ baseUrl: cfg.baseUrl, token, timeoutMs: cfg.timeoutMs })
            const owner = cfg.defaultOwner || ''
            const repo = snap.repoName
            const checkCount = Math.min(15, graphRes.data.commits.length)
            await Promise.allSettled(
              graphRes.data.commits.slice(0, checkCount).map(async (commit) => {
                try {
                  const st = await client2.getCombinedCommitStatus(owner, repo, commit.oid)
                  if (st?.ok && st.data?.state) {
                    commit.ciStatus = st.data.state
                  }
                } catch { /* ignore commit status failure */ }
              })
            )
            graphRes.data.baseUrl = cfg.baseUrl
            graphRes.data.owner = owner
            graphRes.data.repo = repo
          }
        } catch { /* ignore Gitea enrichment failures */ }
      }
      writeJson(res, 200, graphRes)
    },
  }), 'dsh-gitea: /git-graph')

  async function resolveToken(tokenEnv) {
    try {
      const resolved = await ctx.credentials.resolve(credentialRef(tokenEnv))
      if (resolved?.value) return resolved.value
    } catch { /* credential may be unset */ }
    return ''
  }

  async function makeDeps(remoteUrl, instanceName = '') {
    const cfg = live()
    const { resolveInstance } = await import('./instances.js')
    const inst = resolveInstance(cfg, instanceName)
    const tokenEnv = inst.ok ? inst.tokenEnv : cfg.tokenEnv
    const baseUrl = normalizeBaseUrl(inst.ok ? inst.baseUrl : cfg.baseUrl)
    const token = await resolveToken(tokenEnv)
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
          const deps = await makeDeps(remoteUrl, args.instance)
          deps.cwd = cwd
          deps.instance = args.instance || ''
          const result = await runHandler(def.name, args, deps)
          try { await pinGitFromExec({ ...exec, arguments: args }, result) } catch { /* never break a gitea tool */ }
          // #153: если DSH на HTTPS, а Gitea отдаёт http-ссылки — нормализуем scheme
          if (live().forceHttpsUrls && result && typeof result === 'object') {
            try {
              const { normalizeExternalUrl } = await import('./url-safety.js')
              const visit = (node) => {
                if (!node || typeof node !== 'object') return node
                for (const key of Object.keys(node)) {
                  const v = node[key]
                  if (typeof v === 'string' && /^https?:\/\//i.test(v)) {
                    node[key] = normalizeExternalUrl(v, { baseUrl: deps.configured?.baseUrl || '', dshProtocol: 'https:' })
                  } else if (v && typeof v === 'object') {
                    visit(v)
                  }
                }
                return node
              }
              if (result.value && typeof result.value === 'object') visit(result.value)
              else visit(result)
            } catch { /* нормализация не должна ломать результат */ }
          }
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

  // Фоновый планировщик (default off): периодический triage/health + опциональная доставка
  ctx.effect(() => {
    const scheduler = new BgScheduler({ intervalMs: Math.max(1, live().bgSchedulerIntervalMin) * 60000 })
    if (live().bgSchedulerEnabled) {
      scheduler.onTick(async () => {
        const cfg = live()
        const owner = cfg.bgSchedulerOwner || cfg.defaultOwner
        const repo = cfg.bgSchedulerRepo || cfg.defaultRepo
        if (!cfg.baseUrl || !owner || !repo) return { ok: false, error: 'bg scheduler: owner/repo/baseUrl not configured' }
        const token = await resolveToken(cfg.tokenEnv)
        const client2 = new GiteaClient({ baseUrl: cfg.baseUrl, token, timeoutMs: cfg.timeoutMs })
        const { buildTriageDigest } = await import('./triage-digest.js')
        const digest = await buildTriageDigest({ owner, repo }, { client: client2 })
        if (digest?.ok && cfg.bgSchedulerWebhook) {
          const text = `[Triage Digest] ${owner}/${repo}: ${digest.data?.openIssues || 0} open issues, ${digest.data?.openPulls || 0} open PRs`
          try {
            await fetch(cfg.bgSchedulerWebhook, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ text, digest: digest.data }),
            })
          } catch { /* delivery failure should not break bg scheduler */ }
        }
        return digest
      })
      scheduler.start()
    }
    return () => { scheduler.stop() }
  }, 'dsh-gitea: bg scheduler')
}
