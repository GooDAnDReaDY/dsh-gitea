/**
 * url-safety: нормализация scheme наружных Gitea URL в ответах плагина.
 *
 * Проблема #153: когда DSH Web открыт по HTTPS, а Gitea сконфигурирован
 * с http:// baseUrl, API отдаёт http:// html_url — браузер блокирует
 * встраивание как mixed content.
 *
 * Правила:
 * - никогда не даунгрейдить https -> http;
 * - если DSH на https, а внешний URL http и принадлежит нашему baseUrl —
 *   поднять до https;
 * - если baseUrl http-only под https DSH — отдать предупреждение.
 */

export function normalizeExternalUrl(url = '', { baseUrl = '', dshProtocol = '' } = {}) {
  const text = String(url || '')
  try {
    const parsed = new URL(text, 'http://placeholder.invalid')
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return text
    const dshHttps = String(dshProtocol || '').toLowerCase() === 'https:' ||
      String(dshProtocol || '').toLowerCase() === 'https'
    if (dshHttps && parsed.protocol === 'http:') {
      // поднимаем только если url принадлежит нашему gitea baseUrl
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
