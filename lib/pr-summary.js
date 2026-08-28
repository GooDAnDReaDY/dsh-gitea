/**
 * gitea_pr_summary: read-only сводка по PR — файлы, области, риски,
 * тесты, миграции, ревью, merge-статус. Не пишет ничего.
 */

function areaOf(filename) {
  const parts = String(filename || '').split('/')
  return parts.length > 1 ? parts[0] : '(root)'
}

function risksFor(files) {
  const risks = []
  for (const f of files) {
    const name = String(f.filename || '').toLowerCase()
    if (/migration|schema|\.sql$/.test(name)) risks.push({ type: 'migration', file: f.filename })
    if (/lockfile|package\.json|pnpm-lock|yarn\.lock/.test(name)) risks.push({ type: 'dependencies', file: f.filename })
    if (/secret|credential|\.env|token/.test(name)) risks.push({ type: 'security', file: f.filename })
    if (/^api\/|interface|types\.ts/.test(name)) risks.push({ type: 'api-surface', file: f.filename })
  }
  // дедуп
  const seen = new Set()
  return risks.filter((r) => {
    const k = `${r.type}:${r.file}`
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}

/**
 * @param {{owner: string, repo: string, number: number}} args
 * @param {{client: object}} deps
 */
export async function buildPrSummary(args = {}, deps = {}) {
  const client = deps.client
  const owner = args.owner
  const repo = args.repo
  const number = Number(args.number)
  const missing = []

  const [prRes, filesRes, reviewsRes, mergeRes] = await Promise.all([
    client.getPull(owner, repo, number).catch((e) => ({ ok: false, error: String(e) })),
    client.listPullFiles(owner, repo, number, {}).catch((e) => ({ ok: false, error: String(e) })),
    client.listPullReviews(owner, repo, number, {}).catch((e) => ({ ok: false, error: String(e) })),
    client.getPullMergeStatus(owner, repo, number).catch((e) => ({ ok: false, error: String(e) })),
  ])

  if (!prRes?.ok || !prRes.data) missing.push('pr')
  if (!filesRes?.ok) missing.push('files')
  if (!reviewsRes?.ok) missing.push('reviews')
  if (!mergeRes?.ok) missing.push('merge-status')

  const pr = prRes?.data || {}
  const files = filesRes?.ok && Array.isArray(filesRes.data) ? filesRes.data : []
  const reviews = reviewsRes?.ok && Array.isArray(reviewsRes.data) ? reviewsRes.data : []

  const areas = [...new Set(files.map((f) => areaOf(f.filename)))]
  const testFiles = files.filter((f) => /test|spec|\.test\./.test(String(f.filename || '')))
  const risks = risksFor(files)
  const totalAdditions = files.reduce((a, f) => a + (Number(f.additions) || 0), 0)
  const totalDeletions = files.reduce((a, f) => a + (Number(f.deletions) || 0), 0)
  const approvedBy = reviews.filter((r) => r.state === 'APPROVED').map((r) => r.user?.login)

  return {
    ok: true,
    data: {
      number,
      title: pr.title || '',
      body: pr.body || '',
      author: pr.user?.login || '',
      state: pr.state || '',
      files,
      areas,
      testFiles: testFiles.map((f) => f.filename),
      risks,
      totalAdditions,
      totalDeletions,
      approvedBy,
      mergeable: mergeRes?.ok ? (mergeRes.data ? mergeRes.data.mergeable ?? 'unknown' : 'unknown') : 'unknown',
      missing,
    },
  }
}
