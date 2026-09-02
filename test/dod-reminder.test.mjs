import { test } from 'node:test'
import assert from 'node:assert/strict'
import { checkDoD } from '../lib/dod-reminder.js'

test('checkDoD returns reminder when git files changed without issue ref', () => {
  const r = checkDoD({ changedGitFiles: true, references: [] })
  assert.equal(r.ok, true)
  assert.equal(r.reminder, true)
  assert.match(r.message, /issue|PR/i)
})

test('checkDoD no reminder when issue ref exists', () => {
  const r = checkDoD({ changedGitFiles: true, references: ['Refs: #37'] })
  assert.equal(r.ok, true)
  assert.equal(r.reminder, false)
})

test('checkDoD no reminder when nothing changed', () => {
  const r = checkDoD({ changedGitFiles: false, references: [] })
  assert.equal(r.ok, true)
  assert.equal(r.reminder, false)
})

test('checkDoD detects issue reference in text', () => {
  const r = checkDoD({ changedGitFiles: true, references: [], text: 'closes #16 and related #17' })
  assert.equal(r.ok, true)
  assert.equal(r.reminder, false)
})

test('checkDoD is stateless across consecutive calls with refs', () => {
  for (let i = 0; i < 5; i += 1) {
    const r = checkDoD({ changedGitFiles: true, references: ['#12'] })
    assert.equal(r.reminder, false, `iteration ${i} must not produce reminder`)
  }
})
