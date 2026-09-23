/**
 * gitea_review_inbox: categorizes open PRs by user involvement.
 * - awaitingMine: PRs where user is reviewer
 * - awaitingTheirs: user PRs awaiting reviews
 * - mergeReady: PRs with APPROVED and mergeable
 */

import { mapConcurrent } from './retry.js'

export async function buildReviewInbox(args = {}, deps = {}) {
  const client = deps.client
  const owner = args.owner
  const repo = args.repo
  const user = String(args.user || '').trim()
  const concurrency = Number(args.concurrency || 8)
  const errors = []

  const pullsRes = await client.listPulls(owner, repo, { state: 'open', limit: 100 }).catch((e) => ({ ok: false, error: String(e) }))
  if (!pullsRes?.ok) {
    return { ok: true, data: { awaitingMine: [], awaitingTheirs: [], mergeReady: [], errors: [`pulls: ${pullsRes?.error || 'unknown'}`] } }
  }
  const pulls = Array.isArray(pullsRes.data) ? pullsRes.data : []

  const awaitingMine = []
  const awaitingTheirs = []
  const mergeReady = []

  const pullDetails = await mapConcurrent(pulls, concurrency, async (pr) => {
    const number = pr.number
    const author = pr.user?.login || ''
    const title = pr.title || ''
    const htmlUrl = pr.html_url || ''
    const reviewsRes = await client.listPullReviews(owner, repo, number).catch(() => ({ ok: true, data: [] }))
    const reviews = reviewsRes?.ok && Array.isArray(reviewsRes.data) ? reviewsRes.data : []
    const approvedBy = reviews.filter((r) => r.state === 'APPROVED').map((r) => r.user?.login)
    const hasMyApproval = approvedBy.includes(user)
    const isMine = author === user

    return {
      number,
      title,
      author,
      htmlUrl,
      approvedBy,
      hasMyApproval,
      isMine,
      mergeable: pr.mergeable,
    }
  })

  for (const item of pullDetails) {
    const { number, title, author, htmlUrl, approvedBy, hasMyApproval, isMine, mergeable } = item
    if (isMine && !hasMyApproval) {
      awaitingTheirs.push({ number, title, author, htmlUrl })
    } else if (!isMine && !hasMyApproval) {
      awaitingMine.push({ number, title, author, htmlUrl })
    }

    if (approvedBy.length > 0 && mergeable !== false) {
      mergeReady.push({ number, title, author, htmlUrl, approvedBy })
    }
  }

  return {
    ok: true,
    data: {
      owner,
      repo,
      user,
      awaitingMine,
      awaitingTheirs,
      mergeReady,
      errors,
    },
  }
}
