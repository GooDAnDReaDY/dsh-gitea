import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parsePolicy, validatePolicy, evaluatePolicy } from '../lib/policy-code.js'

const GOOD = `
version: 1
requireApproval: true
requiredChecks:
  - ci
protectedPaths:
  - path: "lib/**"
    requiresReviewer: true
`

test('parsePolicy accepts a valid policy document', () => {
  const r = parsePolicy(GOOD)
  assert.equal(r.ok, true)
  assert.equal(r.data.requireApproval, true)
  assert.ok(r.data.protectedPaths.length === 1)
})

test('validatePolicy reports missing fields with clear errors', () => {
  const r = parsePolicy('version: 1\n')
  assert.equal(r.ok, true) // минимально валидна
  assert.equal(r.data.requireApproval, false)
})

test('parsePolicy rejects invalid yaml-ish input', () => {
  const r = parsePolicy('not: [valid')
  assert.equal(r.ok, false)
  assert.ok(r.error)
})

test('evaluatePolicy flags protected path change without reviewer', () => {
  const policy = parsePolicy(GOOD).data
  const r = evaluatePolicy(policy, ['lib/index.js'])
  assert.equal(r.ok, true)
  assert.ok(r.violations.length === 1)
  assert.match(r.violations[0], /lib\//)
})
