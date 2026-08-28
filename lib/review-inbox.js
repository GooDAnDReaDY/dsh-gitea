/**
 * gitea_review_inbox: классификация открытых PR по отношению к пользователю.
 * - awaitingMine: PR, где я ревьюер (или нет моего апрува)
 * - awaitingTheirs: мои PR без финального апрува
 * - mergeReady: PR с APPROVED и mergeable
 * Read-only, ничего не пишет.
 */

export async function buildReviewInbox(args = {}, deps = {}) {
  const client = deps.client
  const owner = args.owner
  const repo = args.repo
  const user = String(args.user || '').trim()
  const errors = []

  const pullsRes = await client.listPulls(owner, repo, { state: 'open', limit: 100 }).catch((e) => ({ ok: false, error: String(e) }))
  if (!pullsRes?.ok) {
    return { ok: true, data: { awaitingMine: [], awaitingTheirs: [], mergeReady: [], errors: [`pulls: ${pullsRes?.error || 'unknown'}`] } }
  }
  const pulls = Array.isArray(pullsRes.data) ? pullsRes.data : []

  const awaitingMine = []
  const awaitingTheirs = []
  const mergeReady = []

  for (const pr of pulls) {
    const number = pr.number
    const author = pr.user?.login || ''
    const title = pr.title || ''
    const htmlUrl = pr.html_url || ''
    const reviewsRes = await client.listPullReviews(owner, repo, number).catch(() => ({ ok: true, data: [] }))
    const reviews = reviewsRes?.ok && Array.isArray(reviewsRes.data) ? reviewsRes.data : []
    const approvedBy = reviews.filter((r) => r.state === 'APPROVED').map((r) => r.user?.login)
    const hasMyApproval = approvedBy.includes(user)
    const isMine = author === user

    if (isMine && !hasMyApproval) {
      awaitingTheirs.push({ number, title, author, htmlUrl })
    } else if (!isMine && !hasMyApproval) {
      awaitingMine.push({ number, title, author, htmlUrl })
    }

    if (approvedBy.length > 0 && pr.mergeable !== false) {
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
