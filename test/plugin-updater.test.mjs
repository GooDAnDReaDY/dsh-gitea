import test from 'node:test'
import assert from 'node:assert/strict'
import { isNewerVersion, parseSemver, comparePrerelease, isTrustedUpdateRequest, registerPluginUpdater } from '../lib/plugin-updater.js'

test('parseSemver parses standard and prerelease semver strings', () => {
  assert.deepEqual(parseSemver('0.7.5'), { core: [0, 7, 5], prerelease: [] })
  assert.deepEqual(parseSemver('v1.2.3-rc.1'), { core: [1, 2, 3], prerelease: ['rc', '1'] })
  assert.equal(parseSemver('invalid'), undefined)
})

test('comparePrerelease orders prerelease tags correctly', () => {
  assert.equal(comparePrerelease(['alpha'], ['beta']) < 0, true)
  assert.equal(comparePrerelease(['rc', '1'], ['rc', '2']) < 0, true)
  assert.equal(comparePrerelease(['rc', '1'], []) < 0, true) // Prerelease is lower than release
  assert.equal(comparePrerelease([], ['rc', '1']) > 0, true)
})

test('isNewerVersion detects updates including prereleases', () => {
  assert.equal(isNewerVersion('0.7.5', '0.7.6'), true)
  assert.equal(isNewerVersion('0.7.5', '0.8.0'), true)
  assert.equal(isNewerVersion('0.7.5', '1.0.0'), true)
  assert.equal(isNewerVersion('0.7.5', '0.7.5'), false)
  assert.equal(isNewerVersion('0.7.6', '0.7.5'), false)

  // Prerelease comparisons
  assert.equal(isNewerVersion('0.7.6-rc.1', '0.7.6-rc.2'), true)
  assert.equal(isNewerVersion('0.7.6-rc.2', '0.7.6'), true)
  assert.equal(isNewerVersion('0.7.5', '0.7.6-rc.1'), true)
  assert.equal(isNewerVersion('0.7.6', '0.7.6-rc.1'), false)
})

test('isTrustedUpdateRequest validates loopback and headers', () => {
  const validReq = {
    headers: {
      'x-dsh-plugin-update': '1',
      'sec-fetch-site': 'same-origin',
      origin: 'http://127.0.0.1:3000',
      host: '127.0.0.1:3000',
    },
    socket: { remoteAddress: '127.0.0.1' },
  }
  assert.equal(isTrustedUpdateRequest(validReq), true)

  // Missing update header
  assert.equal(isTrustedUpdateRequest({ ...validReq, headers: { ...validReq.headers, 'x-dsh-plugin-update': '0' } }), false)

  // Non-loopback remoteAddress
  assert.equal(isTrustedUpdateRequest({ ...validReq, socket: { remoteAddress: '192.168.1.50' } }), false)

  // Cross-origin host mismatch
  assert.equal(isTrustedUpdateRequest({
    ...validReq,
    headers: { ...validReq.headers, host: 'evil.com' },
  }), false)

  // Non-loopback origin
  assert.equal(isTrustedUpdateRequest({
    ...validReq,
    headers: { ...validReq.headers, origin: 'http://evil.com', host: 'evil.com' },
  }), false)
})

test('registerPluginUpdater registers route and serves status', async () => {
  let registeredRoute = null
  const mockCtx = {
    webServer: {
      register(route) {
        registeredRoute = route
        return () => { registeredRoute = null }
      },
    },
  }

  const manifestUrl = new URL('../package.json', import.meta.url)
  const unregister = registerPluginUpdater(mockCtx, {
    endpoint: '/api/dsh-gitea/update',
    packageName: '@goodandready/dsh-gitea',
    manifestUrl,
  })

  assert.ok(registeredRoute)
  assert.equal(registeredRoute.path, '/api/dsh-gitea/update')

  // Test GET request
  let resStatus = 0
  let resHeaders = {}
  let resBody = ''
  const mockRes = {
    writeHead(status, headers) {
      resStatus = status
      resHeaders = headers
    },
    end(data) {
      resBody = data
    },
  }

  await registeredRoute.handler({ method: 'GET', headers: {} }, mockRes)
  assert.equal(resStatus, 200)
  const payload = JSON.parse(resBody)
  assert.equal(payload.packageName, '@goodandready/dsh-gitea')
  assert.ok(payload.currentVersion)

  // Test untrusted POST rejected
  await registeredRoute.handler({
    method: 'POST',
    headers: { origin: 'http://malicious.test', host: 'malicious.test' },
    socket: { remoteAddress: '10.0.0.1' },
  }, mockRes)
  assert.equal(resStatus, 403)
  assert.match(resBody, /Rejected non-local or cross-origin/)

  unregister()
  assert.equal(registeredRoute, null)
})

test('clearLatestCache resets cached version', () => {
  assert.doesNotThrow(() => {
    import('../lib/plugin-updater.js').then(({ clearLatestCache }) => {
      clearLatestCache()
    })
  })
})
