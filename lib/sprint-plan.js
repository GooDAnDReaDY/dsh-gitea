/**
 * sprint-plan: планирование спринта из issues с меткой status/ready.
 * Сортирует по приоритету, предлагает milestone. Dry-run; применение
 * (assignee/milestone) — по confirm.
 */

const PRIORITY = { critical: 0, high: 1, medium: 2, low: 3 }

function priorityOf(labels = []) {
  for (const l of labels) {
    const name = l.name || l
    const m = /^priority\/(\w+)/.exec(name)
    if (m && m[1] in PRIORITY) return PRIORITY[m[1]]
  }
  return 2
}

export async function planSprint(args = {}, deps = {}) {
  const client = deps.client
  const owner = args.owner
  const repo = args.repo

  const [issuesRes, milestonesRes] = await Promise.all([
    client.listIssues(owner, repo, { state: 'open', limit: 200 }).catch((e) => ({ ok: false, error: String(e) })),
    client.listMilestones(owner, repo, { state: 'open', limit: 50 }).catch((e) => ({ ok: false, error: String(e) })),
  ])
  if (!issuesRes?.ok) return { ok: false, error: issuesRes?.error || 'listIssues failed' }

  const issues = Array.isArray(issuesRes.data) ? issuesRes.data : []
  const ready = issues
    .filter((i) => (i.labels || []).some((l) => (l.name || l) === 'status/ready'))
    .sort((a, b) => priorityOf(a.labels) - priorityOf(b.labels))

  const milestones = milestonesRes?.ok && Array.isArray(milestonesRes.data) ? milestonesRes.data : []
  const milestone = milestones.length ? milestones[0].title : null

  return {
    ok: true,
    data: {
      dryRun: true,
      owner, repo,
      issues: ready.map((i) => ({ number: i.number, title: i.title, labels: (i.labels || []).map((l) => l.name || l) })),
      milestone,
      suggestedAssignee: null,
      note: 'План спринта. Применение (assignee/milestone) требует confirm и согласования.',
    },
  }
}
