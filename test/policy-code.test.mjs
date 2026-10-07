import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parsePolicy, validatePolicy, evaluatePolicy, globToRegex } from '../lib/policy-code.js'

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
  assert.deepEqual(r.data.requiredChecks, ['ci'])
  assert.ok(r.data.protectedPaths.length === 1)
})

test('validatePolicy reports missing fields with clear errors', () => {
  const r = parsePolicy('version: 1\n')
  assert.equal(r.ok, true)
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

test('evaluatePolicy correctly matches recursive ** in subdirectories (#270)', () => {
  const policy = {
    protectedPaths: [
      { path: 'src/**', requiresReviewer: true },
      { path: 'docs/*.md', requiresReviewer: true },
    ],
  }
  const r1 = evaluatePolicy(policy, ['src/a.js', 'src/a/b.js', 'src/a/b/c/deep.js'])
  assert.equal(r1.ok, true)
  assert.equal(r1.violations.length, 3, 'src/** must match all nested subdirectories')

  const r2 = evaluatePolicy(policy, ['docs/readme.md', 'docs/sub/readme.md'])
  assert.equal(r2.ok, true)
  assert.equal(r2.violations.length, 1, 'docs/*.md must match top-level md but not nested sub/readme.md')
})

test('globToRegex safely handles unescaped regex characters and malformed input (#270)', () => {
  // Unclosed bracket or unescaped regex quantifier must not throw
  const re1 = globToRegex('lib/[test]+(a)')
  assert.ok(re1 instanceof RegExp)
  assert.equal(re1.test('lib/[test]+(a)'), true)
  assert.equal(re1.test('lib/other'), false)

  const re2 = globToRegex('invalid-[')
  assert.ok(re2 instanceof RegExp)
  assert.equal(re2.test('invalid-['), true)

  const reEmpty = globToRegex('')
  assert.equal(reEmpty, null)
})
