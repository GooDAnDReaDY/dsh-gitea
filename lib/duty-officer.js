/**
 * Repository duty officer: read-only снимок «что случилось с репо» —
 * новые PR, PR без ревью, stale issues, — с идемпотентными event-id.
 * Любая запись в Gitea — только по заранее утверждённой policy/approval.
 */

const DAY_MS = 86400000

function daysSince(iso, now) {
  if (!iso) return null
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return null
  return Math.max(0, Math.floor((now.getTime() - t) / DAY_MS))
}

function eventId(kind, key) {
  return `${kind}:${key}`
}

export async function collectEvents(args = {}, deps = {}, now = new Date()) {
  const client = deps.client
  const owner = args.owner
  const repo = args.repo
  const lastCheckAt = args.lastCheckAt ? new Date(args.lastCheckAt).getTime() : 0
  const events = []
  const errors = []

  const [issuesRes, pullsRes, branchesRes] = await Promise.all([
    client.listIssues(owner, repo, { state: 'open', limit: 100 }).catch((e) => ({ ok: false, error: String(e) })),
    client.listPulls(owner, repo, { state: 'open', limit: 100 }).catch((e) => ({ ok: false, error: String(e) })),
    client.listBranches(owner, repo, { limit: 100 }).catch((e) => ({ ok: false, error: String(e) })),
  ])
  if (!issuesRes?.ok) errors.push(`issues: ${issuesRes?.error}`)
  if (!pullsRes?.ok) errors.push(`pulls: ${pullsRes?.error}`)
  if (!branchesRes?.ok) errors.push(`branches: ${branchesRes?.error}`)

  const pulls = pullsRes?.ok ? (Array.isArray(pullsRes.data) ? pullsRes.data : []) : []
  for (const pr of pulls) {
    const created = new Date(pr.created_at || 0).getTime()
    if (lastCheckAt && created > lastCheckAt) {
      events.push({ id: eventId('pr', pr.number), kind: 'new-pr', number: pr.number, title: pr.title, at: pr.created_at })
    }
    const reviewsRes = await client.listPullReviews(owner, repo, pr.number).catch(() => ({ ok: true, data: [] }))
    const reviews = reviewsRes?.ok && Array.isArray(reviewsRes.data) ? reviewsRes.data : []
    if (!reviews.some((r) => r.state === 'APPROVED')) {
      events.push({ id: eventId('pr-review', pr.number), kind: 'needs-review', number: pr.number, title: pr.title })
    }
  }

  const issues = issuesRes?.ok ? (Array.isArray(issuesRes.data) ? issuesRes.data : []) : []
  const staleDays = Number(args.staleDays || 14)
  for (const issue of issues) {
    const days = daysSince(issue.updated_at, now)
    if (days !== null && days >= staleDays) {
      events.push({ id: eventId('issue-stale', issue.number), kind: 'stale-issue', number: issue.number, title: issue.title, days })
    }
  }

  // дедуп по id
  const seen = new Set()
  const unique = events.filter((e) => {
    if (seen.has(e.id)) return false
    seen.add(e.id)
    return true
  })

  return { ok: true, data: { events: unique, errors, checkedAt: now.toISOString() } }
}

export async function buildDutyReport(args = {}, deps = {}, now = new Date()) {
  const res = await collectEvents(args, deps, now)
  if (!res.ok) return res
  const events = res.data.events
  const actions = events.map((e) => {
    if (e.kind === 'new-pr') return { action: 'review', target: `#${e.number}`, reason: 'новый PR' }
    if (e.kind === 'needs-review') return { action: 'review', target: `#${e.number}`, reason: 'PR без APPROVED' }
    if (e.kind === 'stale-issue') return { action: 'triage', target: `#${e.number}`, reason: `stale ${e.days} дн.` }
    return { action: 'none', target: `#${e.number}`, reason: e.kind }
  })
  return { ok: true, data: { owner: args.owner, repo: args.repo, checkedAt: res.data.checkedAt, events, actions, readOnly: true, errors: res.data.errors } }
}
