export function normalizeBaseUrl(url) {
  const s = String(url || '').trim()
  if (!s) return ''
  return s.replace(/\/+$/, '')
}

function enc(segment) {
  return encodeURIComponent(String(segment))
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
    return this.request('POST', `/repos/${enc(owner)}/${enc(repo)}/issues`, { body })
  }

  listIssues(owner, repo, query = {}) {
    return this.request('GET', `/repos/${enc(owner)}/${enc(repo)}/issues`, { query })
  }

  getIssue(owner, repo, number) {
    return this.request('GET', `/repos/${enc(owner)}/${enc(repo)}/issues/${enc(number)}`)
  }

  commentIssue(owner, repo, number, body) {
    return this.request('POST', `/repos/${enc(owner)}/${enc(repo)}/issues/${enc(number)}/comments`, { body: { body } })
  }

  closeIssue(owner, repo, number) {
    return this.request('PATCH', `/repos/${enc(owner)}/${enc(repo)}/issues/${enc(number)}`, { body: { state: 'closed' } })
  }

  createPull(owner, repo, body) {
    return this.request('POST', `/repos/${enc(owner)}/${enc(repo)}/pulls`, { body })
  }

  listPulls(owner, repo, query = {}) {
    return this.request('GET', `/repos/${enc(owner)}/${enc(repo)}/pulls`, { query })
  }

  getPull(owner, repo, number) {
    return this.request('GET', `/repos/${enc(owner)}/${enc(repo)}/pulls/${enc(number)}`)
  }

  mergePull(owner, repo, number, body) {
    return this.request('POST', `/repos/${enc(owner)}/${enc(repo)}/pulls/${enc(number)}/merge`, { body })
  }

  searchRepos(query = {}) {
    return this.request('GET', '/repos/search', { query })
  }
}
