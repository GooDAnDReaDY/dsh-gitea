import { resolveRepo } from './repo.js'
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
import { isWorktreeTool, handleWorktreeTool } from './handlers/worktrees.js'
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

export async function runHandler(name, args = {}, deps = {}) {
  if (deps.instanceError) {
    return { ok: false, error: deps.instanceError }
  }
  if (LEGACY_MAP[name]) {
    const [target, action] = LEGACY_MAP[name]
    name = target
    args = { ...args, action: args.action || action }
  }

  // Pre-configured / offline tools
  if (LOCAL_TOOLS.has(name)) {
    return handleWorktreeTool(name, args, deps, {})
  }
  if (name === 'gitea_issue_lint' || name === 'gitea_issue_templates') {
    return handleIssueTool(name, args, deps, {})
  }
  if (name === 'gitea_release_assistant' || name === 'gitea_memory_brain_sync') {
    return handleReleaseTool(name, args, deps, {})
  }
  if (name === 'gitea_conflict_analyze' || name === 'gitea_pr_conflict_resolve' || name === 'gitea_conflict_resolve') {
    return handlePrTool(name, args, deps, {})
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
