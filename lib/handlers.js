import { resolveRepo } from './repo.js'
import { credentialRefStatus } from './secrets.js'
import { runWorktreeAction } from './git-local.js'

const schedulerStore = { jobs: new Map() }

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

const NO_REPO = new Set(['gitea_repo_search', 'gitea_whoami', 'gitea_issue_search', 'gitea_issue_lint', 'gitea_org_repos', 'gitea_org_members', 'gitea_user_search', 'gitea_org_list', 'gitea_org_teams', 'gitea_notifications', 'gitea_notifications_mark_read', 'gitea_ci_explain', 'gitea_pr_template_check', 'gitea_mirror_public', ...LOCAL_TOOLS])

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
    case 'gitea_repo_analytics': {
      const { buildAnalytics } = await import('./analytics.js')
      return buildAnalytics({ owner, repo }, { client })
    }
    case 'gitea_auto_actions': {
      const { applyAutoActions } = await import('./auto-actions.js')
      return applyAutoActions({ owner, repo, number: asNumber(args.number), confirm: args.confirm, dryRun: args.confirm !== true }, { client })
    }
    case 'gitea_mirror_public': {
      const { prepareMirror } = await import('./mirror-public.js')
      return prepareMirror({ source: args.source, target: args.target }, {})
    }
    case 'gitea_auto_merge': {
      const { autoMergeIfReady } = await import('./merge-gate.js')
      return autoMergeIfReady({ owner, repo, number: asNumber(args.number), confirm: args.confirm === true }, { client })
    }
    case 'gitea_pr_review': {
      const { buildPrReview } = await import('./pr-review.js')
      return buildPrReview({ owner, repo, number: asNumber(args.number) }, { client })
    }
    case 'gitea_pr_summary': {
      const { buildPrSummary } = await import('./pr-summary.js')
      return buildPrSummary({ owner, repo, number: args.number }, { client })
    }
    case 'gitea_issue_duplicates': {
      const { findDuplicates } = await import('./dup-detect.js')
      return findDuplicates({ owner, repo, title: args.title, body: args.body, threshold: args.threshold }, { client })
    }
    case 'gitea_batch_issue_ops': {
      const { planBatch, applyBatch } = await import('./batch-ops.js')
      if (args.apply === true) {
        return applyBatch({ owner, repo, numbers: args.numbers, label: args.label, assignee: args.assignee }, { client })
      }
      return planBatch({ owner, repo, numbers: args.numbers, label: args.label, assignee: args.assignee }, { client })
    }
    case 'gitea_merge_readiness': {
      const { checkMergeReadiness } = await import('./merge-gate.js')
      return checkMergeReadiness({ owner, repo, number: args.number }, { client })
    }
    case 'gitea_release_notes': {
      const { buildReleaseNotes } = await import('./release-notes.js')
      return buildReleaseNotes({ owner, repo, fromTag: args.fromTag, toTag: args.toTag }, { client })
    }
    case 'gitea_triage_digest': {
      const { buildTriageDigest } = await import('./triage-digest.js')
      return buildTriageDigest({ owner, repo, staleDays: args.staleDays }, { client })
    }
    case 'gitea_dep_watch': {
      const { buildDepWatch } = await import('./dep-watch.js')
      return buildDepWatch({ owner, repo }, { client })
    }
    case 'gitea_pr_impact': {
      const { buildImpactMap } = await import('./impact-map.js')
      return buildImpactMap({ owner, repo, number: args.number }, { client })
    }
    case 'gitea_digest_delivery': {
      const { formatDigest, deliverDigest } = await import('./digest-delivery.js')
      const text = args.text || formatDigest(args.kind || 'triage', {})
      return deliverDigest({ target: args.target, text, dryRun: args.dryRun !== false }, {})
    }
    case 'gitea_label_bootstrap': {
      const { buildLabelPlan, applyLabelPlan } = await import('./label-bootstrap.js')
      if (args.apply === true) return applyLabelPlan({ owner, repo }, { client })
      return buildLabelPlan({ owner, repo }, { client })
    }
    case 'gitea_pr_template_check': {
      const { checkPrTemplate, needsRiskChecklist } = await import('./pr-templates.js')
      const bodyCheck = checkPrTemplate(args.body)
      return { ok: true, data: { template: bodyCheck, riskChecklistNeeded: needsRiskChecklist(args.labels || []) } }
    }
    case 'gitea_issue_flow': {
      const { planIssueFlow, createFlowPr } = await import('./issue-flow.js')
      if (args.action === 'plan') return planIssueFlow({ issue: args.issue, title: args.title, type: args.type })
      if (args.action === 'create') return createFlowPr({ owner, repo, head: args.head, base: args.base, issue: args.issue, title: args.title }, { client })
      return { ok: false, error: `unknown action: ${args.action}` }
    }
    case 'gitea_repo_bootstrap': {
      const { planBootstrap, applyBootstrap } = await import('./repo-bootstrap.js')
      if (args.apply === true) return applyBootstrap({ name: args.name, description: args.description, private: args.private }, { client })
      return planBootstrap({ name: args.name, description: args.description, private: args.private })
    }
    case 'gitea_duty_report': {
      const { buildDutyReport } = await import('./duty-officer.js')
      return buildDutyReport({ owner, repo, lastCheckAt: args.lastCheckAt, staleDays: args.staleDays }, { client })
    }
    case 'gitea_label_auto': {
      const { applyLabelRules } = await import('./label-auto.js')
      return applyLabelRules({ owner, repo, number: args.number }, { client })
    }
    case 'gitea_org_members':
      return wrap(await client.listOrgMembers(args.org, pickQuery(args, ['limit', 'page'])))
    case 'gitea_notifications_mark_read': {
      if (args.confirm !== true) {
        return { ok: false, error: 'Marking notifications read requires confirm: true (boolean).' }
      }
      return wrap(await client.markNotificationsRead())
    }
    case 'gitea_ci_status':
      return wrap(await client.listActionsRuns(owner, repo, pickQuery(args, ['branch', 'sha', 'limit', 'page'])))
    case 'gitea_ci_jobs':
      return wrap(await client.listRunJobs(owner, repo, asNumber(args.run_id), {}))
    case 'gitea_repo_create_org':
      return wrap(await client.createOrgRepo(args.org, { name: args.name, description: args.description, private: args.private !== false }))
    case 'gitea_repo_branch_create':
      return wrap(await client.createBranch(owner, repo, { branch_name: args.branch_name, ref: args.ref || 'main' }))
    case 'gitea_repo_branch_delete': {
      if (args.confirm !== true) return { ok: false, error: 'Deleting a branch requires confirm: true (boolean).' }
      return wrap(await client.deleteBranch(owner, repo, args.branch))
    }
    case 'gitea_repo_tag_create':
      return wrap(await client.createTag(owner, repo, { tag_name: args.tag_name, target: args.target || 'main' }))
    case 'gitea_repo_tag_delete': {
      if (args.confirm !== true) return { ok: false, error: 'Deleting a tag requires confirm: true (boolean).' }
      return wrap(await client.deleteTag(owner, repo, args.tag))
    }
    case 'gitea_milestone_update':
      return wrap(await client.updateMilestone(owner, repo, asNumber(args.milestone_id), {
        title: args.title, state: args.state, due_on: args.due_on,
      }))
    case 'gitea_milestone_delete': {
      if (args.confirm !== true) return { ok: false, error: 'Deleting a milestone requires confirm: true (boolean).' }
      return wrap(await client.deleteMilestone(owner, repo, asNumber(args.milestone_id)))
    }
    case 'gitea_wiki_page':
      return wrap(await client.getWikiPage(owner, repo, args.pageName))
    case 'gitea_release_update':
      return wrap(await client.updateRelease(owner, repo, asNumber(args.release_id), { name: args.name, body: args.body }))
    case 'gitea_webhook_list':
      return wrap(await client.listWebhooks(owner, repo))
    case 'gitea_webhook_create':
      return wrap(await client.createWebhook(owner, repo, { type: args.type || 'gitea', config: { url: args.url }, events: args.events }))
    case 'gitea_webhook_delete': {
      if (args.confirm !== true) return { ok: false, error: 'Deleting a webhook requires confirm: true (boolean).' }
      return wrap(await client.deleteWebhook(owner, repo, asNumber(args.hook_id)))
    }
    case 'gitea_ci_rerun': {
      if (args.confirm !== true) return { ok: false, error: 'Rerunning a job requires confirm: true (boolean).' }
      return wrap(await client.rerunActionsJob(owner, repo, asNumber(args.job_id)))
    }
    case 'gitea_user_search':
      return wrap(await client.searchUsers(pickQuery(args, ['q', 'limit'])))
    case 'gitea_org_list':
      return wrap(await client.listUserOrgs())
    case 'gitea_org_teams':
      return wrap(await client.listOrgTeams(args.org))
    case 'gitea_scheduled_checks': {
      const { addJob, listJobs, runJob } = await import('./scheduler.js')
      if (args.action === 'list') {
        return { ok: true, data: { jobs: listJobs(schedulerStore) } }
      }
      if (args.action === 'add') {
        const r = addJob(schedulerStore, { name: args.name, schedule: args.schedule, owner, repo, action: args.checkType || 'health', dryRun: args.dryRun !== false })
        return r
      }
      if (args.action === 'run') {
        const job = schedulerStore.jobs.get(String(args.name || ''))
        if (!job) return { ok: false, error: `job not found: ${args.name}` }
        const executor = job.action === 'triage'
          ? async () => (await import('./triage-digest.js')).buildTriageDigest({ owner: job.owner, repo: job.repo }, { client })
          : job.action === 'inbox'
            ? async () => (await import('./review-inbox.js')).buildReviewInbox({ owner: job.owner, repo: job.repo, user: '' }, { client })
            : async () => (await import('./project-health.js')).buildHealthReport({ owner: job.owner, repo: job.repo }, { client })
        return runJob(job, executor)
      }
      return { ok: false, error: `unknown action: ${args.action}` }
    }
    case 'gitea_pr_policy': {
      const { parsePolicy, validatePolicy, evaluatePolicy } = await import('./policy-code.js')
      const res = await client.getContents(owner, repo, '.gitea/pr-policy.yml').catch((e) => ({ ok: false, error: String(e) }))
      if (!res?.ok) {
        return { ok: true, data: { present: false, note: 'Политика не найдена (.gitea/pr-policy.yml)', violations: [] } }
      }
      const text = Buffer.from(String(res.data?.content || ''), 'base64').toString('utf8')
      const parsed = parsePolicy(text)
      if (!parsed.ok) return { ok: false, error: parsed.error }
      const v = validatePolicy(parsed.data)
      const evalRes = evaluatePolicy(parsed.data, args.files || [])
      return { ok: true, data: { present: true, policy: parsed.data, validation: v, violations: evalRes.violations } }
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
