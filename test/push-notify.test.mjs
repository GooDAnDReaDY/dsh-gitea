import { test } from 'node:test'
import assert from 'node:assert/strict'
import { shouldNotify, buildNotifyMessage } from '../lib/push-notify.js'

test('shouldNotify true for opened PR and failed CI', () => {
  assert.equal(shouldNotify({ type: 'pull_request', action: 'opened' }), true)
  assert.equal(shouldNotify({ type: 'workflow_run', conclusion: 'failure' }), true)
})

test('shouldNotify false for other events', () => {
  assert.equal(shouldNotify({ type: 'pull_request', action: 'closed' }), false)
  assert.equal(shouldNotify({ type: 'issues', action: 'opened' }), false)
})

test('buildNotifyMessage formats PR event', () => {
  const msg = buildNotifyMessage({ type: 'pull_request', action: 'opened', number: 3, title: 'feat: x' })
  assert.match(msg, /PR #3/)
  assert.match(msg, /feat: x/)
})

test('buildNotifyMessage formats CI failure', () => {
  const msg = buildNotifyMessage({ type: 'workflow_run', conclusion: 'failure', number: 7, title: 'CI' })
  assert.match(msg, /CI/)
  assert.match(msg, /failed/i)
})
