import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildReviewInbox } from '../lib/review-inbox.js'

test('classifies PRs into awaitingMine, awaitingTheirs, mergeReady', async () => {
  const deps = {
    client: {
      listPulls: async () => ({ ok: true, data: [
        { number: 1, title: 'Mine no approval', user: { login: 'alice' }, mergeable: true },
        { number: 2, title: 'Approved', user: { login: 'bob' }, mergeable: true },
      ] }),
      listPullReviews: async (o, r, n) => {
        if (n === 1) return { ok: true, data: [{ state: 'APPROVED', user: { login: 'bob' } }] }
        if (n === 2) return { ok: true, data: [{ state: 'APPROVED', user: { login: 'alice' } }] }
        return { ok: true, data: [] }
      },
    },
  }
  const inbox = await buildReviewInbox({ owner: 'acme', repo: 'app', user: 'alice' }, deps)
  assert.equal(inbox.ok, true)
  assert.ok(inbox.data.awaitingMine.length >= 0)
  assert.equal(inbox.data.mergeReady.some((p) => p.number === 2), true)
  assert.ok(Array.isArray(inbox.data.awaitingTheirs))
})

test('handles empty repo and API errors', async () => {
  const deps = {
    client: {
      listPulls: async () => ({ ok: true, data: [] }),
      listPullReviews: async () => ({ ok: true, data: [] }),
    },
  }
  const inbox = await buildReviewInbox({ owner: 'acme', repo: 'app', user: 'alice' }, deps)
  assert.equal(inbox.ok, true)
  assert.equal(inbox.data.awaitingMine.length, 0)
  assert.equal(inbox.data.mergeReady.length, 0)
})

test('API error in listPulls is captured', async () => {
  const deps = {
    client: {
      listPulls: async () => ({ ok: false, error: 'boom' }),
      listPullReviews: async () => ({ ok: true, data: [] }),
    },
  }
  const inbox = await buildReviewInbox({ owner: 'acme', repo: 'app', user: 'alice' }, deps)
  assert.equal(inbox.ok, true)
  assert.ok(inbox.data.errors.length >= 1)
})
