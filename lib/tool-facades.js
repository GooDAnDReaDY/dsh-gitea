/**
 * tool-facades — resource-oriented tool surface (issues #376, #385).
 *
 * The internal registry keeps one tool definition per action (TOOL_DEFS, 96
 * entries) so handler dispatch and tests stay unchanged. The REGISTERED
 * surface shrinks to resource facades: each facade exposes an `action`
 * parameter and routes (action -> canonical tool, optional sub-action) into
 * the existing implementations. Old tool names remain fully functional as
 * manifest-generated compatibility aliases with a deprecation date and a call
 * counter.
 *
 * Ecosystem facades (issue #385) are registered only when the configuration
 * enables them, so the default agent context stays lean.
 */

import { TOOL_DEFS } from './tool-defs.js'

export const ECOSYSTEM_FACADE = 'gitea_ecosystem'

// Sub-action routes for canonical tools that already expose an `action`
// parameter themselves. The facade action is `<prefix>_<subaction>`; the
// sub-action is forwarded to the canonical implementation.
const MULTI_ACTION_SUBS = {
  gitea_labels: { prefix: 'label', subs: ['list', 'create', 'delete', 'set', 'add_to_issue'] },
  gitea_milestones: { prefix: 'milestone', subs: ['list', 'create', 'update', 'delete'] },
  gitea_releases: { prefix: 'release', subs: ['list', 'create', 'update', 'delete', 'plan', 'notes'] },
  gitea_ci: { prefix: 'ci', subs: ['status', 'jobs', 'rerun', 'explain'] },
  gitea_branches: { prefix: 'branch', subs: ['list', 'create', 'delete'] },
  gitea_tags: { prefix: 'tag', subs: ['list', 'create', 'delete'] },
  gitea_webhooks: { prefix: 'webhook', subs: ['list', 'create', 'delete'] },
  gitea_org: { prefix: 'org', subs: ['list', 'repos', 'members', 'teams', 'create_repo'] },
  gitea_wiki: { prefix: 'wiki', subs: ['list', 'get'] },
}

// Explicit facade action names for tools whose suffix would be clunky.
const ACTION_NAME_OVERRIDES = {
  gitea_release_pipeline: 'pipeline',
}

function actionNameFor(canonical) {
  return ACTION_NAME_OVERRIDES[canonical] ?? canonical.replace(/^gitea_/, '')
}

// Facade grouping. Every canonical tool name must appear exactly once.
// Order matters only for documentation; the routing is name-based.
export const FACADE_GROUPS = [
  {
    name: 'gitea_issues',
    description: 'Issue management facade: create, list, read, comment, update, close, search, assignees, lint, duplicates, templates, timeline, reactions, issue-to-PR and batch operations.',
    tools: [
      'gitea_issue_create', 'gitea_issue_list', 'gitea_issue_get', 'gitea_issue_comments',
      'gitea_issue_comment', 'gitea_issue_comment_delete', 'gitea_issue_close', 'gitea_issue_update',
      'gitea_issue_search', 'gitea_issue_set_assignee', 'gitea_issue_lint', 'gitea_issue_duplicates',
      'gitea_batch_issue_ops', 'gitea_issue_flow', 'gitea_issue_templates', 'gitea_issue_timeline',
      'gitea_issue_to_pr', 'gitea_reactions',
    ],
  },
  {
    name: 'gitea_label_milestones',
    description: 'Label and milestone facade: label CRUD and assignment, label bootstrap/automation, milestone lifecycle.',
    tools: ['gitea_labels', 'gitea_milestones', 'gitea_label_bootstrap', 'gitea_label_auto'],
  },
  {
    name: 'gitea_pulls',
    description: 'Pull request facade: create, list, inspect diffs and files, comments, merge and readiness, rebase, stacks, and merge-conflict analysis/resolution.',
    tools: [
      'gitea_pr_create', 'gitea_pr_list', 'gitea_pr_get', 'gitea_pr_diff', 'gitea_pr_comment',
      'gitea_pr_merge', 'gitea_pr_files', 'gitea_pr_merge_status', 'gitea_pr_summary', 'gitea_pr_impact',
      'gitea_pr_template_check', 'gitea_pr_policy', 'gitea_auto_merge', 'gitea_pr_rebase',
      'gitea_merge_readiness', 'gitea_pr_stack_status', 'gitea_pr_stack_rebase',
      'gitea_conflict_analyze', 'gitea_pr_conflict_resolve',
    ],
  },
  {
    name: 'gitea_reviews',
    description: 'Review facade: submit and inspect reviews, static PR review (secrets, conventions, suggestions), line comments with suggestion blocks, review inbox and escalation, reviewer suggestions.',
    tools: [
      'gitea_pr_reviews', 'gitea_pr_submit_review', 'gitea_pr_review', 'gitea_pr_static_review',
      'gitea_review_inbox', 'gitea_review_escalate', 'gitea_suggest_reviewers', 'gitea_pr_line_comment',
    ],
  },
  {
    name: 'gitea_release_mgmt',
    description: 'Release facade: release lifecycle, structured release planning, and the release assistant (SemVer validation, changelogs, preflight).',
    tools: ['gitea_releases', 'gitea_release_plan', 'gitea_release_assistant', 'gitea_release_pipeline'],
  },
  {
    name: 'gitea_repos',
    description: 'Repository facade: bootstrap, contents, commits, compare, search (repos and code), organization and teams, wiki pages.',
    tools: [
      'gitea_capabilities',
      'gitea_repo_bootstrap', 'gitea_repo_search', 'gitea_code_search', 'gitea_repo_contents',
      'gitea_repo_commits', 'gitea_repo_compare', 'gitea_org', 'gitea_wiki',
    ],
  },
  {
    name: 'gitea_branches_tags',
    description: 'Branch and tag facade: list, create, delete branches and tags.',
    tools: ['gitea_branches', 'gitea_tags'],
  },
  {
    name: 'gitea_notify',
    description: 'Notifications and identity facade: notification list/mark-read, user search, authenticated identity, instance flavor detection.',
    tools: ['gitea_notifications', 'gitea_notifications_mark_read', 'gitea_user_search', 'gitea_whoami', 'gitea_flavor'],
  },
  {
    name: 'gitea_actions',
    description: 'CI / Gitea Actions facade: run and job status, logs, rerun, and failed-log root cause analysis.',
    tools: ['gitea_ci', 'gitea_ci_logs_analyze'],
  },
  {
    name: 'gitea_worktrees',
    description: 'Local git facade: worktree lifecycle and garbage collection, topological commit graph.',
    tools: ['gitea_worktree_list', 'gitea_worktree_add', 'gitea_worktree_use', 'gitea_worktree_remove', 'gitea_worktree_gc', 'gitea_git_graph'],
  },
  {
    name: 'gitea_webhooks_security',
    description: 'Webhook and security facade: webhook CRUD, local webhook sandbox, branch protection, deploy keys, security audit, mirror sync status.',
    tools: [
      'gitea_webhooks', 'gitea_webhook_sandbox', 'gitea_branch_protection_get', 'gitea_branch_protection_set',
      'gitea_deploy_keys', 'gitea_security_audit', 'gitea_mirror_sync_status',
    ],
  },
  {
    name: 'gitea_hub',
    description: 'Interactive UI facade: generative action cards for issues/PRs/branches and scheduled background checks.',
    tools: ['gitea_action_card', 'gitea_scheduled_checks'],
  },
  {
    name: ECOSYSTEM_FACADE,
    description: 'Ecosystem integrations facade (disabled by default, enable with enableEcosystemTools): task tracker sync, memory brain sync, incident reports, duty report, triage digest, project health, repo analytics, public mirror telemetry, package registry.',
    tools: [
      'gitea_usage_report',
      'gitea_task_tracker_sync', 'gitea_memory_brain_sync', 'gitea_incident_report', 'gitea_duty_report',
      'gitea_triage_digest', 'gitea_project_health', 'gitea_repo_analytics', 'gitea_mirror_public',
      'gitea_packages_list', 'gitea_package_get', 'gitea_package_delete', 'gitea_package_config',
    ],
  },
]

export const ALIAS_DEPRECATED_SINCE = '0.11.0'
export const ALIAS_REMOVAL_TARGET = '1.0.0 (planned 2027-06-01)'

// Canonical renames: { currentName: historicalName } (issue #385).
export const RENAMED_ALIASES = {
  gitea_pr_static_review: 'gitea_ai_review',
}

/**
 * Tool-level compatibility alias manifest: every historical tool name
 * (canonical pre-facade names plus renames) maps to its facade and carries
 * deprecation metadata. Multi-action canonical tools keep their own
 * `action` parameter, so the caller supplies the sub-action directly.
 * @returns {Record<string, {facade: string, canonical: string, callerProvidesAction: boolean, renamedTo?: string, deprecatedSince: string, removalTarget: string}>}
 */
export function buildAliasToolManifest() {
  const routes = buildFacadeRoutes()
  const canonicalFacade = new Map()
  for (const [facade, actions] of Object.entries(routes)) {
    for (const route of Object.values(actions)) {
      canonicalFacade.set(route.canonical, facade)
    }
  }
  const manifest = {}
  for (const def of TOOL_DEFS) {
    const historical = RENAMED_ALIASES[def.name] ?? def.name
    manifest[historical] = {
      facade: canonicalFacade.get(def.name),
      canonical: def.name,
      callerProvidesAction: Boolean(MULTI_ACTION_SUBS[def.name]),
      deprecatedSince: ALIAS_DEPRECATED_SINCE,
      removalTarget: ALIAS_REMOVAL_TARGET,
      ...(def.name !== historical ? { renamedTo: def.name } : {}),
    }
  }
  return manifest
}

/**
 * Build the facade routing: { facadeName: { action: { canonical, sub } } }.
 * @returns {Record<string, Record<string, {canonical: string, sub?: string}>>}
 */
export function buildFacadeRoutes() {
  const routes = {}
  const seenCanonical = new Set()
  for (const group of FACADE_GROUPS) {
    routes[group.name] = {}
    for (const canonical of group.tools) {
      if (seenCanonical.has(canonical)) {
        throw new Error(`tool-facades: ${canonical} is assigned to more than one facade`)
      }
      seenCanonical.add(canonical)
      const multi = MULTI_ACTION_SUBS[canonical]
      if (multi) {
        for (const sub of multi.subs) {
          routes[group.name][`${multi.prefix}_${sub}`] = { canonical, sub }
        }
      } else {
        routes[group.name][actionNameFor(canonical)] = { canonical }
      }
    }
  }
  const missing = TOOL_DEFS.map((d) => d.name).filter((name) => !seenCanonical.has(name))
  if (missing.length > 0) {
    throw new Error(`tool-facades: canonical tools not assigned to any facade: ${missing.join(', ')}`)
  }
  return routes
}

/**
 * Compatibility alias manifest: every historically registered tool name maps
 * to a facade route, carries its deprecation metadata and shares the counter
 * key used for usage metrics.
 * @returns {Record<string, {facade: string, action: string, canonical: string, sub?: string, deprecatedSince: string, removalTarget: string}>}
 */
export function buildAliasManifest() {
  const routes = buildFacadeRoutes()
  const manifest = {}
  for (const [facade, actions] of Object.entries(routes)) {
    for (const [action, route] of Object.entries(actions)) {
      // The historical name of a single-action tool is the canonical name
      // itself; for multi-action canonical tools each sub-action keeps its
      // historical alias from handlers/common.js LEGACY_MAP, so only the
      // canonical multi-action name needs a facade-level alias.
      if (!route.sub) {
        manifest[route.canonical] = {
          facade, action, canonical: route.canonical,
          deprecatedSince: ALIAS_DEPRECATED_SINCE, removalTarget: ALIAS_REMOVAL_TARGET,
        }
      } else {
        manifest[`${route.canonical}|${route.sub}`] = {
          facade, action, canonical: route.canonical, sub: route.sub,
          deprecatedSince: ALIAS_DEPRECATED_SINCE, removalTarget: ALIAS_REMOVAL_TARGET,
          internal: true,
        }
      }
    }
  }
  return manifest
}

/** Facade action parameter description (the enum itself lists the values). */
function actionEnumDescription() {
  return 'Action to perform; see the enum for the supported values of this facade.'
}

/**
 * Build the registered facade tool definitions from TOOL_DEFS member params.
 * All facade parameters are optional except `action`: the underlying handler
 * validates its own required arguments and returns structured errors.
 * @returns {Array<{name: string, description: string, parameters: object}>}
 */
export function buildFacadeDefs() {
  const routes = buildFacadeRoutes()
  const defsByName = new Map(TOOL_DEFS.map((d) => [d.name, d]))
  const defs = []
  for (const group of FACADE_GROUPS) {
    const actions = Object.keys(routes[group.name])
    const parameters = {
      action: {
        type: 'string',
        required: true,
        description: actionEnumDescription(),
        enum: actions,
      },
      instance: { type: 'string', description: 'Named Gitea instance (see settings). Defaults to the primary instance.' },
    }
    for (const canonical of group.tools) {
      const def = defsByName.get(canonical)
      if (!def) throw new Error(`tool-facades: no TOOL_DEFS entry for ${canonical}`)
      for (const [param, schema] of Object.entries(def.parameters || {})) {
        if (param === 'action' || param === 'instance' || parameters[param]) continue
        const copy = { ...schema }
        delete copy.required
        // Cap parameter descriptions: the facade merges dozens of params, and
        // the schema bytes count against the tool-surface budget (#376).
        if (typeof copy.description === 'string' && copy.description.length > 60) {
          copy.description = `${copy.description.slice(0, 57).trimEnd()}...`
        }
        parameters[param] = copy
      }
    }
    defs.push({
      name: group.name,
      description: group.description,
      parameters,
      ecosystem: group.name === ECOSYSTEM_FACADE,
    })
  }
  return defs
}

/** Names of facades registered only when the ecosystem flag is enabled. */
export function ecosystemFacadeNames() {
  return FACADE_GROUPS.filter((g) => g.name === ECOSYSTEM_FACADE).map((g) => g.name)
}
