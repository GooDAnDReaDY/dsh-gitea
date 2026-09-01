/**
 * gitea_pr_review: гибридное ревью PR — правило-based анализ diff
 * (риски, области, тесты, миграции, merge-статус) + структурированный
 * вердикт и вопросы. Read-only. Агент использует результат как основу
 * для полноценного ревью (LLM-слой подключаем позже).
 */

function areaOf(filename) {
  const parts = String(filename || '').split('/')
  return parts.length > 1 ? parts[0] : '(root)'
}

function risksFor(files) {
  const risks = []
  for (const f of files) {
    const name = String(f.filename || '').toLowerCase()
    if (/migration|schema|\.sql$/.test(name)) risks.push({ type: 'migration', file: f.filename, severity: 'high', note: 'схема/миграция БД' })
    if (/lockfile|package\.json|pnpm-lock|yarn\.lock/.test(name)) risks.push({ type: 'dependencies', file: f.filename, severity: 'medium', note: 'изменение зависимостей' })
    if (/secret|credential|\.env|token|password/.test(name)) risks.push({ type: 'security', file: f.filename, severity: 'high', note: 'файл секретов/учётных данных' })
    if (/^api\/|interface|types\.ts/.test(name)) risks.push({ type: 'api-surface', file: f.filename, severity: 'medium', note: 'публичная API-поверхность' })
    if (/test|spec\./.test(name)) risks.push({ type: 'tests', file: f.filename, severity: 'low', note: 'тесты' })
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
  if (high.some((r) => r.type === 'security')) questions.push('Проверьте, что секреты не закоммичены (real .env/ключи).')
  if (high.some((r) => r.type === 'migration')) questions.push('Есть ли rollback-план для миграции?')
  if (mergeStatus?.has_conflicts) questions.push('PR имеет конфликты — требуется rebase перед мерджем.')
  if (!hasTests && additions > 50) questions.push('Нет тестов на новый код — добавить?')

  return {
    ok: true,
    data: {
      owner, repo, number,
      readOnly: true,
      summary: `${files.length} файлов, +${additions}/-${deletions}, области: ${areas.join(', ') || '(none)'}`,
      files,
      risks,
      hasTests,
      mergeStatus,
      verdict,
      questions,
    },
  }
}
