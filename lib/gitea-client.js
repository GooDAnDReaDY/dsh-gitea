import { retryWithBackoff } from './retry.js'

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
  constructor({ baseUrl, token, fetchImpl = fetch, timeoutMs = 30_000, retries = 1, retryDelayMs = 300 } = {}) {
    this.baseUrl = normalizeBaseUrl(baseUrl)
    this.apiRoot = this.baseUrl ? `${this.baseUrl}/api/v1` : ''
    this.token = token
    this.fetchImpl = fetchImpl
    this.timeoutMs = timeoutMs
    this.retries = retries
    this.retryDelayMs = retryDelayMs
    this.rateLimitRemaining = null
    this.lastRequestMs = 0
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

    const attempt = async () => {
      try {
        const url = new URL(`${this.apiRoot}${path}`)
        if (query) {
          for (const [key, value] of Object.entries(query)) {
            if (value !== undefined && value !== null) {
              url.searchParams.set(key, String(value))
            }
          }
        }

        const startedAt = Date.now()
        const response = await this.fetchImpl(url.toString(), init)
        this.lastRequestMs = Date.now() - startedAt
        const rlHeader = response.headers && (response.headers.get ? response.headers.get('x-ratelimit-remaining') : null)
        if (rlHeader != null) this.rateLimitRemaining = Number(rlHeader)
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

    return retryWithBackoff(attempt, {
      retries: this.retries,
      baseDelayMs: this.retryDelayMs,
    })
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

  updateIssue(owner, repo, number, body) {
    const path = issuePath(owner, repo, number)
    if (!path) return badSegment()
    return this.request('PATCH', path, { body })
  }

  searchIssues(query = {}) {
    return this.request('GET', '/search/issues', { query })
  }

  listLabels(owner, repo, query = {}) {
    const path = reposPath(owner, repo, '/labels')
    if (!path) return badSegment()
    return this.request('GET', path, { query })
  }

  createLabel(owner, repo, body) {
    const path = reposPath(owner, repo, '/labels')
    if (!path) return badSegment()
    return this.request('POST', path, { body })
  }

  deleteLabel(owner, repo, labelId) {
    const path = reposPath(owner, repo, `/labels/${enc(labelId)}`)
    if (!path) return badSegment()
    return this.request('DELETE', path)
  }

  setIssueLabels(owner, repo, number, labelIds) {
    const path = issuePath(owner, repo, number, '/labels')
    if (!path) return badSegment()
    return this.request('PUT', path, { body: { labels: labelIds } })
  }

  addIssueLabels(owner, repo, number, labelIds) {
    const path = issuePath(owner, repo, number, '/labels')
    if (!path) return badSegment()
    return this.request('POST', path, { body: { labels: labelIds } })
  }

  listMilestones(owner, repo, query = {}) {
    const path = reposPath(owner, repo, '/milestones')
    if (!path) return badSegment()
    return this.request('GET', path, { query })
  }

  createMilestone(owner, repo, body) {
    const path = reposPath(owner, repo, '/milestones')
    if (!path) return badSegment()
    return this.request('POST', path, { body })
  }

  setIssueAssignee(owner, repo, number, assignee) {
    const path = issuePath(owner, repo, number)
    if (!path) return badSegment()
    return this.request('PATCH', path, { body: { assignee } })
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

  listPullFiles(owner, repo, number, query = {}) {
    const path = pullPath(owner, repo, number, '/files')
    if (!path) return badSegment()
    return this.request('GET', path, { query })
  }

  listPullReviews(owner, repo, number, query = {}) {
    const path = pullPath(owner, repo, number, '/reviews')
    if (!path) return badSegment()
    return this.request('GET', path, { query })
  }

  submitPullReview(owner, repo, number, body) {
    const path = pullPath(owner, repo, number, '/reviews')
    if (!path) return badSegment()
    return this.request('POST', path, { body })
  }

  createPullComment(owner, repo, number, body) {
    const path = pullPath(owner, repo, number, '/comments')
    if (!path) return badSegment()
    return this.request('POST', path, { body })
  }

  getPullMergeStatus(owner, repo, number) {
    const path = pullPath(owner, repo, number, '/merge')
    if (!path) return badSegment()
    return this.request('GET', path)
  }

  searchRepos(query = {}) {
    return this.request('GET', '/repos/search', { query })
  }

  searchCode(owner, repo, query = {}) {
    const path = reposPath(owner, repo, '/search/code')
    if (!path) return badSegment()
    return this.request('GET', path, { query })
  }

  getContents(owner, repo, filePath, query = {}) {
    const o = enc(owner)
    const r = enc(repo)
    if (!o || !r) return badSegment()
    const raw = String(filePath || '').replace(/\\/g, '/').replace(/^\/+/, '')
    if (!raw) return badSegment()
    const p = raw.split('/').map(encodeURIComponent).join('/')
    return this.request('GET', `/repos/${o}/${r}/contents/${p}`, { query })
  }

  listBranches(owner, repo, query = {}) {
    const path = reposPath(owner, repo, '/branches')
    if (!path) return badSegment()
    return this.request('GET', path, { query })
  }

  listCommits(owner, repo, query = {}) {
    const path = reposPath(owner, repo, '/commits')
    if (!path) return badSegment()
    return this.request('GET', path, { query })
  }

  compareCommits(owner, repo, range) {
    const o = enc(owner)
    const r = enc(repo)
    const rg = String(range || '').trim()
    if (!o || !r || !rg) return badSegment()
    // keep slashes in the range (branch names can contain them); encode the rest
    const encoded = rg.split('/').map(encodeURIComponent).join('/')
    return this.request('GET', `/repos/${o}/${r}/compare/${encoded}`)
  }

  listTags(owner, repo, query = {}) {
    const path = reposPath(owner, repo, '/tags')
    if (!path) return badSegment()
    return this.request('GET', path, { query })
  }

  listReleases(owner, repo, query = {}) {
    const path = reposPath(owner, repo, '/releases')
    if (!path) return badSegment()
    return this.request('GET', path, { query })
  }

  createRelease(owner, repo, body) {
    const path = reposPath(owner, repo, '/releases')
    if (!path) return badSegment()
    return this.request('POST', path, { body })
  }

  deleteRelease(owner, repo, releaseId) {
    const path = reposPath(owner, repo, `/releases/${enc(releaseId)}`)
    if (!path) return badSegment()
    return this.request('DELETE', path)
  }

  updateRelease(owner, repo, releaseId, body) {
    const path = reposPath(owner, repo, `/releases/${enc(releaseId)}`)
    if (!path) return badSegment()
    return this.request('PATCH', path, { body })
  }

  listWebhooks(owner, repo, query = {}) {
    const path = reposPath(owner, repo, '/hooks')
    if (!path) return badSegment()
    return this.request('GET', path, { query })
  }

  createWebhook(owner, repo, body) {
    const path = reposPath(owner, repo, '/hooks')
    if (!path) return badSegment()
    return this.request('POST', path, { body })
  }

  deleteWebhook(owner, repo, hookId) {
    const path = reposPath(owner, repo, `/hooks/${enc(hookId)}`)
    if (!path) return badSegment()
    return this.request('DELETE', path)
  }

  listWikiPages(owner, repo, query = {}) {
    const path = reposPath(owner, repo, '/wiki/pages')
    if (!path) return badSegment()
    return this.request('GET', path, { query })
  }

  getWikiPage(owner, repo, pageName) {
    const path = reposPath(owner, repo, `/wiki/page/${encodeURIComponent(String(pageName))}`)
    if (!path) return badSegment()
    return this.request('GET', path)
  }

  updateMilestone(owner, repo, milestoneId, body) {
    const path = reposPath(owner, repo, `/milestones/${enc(milestoneId)}`)
    if (!path) return badSegment()
    return this.request('PATCH', path, { body })
  }

  deleteMilestone(owner, repo, milestoneId) {
    const path = reposPath(owner, repo, `/milestones/${enc(milestoneId)}`)
    if (!path) return badSegment()
    return this.request('DELETE', path)
  }

  listOrgRepos(org, query = {}) {
    const o = enc(org)
    if (!o) return badSegment()
    return this.request('GET', `/orgs/${o}/repos`, { query })
  }

  listOrgMembers(org, query = {}) {
    const o = enc(org)
    if (!o) return badSegment()
    return this.request('GET', `/orgs/${o}/members`, { query })
  }

  listNotifications(query = {}) {
    return this.request('GET', '/notifications', { query })
  }

  markNotificationsRead(query = {}) {
    return this.request('PUT', '/notifications/mark-read', { query })
  }

  listActionsRuns(owner, repo, query = {}) {
    const path = reposPath(owner, repo, '/actions/runs')
    if (!path) return badSegment()
    return this.request('GET', path, { query })
  }

  getActionsRun(owner, repo, runId) {
    const path = reposPath(owner, repo, `/actions/runs/${enc(runId)}`)
    if (!path) return badSegment()
    return this.request('GET', path)
  }

  listRunJobs(owner, repo, runId, query = {}) {
    const path = reposPath(owner, repo, `/actions/runs/${enc(runId)}/jobs`)
    if (!path) return badSegment()
    return this.request('GET', path, { query })
  }

  getJobLogs(owner, repo, jobId) {
    const path = reposPath(owner, repo, `/actions/jobs/${enc(jobId)}/logs`)
    if (!path) return badSegment()
    return this.request('GET', path)
  }

  rerunActionsJob(owner, repo, jobId) {
    const path = reposPath(owner, repo, `/actions/jobs/${enc(jobId)}/rerun`)
    if (!path) return badSegment()
    return this.request('POST', path)
  }

  searchUsers(query = {}) {
    return this.request('GET', '/users/search', { query })
  }

  listUserOrgs(query = {}) {
    return this.request('GET', '/user/orgs', { query })
  }

  listOrgTeams(org, query = {}) {
    const o = enc(org)
    if (!o) return badSegment()
    return this.request('GET', `/orgs/${o}/teams`, { query })
  }

  getRepo(owner, repo) {
    const path = reposPath(owner, repo, '')
    if (!path) return badSegment()
    return this.request('GET', path)
  }

  createRepo(body) {
    return this.request('POST', '/user/repos', { body })
  }

  createOrgRepo(org, body) {
    const o = enc(org)
    if (!o) return badSegment()
    return this.request('POST', `/orgs/${o}/repos`, { body })
  }

  createBranch(owner, repo, body) {
    const path = reposPath(owner, repo, '/branches')
    if (!path) return badSegment()
    return this.request('POST', path, { body })
  }

  deleteBranch(owner, repo, branch) {
    const path = reposPath(owner, repo, `/branches/${encodeURIComponent(String(branch))}`)
    if (!path) return badSegment()
    return this.request('DELETE', path)
  }

  createTag(owner, repo, body) {
    const path = reposPath(owner, repo, '/tags')
    if (!path) return badSegment()
    return this.request('POST', path, { body })
  }

  deleteTag(owner, repo, tag) {
    const path = reposPath(owner, repo, `/tags/${encodeURIComponent(String(tag))}`)
    if (!path) return badSegment()
    return this.request('DELETE', path)
  }

  getVersion() {
    return this.request('GET', '/version')
  }

  getUser() {
    return this.request('GET', '/user')
  }
}
