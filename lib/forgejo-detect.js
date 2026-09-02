/**
 * forgejo-detect: определяет flavor инстанса (gitea/forgejo) через
 * GET /api/v1/version и возвращает заметки о различиях.
 */

export async function detectFlavor(args = {}, deps = {}) {
  const client = deps.client
  if (!client || !client.getVersion) {
    return { ok: true, data: { flavor: 'unknown', notes: [], reason: 'no version endpoint' } }
  }
  const res = await client.getVersion().catch((e) => ({ ok: false, error: String(e) }))
  const version = String(res?.ok ? res.data?.version || '' : '')
  const lower = version.toLowerCase()
  const flavor = lower.includes('forgejo') ? 'forgejo' : (lower ? 'gitea' : 'unknown')

  const notes = []
  if (flavor === 'forgejo') {
    notes.push('Gitea Actions может отсутствовать или отличаться — CI-инструменты могут не работать.')
    notes.push('Webhook-формат и заголовки могут отличаться (X-Forgejo-* вместо X-Gitea-*).')
  } else if (flavor === 'gitea') {
    notes.push('Полная поддержка Gitea Actions и webhook X-Gitea-*')
  } else {
    notes.push('Не удалось определить flavor инстанса.')
  }
  return { ok: true, data: { flavor, version, notes } }
}
