import { test } from 'node:test'
import assert from 'node:assert/strict'
import { EventStore } from '../lib/events-store.js'

test('EventStore stores and lists events', () => {
  const store = new EventStore(10)
  store.push({ type: 'pull_request', number: 3, title: 'PR' })
  const events = store.list()
  assert.equal(events.length, 1)
  assert.equal(events[0].number, 3)
})

test('EventStore caps at max and drops oldest', () => {
  const store = new EventStore(3)
  store.push({ type: 'a', number: 1 })
  store.push({ type: 'b', number: 2 })
  store.push({ type: 'c', number: 3 })
  store.push({ type: 'd', number: 4 })
  const events = store.list()
  assert.equal(events.length, 3)
  assert.equal(events[0].number, 4)
  assert.equal(events[2].number, 2)
})

test('EventStore dedupes by event id', () => {
  const store = new EventStore(10)
  store.push({ id: 'x', type: 'a', number: 1 })
  store.push({ id: 'x', type: 'a', number: 1 })
  assert.equal(store.list().length, 1)
})

test('EventStore maps webhook payload to event', () => {
  const store = new EventStore(10)
  const ev = store.fromWebhook({ event: 'pull_request', action: 'opened', payload: { number: 5, pull_request: { title: 'feat' } } })
  assert.equal(ev.type, 'pull_request')
  assert.equal(ev.number, 5)
  assert.equal(ev.action, 'opened')
})
