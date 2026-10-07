import { test } from 'node:test'
import assert from 'node:assert/strict'
import { EventStore } from '../lib/events-store.js'
import { computeSignature, verifySignature } from '../lib/webhook-signature.js'

test('EventStore.fromWebhook parses push events', () => {
  const store = new EventStore(10)
  const payload = {
    ref: 'refs/heads/feature-x',
    commits: [
      { message: 'feat: add cool feature\\n\\nDetails' },
      { message: 'test: add unit test' },
    ],
    compare_url: 'https://gitea.example.com/acme/app/compare/main...feature-x',
    sender: { login: 'bob' },
  }
  const ev = store.fromWebhook({ event: 'push', action: '', payload })
  assert.equal(ev.type, 'push')
  assert.equal(ev.branch, 'feature-x')
  assert.equal(ev.commitsCount, 2)
  assert.equal(ev.sender, 'bob')
  assert.match(ev.title, /Push to feature-x \(2 commits\): feat: add cool feature/)
  assert.equal(ev.url, payload.compare_url)
})

test('EventStore.fromWebhook parses issue_comment events', () => {
  const store = new EventStore(10)
  const payload = {
    issue: { number: 42, pull_request: {}, html_url: 'https://gitea.example.com/acme/app/pulls/42' },
    comment: { body: 'Looks great to me, approved!', html_url: 'https://gitea.example.com/acme/app/pulls/42#comment-1' },
    sender: { login: 'alice' },
  }
  const ev = store.fromWebhook({ event: 'issue_comment', action: 'created', payload })
  assert.equal(ev.type, 'issue_comment')
  assert.equal(ev.action, 'created')
  assert.equal(ev.number, 42)
  assert.equal(ev.isPr, true)
  assert.equal(ev.sender, 'alice')
  assert.match(ev.title, /Comment on #42: Looks great to me, approved!/)
})

test('EventStore.fromWebhook parses release events', () => {
  const store = new EventStore(10)
  const payload = {
    release: { tag_name: 'v1.0.0', name: 'Release 1.0.0', html_url: 'https://gitea.example.com/acme/app/releases/tag/v1.0.0' },
    sender: { login: 'charlie' },
  }
  const ev = store.fromWebhook({ event: 'release', action: 'published', payload })
  assert.equal(ev.type, 'release')
  assert.equal(ev.action, 'published')
  assert.equal(ev.sender, 'charlie')
  assert.equal(ev.title, 'Release v1.0.0')
})

test('Inbound webhook flow with signature verification', () => {
  const secret = 'my-webhook-secret-123'
  const store = new EventStore(10)
  const bodyText = JSON.stringify({
    action: 'opened',
    number: 77,
    pull_request: { number: 77, title: 'Super PR', html_url: 'https://gitea.example.com/acme/app/pulls/77' },
    sender: { login: 'dev' },
  })

  // 1. Compute HMAC signature
  const validSig = computeSignature(secret, bodyText)
  assert.equal(verifySignature(secret, bodyText, validSig), true)

  // 2. Reject mismatched signature
  assert.equal(verifySignature(secret, bodyText, 'invalid_sig'), false)

  // 3. Reject wrong secret
  assert.equal(verifySignature('other-secret', bodyText, validSig), false)

  // 4. Ingestion into store
  const ev = store.fromWebhook({ event: 'pull_request', action: 'opened', payload: JSON.parse(bodyText) })
  const pushed = store.push(ev)
  assert.equal(pushed, true)
  assert.equal(store.list().length, 1)
  assert.equal(store.list()[0].number, 77)
  assert.equal(store.list()[0].sender, 'dev')
})

