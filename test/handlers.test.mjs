import { test } from 'node:test'
import assert from 'node:assert/strict'
import { guardMerge, runHandler, formatToolResult } from '../lib/handlers.js'

function mockClient() {
  const calls = []
  const client = {
    calls,
    createIssue: (...args) => {
      calls.push({ method: 'createIssue', args })
      return Promise.resolve({ ok: true, data: { number: 1, title: 'Bug' } })
    },
    listIssues: (...args) => {
      calls.push({ method: 'listIssues', args })
      return Promise.resolve({ ok: true, data: [] })
    },
    getIssue: (...args) => {
      calls.push({ method: 'getIssue', args })
      return Promise.resolve({ ok: true, data: { number: 3, title: 'Test' } })
    },
    commentIssue: (...args) => {
      calls.push({ method: 'commentIssue', args })
      return Promise.resolve({ ok: true, data: { id: 1 } })
    },
    closeIssue: (...args) => {
      calls.push({ method: 'closeIssue', args })
      return Promise.resolve({ ok: true, data: { number: 2, state: 'closed' } })
    },
    createPull: (...args) => {
      calls.push({ method: 'createPull', args })
      return Promise.resolve({ ok: true, data: { number: 5, title: 'PR' } })
    },
    listPulls: (...args) => {
      calls.push({ method: 'listPulls', args })
      return Promise.resolve({ ok: true, data: [] })
    },
    getPull: (...args) => {
      calls.push({ method: 'getPull', args })
      return Promise.resolve({ ok: true, data: { number: 4, title: 'Feature' } })
    },
    mergePull: (...args) => {
      calls.push({ method: 'mergePull', args })
      return Promise.resolve({ ok: true, data: { merged: true } })
    },
    searchRepos: (...args) => {
      calls.push({ method: 'searchRepos', args })
      return Promise.resolve({ ok: true, data: [{ name: 'app' }] })
    },
  }
  return client
}

function baseDeps(client, overrides = {}) {
  return {
    client,
    settings: { tokenEnv: 'GITEA_TOKEN', defaultOwner: 'acme', defaultRepo: 'app', ...overrides.settings },
    remoteUrl: overrides.remoteUrl || '',
    configured: { baseUrl: 'https://gitea.example.com', token: 't-test', ...overrides.configured },
  }
}

test('guardMerge: confirm true is ok', () => {
  assert.equal(guardMerge({ confirm: true }).ok, true)
})

test('guardMerge: false, missing, and string true are not ok', () => {
  assert.notEqual(guardMerge({ confirm: false }).ok, true)
  assert.notEqual(guardMerge({}).ok, true)
  assert.notEqual(guardMerge({ confirm: 'true' }).ok, true)
})

test('gitea_pr_merge without confirm does not call mergePull', async () => {
  const client = mockClient()
  const deps = baseDeps(client)
  const result = await runHandler('gitea_pr_merge', { number: 3, owner: 'acme', repo: 'app' }, deps)
  assert.equal(result.ok, false)
  assert.equal(client.calls.filter((c) => c.method === 'mergePull').length, 0)
})

test('gitea_pr_merge with confirm calls mergePull', async () => {
  const client = mockClient()
  const deps = baseDeps(client)
  const result = await runHandler('gitea_pr_merge', { number: 3, confirm: true, owner: 'acme', repo: 'app' }, deps)
  assert.equal(result.ok, true)
  assert.equal(client.calls.filter((c) => c.method === 'mergePull').length, 1)
})

test('empty configured.baseUrl returns error and no HTTP', async () => {
  const client = mockClient()
  const deps = baseDeps(client, { configured: { baseUrl: '', token: 't-test' } })
  const result = await runHandler('gitea_issue_list', { owner: 'acme', repo: 'app' }, deps)
  assert.equal(result.ok, false)
  assert.match(result.error, /url|instance|configure/i)
  assert.equal(client.calls.length, 0)
})

test('formatToolResult returns text block containing #3', () => {
  const rendered = formatToolResult('gitea_issue_get', { ok: true, data: { number: 3, title: 'Test' } })
  assert.equal(rendered.length, 1)
  assert.equal(rendered[0].type, 'text')
  assert.match(rendered[0].text, /#3/)
})

test('gitea_repo_search does not require owner/repo', async () => {
  const client = mockClient()
  const deps = baseDeps(client)
  const result = await runHandler('gitea_repo_search', { q: 'app' }, deps)
  assert.equal(result.ok, true)
  assert.equal(client.calls[0].method, 'searchRepos')
})
