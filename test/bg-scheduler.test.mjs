import { test } from 'node:test'
import assert from 'node:assert/strict'
import { BgScheduler, shouldFire } from '../lib/bg-scheduler.js'

test('shouldFire true when interval elapsed', () => {
  assert.equal(shouldFire({ lastRunAt: 0, intervalMs: 60000, now: 120000 }), true)
})

test('shouldFire false before interval', () => {
  assert.equal(shouldFire({ lastRunAt: 100000, intervalMs: 60000, now: 150000 }), false)
})

test('BgScheduler runs action and records lastRunAt', async () => {
  let ran = 0
  const scheduler = new BgScheduler({ intervalMs: 1000 })
  scheduler.onTick(async () => { ran += 1 })
  await scheduler.runOnce(60000)
  assert.equal(ran, 1)
  assert.ok(scheduler.lastRunAt > 0)
})

test('BgScheduler respects interval (does not fire early)', async () => {
  let ran = 0
  const scheduler = new BgScheduler({ intervalMs: 60000 })
  scheduler.onTick(async () => { ran += 1 })
  scheduler.lastRunAt = 100000
  await scheduler.runOnce(150000)
  assert.equal(ran, 0)
})

test('BgScheduler start/stop manage the timer', () => {
  const scheduler = new BgScheduler({ intervalMs: 60000 })
  scheduler.onTick(async () => {})
  scheduler.start()
  assert.ok(scheduler.timer)
  scheduler.stop()
  assert.equal(scheduler.timer, null)
})
