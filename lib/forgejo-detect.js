/**
 * forgejo-detect: detects instance flavor (gitea/forgejo) via
 * GET /api/v1/version and returns flavor compatibility notes.
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
    notes.push('Gitea Actions may be absent or differ — CI tools may not work.')
    notes.push('Webhook format and headers may differ (X-Forgejo-* instead of X-Gitea-*).')
  } else if (flavor === 'gitea') {
    notes.push('Full support for Gitea Actions and X-Gitea-* webhooks.')
  } else {
    notes.push('Could not detect instance flavor.')
  }
  return { ok: true, data: { flavor, version, notes } }
}
