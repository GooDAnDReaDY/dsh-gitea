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

test('task service resolves string labels to numeric IDs via listLabels (#298)', async () => {
  let createdBody
  const service = createGiteaTaskService({
    getConfig: () => ({ baseUrl: 'https://gitea.example.test', tokenEnv: 'GITEA_TOKEN', defaultOwner: 'acme', defaultRepo: 'app' }),
    resolveToken: async () => 'secret',
    clientFactory: () => ({
      listLabels: async (owner, repo, query) => {
        assert.equal(owner, 'acme')
        assert.equal(repo, 'app')
        return {
          ok: true,
          data: [
            { id: 101, name: 'bug' },
            { id: 102, name: 'scope/agent-tools' },
          ],
        }
      },
      createIssue: async (owner, repo, body) => {
        createdBody = body
        return { ok: true, data: { number: 12, html_url: 'https://gitea.example.test/acme/app/issues/12' } }
      },
    }),
  })

  // Mix of string name, existing numeric ID, and string integer
  const res = await service.createIssue({
    title: 'Resolve labels test',
    labels: ['bug', 999, '102'],
  })

  assert.equal(res.ok, true)
  assert.equal(res.number, 12)
  // 'bug' -> 101, 999 -> 999, '102' -> 102
  assert.deepEqual(createdBody.labels.sort((a, b) => a - b), [101, 102, 999])
})

test('task service fails closed when label name is not found in repository (#298)', async () => {
  let created = false
  const service = createGiteaTaskService({
    getConfig: () => ({ baseUrl: 'https://gitea.example.test', tokenEnv: 'GITEA_TOKEN', defaultOwner: 'acme', defaultRepo: 'app' }),
    resolveToken: async () => 'secret',
    clientFactory: () => ({
      listLabels: async () => ({
        ok: true,
        data: [{ id: 101, name: 'bug' }],
      }),
      createIssue: async () => { created = true; return { ok: true } },
    }),
  })

  const res = await service.createIssue({
    title: 'Unknown label test',
    labels: ['non-existent-label'],
  })

  assert.equal(res.ok, false)
  assert.equal(res.code, 'labels-not-found')
  assert.match(res.error, /non-existent-label/)
  assert.equal(created, false)
})

test('task service verifies repository identity and rejects cross-repo issue matches (#299)', async () => {
  let createdIssueCalled = false
  let searchParams
  const service = createGiteaTaskService({
    getConfig: () => ({ baseUrl: 'https://gitea.example.test', tokenEnv: 'GITEA_TOKEN', defaultOwner: 'acme', defaultRepo: 'app' }),
    resolveToken: async () => 'secret',
    clientFactory: () => ({
      searchIssues: async (query) => {
        searchParams = query
        return {
          ok: true,
          data: [
            // Foreign repository issue with matching external-ref marker
            {
              number: 88,
              body: 'foreign details\n<!-- dsh-external-ref: task-42 -->',
              repository: { name: 'foreign-repo', owner: { login: 'acme' } },
            },
            // Another foreign owner issue
            {
              number: 89,
              body: 'foreign details 2\n<!-- dsh-external-ref: task-42 -->',
              repository: { name: 'app', owner: { login: 'hacker-org' } },
            },
          ],
        }
      },
      createIssue: async (owner, repo, body) => {
        createdIssueCalled = true
        return { ok: true, data: { number: 90, html_url: 'https://gitea.example.test/acme/app/issues/90' } }
      },
    }),
  })

  const res = await service.createIssue({
    title: 'Isolated task',
    externalRef: 'task-42',
  })

  // Foreign issues must NOT match; a new issue must be created in target repo
  assert.equal(searchParams.repo, 'app')
  assert.equal(searchParams.owner, 'acme')
  assert.equal(createdIssueCalled, true)
  assert.equal(res.ok, true)
  assert.equal(res.number, 90)
  assert.equal(res.alreadyExists, false)
})

test('task service matches existing issue when repository identity matches (#299)', async () => {
  let createdIssueCalled = false
  const service = createGiteaTaskService({
    getConfig: () => ({ baseUrl: 'https://gitea.example.test', tokenEnv: 'GITEA_TOKEN', defaultOwner: 'acme', defaultRepo: 'app' }),
    resolveToken: async () => 'secret',
    clientFactory: () => ({
      searchIssues: async () => ({
        ok: true,
        data: [
          {
            number: 77,
            body: 'target details\n<!-- dsh-external-ref: task-77 -->',
            repository: { name: 'app', owner: { login: 'acme' } },
          },
        ],
      }),
      createIssue: async () => { createdIssueCalled = true; return { ok: true } },
    }),
  })

  const res = await service.createIssue({
    title: 'Existing task',
    externalRef: 'task-77',
  })

  assert.equal(createdIssueCalled, false)
  assert.equal(res.ok, true)
  assert.equal(res.number, 77)
  assert.equal(res.alreadyExists, true)
})

