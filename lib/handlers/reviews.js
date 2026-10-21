import { wrap, pickQuery, asNumber } from './common.js'

const REVIEW_TOOLS = new Set([
  'gitea_pr_reviews',
  'gitea_pr_submit_review',
  'gitea_pr_review',
  'gitea_ai_review',
  'gitea_review_inbox',
  'gitea_review_escalate',
  'gitea_suggest_reviewers',
])

export function isReviewTool(name) {
  return REVIEW_TOOLS.has(name)
}

export async function handleReviewTool(name, args, deps, ctx) {
  const { client, settings, remoteUrl, owner, repo } = ctx

  if (name === 'gitea_ai_review') {
    const { runAiReview } = await import('../ai-review.js')
    return runAiReview(args, { ...deps, client, settings, remoteUrl })
  }

  if (name === 'gitea_suggest_reviewers') {
    const { suggestReviewers } = await import('../reviewer-matcher.js')
    return suggestReviewers({ ...args, owner: args.owner || owner, repo: args.repo || repo }, { ...deps, client, settings })
  }

  switch (name) {
    case 'gitea_pr_reviews':
      return wrap(await client.listPullReviews(owner, repo, asNumber(args.number), pickQuery(args, ['limit', 'page'])))

    case 'gitea_pr_submit_review':
      return wrap(await client.submitPullReview(owner, repo, asNumber(args.number), {
        event: args.event,
        body: args.body,
      }))

    case 'gitea_pr_review': {
      const { buildPrReview } = await import('../pr-review.js')
      return buildPrReview({ owner, repo, number: asNumber(args.number) }, { client })
    }

    case 'gitea_review_inbox': {
      const { buildReviewInbox } = await import('../review-inbox.js')
      return buildReviewInbox({ owner, repo, user: args.user }, { client })
    }

    case 'gitea_review_escalate': {
      const { escalate } = await import('../review-escalation.js')
      return escalate({ owner, repo, staleDays: args.staleDays, confirm: args.confirm, dryRun: args.confirm !== true }, deps)
    }

    default:
      return { ok: false, error: `Unknown review tool: ${name}` }
  }
}
