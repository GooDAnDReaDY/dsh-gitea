import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Config, apply } from '../lib/index.js'

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
