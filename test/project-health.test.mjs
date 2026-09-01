import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildHealthReport } from '../lib/project-health.js'

const NOW = new Date('2026-08-28T12:00:00Z')

function daysAgo(n) {
  return new Date(NOW.getTime() - n * 86400000).toISOString()
}

test('buildHealthReport returns structured summary', async () => {
  const deps = {
    client: {
      listIssues: async () => ({ ok: true, data: [{ number: 1, title: 'stale', updated_at: daysAgo(30), state: 'open' }] }),
      listPulls: async () => ({ ok: true, data: [{ number: 2, title: 'PR', updated_at: daysAgo(1), state: 'open' }] }),
      listBranches: async () => ({ ok: true, data: [{ name: 'old-branch', commit: { created: daysAgo(40) } }] }),
    },
  }
  const report = await buildHealthReport({ owner: 'acme', repo: 'app' }, deps, NOW)
  assert.equal(report.ok, true)
  assert.equal(report.data.openPRs, 1)
  assert.equal(report.data.openIssues, 1)
  assert.ok(report.data.staleIssues.length === 1)
  assert.equal(report.data.staleIssues[0].number, 1)
  assert.ok(Array.isArray(report.data.staleBranches))
})

test('buildHealthReport handles empty repo', async () => {
  const deps = {
    client: {
      listIssues: async () => ({ ok: true, data: [] }),
      listPulls: async () => ({ ok: true, data: [] }),
      listBranches: async () => ({ ok: true, data: [] }),
    },
  }
  const report = await buildHealthReport({ owner: 'acme', repo: 'app' }, deps, NOW)
  assert.equal(report.ok, true)
  assert.equal(report.data.openPRs, 0)
  assert.equal(report.data.openIssues, 0)
  assert.equal(report.data.staleIssues.length, 0)
})

test('buildHealthReport respects stale thresholds', async () => {
  const deps = {
    client: {
      listIssues: async () => ({ ok: true, data: [{ number: 1, title: 'fresh', updated_at: daysAgo(2), state: 'open' }] }),
      listPulls: async () => ({ ok: true, data: [] }),
      listBranches: async () => ({ ok: true, data: [] }),
    },
  }
  const report = await buildHealthReport({ owner: 'acme', repo: 'app', staleDays: 14 }, deps, NOW)
  assert.equal(report.ok, true)
  assert.equal(report.data.staleIssues.length, 0)
})

test('buildHealthReport handles API errors gracefully', async () => {
  const deps = {
    client: {
      listIssues: async () => ({ ok: false, error: 'boom' }),
      listPulls: async () => ({ ok: true, data: [] }),
      listBranches: async () => ({ ok: true, data: [] }),
    },
  }
  const report = await buildHealthReport({ owner: 'acme', repo: 'app' }, deps, NOW)
  assert.equal(report.ok, true)
  assert.equal(report.data.openIssues, 0)
  assert.ok(report.data.errors.length >= 1)
})
