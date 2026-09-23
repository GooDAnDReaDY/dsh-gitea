import { test } from 'node:test'
import assert from 'node:assert/strict'
import { shouldRetry, retryWithBackoff, mapConcurrent } from '../lib/retry.js'

test('shouldRetry true for 429 and 5xx and 0', () => {
  assert.equal(shouldRetry(0), true)
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

test('mapConcurrent processes tasks respecting concurrency and preserves order', async () => {
  let active = 0
  let maxActive = 0
  const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

  const results = await mapConcurrent(items, 3, async (num) => {
    active += 1
    maxActive = Math.max(maxActive, active)
    await new Promise((resolve) => setTimeout(resolve, 10))
    active -= 1
    return num * 2
  })

  assert.equal(maxActive <= 3, true, `maxActive was ${maxActive}, expected <= 3`)
  assert.deepEqual(results, [2, 4, 6, 8, 10, 12, 14, 16, 18, 20])
})

test('mapConcurrent handles empty array', async () => {
  const results = await mapConcurrent([], 5, async () => 1)
  assert.deepEqual(results, [])
})
