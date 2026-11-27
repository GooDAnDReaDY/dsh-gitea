import { resolveRepo } from './repo.js'
import { buildFacadeRoutes } from './tool-facades.js'
import {
  schedulerStore,
  guardMerge,
  LOCAL_TOOLS,
  NO_REPO,
  configuredError,
  RECORD_KEYS,
  slimRecord,
  getLoggerWarn,
  annotateCommentsWithMine,
  unwrapPayload,
  wrap,
  toLossless,
  asNumber,
  pickQuery,
  LEGACY_MAP,
} from './handlers/common.js'
import { formatToolResult } from './handlers/formatters.js'
import { handleWorktreeTool } from './handlers/worktrees.js'
import { isReleaseTool, handleReleaseTool } from './handlers/releases.js'
import { isReviewTool, handleReviewTool } from './handlers/reviews.js'
import { isIssueTool, handleIssueTool } from './handlers/issues.js'
import { isPrTool, handlePrTool } from './handlers/prs.js'
import { isRepoTool, handleRepoTool } from './handlers/repos.js'

export {
  schedulerStore,
  guardMerge,
  LOCAL_TOOLS,
  NO_REPO,
  configuredError,
  RECORD_KEYS,
  slimRecord,
  getLoggerWarn,
  annotateCommentsWithMine,
  unwrapPayload,
  wrap,
  toLossless,
  asNumber,
  pickQuery,
  LEGACY_MAP,
  formatToolResult,
}

// Usage counters for compatibility aliases (issue #376): keyed by the
// historical tool name, incremented on every alias-driven call.
export const legacyCallCounts = Object.create(null)

const FACADE_ROUTES = buildFacadeRoutes()

// #396: usage snapshot - facades and legacy aliases counted separately so
// analytics can show which surface the agents actually use.
export function getToolUsageSnapshot() {
  const facades = {}
  const aliases = {}
  let totalCalls = 0
  for (const [name, calls] of Object.entries(legacyCallCounts)) {
    totalCalls += calls
    if (FACADE_ROUTES[name]) facades[name] = calls
    else aliases[name] = calls
  }
  return { generatedAt: new Date().toISOString(), totalCalls, facades, aliases }
}

export async function runHandler(name, args = {}, deps = {}) {
  if (deps.instanceError) {
    return { ok: false, error: deps.instanceError }
  }
  if (LEGACY_MAP[name]) {
    const [target, action] = LEGACY_MAP[name]
    legacyCallCounts[name] = (legacyCallCounts[name] || 0) + 1
    name = target
    args = { ...args, action: args.action || action }
  }
  if (FACADE_ROUTES[name]) {
    const route = FACADE_ROUTES[name][args?.action]
    if (!route) {
      const known = Object.keys(FACADE_ROUTES[name]).join(', ')
      return { ok: false, error: `Unknown action ${JSON.stringify(args?.action)} for ${name}. Known actions: ${known}.` }
    }
    legacyCallCounts[name] = (legacyCallCounts[name] || 0) + 1
    name = route.canonical
    args = { ...args, action: route.sub ?? args.action }
  }

  // Pre-configured / offline tools
  if (LOCAL_TOOLS.has(name)) {
    return handleWorktreeTool(name, args, deps, {})
  }
  if (name === 'gitea_issue_lint' || name === 'gitea_issue_templates') {
    return handleIssueTool(name, args, deps, {})
  }
  if (name === 'gitea_usage_report') {
    const { getHubAuditLog } = await import('./routes-hub.js')
    return { ok: true, data: { ...getToolUsageSnapshot(), hubAudit: getHubAuditLog(20) } }
  }
  if (name === 'gitea_release_assistant' || name === 'gitea_memory_brain_sync' || name === 'gitea_release_pipeline') {
    // #395: the release pipeline operates on the local repository checkout
    // and must run before the instance/credential pre-check.
    return handleReleaseTool(name, args, deps, {})
  }
  if (name === 'gitea_conflict_analyze' || name === 'gitea_pr_conflict_resolve' || name === 'gitea_conflict_resolve') {
    return handlePrTool(name, args, deps, {})
  }
  if (name === 'gitea_webhook_sandbox' || name === 'gitea_capabilities') {
    // #397: capabilities is discovery and must answer pre-config too.
    return handleRepoTool(name, args, deps, {})
  }

  // Auth / configuration check
  const pre = configuredError(deps)
  if (pre) return pre

  const client = deps.client
  const settings = deps.settings || {}
  const remoteUrl = deps.remoteUrl || ''

  if (name === 'gitea_action_card') {
    return handleWorktreeTool(name, args, deps, { client, settings, remoteUrl })
  }

  const needsRepo = !NO_REPO.has(name)
    && !(name === 'gitea_scheduled_checks' && args.action === 'list')
    && !(name === 'gitea_org')
    && !(name === 'gitea_ci' && args.action === 'explain')

  let owner
  let repo
  if (needsRepo) {
    const resolved = resolveRepo({ args, settings, remoteUrl })
    if (!resolved.ok) return { ok: false, error: resolved.error }
    owner = resolved.owner
    repo = resolved.repo
  }

  const ctx = { client, settings, remoteUrl, owner, repo }

  if (isIssueTool(name)) {
    return handleIssueTool(name, args, deps, ctx)
  }
  if (isPrTool(name)) {
    return handlePrTool(name, args, deps, ctx)
  }
  if (isReviewTool(name)) {
    return handleReviewTool(name, args, deps, ctx)
  }
  if (isReleaseTool(name)) {
    return handleReleaseTool(name, args, deps, ctx)
  }
  if (isRepoTool(name)) {
    return handleRepoTool(name, args, deps, ctx)
  }

  return { ok: false, error: `Unknown tool: ${name}` }
}
