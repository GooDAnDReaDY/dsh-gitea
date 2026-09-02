/**
 * gitea_repo_analytics: read-only статистика репозитория — open/closed,
 * cycle time, PR-метрики.
 */

const DAY_MS = 86400000

function daysBetween(a, b) {
  const ta = new Date(a).getTime()
  const tb = new Date(b).getTime()
  if (Number.isNaN(ta) || Number.isNaN(tb)) return null
  return Math.max(0, (tb - ta) / DAY_MS)
}

export async function buildAnalytics(args = {}, deps = {}) {
  const client = deps.client
  const owner = args.owner
  const repo = args.repo

  const [issuesRes, pullsRes] = await Promise.all([
    client.listIssues(owner, repo, { state: 'all', limit: 200 }).catch((e) => ({ ok: false, error: String(e) })),
    client.listPulls(owner, repo, { state: 'all', limit: 200 }).catch((e) => ({ ok: false, error: String(e) })),
  ])
  if (!issuesRes?.ok) return { ok: false, error: issuesRes?.error || 'listIssues failed' }

  const issues = Array.isArray(issuesRes.data) ? issuesRes.data : []
  const pulls = pullsRes?.ok && Array.isArray(pullsRes.data) ? pullsRes.data : []

  const issuesOpen = issues.filter((i) => i.state === 'open').length
  const issuesClosed = issues.filter((i) => i.state === 'closed').length
  const closedTimes = issues
    .filter((i) => i.state === 'closed')
    .map((i) => daysBetween(i.created_at, i.updated_at))
    .filter((d) => d !== null)
  const cycleTimeDays = closedTimes.length ? closedTimes.reduce((s, d) => s + d, 0) / closedTimes.length : 0

  const pullsOpen = pulls.filter((p) => p.state === 'open').length
  const pullsMerged = pulls.filter((p) => p.merged === true || p.state === 'merged' || (p.state === 'closed' && (p.merged || p.merged_at))).length
  const pullsClosed = pulls.filter((p) => p.state === 'closed' && !p.merged && p.state !== 'merged').length

  return {
    ok: true,
    data: {
      owner, repo,
      readOnly: true,
      issues: { total: issues.length, open: issuesOpen, closed: issuesClosed },
      pulls: { total: pulls.length, open: pullsOpen, merged: pullsMerged, closed: pullsClosed },
      cycleTimeDays: Math.round(cycleTimeDays * 10) / 10,
      notes: closedTimes.length ? `средний cycle time по ${closedTimes.length} закрытым` : 'нет закрытых issues',
    },
  }
}
