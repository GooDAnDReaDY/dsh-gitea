/**
 * gitea_pr_review: hybrid PR review — rule-based diff analysis
 * (risks, areas, tests, migrations, merge status) + structured verdict.
 */

function areaOf(filename) {
  const parts = String(filename || '').split('/')
  return parts.length > 1 ? parts[0] : '(root)'
}

function risksFor(files) {
  const risks = []
  for (const f of files) {
    const name = String(f.filename || '').toLowerCase()
    if (/migration|schema|\.sql$/.test(name)) risks.push({ type: 'migration', file: f.filename, severity: 'high', note: 'database migration / schema' })
    if (/lockfile|package\.json|pnpm-lock|yarn\.lock/.test(name)) risks.push({ type: 'dependencies', file: f.filename, severity: 'medium', note: 'dependency change' })
    if (/secret|credential|\.env|token|password/.test(name)) risks.push({ type: 'security', file: f.filename, severity: 'high', note: 'secret or credential file' })
    if (/^api\/|interface|types\.ts/.test(name)) risks.push({ type: 'api-surface', file: f.filename, severity: 'medium', note: 'public API surface' })
    if (/test|spec\./.test(name)) risks.push({ type: 'tests', file: f.filename, severity: 'low', note: 'test files' })
  }
  const seen = new Set()
  return risks.filter((r) => {
    const k = `${r.type}:${r.file}`
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}

export async function buildPrReview(args = {}, deps = {}) {
  const client = deps.client
  const owner = args.owner
  const repo = args.repo
  const number = Number(args.number)

  const [filesRes, mergeRes] = await Promise.all([
    client.listPullFiles(owner, repo, number).catch((e) => ({ ok: false, error: String(e) })),
    client.getPullMergeStatus(owner, repo, number).catch((e) => ({ ok: false, error: String(e) })),
  ])
  if (!filesRes?.ok) return { ok: false, error: filesRes?.error || 'listPullFiles failed' }

  const files = Array.isArray(filesRes.data) ? filesRes.data : []
  const risks = risksFor(files)
  const areas = [...new Set(files.map((f) => areaOf(f.filename)))]
  const hasTests = files.some((f) => /test|spec\./.test(String(f.filename || '')))
  const additions = files.reduce((s, f) => s + (Number(f.additions) || 0), 0)
  const deletions = files.reduce((s, f) => s + (Number(f.deletions) || 0), 0)
  const mergeStatus = mergeRes?.ok ? mergeRes.data : {}

  const high = risks.filter((r) => r.severity === 'high')
  const verdict = high.length > 0 ? 'request_changes' : (additions + deletions > 500 ? 'comment' : 'approve')
  const questions = []
  if (high.some((r) => r.type === 'security')) questions.push('Verify that secrets are not committed (real .env or API keys).')
  if (high.some((r) => r.type === 'migration')) questions.push('Is there a rollback plan for the database migration?')
  if (mergeStatus?.has_conflicts) questions.push('PR has merge conflicts — rebase required before merge.')
  if (!hasTests && additions > 50) questions.push('No tests for new code — should tests be added?')

  return {
    ok: true,
    data: {
      owner, repo, number,
      readOnly: true,
      summary: `${files.length} files, +${additions}/-${deletions}, areas: ${areas.join(', ') || '(none)'}`,
      files,
      risks,
      hasTests,
      mergeStatus,
      verdict,
      questions,
    },
  }
}
