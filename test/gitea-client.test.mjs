import { test } from 'node:test'
import assert from 'node:assert/strict'
import { normalizeBaseUrl, GiteaClient } from '../lib/gitea-client.js'

test('normalizeBaseUrl: empty returns empty string', () => {
  assert.equal(normalizeBaseUrl(''), '')
  assert.equal(normalizeBaseUrl(null), '')
  assert.equal(normalizeBaseUrl(undefined), '')
})

test('normalizeBaseUrl: strips trailing slashes', () => {
  assert.equal(normalizeBaseUrl('https://gitea.example.com/'), 'https://gitea.example.com')
  assert.equal(normalizeBaseUrl('https://gitea.example.com///'), 'https://gitea.example.com')
})

test('createIssue POSTs correct URL with Authorization header', async () => {
  let capturedUrl
  let capturedInit
  const fetchImpl = async (url, init) => {
    capturedUrl = url
    capturedInit = init
    return {
      ok: true,
      status: 201,
      json: async () => ({ id: 1, title: 'Bug' }),
    }
  }

  const client = new GiteaClient({
    baseUrl: 'https://gitea.example.com/',
    token: 't-test',
    fetchImpl,
  })

  const result = await client.createIssue('acme', 'app', { title: 'Bug', body: 'details' })

  assert.equal(capturedUrl, 'https://gitea.example.com/api/v1/repos/acme/app/issues')
  assert.equal(capturedInit.method, 'POST')
  assert.equal(capturedInit.headers.Authorization, 'token t-test')
  assert.equal(capturedInit.headers.Accept, 'application/json')
  assert.equal(capturedInit.headers['Content-Type'], 'application/json')
  assert.deepEqual(JSON.parse(capturedInit.body), { title: 'Bug', body: 'details' })
  assert.equal(result.ok, true)
  assert.equal(result.status, 201)
  assert.deepEqual(result.data, { id: 1, title: 'Bug' })
})

test('404 returns {ok:false} without throwing', async () => {
  const fetchImpl = async () => ({
    ok: false,
    status: 404,
    json: async () => ({ message: 'Not Found' }),
  })

  const client = new GiteaClient({
    baseUrl: 'https://gitea.example.com',
    token: 't-test',
    fetchImpl,
  })

  const result = await client.getIssue('acme', 'app', 99)
  assert.equal(result.ok, false)
  assert.equal(result.status, 404)
})

test('mergePull POSTs merge endpoint with Do squash', async () => {
  let capturedUrl
  let capturedInit
  const fetchImpl = async (url, init) => {
    capturedUrl = url
    capturedInit = init
    return {
      ok: true,
      status: 200,
      json: async () => ({ merged: true }),
    }
  }

  const client = new GiteaClient({
    baseUrl: 'https://gitea.example.com',
    token: 't-test',
    fetchImpl,
  })

  const result = await client.mergePull('acme', 'app', 3, { Do: 'squash' })

  assert.equal(capturedUrl, 'https://gitea.example.com/api/v1/repos/acme/app/pulls/3/merge')
  assert.equal(capturedInit.method, 'POST')
  assert.deepEqual(JSON.parse(capturedInit.body), { Do: 'squash' })
  assert.equal(result.ok, true)
})

test('network error returns {ok:false, status:0}', async () => {
  const fetchImpl = async () => {
    throw new Error('network down')
  }

  const client = new GiteaClient({
    baseUrl: 'https://gitea.example.com',
    token: 't-test',
    fetchImpl,
  })

  const result = await client.listIssues('acme', 'app')
  assert.equal(result.ok, false)
  assert.equal(result.status, 0)
  assert.match(result.error, /network down/)
})

test('malformed baseUrl without scheme returns {ok:false} without throwing', async () => {
  const fetchImpl = async () => {
    throw new Error('fetch should not be called')
  }

  const client = new GiteaClient({
    baseUrl: 'gitea.example.com',
    token: 't-test',
    fetchImpl,
  })

  const result = await client.listIssues('acme', 'app')
  assert.equal(result.ok, false)
  assert.equal(result.status, 0)
  assert.match(result.error, /Invalid URL/i)
})

test('owner with slash is rejected before fetch', async () => {
  let called = false
  const fetchImpl = async () => {
    called = true
    return { ok: true, status: 200, json: async () => ([]) }
  }
  const client = new GiteaClient({
    baseUrl: 'https://gitea.example.com',
    token: 't-test',
    fetchImpl,
  })
  const result = await client.listIssues('../admin', 'app')
  assert.equal(called, false)
  assert.equal(result.ok, false)
  assert.match(result.error, /invalid/)
})

test('owner .. is rejected and does not escape repos prefix', async () => {
  let capturedUrl
  const fetchImpl = async (url) => {
    capturedUrl = url
    return { ok: true, status: 200, json: async () => ([]) }
  }
  const client = new GiteaClient({
    baseUrl: 'https://gitea.example.com',
    token: 't-test',
    fetchImpl,
  })
  const result = await client.listIssues('..', 'admin')
  assert.equal(result.ok, false)
  assert.equal(capturedUrl, undefined)
  assert.match(result.error, /invalid/)
})

// ---- #16 issue governance: update, search, labels, milestones, assignees ----

test('updateIssue PATCHes issue endpoint with partial body', async () => {
  let capturedUrl, capturedInit
  const fetchImpl = async (url, init) => {
    capturedUrl = url
    capturedInit = init
    return { ok: true, status: 200, json: async () => ({ id: 3, title: 'Updated' }) }
  }
  const client = new GiteaClient({ baseUrl: 'https://gitea.example.com', token: 't-test', fetchImpl })
  const result = await client.updateIssue('acme', 'app', 3, { title: 'Updated', state: 'closed' })
  assert.equal(capturedUrl, 'https://gitea.example.com/api/v1/repos/acme/app/issues/3')
  assert.equal(capturedInit.method, 'PATCH')
  assert.deepEqual(JSON.parse(capturedInit.body), { title: 'Updated', state: 'closed' })
  assert.equal(result.ok, true)
})

test('searchIssues GETs /search/issues with repo and query', async () => {
  let capturedUrl
  const fetchImpl = async (url) => {
    capturedUrl = url
    return { ok: true, status: 200, json: async () => ({ data: [] }) }
  }
  const client = new GiteaClient({ baseUrl: 'https://gitea.example.com', token: 't-test', fetchImpl })
  const result = await client.searchIssues({ q: 'bug', repo: 'acme/app', limit: 5 })
  assert.ok(capturedUrl.startsWith('https://gitea.example.com/api/v1/search/issues'))
  assert.ok(capturedUrl.includes('q=bug'))
  assert.ok(capturedUrl.includes('repo=acme%2Fapp'))
  assert.equal(result.ok, true)
})

test('listLabels GETs labels endpoint', async () => {
  let capturedUrl
  const fetchImpl = async (url) => {
    capturedUrl = url
    return { ok: true, status: 200, json: async () => [{ id: 1, name: 'type/bug' }] }
  }
  const client = new GiteaClient({ baseUrl: 'https://gitea.example.com', token: 't-test', fetchImpl })
  const result = await client.listLabels('acme', 'app')
  assert.equal(capturedUrl, 'https://gitea.example.com/api/v1/repos/acme/app/labels')
  assert.equal(result.ok, true)
})

test('createLabel POSTs labels endpoint', async () => {
  let capturedInit
  const fetchImpl = async (url, init) => {
    capturedInit = init
    return { ok: true, status: 201, json: async () => ({ id: 9, name: 'priority/H' }) }
  }
  const client = new GiteaClient({ baseUrl: 'https://gitea.example.com', token: 't-test', fetchImpl })
  const result = await client.createLabel('acme', 'app', { name: 'priority/H', color: 'd93f0b' })
  assert.equal(capturedInit.method, 'POST')
  assert.deepEqual(JSON.parse(capturedInit.body), { name: 'priority/H', color: 'd93f0b' })
  assert.equal(result.ok, true)
})

test('deleteLabel DELETEs labels endpoint', async () => {
  let capturedInit
  const fetchImpl = async (url, init) => {
    capturedInit = init
    return { ok: true, status: 204, json: async () => ({}) }
  }
  const client = new GiteaClient({ baseUrl: 'https://gitea.example.com', token: 't-test', fetchImpl })
  const result = await client.deleteLabel('acme', 'app', 9)
  assert.equal(capturedInit.method, 'DELETE')
  assert.equal(result.ok, true)
})

test('setIssueLabels PUTs labels on issue', async () => {
  let capturedUrl, capturedInit
  const fetchImpl = async (url, init) => {
    capturedUrl = url
    capturedInit = init
    return { ok: true, status: 200, json: async () => [{ id: 1, name: 'type/bug' }] }
  }
  const client = new GiteaClient({ baseUrl: 'https://gitea.example.com', token: 't-test', fetchImpl })
  const result = await client.setIssueLabels('acme', 'app', 3, [1, 2])
  assert.equal(capturedUrl, 'https://gitea.example.com/api/v1/repos/acme/app/issues/3/labels')
  assert.equal(capturedInit.method, 'PUT')
  assert.deepEqual(JSON.parse(capturedInit.body), { labels: [1, 2] })
  assert.equal(result.ok, true)
})

test('listMilestones GETs milestones endpoint', async () => {
  let capturedUrl
  const fetchImpl = async (url) => {
    capturedUrl = url
    return { ok: true, status: 200, json: async () => [{ id: 5, title: 'v0.3' }] }
  }
  const client = new GiteaClient({ baseUrl: 'https://gitea.example.com', token: 't-test', fetchImpl })
  const result = await client.listMilestones('acme', 'app')
  assert.equal(capturedUrl, 'https://gitea.example.com/api/v1/repos/acme/app/milestones')
  assert.equal(result.ok, true)
})

test('createMilestone POSTs milestones endpoint', async () => {
  let capturedInit
  const fetchImpl = async (url, init) => {
    capturedInit = init
    return { ok: true, status: 201, json: async () => ({ id: 5, title: 'v0.3' }) }
  }
  const client = new GiteaClient({ baseUrl: 'https://gitea.example.com', token: 't-test', fetchImpl })
  const result = await client.createMilestone('acme', 'app', { title: 'v0.3' })
  assert.equal(capturedInit.method, 'POST')
  assert.deepEqual(JSON.parse(capturedInit.body), { title: 'v0.3' })
  assert.equal(result.ok, true)
})

test('setIssueAssignee PATCHes assignee on issue', async () => {
  let capturedUrl, capturedInit
  const fetchImpl = async (url, init) => {
    capturedUrl = url
    capturedInit = init
    return { ok: true, status: 200, json: async () => ({ id: 3, assignee: { login: 'claude' } }) }
  }
  const client = new GiteaClient({ baseUrl: 'https://gitea.example.com', token: 't-test', fetchImpl })
  const result = await client.setIssueAssignee('acme', 'app', 3, 'claude')
  assert.equal(capturedUrl, 'https://gitea.example.com/api/v1/repos/acme/app/issues/3')
  assert.equal(capturedInit.method, 'PATCH')
  assert.deepEqual(JSON.parse(capturedInit.body), { assignee: 'claude' })
  assert.equal(result.ok, true)
})

// ---- #17 PR files, reviews, line comments, merge status ----

test('listPullFiles GETs pulls/{n}/files', async () => {
  let capturedUrl
  const fetchImpl = async (url) => {
    capturedUrl = url
    return { ok: true, status: 200, json: async () => [{ filename: 'lib/a.js', additions: 3, deletions: 1 }] }
  }
  const client = new GiteaClient({ baseUrl: 'https://gitea.example.com', token: 't-test', fetchImpl })
  const result = await client.listPullFiles('acme', 'app', 5)
  assert.equal(capturedUrl, 'https://gitea.example.com/api/v1/repos/acme/app/pulls/5/files')
  assert.equal(result.ok, true)
  assert.equal(result.data[0].filename, 'lib/a.js')
})

test('listPullReviews GETs pulls/{n}/reviews', async () => {
  let capturedUrl
  const fetchImpl = async (url) => {
    capturedUrl = url
    return { ok: true, status: 200, json: async () => [{ id: 1, state: 'APPROVED' }] }
  }
  const client = new GiteaClient({ baseUrl: 'https://gitea.example.com', token: 't-test', fetchImpl })
  const result = await client.listPullReviews('acme', 'app', 5)
  assert.equal(capturedUrl, 'https://gitea.example.com/api/v1/repos/acme/app/pulls/5/reviews')
  assert.equal(result.ok, true)
})

test('submitPullReview POSTs pulls/{n}/reviews', async () => {
  let capturedInit
  const fetchImpl = async (url, init) => {
    capturedInit = init
    return { ok: true, status: 201, json: async () => ({ id: 1, state: 'APPROVED' }) }
  }
  const client = new GiteaClient({ baseUrl: 'https://gitea.example.com', token: 't-test', fetchImpl })
  const result = await client.submitPullReview('acme', 'app', 5, { event: 'APPROVED', body: 'ok' })
  assert.equal(capturedInit.method, 'POST')
  assert.deepEqual(JSON.parse(capturedInit.body), { event: 'APPROVED', body: 'ok' })
  assert.equal(result.ok, true)
})

test('createPullComment POSTs pulls/{n}/comments for line comment', async () => {
  let capturedUrl, capturedInit
  const fetchImpl = async (url, init) => {
    capturedUrl = url
    capturedInit = init
    return { ok: true, status: 201, json: async () => ({ id: 2 }) }
  }
  const client = new GiteaClient({ baseUrl: 'https://gitea.example.com', token: 't-test', fetchImpl })
  const result = await client.createPullComment('acme', 'app', 5, { body: 'nit', path: 'lib/a.js', line: 3 })
  assert.equal(capturedUrl, 'https://gitea.example.com/api/v1/repos/acme/app/pulls/5/comments')
  assert.equal(capturedInit.method, 'POST')
  assert.deepEqual(JSON.parse(capturedInit.body), { body: 'nit', path: 'lib/a.js', line: 3 })
  assert.equal(result.ok, true)
})

test('getPullMergeStatus GETs pulls/{n}/merge', async () => {
  let capturedUrl
  const fetchImpl = async (url) => {
    capturedUrl = url
    return { ok: true, status: 204, json: async () => ({}) }
  }
  const client = new GiteaClient({ baseUrl: 'https://gitea.example.com', token: 't-test', fetchImpl })
  const result = await client.getPullMergeStatus('acme', 'app', 5)
  assert.equal(capturedUrl, 'https://gitea.example.com/api/v1/repos/acme/app/pulls/5/merge')
  assert.equal(result.ok, true)
})

// ---- #18 contents, branches, commits, compare, tags ----

test('getContents GETs repos/{o}/{r}/contents/{path}', async () => {
  let capturedUrl
  const fetchImpl = async (url) => {
    capturedUrl = url
    return { ok: true, status: 200, json: async () => ({ name: 'README.md', content: 'base64' }) }
  }
  const client = new GiteaClient({ baseUrl: 'https://gitea.example.com', token: 't-test', fetchImpl })
  const result = await client.getContents('acme', 'app', 'README.md')
  assert.equal(capturedUrl, 'https://gitea.example.com/api/v1/repos/acme/app/contents/README.md')
  assert.equal(result.ok, true)
})

test('listBranches GETs repos/{o}/{r}/branches', async () => {
  let capturedUrl
  const fetchImpl = async (url) => {
    capturedUrl = url
    return { ok: true, status: 200, json: async () => [{ name: 'main' }] }
  }
  const client = new GiteaClient({ baseUrl: 'https://gitea.example.com', token: 't-test', fetchImpl })
  const result = await client.listBranches('acme', 'app')
  assert.equal(capturedUrl, 'https://gitea.example.com/api/v1/repos/acme/app/branches')
  assert.equal(result.ok, true)
})

test('listCommits GETs repos/{o}/{r}/commits', async () => {
  let capturedUrl
  const fetchImpl = async (url) => {
    capturedUrl = url
    return { ok: true, status: 200, json: async () => [{ sha: 'abc', commit: { message: 'x' } }] }
  }
  const client = new GiteaClient({ baseUrl: 'https://gitea.example.com', token: 't-test', fetchImpl })
  const result = await client.listCommits('acme', 'app')
  assert.equal(capturedUrl, 'https://gitea.example.com/api/v1/repos/acme/app/commits')
  assert.equal(result.ok, true)
})

test('compareCommits GETs compare endpoint', async () => {
  let capturedUrl
  const fetchImpl = async (url) => {
    capturedUrl = url
    return { ok: true, status: 200, json: async () => ({ commits: [], total: 0 }) }
  }
  const client = new GiteaClient({ baseUrl: 'https://gitea.example.com', token: 't-test', fetchImpl })
  const result = await client.compareCommits('acme', 'app', 'main...feat/x')
  assert.equal(capturedUrl, 'https://gitea.example.com/api/v1/repos/acme/app/compare/main...feat/x')
  assert.equal(result.ok, true)
})

test('listTags GETs repos/{o}/{r}/tags', async () => {
  let capturedUrl
  const fetchImpl = async (url) => {
    capturedUrl = url
    return { ok: true, status: 200, json: async () => [{ name: 'v0.2.12' }] }
  }
  const client = new GiteaClient({ baseUrl: 'https://gitea.example.com', token: 't-test', fetchImpl })
  const result = await client.listTags('acme', 'app')
  assert.equal(capturedUrl, 'https://gitea.example.com/api/v1/repos/acme/app/tags')
  assert.equal(result.ok, true)
})

// ---- #19 releases, wiki, org repos, notifications ----

test('listReleases GETs repos/{o}/{r}/releases', async () => {
  let capturedUrl
  const fetchImpl = async (url) => {
    capturedUrl = url
    return { ok: true, status: 200, json: async () => [{ id: 1, tag_name: 'v0.2.12' }] }
  }
  const client = new GiteaClient({ baseUrl: 'https://gitea.example.com', token: 't-test', fetchImpl })
  const result = await client.listReleases('acme', 'app')
  assert.equal(capturedUrl, 'https://gitea.example.com/api/v1/repos/acme/app/releases')
  assert.equal(result.ok, true)
})

test('createRelease POSTs releases endpoint', async () => {
  let capturedInit
  const fetchImpl = async (url, init) => {
    capturedInit = init
    return { ok: true, status: 201, json: async () => ({ id: 1, tag_name: 'v0.3.0' }) }
  }
  const client = new GiteaClient({ baseUrl: 'https://gitea.example.com', token: 't-test', fetchImpl })
  const result = await client.createRelease('acme', 'app', { tag_name: 'v0.3.0', name: 'v0.3.0' })
  assert.equal(capturedInit.method, 'POST')
  assert.deepEqual(JSON.parse(capturedInit.body), { tag_name: 'v0.3.0', name: 'v0.3.0' })
  assert.equal(result.ok, true)
})

test('deleteRelease DELETEs release endpoint', async () => {
  let capturedInit
  const fetchImpl = async (url, init) => {
    capturedInit = init
    return { ok: true, status: 204, json: async () => ({}) }
  }
  const client = new GiteaClient({ baseUrl: 'https://gitea.example.com', token: 't-test', fetchImpl })
  const result = await client.deleteRelease('acme', 'app', 7)
  assert.equal(capturedInit.method, 'DELETE')
  assert.equal(result.ok, true)
})

test('listWikiPages GETs wiki pages', async () => {
  let capturedUrl
  const fetchImpl = async (url) => {
    capturedUrl = url
    return { ok: true, status: 200, json: async () => [{ pageName: 'Home' }] }
  }
  const client = new GiteaClient({ baseUrl: 'https://gitea.example.com', token: 't-test', fetchImpl })
  const result = await client.listWikiPages('acme', 'app')
  assert.equal(capturedUrl, 'https://gitea.example.com/api/v1/repos/acme/app/wiki/pages')
  assert.equal(result.ok, true)
})

test('listOrgRepos GETs orgs/{org}/repos', async () => {
  let capturedUrl
  const fetchImpl = async (url) => {
    capturedUrl = url
    return { ok: true, status: 200, json: async () => [{ name: 'dsh-gitea' }] }
  }
  const client = new GiteaClient({ baseUrl: 'https://gitea.example.com', token: 't-test', fetchImpl })
  const result = await client.listOrgRepos('goodandready')
  assert.equal(capturedUrl, 'https://gitea.example.com/api/v1/orgs/goodandready/repos')
  assert.equal(result.ok, true)
})

test('listNotifications GETs notifications', async () => {
  let capturedUrl
  const fetchImpl = async (url) => {
    capturedUrl = url
    return { ok: true, status: 200, json: async () => [{ id: 1, subject: { title: 'x' } }] }
  }
  const client = new GiteaClient({ baseUrl: 'https://gitea.example.com', token: 't-test', fetchImpl })
  const result = await client.listNotifications()
  assert.equal(capturedUrl, 'https://gitea.example.com/api/v1/notifications')
  assert.equal(result.ok, true)
})

// ---- #99 org members ----

test('listOrgMembers GETs orgs/{org}/members', async () => {
  let capturedUrl
  const fetchImpl = async (url) => {
    capturedUrl = url
    return { ok: true, status: 200, json: async () => [{ id: 1, login: 'alice' }] }
  }
  const client = new GiteaClient({ baseUrl: 'https://gitea.example.com', token: 't-test', fetchImpl })
  const result = await client.listOrgMembers('goodandready')
  assert.equal(capturedUrl, 'https://gitea.example.com/api/v1/orgs/goodandready/members')
  assert.equal(result.ok, true)
  assert.equal(result.data[0].login, 'alice')
})

// ---- #100 notifications mark read ----

test('markNotificationsRead POSTs /notifications/mark-read', async () => {
  let capturedUrl, capturedInit
  const fetchImpl = async (url, init) => {
    capturedUrl = url
    capturedInit = init
    return { ok: true, status: 204, json: async () => ({}) }
  }
  const client = new GiteaClient({ baseUrl: 'https://gitea.example.com', token: 't-test', fetchImpl })
  const result = await client.markNotificationsRead()
  assert.equal(capturedUrl, 'https://gitea.example.com/api/v1/notifications/mark-read')
  assert.equal(capturedInit.method, 'PUT')
  assert.equal(result.ok, true)
})
