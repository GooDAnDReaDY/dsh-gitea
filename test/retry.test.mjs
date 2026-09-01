import { test } from 'node:test'
import assert from 'node:assert/strict'
import { shouldRetry, retryWithBackoff } from '../lib/retry.js'

test('shouldRetry true for 429 and 5xx', () => {
  assert.equal(shouldRetry(429), true)
  assert.equal(shouldRetry(500), true)
  assert.equal(shouldRetry(503), true)
  assert.equal(shouldRetry(404), false)
  assert.equal(shouldRetry(200), false)
})

test('retryWithBackoff retries on transient errors', async () => {
  let attempts = 0
  const fn = async () => {
    attempts += 1
    if (attempts < 3) return { ok: false, status: 503, error: 'busy' }
    return { ok: true, status: 200, data: {} }
  }
  const r = await retryWithBackoff(fn, { retries: 3, baseDelayMs: 1 })
  assert.equal(r.ok, true)
  assert.equal(attempts, 3)
})

test('retryWithBackoff gives up after max retries', async () => {
  let attempts = 0
  const fn = async () => {
    attempts += 1
    return { ok: false, status: 500, error: 'x' }
  }
  const r = await retryWithBackoff(fn, { retries: 2, baseDelayMs: 1 })
  assert.equal(r.ok, false)
  assert.equal(attempts, 3)
})

test('retryWithBackoff does not retry on non-transient', async () => {
  let attempts = 0
  const fn = async () => {
    attempts += 1
    return { ok: false, status: 404, error: 'x' }
  }
  const r = await retryWithBackoff(fn, { retries: 3, baseDelayMs: 1 })
  assert.equal(r.ok, false)
  assert.equal(attempts, 1)
})
