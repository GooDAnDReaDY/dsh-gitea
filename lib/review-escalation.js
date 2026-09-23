/**
 * review-escalation: finds PRs awaiting review longer than N days
 * and marked priority/high. Shows candidates (dry-run) or pings reviewers.
 */

import { mapConcurrent } from './retry.js'

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
  const concurrency = Number(args.concurrency || 8)

  const pullsRes = await client.listPulls(owner, repo, { state: 'open', limit: 100 }).catch((e) => ({ ok: false, error: String(e) }))
  if (!pullsRes?.ok) return { ok: false, error: pullsRes?.error || 'listPulls failed' }
  const pulls = Array.isArray(pullsRes.data) ? pullsRes.data : []

  // Pre-filter candidates by age
  const candidatePulls = pulls.filter((pr) => {
    const age = daysSince(pr.updated_at, now)
    return age !== null && age >= staleDays
  })

  const checkedCandidates = await mapConcurrent(candidatePulls, concurrency, async (pr) => {
    const age = daysSince(pr.updated_at, now)
    let labels = Array.isArray(pr.labels) ? pr.labels.map((l) => l.name || l) : null
    if (labels === null) {
      const prRes = await client.getPull(owner, repo, pr.number).catch(() => ({ ok: true, data: null }))
      labels = (prRes?.ok && prRes.data?.labels) ? prRes.data.labels.map((l) => l.name || l) : []
    }
    if (!labels.includes('priority/high')) return null

    const reviewsRes = await client.listPullReviews(owner, repo, pr.number, {}).catch(() => ({ ok: true, data: [] }))
    const reviews = reviewsRes?.ok && Array.isArray(reviewsRes.data) ? reviewsRes.data : []
    if (reviews.some((r) => r.state === 'APPROVED')) return null

    return { number: pr.number, title: pr.title, ageDays: age }
  })

  const escalations = checkedCandidates.filter(Boolean)

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
    const body = `⏰ Review escalation: PR #${e.number} has been awaiting review for ${e.ageDays} days and is marked priority/high. Please review.`
    const res = await client.commentIssue(owner, repo, e.number, body).catch((err) => ({ ok: false, error: String(err) }))
    results.push({ number: e.number, ok: res.ok })
  }
  return { ok: true, data: { escalations, applied: true, results } }
}
