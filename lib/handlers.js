import { resolveRepo } from './repo.js'
import { credentialRefStatus } from './secrets.js'
import { runWorktreeAction } from './git-local.js'

export function guardMerge(args = {}) {
  if (args.confirm === true) return { ok: true }
  return { ok: false, error: 'Merge requires confirm: true (boolean).' }
}

const LOCAL_TOOLS = new Set([
  'gitea_worktree_list',
  'gitea_worktree_add',
  'gitea_worktree_use',
  'gitea_worktree_remove',
])

const NO_REPO = new Set(['gitea_repo_search', 'gitea_whoami', 'gitea_issue_search', 'gitea_issue_lint', 'gitea_org_repos', 'gitea_notifications', 'gitea_ci_explain', ...LOCAL_TOOLS])

function configuredError(deps) {
  const cred = credentialRefStatus(deps.settings?.tokenEnv || 'GITEA_TOKEN')
  if (!cred.ok) return { ok: false, error: cred.error }
  if (!deps.configured?.baseUrl) {
    return { ok: false, error: 'Configure the Gitea instance URL in Settings.' }
  }
  if (!deps.configured?.token) {
    return { ok: false, error: `Set the credential named ${cred.name} in DSH credentials.` }
  }
  return null
}

const RECORD_KEYS = [
  'number', 'title', 'name', 'merged', 'state', 'id',
  'body', 'html_url', 'full_name', 'created_at', 'updated_at',
  'login', 'path', 'branch', 'dirty', 'head', 'current', 'repoDir',
]

function slimRecord(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value
  const out = {}
  for (const key of RECORD_KEYS) {
    if (value[key] !== undefined && value[key] !== null) out[key] = value[key]
  }
  if (value.user?.login) out.user_login = value.user.login
  return out
}

function unwrapPayload(raw) {
  if (raw && typeof raw === 'object' && !Array.isArray(raw) && Array.isArray(raw.data)) {
    return raw.data
  }
  return raw
}

function wrap(apiResult) {
  if (!apiResult?.ok) {
    return { ok: false, error: apiResult?.error || `HTTP ${apiResult?.status || 0}` }
  }
  const raw = unwrapPayload(apiResult.data)
  if (Array.isArray(raw)) {
    return { ok: true, data: raw.map(slimRecord) }
  }
  return { ok: true, data: slimRecord(raw) }
}

function asNumber(value) {
  const n = Number(value)
  return Number.isFinite(n) ? n : value
}

function pickQuery(args, keys) {
  const query = {}
  for (const key of keys) {
    const value = args[key]
    if (value !== undefined && value !== null && value !== '') query[key] = value
  }
  return query
}

export async function runHandler(name, args = {}, deps = {}) {
  if (LOCAL_TOOLS.has(name)) {
    const action = name.replace('gitea_worktree_', '')
    return runWorktreeAction(action, args, deps)
  }

  if (name === 'gitea_issue_lint') {
    const { lintIssue } = await import('./issue-lint.js')
    const result = lintIssue({ title: args.title, body: args.body }, { preset: args.preset })
    return { ok: true, data: result }
  }

  const pre = configuredError(deps)
  if (pre) return pre

  const client = deps.client
  const settings = deps.settings || {}
  const remoteUrl = deps.remoteUrl || ''

  if (name === 'gitea_whoami') {
    return wrap(await client.getUser())
  }

  const needsRepo = !NO_REPO.has(name)
  let owner
  let repo
  if (needsRepo) {
    const resolved = resolveRepo({ args, settings, remoteUrl })
    if (!resolved.ok) return { ok: false, error: resolved.error }
    owner = resolved.owner
    repo = resolved.repo
  }

  switch (name) {
    case 'gitea_issue_create':
      return wrap(await client.createIssue(owner, repo, {
        title: args.title,
        body: args.body,
      }))
    case 'gitea_issue_list':
      return wrap(await client.listIssues(owner, repo, pickQuery(args, ['state', 'limit', 'page'])))
    case 'gitea_issue_get':
      return wrap(await client.getIssue(owner, repo, asNumber(args.number)))
    case 'gitea_issue_comment':
      return wrap(await client.commentIssue(owner, repo, asNumber(args.number), args.body))
    case 'gitea_issue_close':
      return wrap(await client.closeIssue(owner, repo, asNumber(args.number)))
    case 'gitea_issue_update':
      return wrap(await client.updateIssue(owner, repo, asNumber(args.number), {
        title: args.title,
        body: args.body,
        state: args.state,
      }))
    case 'gitea_issue_search':
      return wrap(await client.searchIssues(pickQuery(args, ['q', 'repo', 'state', 'limit', 'page', 'type', 'labels'])))
    case 'gitea_label_list':
      return wrap(await client.listLabels(owner, repo, pickQuery(args, ['limit', 'page'])))
    case 'gitea_label_create':
      return wrap(await client.createLabel(owner, repo, {
        name: args.name,
        color: args.color,
        description: args.description,
      }))
    case 'gitea_label_delete':
      return wrap(await client.deleteLabel(owner, repo, asNumber(args.label_id)))
    case 'gitea_issue_set_labels':
      return wrap(await client.setIssueLabels(owner, repo, asNumber(args.number), (args.labels || []).map(Number)))
    case 'gitea_milestone_list':
      return wrap(await client.listMilestones(owner, repo, pickQuery(args, ['state', 'limit', 'page'])))
    case 'gitea_milestone_create':
      return wrap(await client.createMilestone(owner, repo, {
        title: args.title,
        description: args.description,
        due_on: args.due_on,
      }))
    case 'gitea_issue_set_assignee':
      return wrap(await client.setIssueAssignee(owner, repo, asNumber(args.number), args.assignee))
    case 'gitea_pr_create':
      return wrap(await client.createPull(owner, repo, {
        title: args.title,
        head: args.head,
        base: args.base,
        body: args.body,
      }))
    case 'gitea_pr_list':
      return wrap(await client.listPulls(owner, repo, pickQuery(args, ['state', 'limit', 'page'])))
    case 'gitea_pr_get':
      return wrap(await client.getPull(owner, repo, asNumber(args.number)))
    case 'gitea_pr_comment':
      return wrap(await client.commentIssue(owner, repo, asNumber(args.number), args.body))
    case 'gitea_pr_merge': {
      const guard = guardMerge(args)
      if (!guard.ok) return { ok: false, error: guard.error }
      const Do = ['merge', 'rebase', 'squash'].includes(args.Do) ? args.Do : 'merge'
      return wrap(await client.mergePull(owner, repo, asNumber(args.number), { Do }))
    }
    case 'gitea_pr_files':
      return wrap(await client.listPullFiles(owner, repo, asNumber(args.number), pickQuery(args, ['limit', 'page'])))
    case 'gitea_pr_reviews':
      return wrap(await client.listPullReviews(owner, repo, asNumber(args.number), pickQuery(args, ['limit', 'page'])))
    case 'gitea_pr_submit_review':
      return wrap(await client.submitPullReview(owner, repo, asNumber(args.number), {
        event: args.event,
        body: args.body,
      }))
    case 'gitea_pr_line_comment':
      return wrap(await client.createPullComment(owner, repo, asNumber(args.number), {
        body: args.body,
        path: args.path,
        line: args.line ? asNumber(args.line) : undefined,
      }))
    case 'gitea_pr_merge_status':
      return wrap(await client.getPullMergeStatus(owner, repo, asNumber(args.number)))
    case 'gitea_repo_search':
      return wrap(await client.searchRepos(pickQuery(args, ['q', 'limit'])))
    case 'gitea_repo_contents':
      return wrap(await client.getContents(owner, repo, args.path, pickQuery(args, ['ref'])))
    case 'gitea_repo_branches':
      return wrap(await client.listBranches(owner, repo, pickQuery(args, ['limit', 'page'])))
    case 'gitea_repo_commits':
      return wrap(await client.listCommits(owner, repo, pickQuery(args, ['sha', 'limit', 'page'])))
    case 'gitea_repo_compare':
      return wrap(await client.compareCommits(owner, repo, args.range))
    case 'gitea_repo_tags':
      return wrap(await client.listTags(owner, repo, pickQuery(args, ['limit', 'page'])))
    case 'gitea_release_list':
      return wrap(await client.listReleases(owner, repo, pickQuery(args, ['limit', 'page'])))
    case 'gitea_release_create':
      return wrap(await client.createRelease(owner, repo, {
        tag_name: args.tag_name,
        name: args.name,
        body: args.body,
      }))
    case 'gitea_release_delete': {
      if (args.confirm !== true) {
        return { ok: false, error: 'Deleting a release requires confirm: true (boolean).' }
      }
      return wrap(await client.deleteRelease(owner, repo, asNumber(args.release_id)))
    }
    case 'gitea_wiki_pages':
      return wrap(await client.listWikiPages(owner, repo, pickQuery(args, ['limit', 'page'])))
    case 'gitea_org_repos':
      return wrap(await client.listOrgRepos(args.org, pickQuery(args, ['limit', 'page'])))
    case 'gitea_notifications':
      return wrap(await client.listNotifications(pickQuery(args, ['status', 'limit', 'page'])))
    case 'gitea_project_health': {
      const { buildHealthReport } = await import('./project-health.js')
      return buildHealthReport({ owner, repo, staleDays: args.staleDays }, { client })
    }
    case 'gitea_review_inbox': {
      const { buildReviewInbox } = await import('./review-inbox.js')
      return buildReviewInbox({ owner, repo, user: args.user }, { client })
    }
    case 'gitea_ci_explain': {
      const { explainFailedJob } = await import('./ci-explainer.js')
      return { ok: true, data: explainFailedJob(args.job || {}) }
    }
    default:
      return { ok: false, error: `Unknown tool: ${name}` }
  }
}

export function formatToolResult(name, value) {
  if (!value?.ok) {
    const err = value?.error || 'unknown error'
    return [{ type: 'text', text: `${name} failed: ${err}` }]
  }

  const data = value.data
  if (data && typeof data === 'object') {
    if (Array.isArray(data)) {
      const lines = data.slice(0, 20).map((item) => {
        if (item?.number != null) return `#${item.number} ${item.title || ''}`.trim()
        if (item?.path != null) return `${item.branch || ''} ${item.path}`.trim()
        if (item?.name != null) return item.name
        return JSON.stringify(item)
      })
      return [{ type: 'text', text: lines.join('\n') || 'OK' }]
    }
    if (data.login) return [{ type: 'text', text: data.login }]
    if (data.path) return [{ type: 'text', text: data.path }]
    if (data.number != null) {
      const title = data.title ? ` "${data.title}"` : ''
      return [{ type: 'text', text: `#${data.number}${title}` }]
    }
    if (data.merged) {
      return [{ type: 'text', text: 'Pull request merged.' }]
    }
  }

  return [{ type: 'text', text: 'OK' }]
}
