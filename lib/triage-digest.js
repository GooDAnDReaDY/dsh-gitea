/**
 * gitea_triage_digest: ежедневный triage-отчёт по репозиторию —
 * PR без ревью, stale issues, ветки без активности, ошибки API.
 * Read-only; доставка наружу — через уже подключённые каналы.
 */

const DAY_MS = 86400000

function daysSince(iso, now) {
  if (!iso) return null
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return null
  return Math.max(0, Math.floor((now.getTime() - t) / DAY_MS))
}

export async function buildTriageDigest(args = {}, deps = {}, now = new Date()) {
  const client = deps.client
  const owner = args.owner
  const repo = args.repo
  const staleDays = Number(args.staleDays || 14)
  const errors = []

  const [issuesRes, pullsRes, branchesRes] = await Promise.all([
    client.listIssues(owner, repo, { state: 'open', limit: 100 }).catch((e) => ({ ok: false, error: String(e) })),
    client.listPulls(owner, repo, { state: 'open', limit: 100 }).catch((e) => ({ ok: false, error: String(e) })),
    client.listBranches(owner, repo, { limit: 100 }).catch((e) => ({ ok: false, error: String(e) })),
  ])

  if (!issuesRes?.ok) errors.push(`issues: ${issuesRes?.error || 'unknown'}`)
  if (!pullsRes?.ok) errors.push(`pulls: ${pullsRes?.error || 'unknown'}`)
  if (!branchesRes?.ok) errors.push(`branches: ${branchesRes?.error || 'unknown'}`)

  const issues = issuesRes?.ok ? (Array.isArray(issuesRes.data) ? issuesRes.data : []) : []
  const pulls = pullsRes?.ok ? (Array.isArray(pullsRes.data) ? pullsRes.data : []) : []
  const branches = branchesRes?.ok ? (Array.isArray(branchesRes.data) ? branchesRes.data : []) : []

  // PR без APPROVED-ревью
  const pullRequestsNoReview = []
  for (const pr of pulls) {
    const reviewsRes = await client.listPullReviews(owner, repo, pr.number).catch(() => ({ ok: true, data: [] }))
    const reviews = reviewsRes?.ok && Array.isArray(reviewsRes.data) ? reviewsRes.data : []
    if (!reviews.some((r) => r.state === 'APPROVED')) {
      pullRequestsNoReview.push({ number: pr.number, title: pr.title, author: pr.user?.login || '' })
    }
  }

  const staleIssues = issues
    .map((i) => ({ number: i.number, title: i.title, days: daysSince(i.updated_at, now) }))
    .filter((i) => i.days !== null && i.days >= staleDays)
    .sort((a, b) => b.days - a.days)

  const staleBranches = branches
    .map((b) => ({ name: b.name, days: daysSince(b.commit?.created, now) }))
    .filter((b) => b.days !== null && b.days >= staleDays)
    .sort((a, b) => b.days - a.days)

  let priorityAction = 'Всё в порядке'
  if (pullRequestsNoReview.length > 0) priorityAction = `Проверить ${pullRequestsNoReview.length} PR без ревью`
  else if (staleIssues.length > 0) priorityAction = `Разобрать ${staleIssues.length} stale issues`
  else if (staleBranches.length > 0) priorityAction = `Почистить ${staleBranches.length} устаревших веток`

  return {
    ok: true,
    data: {
      owner,
      repo,
      generatedAt: now.toISOString(),
      pullRequestsNoReview,
      staleIssues,
      staleBranches,
      priorityAction,
      errors,
    },
  }
}
