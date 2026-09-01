import { test } from 'node:test'
import assert from 'node:assert/strict'
import { sanitizeForPublic, prepareMirror } from '../lib/mirror-public.js'

test('sanitizeForPublic replaces personal patterns', () => {
  const out = sanitizeForPublic('path /home/vadim/x and /mnt/external and 192.168.1.1 and vadim')
  assert.ok(!out.includes('/home/vadim'))
  assert.ok(!out.includes('/mnt/external'))
  assert.ok(!out.includes('192.168.1.1'))
  assert.ok(!out.includes('vadim'))
  assert.ok(out.includes('/home/user'))
  assert.ok(out.includes('/path/to'))
})

test('sanitizeForPublic replaces old token', () => {
  const out = sanitizeForPublic('token 36c9614607417f02736f35565a8340ccdf20437c')
  assert.ok(!out.includes('36c9614607417f02736f35565a8340ccdf20437c'))
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
