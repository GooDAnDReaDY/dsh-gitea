import { test } from 'node:test'
import assert from 'node:assert/strict'
import { verifySignature, computeSignature } from '../lib/webhook-signature.js'

test('computeSignature returns hex HMAC-SHA256', () => {
  const sig = computeSignature('secret', '{"a":1}')
  assert.equal(typeof sig, 'string')
  assert.match(sig, /^[0-9a-f]{64}$/)
})

test('verifySignature accepts matching signature', () => {
  const body = 'payload'
  const sig = computeSignature('secret', body)
  assert.equal(verifySignature('secret', body, sig), true)
})

test('verifySignature rejects wrong signature', () => {
  const body = 'payload'
  const sig = computeSignature('wrong', body)
  assert.equal(verifySignature('secret', body, sig), false)
})

test('verifySignature with empty secret returns true (disabled)', () => {
  assert.equal(verifySignature('', 'body', 'anything'), true)
})
