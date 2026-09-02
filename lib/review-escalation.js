/**
 * review-escalation: находит PR без ревью, которые «зависли» дольше N дней
 * и помечены priority/high. Показывает кандидатов (dry-run) или пишет
 * комментарий-пинг (confirm).
 */

const DAY_MS = 86400000

function daysSince(iso, now) {
  if (!iso) return null
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return null
  return Math.max(0, Math.floor((now - t) / DAY_MS))
}

export async function findEscalations(args = {}, deps = {}, now = Date.now()) {
  const client = deps.client
  const owner = args.owner
  const repo = args.repo
  const staleDays = Number(args.staleDays || 7)

  const pullsRes = await client.listPulls(owner, repo, { state: 'open', limit: 100 }).catch((e) => ({ ok: false, error: String(e) }))
  if (!pullsRes?.ok) return { ok: false, error: pullsRes?.error || 'listPulls failed' }
  const pulls = Array.isArray(pullsRes.data) ? pullsRes.data : []

  const escalations = []
  for (const pr of pulls) {
    const age = daysSince(pr.updated_at, now)
    if (age === null || age < staleDays) continue
    const prRes = await client.getPull(owner, repo, pr.number).catch(() => ({ ok: true, data: null }))
    const labels = (prRes?.ok && prRes.data?.labels) ? prRes.data.labels.map((l) => l.name || l) : []
    if (!labels.includes('priority/high')) continue
    const reviewsRes = await client.listPullReviews(owner, repo, pr.number, {}).catch(() => ({ ok: true, data: [] }))
    const reviews = reviewsRes?.ok && Array.isArray(reviewsRes.data) ? reviewsRes.data : []
    if (reviews.some((r) => r.state === 'APPROVED')) continue
    escalations.push({ number: pr.number, title: pr.title, ageDays: age })
  }

  return { ok: true, data: { escalations, readOnly: true } }
}

export async function escalate(args = {}, deps = {}) {
  const client = deps.client
  const owner = args.owner
  const repo = args.repo

  const found = await findEscalations(args, deps)
  if (!found.ok) return found
  const escalations = found.data.escalations

  if (args.dryRun === true || args.confirm !== true) {
    return { ok: true, data: { escalations, applied: false, needConfirm: args.dryRun !== true } }
  }

  const results = []
  for (const e of escalations) {
    const body = `⏰ Review escalation: PR #${e.number} ждёт ревью ${e.ageDays} дн. и помечен priority/high. Пожалуйста, отревьюйте.`
    const res = await client.commentIssue(owner, repo, e.number, body).catch((err) => ({ ok: false, error: String(err) }))
    results.push({ number: e.number, ok: res.ok })
  }
  return { ok: true, data: { escalations, applied: true, results } }
}
