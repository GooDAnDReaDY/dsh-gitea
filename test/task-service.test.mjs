import test from 'node:test'
import assert from 'node:assert/strict'
import { createGiteaTaskService, TASK_PROVISION_CONTRACT } from '../lib/task-service.js'

test('task service rejects missing configuration before client creation', async () => {
  let created = false
  const service = createGiteaTaskService({
    getConfig: () => ({ baseUrl: '', defaultOwner: '', defaultRepo: '' }),
    resolveToken: async () => 'secret',
    clientFactory: () => { created = true; return {} },
  })
  assert.equal(service.contract, TASK_PROVISION_CONTRACT)
  assert.equal(service.isConfigured(), false)
  assert.deepEqual(await service.createIssue({ title: 'A' }), { ok: false, code: 'target-required' })
  assert.equal(created, false)
})

test('task service reuses configured client and returns normalized issue', async () => {
  let captured
  const service = createGiteaTaskService({
    getConfig: () => ({ baseUrl: 'https://gitea.example.test/', tokenEnv: 'GITEA_TOKEN', defaultOwner: 'acme', defaultRepo: 'app', timeoutMs: 1234 }),
    resolveToken: async (name) => name === 'GITEA_TOKEN' ? 'secret' : '',
    clientFactory: (options) => {
      captured = options
      return {
        createIssue: async (owner, repo, body) => {
          assert.deepEqual({ owner, repo }, { owner: 'acme', repo: 'app' })
          assert.equal(body.title, 'Drive task')
          assert.match(body.body, /dsh-external-ref: proposal-1/)
          assert.deepEqual(body.labels, ['dsh-drives'])
          return { ok: true, status: 201, data: { number: 7, html_url: 'https://gitea.example.test/acme/app/issues/7' } }
        },
      }
    },
  })
  const result = await service.createIssue({
    title: 'Drive task',
    body: 'details',
    labels: ['dsh-drives', 'dsh-drives'],
    externalRef: 'proposal-1',
  })
  assert.equal(result.alreadyExists, false)
  assert.deepEqual(captured, { baseUrl: 'https://gitea.example.test', token: 'secret', timeoutMs: 1234 })
  assert.deepEqual(result, {
    ok: true,
    number: 7,
    html_url: 'https://gitea.example.test/acme/app/issues/7',
    url: 'https://gitea.example.test/acme/app/issues/7',
    externalRef: 'proposal-1',
    alreadyExists: false,
  })
})

test('task service reports API failures without throwing', async () => {
  const service = createGiteaTaskService({
    getConfig: () => ({ baseUrl: 'https://gitea.example.test', tokenEnv: 'GITEA_TOKEN', defaultOwner: 'acme', defaultRepo: 'app' }),
    resolveToken: async () => 'secret',
    clientFactory: () => ({ createIssue: async () => ({ ok: false, status: 403, error: 'forbidden' }) }),
  })
  assert.deepEqual(await service.createIssue({ title: 'A' }), {
    ok: false,
    code: 'gitea-api-error',
    status: 403,
    error: 'forbidden',
  })
})
test('task service reuses an existing issue for the same external reference', async () => {
  let creates = 0
  const service = createGiteaTaskService({
    getConfig: () => ({ baseUrl: 'https://gitea.example.test', tokenEnv: 'GITEA_TOKEN', defaultOwner: 'acme', defaultRepo: 'app' }),
    resolveToken: async () => 'secret',
    clientFactory: () => ({
      searchIssues: async (query) => {
        assert.equal(query.q, '<!-- dsh-external-ref: proposal-1 -->')
        return { ok: true, data: [{ number: 7, body: 'details\n\n<!-- dsh-external-ref: proposal-1 -->' }] }
      },
      createIssue: async () => { creates += 1; return { ok: true, data: { number: 8 } } },
    }),
  })
  const result = await service.createIssue({ title: 'Drive task', externalRef: 'proposal-1' })
  assert.equal(result.number, 7)
  assert.equal(result.alreadyExists, true)
  assert.equal(creates, 0)
})
