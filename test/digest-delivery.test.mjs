import { test } from 'node:test'
import assert from 'node:assert/strict'
import { formatDigest, deliverDigest } from '../lib/digest-delivery.js'

test('formatDigest renders triage digest as text', () => {
  const data = { pullRequestsNoReview: [{ number: 2, title: 'PR' }], staleIssues: [], staleBranches: [], priorityAction: 'Review PRs' }
  const text = formatDigest('triage', data)
  assert.match(text, /triage/i)
  assert.match(text, /#2/)
  assert.match(text, /Review PRs/)
})

test('formatDigest handles empty digest', () => {
  const text = formatDigest('health', { openPRs: 0, openIssues: 0, staleIssues: [], staleBranches: [], errors: [] })
  assert.ok(text.length > 0)
})

test('deliverDigest sends webhook when target configured', async () => {
  let sent = null
  const post = async (url, payload) => { sent = { url, payload } }
  const r = await deliverDigest({ target: 'https://hooks.example.com/x', text: 'hello', dryRun: false }, { post })
  assert.equal(r.ok, true)
  assert.equal(sent.url, 'https://hooks.example.com/x')
  assert.equal(sent.payload.text, 'hello')
})

test('deliverDigest dry-run does not send', async () => {
  let sent = null
  const post = async (url, payload) => { sent = { url, payload } }
  const r = await deliverDigest({ target: 'https://hooks.example.com/x', text: 'hello', dryRun: true }, { post })
  assert.equal(r.ok, true)
  assert.equal(r.data.dryRun, true)
  assert.equal(sent, null)
})
