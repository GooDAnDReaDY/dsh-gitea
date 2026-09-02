import { test } from 'node:test'
import assert from 'node:assert/strict'
import { findEscalations, escalate } from '../lib/review-escalation.js'

const DAY = 86400000

test('findEscalations flags high-priority PR without review after N days', async () => {
  const client = {
    listPulls: async () => ({ ok: true, data: [{ number: 5, title: 'urgent', state: 'open', updated_at: new Date(Date.now() - 4 * DAY).toISOString() }] }),
    getPull: async () => ({ ok: true, data: { number: 5, labels: [{ name: 'priority/high' }] } }),
    listPullReviews: async () => ({ ok: true, data: [] }),
  }
  const r = await findEscalations({ owner: 'acme', repo: 'app', staleDays: 3 }, { client })
  assert.equal(r.ok, true)
  assert.equal(r.data.escalations.length, 1)
})

test('findEscalations skips reviewed or recent PRs', async () => {
  const client = {
    listPulls: async () => ({ ok: true, data: [
      { number: 1, title: 'reviewed', state: 'open', updated_at: new Date(Date.now() - 5 * DAY).toISOString() },
      { number: 2, title: 'fresh', state: 'open', updated_at: new Date(Date.now() - 1 * DAY).toISOString() },
    ] }),
    getPull: async () => ({ ok: true, data: { number: 1, labels: [] } }),
    listPullReviews: async () => ({ ok: true, data: [{ state: 'APPROVED' }] }),
  }
  const r = await findEscalations({ owner: 'acme', repo: 'app', staleDays: 3 }, { client })
  assert.equal(r.ok, true)
  assert.equal(r.data.escalations.length, 0)
})

test('escalate dry-runs without confirm', async () => {
  const client = { listPulls: async () => ({ ok: true, data: [] }) }
  const r = await escalate({ owner: 'acme', repo: 'app', staleDays: 3, dryRun: true }, { client })
  assert.equal(r.ok, true)
  assert.equal(r.data.applied, false)
})
