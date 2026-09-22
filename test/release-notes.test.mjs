import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildReleaseNotes, semverBump } from '../lib/release-notes.js'

test('semverBump: fix is patch, feat is minor, breaking is major', () => {
  assert.equal(semverBump(['fix: x', 'chore: y']), 'patch')
  assert.equal(semverBump(['feat: x']), 'minor')
  assert.equal(semverBump(['feat!: breaking']), 'major')
})

test('buildReleaseNotes aggregates merged PRs between base and head', async () => {
  const deps = {
    client: {
      listPulls: async () => ({ ok: true, data: [
        { number: 1, title: 'fix: a', merged_at: '2026-08-01T00:00:00Z', state: 'closed' },
        { number: 2, title: 'feat: b', merged_at: '2026-08-02T00:00:00Z', state: 'closed' },
        { number: 3, title: 'open', merged_at: null, state: 'open' },
      ] }),
    },
  }
  const r = await buildReleaseNotes({ owner: 'acme', repo: 'app', fromTag: 'v0.2.12', toTag: 'v0.2.13' }, deps)
  assert.equal(r.ok, true)
  assert.equal(r.data.changes.length, 2)
  assert.equal(r.data.bump, 'minor')
})

test('buildReleaseNotes handles empty result', async () => {
  const deps = { client: { listPulls: async () => ({ ok: true, data: [] }) } }
  const r = await buildReleaseNotes({ owner: 'acme', repo: 'app', fromTag: 'a', toTag: 'b' }, deps)
  assert.equal(r.ok, true)
  assert.equal(r.data.changes.length, 0)
  assert.equal(r.data.bump, 'patch')
})
