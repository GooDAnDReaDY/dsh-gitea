/**
 * push-notify: определяет, какое webhook-событие требует push-уведомления
 * (новый PR, упавший CI) и формирует текст. Доставка — через настроенный
 * канал (digestWebhook / messenger), если он есть.
 */

export function shouldNotify(event = {}) {
  if (event.type === 'pull_request' && event.action === 'opened') return true
  if (event.type === 'workflow_run' && event.conclusion === 'failure') return true
  if (event.type === 'actions' && event.conclusion === 'failure') return true
  return false
}

export function buildNotifyMessage(event = {}) {
  const at = String(event.at || '').slice(0, 16).replace('T', ' ')
  if (event.type === 'pull_request') {
    return `[Gitea] Новый PR #${event.number}: ${event.title || ''} (${at}) ${event.url || ''}`.trim()
  }
  if (event.type === 'workflow_run' || event.type === 'actions') {
    return `[Gitea] CI failed: ${event.title || 'workflow'} #${event.number || ''} (${at}) ${event.url || ''}`.trim()
  }
  return ''
}

export async function pushNotify(event = {}, deps = {}) {
  if (!shouldNotify(event)) return { ok: true, data: { notified: false } }
  const text = buildNotifyMessage(event)
  const target = deps.webhookUrl || ''
  if (!target) return { ok: true, data: { notified: false, reason: 'no channel configured' } }
  const { deliverDigest } = await import('./digest-delivery.js')
  const res = await deliverDigest({ target, text, dryRun: false }, {}).catch((e) => ({ ok: false, error: String(e) }))
  return { ok: res.ok, data: { notified: res.ok, error: res.error } }
}
