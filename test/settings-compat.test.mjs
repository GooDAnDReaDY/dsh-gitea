import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Config, apply, parseConfig, unwrapVolatile } from '../lib/index.js'

test('settings-compat: Config schema marks live fields with volatile metadata', () => {
  // Inspect Config fields for volatile metadata
  const dict = Config.dict || {}
  const volatileFields = [
    'baseUrl',
    'tokenEnv',
    'defaultOwner',
    'defaultRepo',
    'gitWrapper',
    'dodReminder',
    'bgSchedulerEnabled',
    'bgSchedulerIntervalMin',
    'bgSchedulerOwner',
    'bgSchedulerRepo',
    'bgSchedulerWebhook',
    'notifyWebhook',
    'forceHttpsUrls',
    'webhookSecretEnv',
    'instances',
    'timeoutMs',
  ]

  for (const field of volatileFields) {
    const node = dict[field]
    assert.ok(node, `Field ${field} should exist on Config`)
    assert.equal(
      Boolean(node.meta?.volatile),
      true,
      `Field ${field} should have volatile: true metadata for DSH SettingsForms`,
    )
  }
})

test('settings-compat: unwrapVolatile recursively unwraps getter functions from Volatile references', () => {
  // Single volatile value
  const singleVolatile = { get: () => 'http://192.168.1.111:3005' }
  assert.equal(unwrapVolatile(singleVolatile), 'http://192.168.1.111:3005')

  // Object with volatile fields
  const objVolatile = {
    baseUrl: { get: () => 'http://192.168.1.111:3005' },
    tokenEnv: { get: () => 'CUSTOM_TOKEN' },
    timeoutMs: { get: () => 45000 },
    instances: [
      {
        name: 'mirror',
        baseUrl: { get: () => 'https://mirror.gitea.local' },
        tokenEnv: 'MIRROR_TOKEN',
      },
    ],
  }

  const unwrapped = unwrapVolatile(objVolatile)
  assert.deepEqual(unwrapped, {
    baseUrl: 'http://192.168.1.111:3005',
    tokenEnv: 'CUSTOM_TOKEN',
    timeoutMs: 45000,
    instances: [
      {
        name: 'mirror',
        baseUrl: 'https://mirror.gitea.local',
        tokenEnv: 'MIRROR_TOKEN',
      },
    ],
  })

  // Primitives pass through unchanged
  assert.equal(unwrapVolatile('plain-string'), 'plain-string')
  assert.equal(unwrapVolatile(123), 123)
  assert.equal(unwrapVolatile(null), null)
  assert.equal(unwrapVolatile(undefined), undefined)
})

test('settings-compat: parseConfig safely handles raw input with Volatile reference objects (#250)', () => {
  // When Cordis / Schemastery passes a volatile-wrapped config object
  const cordisRaw = {
    baseUrl: { get: () => 'http://192.168.1.111:3005' },
    tokenEnv: { get: () => 'GITEA_TOKEN' },
    defaultOwner: { get: () => 'goodandready' },
  }

  // Must not throw ValidationError: $.baseUrl expected string but got [object Object]
  let parsed
  assert.doesNotThrow(() => {
    parsed = parseConfig(cordisRaw)
  })

  assert.equal(typeof parsed.baseUrl, 'string')
  assert.equal(parsed.baseUrl, 'http://192.168.1.111:3005')
  assert.equal(parsed.tokenEnv, 'GITEA_TOKEN')
  assert.equal(parsed.defaultOwner, 'goodandready')

  // Idempotency check: passing the result back into parseConfig must also succeed
  assert.doesNotThrow(() => {
    const reparsed = parseConfig(parsed)
    assert.equal(reparsed.baseUrl, 'http://192.168.1.111:3005')
  })
})

test('settings-compat: apply activates without throwing when config contains volatile references (#250)', async () => {
  const events = {}
  let registeredRoutes = []

  const mockCtx = {
    inject(deps, callback) {
      if (deps.includes('settings')) {
        callback({ settings: {} })
      }
    },
    on(event, handler) {
      events[event] = handler
    },
    effect(fn) {
      return fn()
    },
    provide() {},
    tools: { register() {} },
    webServer: {
      register(spec) {
        registeredRoutes.push(spec)
      },
    },
    credentials: {
      resolve: async () => ({ value: 'dummy' }),
      describe: async () => ({ configured: true }),
    },
  }

  // Cordis activates plugin with volatile objects in config
  let volatileBaseUrl = 'http://192.168.1.111:3005'
  const volatileConfig = {
    baseUrl: { get: () => volatileBaseUrl },
    tokenEnv: { get: () => 'GITEA_TOKEN' },
    defaultOwner: 'goodandready',
  }

  // Must not throw ValidationError on activation
  assert.doesNotThrow(() => {
    apply(mockCtx, volatileConfig)
  })

  // Find the /dsh-gitea/config GET route
  const configRoute = registeredRoutes.find((r) => r.path === '/dsh-gitea/config')
  assert.ok(configRoute, 'GET /dsh-gitea/config route should be registered')

  // Mock response to verify current config
  let responseData = null
  const mockRes = {
    writeHead() {},
    end(body) {
      responseData = JSON.parse(body)
    },
  }
  const mockReq = {
    method: 'GET', headers: {
      host: '127.0.0.1:3080',
      'sec-fetch-site': 'same-origin',
    },
  }

  await configRoute.handler(mockReq, mockRes)
  assert.ok(responseData && responseData.ok, 'Config route should return ok: true')
  assert.equal(responseData.config.baseUrl, 'http://192.168.1.111:3005')

  // Simulate in-place volatile update (e.g. loader volatile-update / commitVolatile)
  volatileBaseUrl = 'http://192.168.1.111:3006'
  assert.equal(typeof events['loader/volatile-update'], 'function')
  events['loader/volatile-update']({
    'dsh-gitea': { baseUrl: 'http://192.168.1.111:3006' },
  })

  await configRoute.handler(mockReq, mockRes)
  assert.equal(responseData.config.baseUrl, 'http://192.168.1.111:3006')
})

test('settings-compat: apply does not crash when settings.register is missing (DSH 0.1.7)', async () => {
  const events = {}
  let registeredRoutes = null

  const mockCtx = {
    inject(deps, callback) {
      if (deps.includes('settings')) {
        // Modern DSH 0.1.7: settings service exists but register() is not a function
        callback({ settings: {} })
      }
    },
    on(event, handler) {
      events[event] = handler
    },
    effect(fn) {
      return fn()
    },
    provide() {},
    tools: { register() {} },
    webServer: {
      register(spec) {
        if (!registeredRoutes) registeredRoutes = []
        registeredRoutes.push(spec)
      },
    },
    credentials: {
      resolve: async () => ({ value: 'dummy' }),
      describe: async () => ({ configured: true }),
    },
  }

  // Must not throw TypeError: settings.register is not a function
  assert.doesNotThrow(() => {
    apply(mockCtx, { baseUrl: 'https://original.git' })
  })

  // Verify volatile-update event listener was wired up
  assert.equal(typeof events['loader/volatile-update'], 'function')

  // Trigger volatile update
  events['loader/volatile-update']({
    'dsh-gitea': { baseUrl: 'https://updated.git' },
  })
})
