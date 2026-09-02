/**
 * gitea_project_health: единый read-only отчёт по репозиторию.
 * Собирает открытые PR, open issues (включая stale), ветки без активности
 * и ошибки API. Ничего не пишет.
 */

const DAY_MS = 86400000

function daysSince(iso, now) {
  if (!iso) return null
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return null
  return Math.max(0, Math.floor((now.getTime() - t) / DAY_MS))
}

/**
 * @param {{owner: string, repo: string, staleDays?: number}} args
 * @param {{client: object}} deps
 * @param {Date} [now]
 */
export async function buildHealthReport(args = {}, deps = {}, now = new Date()) {
  const client = deps.client
  const owner = args.owner
  const repo = args.repo
  const staleDays = Number(args.staleDays || 14)
  const errors = []

  const startedAt = Date.now()
  const [issuesRes, pullsRes, branchesRes, repoRes] = await Promise.all([
    client.listIssues(owner, repo, { state: 'open', limit: 100 }).catch((e) => ({ ok: false, error: String(e) })),
    client.listPulls(owner, repo, { state: 'open', limit: 100 }).catch((e) => ({ ok: false, error: String(e) })),
    client.listBranches(owner, repo, { limit: 100 }).catch((e) => ({ ok: false, error: String(e) })),
    (client.getRepo ? client.getRepo(owner, repo) : Promise.resolve({ ok: false, error: 'no getRepo' })).catch((e) => ({ ok: false, error: String(e) })),
  ])
  const apiMs = Date.now() - startedAt

  if (!issuesRes?.ok) errors.push(`issues: ${issuesRes?.error || 'unknown'}`)
  if (!pullsRes?.ok) errors.push(`pulls: ${pullsRes?.error || 'unknown'}`)
  if (!branchesRes?.ok) errors.push(`branches: ${branchesRes?.error || 'unknown'}`)

  const issues = issuesRes?.ok ? (Array.isArray(issuesRes.data) ? issuesRes.data : []) : []
  const pulls = pullsRes?.ok ? (Array.isArray(pullsRes.data) ? pullsRes.data : []) : []
  const branches = branchesRes?.ok ? (Array.isArray(branchesRes.data) ? branchesRes.data : []) : []

  const openIssues = issues.filter((i) => i.state !== 'closed')
  const openPRs = pulls.filter((p) => p.state !== 'closed')

  const staleIssues = openIssues
    .map((i) => ({ number: i.number, title: i.title, staleDays: daysSince(i.updated_at, now) }))
    .filter((i) => i.staleDays !== null && i.staleDays >= staleDays)
    .sort((a, b) => b.staleDays - a.staleDays)

  const staleBranches = branches
    .map((b) => ({ name: b.name, ageDays: daysSince(b.commit?.created || b.commit?.committer?.date, now) }))
    .filter((b) => b.ageDays !== null && b.ageDays >= staleDays)
    .sort((a, b) => b.ageDays - a.ageDays)

  return {
    ok: true,
    data: {
      owner,
      repo,
      generatedAt: now.toISOString(),
      openPRs: openPRs.length,
      openIssues: openIssues.length,
      staleIssues,
      staleBranches,
      staleDays,
      apiMs,
      repoSize: repoRes?.ok ? repoRes.data?.size : null,
      rateLimitRemaining: client.rateLimitRemaining ?? null,
      errors,
    },
  }
}
