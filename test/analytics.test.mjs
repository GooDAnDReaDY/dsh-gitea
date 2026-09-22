import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildAnalytics } from '../lib/analytics.js'

function mkDeps(issues = [], pulls = []) {
  const client = {
    listIssues: async () => ({ ok: true, data: issues }),
    listPulls: async () => ({ ok: true, data: pulls }),
  }
  return { client }
}

test('buildAnalytics computes open/closed ratio', async () => {
  const r = await buildAnalytics({ owner: 'acme', repo: 'app' }, mkDeps(
    [
      { number: 1, state: 'open', created_at: '2026-08-01T00:00:00Z', updated_at: '2026-08-10T00:00:00Z' },
      { number: 2, state: 'closed', created_at: '2026-08-01T00:00:00Z', updated_at: '2026-08-05T00:00:00Z' },
    ],
    [],
  ))
  assert.equal(r.ok, true)
  assert.equal(r.data.issues.open, 1)
  assert.equal(r.data.issues.closed, 1)
  assert.equal(r.data.readOnly, true)
})

test('buildAnalytics computes cycle time for closed issues', async () => {
  const r = await buildAnalytics({ owner: 'acme', repo: 'app' }, mkDeps(
    [
      { number: 2, state: 'closed', created_at: '2026-08-01T00:00:00Z', updated_at: '2026-08-05T00:00:00Z' },
    ],
    [],
  ))
  assert.equal(r.ok, true)
  assert.ok(r.data.cycleTimeDays >= 3 && r.data.cycleTimeDays <= 5)
})

test('buildAnalytics counts open PRs', async () => {
  const r = await buildAnalytics({ owner: 'acme', repo: 'app' }, mkDeps([], [
    { number: 1, state: 'open' },
    { number: 2, state: 'open' },
    { number: 3, state: 'merged' },
    { number: 4, state: 'closed', merged: true },
    { number: 5, state: 'closed', merged: false },
  ]))
  assert.equal(r.data.pulls.open, 2)
  assert.equal(r.data.pulls.merged, 2)
  assert.equal(r.data.pulls.closed, 1)
})

test('buildAnalytics handles empty repo', async () => {
  const r = await buildAnalytics({ owner: 'acme', repo: 'app' }, mkDeps([], []))
  assert.equal(r.ok, true)
  assert.equal(r.data.issues.open, 0)
  assert.equal(r.data.pulls.open, 0)
})
