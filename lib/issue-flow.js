/**
 * Issue → branch → worktree → PR flow: связывает issue с веткой/worktree
 * и создаёт draft PR. Write-операции (worktree) требуют gitWrapper;
 * создание PR — штатный API-вызов, без force.
 */

function slugify(title = '') {
  return String(title || '')
    .toLowerCase()
    .replace(/^[a-z]+:\s*/, '')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
}

export function branchNameFor({ number, title, type = 'feat' }) {
  const slug = slugify(title) || 'task'
  return `${type}/${number}-${slug}`
}

export function planIssueFlow({ number, title, type = 'feat', issue }) {
  const n = Number(issue || number)
  if (!n) return { ok: false, error: 'issue number is required' }
  const branch = branchNameFor({ number: n, title, type })
  return {
    ok: true,
    data: {
      issue: n,
      branch,
      worktreePath: `.worktrees/${branch.replace(/\//g, '-')}`,
    },
  }
}

export async function createFlowPr(args = {}, deps = {}) {
  const client = deps.client
  const owner = args.owner
  const repo = args.repo
  const head = args.head
  const base = args.base || 'main'
  const issue = Number(args.issue || '')
  if (!head) return { ok: false, error: 'head branch is required' }

  let body = args.body
  if (!body) {
    const { templateForBranch } = await import('./pr-templates-branch.js')
    body = templateForBranch(head, { number: issue, title: args.title || '' })
  }
  const res = await client.createPull(owner, repo, { title: args.title || `feat: work for #${issue}`, head, base, body })
  if (!res?.ok) return { ok: false, error: res?.error || 'createPull failed' }
  return { ok: true, data: { number: res.data?.number, html_url: res.data?.html_url || '' } }
}
