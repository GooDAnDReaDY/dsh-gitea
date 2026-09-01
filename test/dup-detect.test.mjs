import { test } from 'node:test'
import assert from 'node:assert/strict'
import { findDuplicates, normalizeText, similarity } from '../lib/dup-detect.js'

test('normalizeText lowercases and strips punctuation', () => {
  assert.deepEqual(normalizeText('Hello, WORLD! 123'), ['hello', 'world', '123'])
  assert.deepEqual(normalizeText('  Foo   Bar  '), ['foo', 'bar'])
})

test('similarity is high for near-identical titles', () => {
  const s = similarity('fix login crash', 'fix login crash on startup')
  assert.ok(s > 0.5)
})

test('similarity is low for unrelated titles', () => {
  const s = similarity('add dark theme', 'bump dependency version')
  assert.ok(s < 0.3)
})

test('findDuplicates returns ranked candidates with explanation', async () => {
  const issues = [
    { number: 1, title: 'fix login crash', body: 'login crashes' },
    { number: 2, title: 'add dark theme', body: 'theme' },
    { number: 3, title: 'login crash on startup', body: 'crash when logging in' },
  ]
  const deps = { client: { searchIssues: async () => ({ ok: true, data: issues }) } }
  const r = await findDuplicates({ owner: 'acme', repo: 'app', title: 'login crashes', body: 'crash during login' }, deps)
  assert.equal(r.ok, true)
  assert.ok(r.data.candidates.length >= 1)
  assert.ok(r.data.candidates[0].number !== undefined)
  assert.ok(r.data.candidates[0].score > 0)
  assert.ok(r.data.candidates[0].reason)
})

test('findDuplicates returns empty when nothing matches', async () => {
  const deps = { client: { searchIssues: async () => ({ ok: true, data: [{ number: 1, title: 'xyz', body: 'abc' }] }) } }
  const r = await findDuplicates({ owner: 'acme', repo: 'app', title: 'totally unrelated qwerty', body: '' }, deps)
  assert.equal(r.ok, true)
  assert.equal(r.data.candidates.length, 0)
})
