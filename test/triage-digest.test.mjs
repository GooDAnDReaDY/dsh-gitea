import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildTriageDigest } from '../lib/triage-digest.js'

function mkDeps(over = {}) {
  const client = {
    listIssues: async () => ({ ok: true, data: [{ number: 1, title: 'stale', updated_at: '2026-07-01T00:00:00Z', state: 'open' }] }),
    listPulls: async () => ({ ok: true, data: [
      { number: 2, title: 'PR no review', user: { login: 'bob' }, updated_at: '2026-08-01T00:00:00Z', state: 'open' },
    ] }),
    listPullReviews: async () => ({ ok: true, data: [] }),
    listBranches: async () => ({ ok: true, data: [] }),
    ...over,
  }
  return { client }
}

test('buildTriageDigest aggregates PRs, issues, and priorities', async () => {
  const r = await buildTriageDigest({ owner: 'acme', repo: 'app' }, mkDeps(), new Date('2026-08-28T12:00:00Z'))
  assert.equal(r.ok, true)
  assert.ok(r.data.pullRequestsNoReview.length >= 1)
  assert.ok(r.data.staleIssues.length >= 1)
  assert.ok(r.data.priorityAction)
})

test('buildTriageDigest handles empty repo', async () => {
  const r = await buildTriageDigest({ owner: 'acme', repo: 'app' }, mkDeps({
    listIssues: async () => ({ ok: true, data: [] }),
    listPulls: async () => ({ ok: true, data: [] }),
  }), new Date('2026-08-28T12:00:00Z'))
  assert.equal(r.ok, true)
  assert.equal(r.data.pullRequestsNoReview.length, 0)
  assert.equal(r.data.staleIssues.length, 0)
})

test('buildTriageDigest marks API errors', async () => {
  const r = await buildTriageDigest({ owner: 'acme', repo: 'app' }, mkDeps({
    listIssues: async () => ({ ok: false, error: 'boom' }),
  }), new Date('2026-08-28T12:00:00Z'))
  assert.equal(r.ok, true)
  assert.ok(r.data.errors.length >= 1)
})
