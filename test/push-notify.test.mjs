import { test } from 'node:test'
import assert from 'node:assert/strict'
import { shouldNotify, buildNotifyMessage, pushNotify } from '../lib/push-notify.js'

test('shouldNotify true for opened PR and failed CI', () => {
  assert.equal(shouldNotify({ type: 'pull_request', action: 'opened' }), true)
  assert.equal(shouldNotify({ type: 'workflow_run', conclusion: 'failure' }), true)
})

test('shouldNotify false for other events', () => {
  assert.equal(shouldNotify({ type: 'pull_request', action: 'closed' }), false)
  assert.equal(shouldNotify({ type: 'issues', action: 'opened' }), false)
})

test('buildNotifyMessage formats PR event', () => {
  const msg = buildNotifyMessage({ type: 'pull_request', action: 'opened', number: 3, title: 'feat: x' })
  assert.match(msg, /PR #3/)
  assert.match(msg, /feat: x/)
})

test('buildNotifyMessage formats CI failure', () => {
  const msg = buildNotifyMessage({ type: 'workflow_run', conclusion: 'failure', number: 7, title: 'CI' })
  assert.match(msg, /CI/)
  assert.match(msg, /failed/i)
})



test('pushNotify delivers notification with signal and returns ok', async () => {
  let calledUrl = ''
  let calledOptions = null
  const mockFetch = async (url, options) => {
    calledUrl = url
    calledOptions = options
    return { ok: true }
  }

  const res = await pushNotify(
    { type: 'pull_request', action: 'opened', number: 10, title: 'fix: test' },
    { webhookUrl: 'https://example.com/webhook', fetch: mockFetch, timeoutMs: 2500 }
  )

  assert.equal(res.ok, true)
  assert.equal(res.data?.notified, true)
  assert.equal(calledUrl, 'https://example.com/webhook')
  assert.equal(calledOptions?.method, 'POST')
  assert.ok(calledOptions?.signal, 'signal must be passed to fetch')
})

test('pushNotify handles fetch errors gracefully without throwing', async () => {
  const mockFetch = async () => {
    throw new Error('fetch timeout simulation')
  }

  const res = await pushNotify(
    { type: 'workflow_run', conclusion: 'failure', number: 12, title: 'CI build' },
    { webhookUrl: 'https://example.com/webhook', fetch: mockFetch }
  )

  assert.equal(res.ok, false)
  assert.equal(res.data?.notified, false)
  assert.match(res.data?.error, /fetch timeout simulation/)
})

test('pushNotify skips when webhookUrl is missing', async () => {
  const res = await pushNotify(
    { type: 'pull_request', action: 'opened', number: 1 },
    { webhookUrl: '' }
  )
  assert.equal(res.ok, true)
  assert.equal(res.data?.notified, false)
})
