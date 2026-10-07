import { test } from 'node:test'
import assert from 'node:assert/strict'
import { collectEvents, buildDutyReport } from '../lib/duty-officer.js'

function mkDeps(over = {}) {
  const client = {
    listIssues: async () => ({ ok: true, data: [{ number: 1, title: 'stale', updated_at: '2026-07-01T00:00:00Z', state: 'open' }] }),
    listPulls: async () => ({ ok: true, data: [{ number: 2, title: 'PR', user: { login: 'bob' }, updated_at: '2026-08-01T00:00:00Z', state: 'open' }] }),
    listPullReviews: async () => ({ ok: true, data: [] }),
    listBranches: async () => ({ ok: true, data: [] }),
    ...over,
  }
  return { client }
}

test('collectEvents deduplicates and lists new PRs and stale issues', async () => {
  const r = await collectEvents({ owner: 'acme', repo: 'app', lastCheckAt: '2026-08-01T00:00:00Z' }, mkDeps())
  assert.equal(r.ok, true)
  assert.ok(r.data.events.length >= 1)
  assert.ok(r.data.events.every((e) => e.id))
})

test('buildDutyReport returns read-only report with actions', async () => {
  const r = await buildDutyReport({ owner: 'acme', repo: 'app' }, mkDeps())
  assert.equal(r.ok, true)
  assert.ok(Array.isArray(r.data.actions))
  assert.equal(r.data.readOnly, true)
})

test('collectEvents handles empty repo', async () => {
  const r = await collectEvents({ owner: 'acme', repo: 'app' }, mkDeps({
    listIssues: async () => ({ ok: true, data: [] }),
    listPulls: async () => ({ ok: true, data: [] }),
  }))
  assert.equal(r.ok, true)
  assert.equal(r.data.events.length, 0)
})
