import { test } from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import z from '@deepseek-ai/schemastery'

import { apply, parseConfig, getCachedClient, clearClientCache } from '../lib/index.js'
import { registerHttpRoutes } from '../lib/routes.js'
import { GiteaClient } from '../lib/gitea-client.js'

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
  req.headers = {
    host: '127.0.0.1:3080',
    origin: 'http://127.0.0.1:3080',
    'sec-fetch-site': 'same-origin',
    ...headers,
  }
  req.socket = { remoteAddress: '127.0.0.1' }
  req.destroy = () => {}
  process.nextTick(() => {
    if (body) req.emit('data', Buffer.from(body, 'utf8'))
    req.emit('end')
  })
  return req
}

// -----------------------------------------------------------------------------
// Issue #315: Schemastery prototype cleanliness
// -----------------------------------------------------------------------------
test('issue #315: Schemastery boolean prototype is not monkeypatched and supports native volatile', () => {
  const bool = z.boolean()
  assert.equal(typeof bool.volatile, 'function')
  const v = bool.volatile()
  assert.equal(Boolean(v.meta?.volatile), true)
  assert.equal(Object.prototype.hasOwnProperty('volatile'), false)
})

// -----------------------------------------------------------------------------
// Issue #301: Transactional settings update
// -----------------------------------------------------------------------------
test('issue #301: servedScope.update does not mutate in-memory config if settingsSvc rejects', async () => {
  const events = {}
  const registeredRoutes = []
  const mockCtx = {
    inject(deps, callback) {
      const sctx = {
        settings: {
          describe() { return [{ ns: 'dsh-gitea', revision: 1 }] },
          async update() {
            throw new Error('Disk full / conflict error')
          },
        },
      }
      callback(sctx)
    },
    on(event, handler) { events[event] = handler; return () => {} },
    tools: { register() {} },
    webServer: {
      register(spec) {
        registeredRoutes.push(spec)
        return () => {}
      },
    },
    credentials: {
      resolve: async () => ({ value: 'dummy' }),
      describe: async () => ({ configured: true }),
    },
    effect(fn) { fn() },
    provide() {},
    logger: { warn() {} },
  }

  apply(mockCtx, {
    baseUrl: 'https://gitea.original.com',
    tokenEnv: 'ORIGINAL_TOKEN',
  })

  const configRoute = registeredRoutes.find((r) => r.path === '/dsh-gitea/config')
  assert.ok(configRoute, 'Route /dsh-gitea/config must be registered')

  // Try updating via POST /dsh-gitea/config where settingsSvc.update throws
  const updateReq = mockReq({
    method: 'POST',
    body: JSON.stringify({ config: { baseUrl: 'https://gitea.corrupted.com' } }),
  })
  const updateRes = mockRes()
  await configRoute.handler(updateReq, updateRes)

  // Must return 500 save error
  assert.equal(updateRes.getStatus(), 500)
  assert.equal(updateRes.getBody().ok, false)

  // Verify that GET /dsh-gitea/config still returns original config (NOT mutated)
  const getReq = mockReq({ method: 'GET' })
  const getRes = mockRes()
  await configRoute.handler(getReq, getRes)
  assert.equal(getRes.getStatus(), 200)
  assert.equal(getRes.getBody().config.baseUrl, 'https://gitea.original.com')
})

// -----------------------------------------------------------------------------
// Issue #314: Preserving webhookSecret on POST /dsh-gitea/config
// -----------------------------------------------------------------------------
test('issue #314: POST /dsh-gitea/config preserves existing webhookSecret when omitted in request', async () => {
  let configHandler = null
  const mockCtx = {
    webServer: {
      register(spec) {
        if (spec.path === '/dsh-gitea/config') configHandler = spec.handler
        return () => {}
      },
    },
    effect(fn) { fn() },
  }

  let storedConfig = {
    baseUrl: 'https://gitea.example.com',
    tokenEnv: 'GITEA_TOKEN',
    webhookSecret: 'my-super-secret-key-12345',
    webhookSecretEnv: 'GITEA_WEBHOOK_SECRET',
  }

  const mockSettingsScope = {
    get: () => storedConfig,
    update: async (patch) => {
      storedConfig = { ...storedConfig, ...patch }
      return storedConfig
    },
  }

  registerHttpRoutes(mockCtx, {
    parseConfig: (c) => c,
    live: () => storedConfig,
    getSettingsScope: () => mockSettingsScope,
    resolveToken: async () => 'token',
  })

  assert.ok(configHandler)

  // Client UI submits form without webhookSecret (because GET stripped it and UI form doesn't send raw secret)
  const uiPayload = JSON.stringify({
    config: {
      baseUrl: 'https://gitea-updated.example.com',
      tokenEnv: 'GITEA_TOKEN',
      webhookSecretEnv: 'GITEA_WEBHOOK_SECRET',
    },
  })

  const req = mockReq({ method: 'POST', body: uiPayload })
  const res = mockRes()
  await configHandler(req, res)

  assert.equal(res.getStatus(), 200)
  assert.equal(storedConfig.baseUrl, 'https://gitea-updated.example.com')
  // Verify webhookSecret was NOT wiped out
  assert.equal(storedConfig.webhookSecret, 'my-super-secret-key-12345')
})

test('issue #314: POST /dsh-gitea/config updates webhookSecret when explicitly supplied by API client', async () => {
  let configHandler = null
  const mockCtx = {
    webServer: {
      register(spec) {
        if (spec.path === '/dsh-gitea/config') configHandler = spec.handler
        return () => {}
      },
    },
    effect(fn) { fn() },
  }

  let storedConfig = {
    baseUrl: 'https://gitea.example.com',
    tokenEnv: 'GITEA_TOKEN',
    webhookSecret: 'old-secret',
  }

  const mockSettingsScope = {
    get: () => storedConfig,
    update: async (patch) => {
      storedConfig = { ...storedConfig, ...patch }
      return storedConfig
    },
  }

  registerHttpRoutes(mockCtx, {
    parseConfig: (c) => c,
    live: () => storedConfig,
    getSettingsScope: () => mockSettingsScope,
    resolveToken: async () => 'token',
  })

  const apiPayload = JSON.stringify({
    config: {
      webhookSecret: 'brand-new-secret',
    },
  })

  const req = mockReq({ method: 'POST', body: apiPayload })
  const res = mockRes()
  await configHandler(req, res)

  assert.equal(res.getStatus(), 200)
  assert.equal(storedConfig.webhookSecret, 'brand-new-secret')
})

// -----------------------------------------------------------------------------
// Issue #266: Fresh AbortSignal on each retry attempt
// -----------------------------------------------------------------------------
test('issue #266: GiteaClient request creates fresh AbortSignal on retry attempts after timeout', async () => {
  let attemptCount = 0
  const observedSignals = []

  const fetchImpl = async (url, init) => {
    attemptCount += 1
    observedSignals.push(init.signal)
    if (attemptCount === 1) {
      const err = new Error('The operation was aborted due to timeout')
      err.name = 'TimeoutError'
      throw err
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({ ok: true, attempt: attemptCount }),
    }
  }

  const client = new GiteaClient({
    baseUrl: 'https://gitea.example.com',
    token: 'token-123',
    timeoutMs: 50,
    retries: 1,
    retryDelayMs: 10,
    fetchImpl,
  })

  const res = await client.request('GET', '/api/v1/user')
  assert.equal(res.ok, true)
  assert.equal(res.data.attempt, 2)
  assert.equal(attemptCount, 2)
  assert.equal(observedSignals.length, 2)
  assert.notEqual(observedSignals[0], observedSignals[1], 'Each attempt must receive a unique AbortSignal')
})

// -----------------------------------------------------------------------------
// Issue #282: Idempotent HTTP retry policy
// -----------------------------------------------------------------------------
test('issue #282: GiteaClient POST does not retry on 500 by default', async () => {
  let postCount = 0
  const fetchImpl = async () => {
    postCount += 1
    return {
      ok: false,
      status: 500,
      json: async () => ({ message: 'Internal Server Error' }),
    }
  }

  const client = new GiteaClient({
    baseUrl: 'https://gitea.example.com',
    token: 'token-123',
    retries: 2,
    retryDelayMs: 5,
    fetchImpl,
  })

  const res = await client.request('POST', '/api/v1/repos/owner/repo/issues', {
    body: { title: 'Test issue' },
  })

  assert.equal(res.ok, false)
  assert.equal(res.status, 500)
  assert.equal(postCount, 1, 'POST must not be retried to prevent duplicate entity creation')
})

test('issue #282: GiteaClient POST retries when allowNonIdempotentRetry is true', async () => {
  let postCount = 0
  const fetchImpl = async () => {
    postCount += 1
    if (postCount === 1) {
      return {
        ok: false,
        status: 500,
        json: async () => ({ message: 'Temporary Server Error' }),
      }
    }
    return {
      ok: true,
      status: 201,
      json: async () => ({ id: 42, title: 'Test issue' }),
    }
  }

  const client = new GiteaClient({
    baseUrl: 'https://gitea.example.com',
    token: 'token-123',
    retries: 2,
    retryDelayMs: 5,
    fetchImpl,
  })

  const res = await client.request('POST', '/api/v1/repos/owner/repo/issues', {
    body: { title: 'Test issue' },
    allowNonIdempotentRetry: true,
  })

  assert.equal(res.ok, true)
  assert.equal(postCount, 2, 'POST should retry when explicitly allowed')
})

test('issue #282: GiteaClient GET retries on 500 error', async () => {
  let getCount = 0
  const fetchImpl = async () => {
    getCount += 1
    if (getCount === 1) {
      return {
        ok: false,
        status: 502,
        json: async () => ({ message: 'Bad Gateway' }),
      }
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({ name: 'my-repo' }),
    }
  }

  const client = new GiteaClient({
    baseUrl: 'https://gitea.example.com',
    token: 'token-123',
    retries: 2,
    retryDelayMs: 5,
    fetchImpl,
  })

  const res = await client.request('GET', '/api/v1/repos/owner/repo')
  assert.equal(res.ok, true)
  assert.equal(getCount, 2, 'GET must retry on 5xx status')
})

// -----------------------------------------------------------------------------
// Issue #287: Client factory caching across tool calls
// -----------------------------------------------------------------------------
test('issue #287: getCachedClient returns same instance for identical credentials and clears on clearClientCache', () => {
  clearClientCache()

  const client1 = getCachedClient({
    baseUrl: 'https://gitea.local',
    token: 'tok-abc',
    timeoutMs: 30000,
  })

  const client2 = getCachedClient({
    baseUrl: 'https://gitea.local',
    token: 'tok-abc',
    timeoutMs: 30000,
  })

  assert.equal(client1, client2, 'Factory must return cached client instance')

  // Different config gets different client
  const client3 = getCachedClient({
    baseUrl: 'https://gitea.local',
    token: 'different-tok',
    timeoutMs: 30000,
  })
  assert.notEqual(client1, client3, 'Different token must produce different client')

  // Cache reset
  clearClientCache()
  const client4 = getCachedClient({
    baseUrl: 'https://gitea.local',
    token: 'tok-abc',
    timeoutMs: 30000,
  })
  assert.notEqual(client1, client4, 'clearClientCache must purge cached clients')
})

// -----------------------------------------------------------------------------
// Issue #316: Client UI fetch timeout helper
// -----------------------------------------------------------------------------
test('issue #316: client.js defines clientFetch and wraps all UI HTTP requests', () => {
  const clientJsPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '../lib/client.js')
  const clientSrc = readFileSync(clientJsPath, 'utf8')

  assert.match(clientSrc, /function clientFetch\(url,\s*options\s*=\s*\{\},\s*timeoutMs\s*=\s*15000\)/)
  assert.match(clientSrc, /clientFetch\('\/api\/dsh-gitea\/update'/)
  assert.match(clientSrc, /clientFetch\('\/dsh-gitea\/config'/)
  assert.match(clientSrc, /clientFetch\('\/dsh-gitea\/events'/)
  assert.match(clientSrc, /clientFetch\('\/dsh-gitea\/git-graph\?'/)
  assert.match(clientSrc, /clientFetch\('\/dsh-gitea\/git-status'/)

  // Verify no raw fetch calls remain outside the clientFetch helper
  const rawFetchMatches = clientSrc.match(/[^a-zA-Z0-9_]fetch\(/g) || []
  assert.equal(rawFetchMatches.length, 2, 'Only 2 internal fetch invocations should exist inside clientFetch')
})
