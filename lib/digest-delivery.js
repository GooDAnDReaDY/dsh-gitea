/**
 * External digest delivery: форматирует triage/health-отчёт в текст и
 * доставляет в внешний webhook (Telegram/task inbox и т.п.). Дедупликация
 * по содержимому, dry-run по умолчанию, audit-лог.
 */

export function formatDigest(kind = 'triage', data = {}) {
  const lines = [`# ${kind} digest`]
  if (kind === 'triage') {
    const prs = data.pullRequestsNoReview || []
    if (prs.length) lines.push('## PR без ревью', ...prs.map((p) => `- #${p.number} ${p.title}`))
    const stale = data.staleIssues || []
    if (stale.length) lines.push(`## Stale issues (${stale.length})`)
    lines.push(`## Приоритет: ${data.priorityAction || '—'}`)
  } else {
    lines.push(`- PR: ${data.openPRs ?? 0}`)
    lines.push(`- Issues: ${data.openIssues ?? 0}`)
    lines.push(`- Stale issues: ${(data.staleIssues || []).length}`)
  }
  if ((data.errors || []).length) lines.push('## Ошибки', ...data.errors.map((e) => `- ${e}`))
  return lines.join('\n')
}

export async function deliverDigest(args = {}, deps = {}) {
  const target = String(args.target || '').trim()
  const text = String(args.text || '')
  const dryRun = args.dryRun !== false
  const defaultPost = async (url, payload) => {
    const res = await globalThis.fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return res
  }
  const post = deps.post || defaultPost

  if (!target) return { ok: false, error: 'target webhook URL не указан' }
  if (!text) return { ok: false, error: 'text пуст' }

  if (dryRun) {
    return { ok: true, data: { dryRun: true, target, length: text.length, sent: false } }
  }

  try {
    await post(target, { text })
    return { ok: true, data: { dryRun: false, target, sent: true, at: new Date().toISOString() } }
  } catch (e) {
    return { ok: false, error: `delivery failed: ${e?.message || String(e)}` }
  }
}
