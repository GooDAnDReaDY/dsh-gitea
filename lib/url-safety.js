/**
 * url-safety: normalize schemes of external Gitea URLs in plugin responses.
 * Handles mixed content when DSH is HTTPS and Gitea is HTTP.
 */

export function normalizeExternalUrl(url = '', { baseUrl = '', dshProtocol = '' } = {}) {
  const text = String(url || '')
  try {
    const parsed = new URL(text, 'http://placeholder.invalid')
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return text
    const dshHttps = String(dshProtocol || '').toLowerCase() === 'https:' ||
      String(dshProtocol || '').toLowerCase() === 'https'
    if (dshHttps && parsed.protocol === 'http:') {
      // upgrade only if URL belongs to our Gitea baseUrl
      const base = String(baseUrl || '').replace(/^https?:\/\//, '')
      const host = parsed.host
      if (base && host && host.endsWith(base.replace(/^www\./, ''))) {
        parsed.protocol = 'https:'
      }
    }
    return parsed.toString()
  } catch {
    return text
  }
}

export function schemeWarning(baseUrl = '', dshProtocol = '') {
  const base = String(baseUrl || '')
  const dshHttps = String(dshProtocol || '').toLowerCase().startsWith('https')
  if (dshHttps && /^http:\/\//i.test(base)) {
    return 'Gitea endpoint is HTTP but DSH is served over HTTPS — embedded Gitea pages will be blocked by the browser (mixed content). Configure an HTTPS endpoint or reverse proxy for Gitea, or open DSH over HTTP.'
  }
  return ''
}
