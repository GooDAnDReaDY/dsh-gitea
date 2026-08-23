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
