import { resolveRepo } from './repo.js'

export function guardMerge(args = {}) {
  if (args.confirm === true) return { ok: true }
  return { ok: false, error: 'Merge requires confirm: true (boolean).' }
}

function configuredError(deps) {
  if (!deps.configured?.baseUrl) {
    return { ok: false, error: 'Configure the Gitea instance URL in Settings.' }
  }
  if (!deps.configured?.token) {
    const env = deps.settings?.tokenEnv || 'GITEA_TOKEN'
    return { ok: false, error: `Set the credential named ${env} in DSH credentials.` }
  }
  return null
}

const RECORD_KEYS = ['number', 'title', 'name', 'merged', 'state', 'id']

function slimRecord(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value
  const out = {}
  for (const key of RECORD_KEYS) {
    if (value[key] !== undefined && value[key] !== null) out[key] = value[key]
  }
  return out
}

function wrap(apiResult) {
  if (!apiResult?.ok) {
    return { ok: false, error: apiResult?.error || `HTTP ${apiResult?.status || 0}` }
  }
  const raw = apiResult.data
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
  const pre = configuredError(deps)
  if (pre) return pre

  const client = deps.client
  const settings = deps.settings || {}
  const remoteUrl = deps.remoteUrl || ''

  const needsRepo = name !== 'gitea_repo_search'
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
    case 'gitea_repo_search':
      return wrap(await client.searchRepos(pickQuery(args, ['q', 'limit'])))
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
        if (item?.name != null) return item.name
        return JSON.stringify(item)
      })
      return [{ type: 'text', text: lines.join('\n') || 'OK' }]
    }
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
