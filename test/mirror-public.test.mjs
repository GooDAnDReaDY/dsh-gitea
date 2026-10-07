import { test } from 'node:test'
import assert from 'node:assert/strict'
import { sanitizeForPublic, prepareMirror } from '../lib/mirror-public.js'

test('sanitizeForPublic replaces generic home and mount paths and private IPs', () => {
  const out = sanitizeForPublic('path /home/devaccount/x and /mnt/storagedrive and 192.168.1.100 and devaccount', {
    username: 'devaccount',
  })
  assert.ok(!out.includes('/home/devaccount'))
  assert.ok(!out.includes('/mnt/storagedrive'))
  assert.ok(!out.includes('192.168.1.100'))
  assert.ok(!out.includes('devaccount'))
  assert.ok(out.includes('/home/user'))
  assert.ok(out.includes('/path/to'))
  assert.ok(out.includes('127.0.0.1'))
})

test('sanitizeForPublic redacts tokens and secrets', () => {
  const secret = 'aabbccddeeff00112233445566778899aabbccdd'
  const out = sanitizeForPublic(`token ${secret}`, { tokens: [secret] })
  assert.ok(!out.includes(secret))
  assert.ok(out.includes('0000000000000000000000000000000000000000'))
})

test('sanitizeForPublic replaces private scope', () => {
  const out = sanitizeForPublic('@goodandready-private/dsh-gitea')
  assert.equal(out.includes('@goodandready-private'), false)
  assert.ok(out.includes('@goodandready/dsh-gitea'))
})

test('prepareMirror returns plan without executing', async () => {
  const plan = await prepareMirror({ source: 'gitea', target: 'github' }, {})
  assert.equal(plan.ok, true)
  assert.equal(plan.data.dryRun, true)
  assert.ok(plan.data.steps.length >= 3)
})
