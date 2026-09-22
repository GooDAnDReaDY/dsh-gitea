import test from 'node:test'
import assert from 'node:assert/strict'
import { createGiteaEventsService, toSafeGiteaEvent } from '../lib/gitea-events.js'

test('giteaEvents service supports subscribe and unsubscribe', () => {
  const service = createGiteaEventsService()
  const events = []
  const unsubscribe = service.subscribe((ev) => events.push(ev))

  assert.equal(service.subscriberCount, 1)

  service.emit({
    event: 'pull_request',
    action: 'opened',
    payload: {
      id: 'pr-100',
      pull_request: { number: 42, head: { ref: 'feature/login' } },
      repository: { name: 'app', owner: { login: 'acme' } },
      secretToken: 'super-secret',
    },
  })

  assert.equal(events.length, 1)
  assert.equal(events[0].id, 'pr-100')
  assert.equal(events[0].event, 'pull_request')
  assert.equal(events[0].action, 'opened')
  assert.deepEqual(events[0].giteaContext, {
    owner: 'acme',
    repo: 'app',
    issue: null,
    pull: 42,
    project: null,
    ref: 'feature/login',
  })
  // Ensure sensitive fields are omitted
  assert.equal('secretToken' in events[0], false)
  assert.equal('payload' in events[0], false)

  unsubscribe()
  assert.equal(service.subscriberCount, 0)

  service.emit({ event: 'push', payload: {} })
  assert.equal(events.length, 1)
})

test('giteaEvents on("event", listener) acts as an EventEmitter alias for subscribe', () => {
  const service = createGiteaEventsService()
  const events = []
  const stop = service.on('event', (ev) => events.push(ev))

  assert.equal(service.subscriberCount, 1)
  service.emit({ event: 'push', action: '', payload: { ref: 'refs/heads/main' } })
  assert.equal(events.length, 1)
  assert.equal(events[0].giteaContext.ref, 'main')

  stop()
  assert.equal(service.subscriberCount, 0)
})

test('giteaEvents isolates subscriber failures and continues delivering to others', () => {
  const service = createGiteaEventsService()
  const results = []

  service.subscribe(() => {
    throw new Error('Subscriber failure!')
  })
  service.subscribe((ev) => {
    results.push(ev.id)
  })

  assert.doesNotThrow(() => {
    service.emit({ event: 'release', payload: { id: 'rel-1' } })
  })

  assert.deepEqual(results, ['rel-1'])
})

test('toSafeGiteaEvent extracts safe issue and PR context without leaking body or comments', () => {
  const raw = {
    event: 'issue_comment',
    action: 'created',
    payload: {
      id: 'comment-55',
      body: 'This is a sensitive comment body with confidential data',
      comment: { body: 'Do not expose this comment' },
      issue: { number: 17, pull_request: false },
      repository: { name: 'core', owner: { login: 'goodandready' } },
      headers: { authorization: 'Bearer 12345' },
    },
  }

  const safe = toSafeGiteaEvent(raw)
  assert.equal(safe.id, 'comment-55')
  assert.equal(safe.event, 'issue_comment')
  assert.equal(safe.action, 'created')
  assert.deepEqual(safe.giteaContext, {
    owner: 'goodandready',
    repo: 'core',
    issue: 17,
    pull: null,
    project: null,
    ref: null,
  })
  assert.equal(safe.body, undefined)
  assert.equal(safe.comment, undefined)
  assert.equal(safe.headers, undefined)
})
