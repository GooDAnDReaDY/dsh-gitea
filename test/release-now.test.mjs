import { test } from 'node:test'
import assert from 'node:assert/strict'
import { planReleaseNow } from '../lib/release-now.js'

test('planReleaseNow returns dry-run plan with bump', async () => {
  const client = {
    listPulls: async () => ({ ok: true, data: [
      { number: 1, title: 'feat: x', state: 'closed', merged_at: '2026-09-01T00:00:00Z' },
      { number: 2, title: 'fix: y', state: 'closed', merged_at: '2026-09-01T00:00:00Z' },
    ] }),
  }
  const r = await planReleaseNow({ owner: 'acme', repo: 'app' }, { client })
  assert.equal(r.ok, true)
  assert.equal(r.data.dryRun, true)
  assert.equal(r.data.bump, 'minor')
  assert.ok(Array.isArray(r.data.features))
})

test('planReleaseNow handles empty merged PRs', async () => {
  const client = { listPulls: async () => ({ ok: true, data: [] }) }
  const r = await planReleaseNow({ owner: 'acme', repo: 'app' }, { client })
  assert.equal(r.ok, true)
  assert.equal(r.data.bump, 'patch')
})
