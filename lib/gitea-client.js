export function normalizeBaseUrl(url) {
  const s = String(url || '').trim()
  if (!s) return ''
  return s.replace(/\/+$/, '')
}

function enc(segment) {
  const s = String(segment ?? '')
  if (!s || s === '.' || s === '..' || /[\\/\0]/.test(s) || !/^[A-Za-z0-9._-]+$/.test(s)) {
    return null
  }
  return encodeURIComponent(s)
}

function reposPath(owner, repo, suffix = '') {
  const o = enc(owner)
  const r = enc(repo)
  if (!o || !r) return null
  return `/repos/${o}/${r}${suffix}`
}

function issuePath(owner, repo, number, suffix = '') {
  const base = reposPath(owner, repo)
  const n = enc(number)
  if (!base || !n) return null
  return `${base}/issues/${n}${suffix}`
}

function pullPath(owner, repo, number, suffix = '') {
  const base = reposPath(owner, repo)
  const n = enc(number)
  if (!base || !n) return null
  return `${base}/pulls/${n}${suffix}`
}

function badSegment() {
  return Promise.resolve({ ok: false, status: 0, error: 'invalid owner, repo, or number' })
}

export class GiteaClient {
  constructor({ baseUrl, token, fetchImpl = fetch, timeoutMs = 30_000 } = {}) {
    this.baseUrl = normalizeBaseUrl(baseUrl)
    this.apiRoot = this.baseUrl ? `${this.baseUrl}/api/v1` : ''
    this.token = token
    this.fetchImpl = fetchImpl
    this.timeoutMs = timeoutMs
  }

  async request(method, path, { query, body } = {}) {
    const headers = {
      Accept: 'application/json',
      Authorization: `token ${this.token}`,
    }
    const init = { method, headers }
    if (body !== undefined) {
      headers['Content-Type'] = 'application/json'
      init.body = JSON.stringify(body)
    }
    if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
      init.signal = AbortSignal.timeout(this.timeoutMs)
    }

    try {
      const url = new URL(`${this.apiRoot}${path}`)
      if (query) {
        for (const [key, value] of Object.entries(query)) {
          if (value !== undefined && value !== null) {
            url.searchParams.set(key, String(value))
          }
        }
      }

      const response = await this.fetchImpl(url.toString(), init)
      let data
      try {
        if (typeof response.json === 'function') {
          data = await response.json()
        } else if (typeof response.text === 'function') {
          const text = await response.text()
          data = text ? JSON.parse(text) : undefined
        }
      } catch {
        data = undefined
      }
      if (!response.ok) {
        return {
          ok: false,
          status: response.status,
          data,
          error: data?.message || data?.error || `HTTP ${response.status}`,
        }
      }
      return { ok: true, status: response.status, data }
    } catch (err) {
      return {
        ok: false,
        status: 0,
        error: err?.message || String(err),
      }
    }
  }

  createIssue(owner, repo, body) {
    const path = reposPath(owner, repo, '/issues')
    if (!path) return badSegment()
    return this.request('POST', path, { body })
  }

  listIssues(owner, repo, query = {}) {
    const path = reposPath(owner, repo, '/issues')
    if (!path) return badSegment()
    return this.request('GET', path, { query })
  }

  getIssue(owner, repo, number) {
    const path = issuePath(owner, repo, number)
    if (!path) return badSegment()
    return this.request('GET', path)
  }

  commentIssue(owner, repo, number, body) {
    const path = issuePath(owner, repo, number, '/comments')
    if (!path) return badSegment()
    return this.request('POST', path, { body: { body } })
  }

  closeIssue(owner, repo, number) {
    const path = issuePath(owner, repo, number)
    if (!path) return badSegment()
    return this.request('PATCH', path, { body: { state: 'closed' } })
  }

  createPull(owner, repo, body) {
    const path = reposPath(owner, repo, '/pulls')
    if (!path) return badSegment()
    return this.request('POST', path, { body })
  }

  listPulls(owner, repo, query = {}) {
    const path = reposPath(owner, repo, '/pulls')
    if (!path) return badSegment()
    return this.request('GET', path, { query })
  }

  getPull(owner, repo, number) {
    const path = pullPath(owner, repo, number)
    if (!path) return badSegment()
    return this.request('GET', path)
  }

  mergePull(owner, repo, number, body) {
    const path = pullPath(owner, repo, number, '/merge')
    if (!path) return badSegment()
    return this.request('POST', path, { body })
  }

  searchRepos(query = {}) {
    return this.request('GET', '/repos/search', { query })
  }
}
