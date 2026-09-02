import { test } from 'node:test'
import assert from 'node:assert/strict'
import { templateForBranch } from '../lib/pr-templates-branch.js'

test('templateForBranch returns feat template for feat/ branch', () => {
  const t = templateForBranch('feat/42-new-thing', { number: 42, title: 'feat: new thing' })
  assert.match(t, /Что|What|Summary/i)
  assert.ok(t.includes('42'))
})

test('templateForBranch returns fix template for fix/ branch', () => {
  const t = templateForBranch('fix/7-bug', { number: 7, title: 'fix: bug' })
  assert.match(t, /Проблема|Problem|Bug/i)
})

test('templateForBranch falls back to generic', () => {
  const t = templateForBranch('random-branch', { number: 1, title: 'x' })
  assert.ok(typeof t === 'string' && t.length > 0)
})

test('templateForBranch matches docs and chore', () => {
  assert.match(templateForBranch('docs/readme', { number: 1, title: 'docs' }), /docs|документац/i)
  assert.ok(templateForBranch('chore/ci', { number: 2, title: 'chore' }))
})
