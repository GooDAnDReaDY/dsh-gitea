import { test } from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { registerHttpRoutes, writeJson, readBody } from '../lib/routes.js'
import { EventStore } from '../lib/events-store.js'

function mockRes() {
  const headers = {}
  let statusCode = 0
  let data = ''
  return {
    writeHead(code, h) {
      statusCode = code
      Object.assign(headers, h)
    },
    end(str) {
      data = str
    },
    getStatus: () => statusCode,
    getHeaders: () => headers,
    getBody: () => (data ? JSON.parse(data) : null),
    getRawBody: () => data,
  }
}

function mockReq({ method = 'GET', url = '/', headers = {}, body = '' } = {}) {
  const req = new EventEmitter()
  req.method = method
  req.url = url
  req.headers = { host: 'localhost:3080', ...headers }
  req.destroy = () => {}
  process.nextTick(() => {
    if (body) req.emit('data', Buffer.from(body, 'utf8'))
    req.emit('end')
  })
  return req
}

test('writeJson sets headers and serializes json body', () => {
  const res = mockRes()
  writeJson(res, 200, { ok: true, count: 42 })
  assert.equal(res.getStatus(), 200)
  assert.equal(res.getHeaders()['Content-Type'], 'application/json')
  assert.equal(res.getHeaders()['Cache-Control'], 'no-store')
  assert.deepEqual(res.getBody(), { ok: true, count: 42 })
})

test('readBody streams incoming payload and enforces maxBytes', async () => {
  const req = mockReq({ body: 'hello world' })
  const buf = await readBody(req, 1024)
  assert.equal(buf.toString('utf8'), 'hello world')

  const largeReq = mockReq({ body: 'x'.repeat(200) })
  await assert.rejects(async () => {
    await readBody(largeReq, 100)
  }, /body too large/)
})

test('registerHttpRoutes registers all 5 core routes with correct paths', () => {
  const registered = []
  const mockCtx = {
    webServer: {
      register(spec) {
        registered.push(spec)
        return () => {}
      },
    },
    effect(fn) {
      return fn()
    },
    credentials: {
      resolve: async () => ({ value: 'test-token' }),
      describe: async () => ({ configured: true }),
    },
  }

  const eventsStore = new EventStore(10)
  const giteaEventsService = { emit: () => {} }

  registerHttpRoutes(mockCtx, {
    parseConfig: (c) => c,
    live: () => ({ baseUrl: 'https://gitea.example.com', tokenEnv: 'GITEA_TOKEN' }),
    getSettingsScope: () => ({ update: async () => {} }),
    resolveToken: async () => 'test-token',
    eventsStore,
    giteaEventsService,
    pinGitFromSessionLog: async () => {},
    execFile: async () => ({ stdout: '' }),
  })

  assert.equal(registered.length, 8)
  const paths = registered.map((r) => r.path)
  assert.ok(paths.includes('/dsh-gitea/config'))
  assert.ok(paths.includes('/dsh-gitea/webhook'))
  assert.ok(paths.includes('/dsh-gitea/events'))
  assert.ok(paths.includes('/dsh-gitea/git-status'))
  assert.ok(paths.includes('/dsh-gitea/git-graph'))
  assert.ok(paths.includes('/dsh-gitea/sse'))
  assert.ok(paths.includes('/dsh-gitea/release-assistant'))
  assert.ok(paths.includes('/dsh-gitea/hub'))
})

test('route /dsh-gitea/events returns 200 with events list and rejects untrusted host', async () => {
  let eventsHandler = null
  const mockCtx = {
    webServer: {
      register(spec) {
        if (spec.path === '/dsh-gitea/events') eventsHandler = spec.handler
        return () => {}
      },
    },
    effect(fn) { fn() },
  }

  const eventsStore = new EventStore(10)
  eventsStore.push({ id: 'ev-1', type: 'push', title: 'Test event' })

  registerHttpRoutes(mockCtx, {
    parseConfig: (c) => c,
    live: () => ({}),
    getSettingsScope: () => null,
    resolveToken: async () => '',
    eventsStore,
    giteaEventsService: { emit: () => {} },
    pinGitFromSessionLog: async () => {},
    execFile: async () => ({ stdout: '' }),
  })

  assert.ok(eventsHandler)

  // GET returns 200 with valid host
  const req = mockReq({ method: 'GET' })
  const res = mockRes()
  await eventsHandler(req, res)
  assert.equal(res.getStatus(), 200)
  assert.equal(res.getBody().ok, true)
  assert.equal(res.getBody().data.length, 1)
  assert.equal(res.getBody().data[0].id, 'ev-1')

  // GET rejects untrusted host with 403
  const untrustedReq = mockReq({ method: 'GET', headers: { host: 'attacker.evil.com' } })
  const untrustedRes = mockRes()
  await eventsHandler(untrustedReq, untrustedRes)
  assert.equal(untrustedRes.getStatus(), 403)
  assert.equal(untrustedRes.getBody().ok, false)

  // POST returns 405 Method Not Allowed
  const postReq = mockReq({ method: 'POST' })
  const postRes = mockRes()
  await eventsHandler(postReq, postRes)
  assert.equal(postRes.getStatus(), 405)
})

test('routes /dsh-gitea/git-status and /git-graph reject untrusted host with 403', async () => {
  let statusHandler = null
  let graphHandler = null
  const mockCtx = {
    webServer: {
      register(spec) {
        if (spec.path === '/dsh-gitea/git-status') statusHandler = spec.handler
        if (spec.path === '/dsh-gitea/git-graph') graphHandler = spec.handler
        return () => {}
      },
    },
    effect(fn) { fn() },
  }

  registerHttpRoutes(mockCtx, {
    parseConfig: (c) => c,
    live: () => ({}),
    getSettingsScope: () => null,
    resolveToken: async () => '',
    eventsStore: new EventStore(10),
    giteaEventsService: { emit: () => {} },
    pinGitFromSessionLog: async () => {},
    execFile: async () => ({ stdout: '' }),
  })

  assert.ok(statusHandler)
  assert.ok(graphHandler)

  const untrustedReq1 = mockReq({ method: 'GET', headers: { host: 'dns-rebinding.com' } })
  const res1 = mockRes()
  await statusHandler(untrustedReq1, res1)
  assert.equal(res1.getStatus(), 403)

  const untrustedReq2 = mockReq({ method: 'GET', headers: { host: 'dns-rebinding.com' } })
  const res2 = mockRes()
  await graphHandler(untrustedReq2, res2)
  assert.equal(res2.getStatus(), 403)
})
