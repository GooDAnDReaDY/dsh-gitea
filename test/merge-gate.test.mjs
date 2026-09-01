import { test } from 'node:test'
import assert from 'node:assert/strict'
import { checkMergeReadiness, autoMergeIfReady } from '../lib/merge-gate.js'

function mkDeps(over = {}) {
  const client = {
    getPull: async () => ({ ok: true, data: { number: 5, title: 'feat: x', body: 'full description with enough detail', mergeable: true, merged: false } }),
    listPullReviews: async () => ({ ok: true, data: [{ state: 'APPROVED', user: { login: 'bob' } }] }),
    listPullFiles: async () => ({ ok: true, data: [{ filename: 'lib/a.js' }, { filename: 'test/a.test.mjs' }] }),
    ...over,
  }
  return { client }
}

test('checkMergeReadiness returns pass for a ready PR', async () => {
  const r = await checkMergeReadiness({ owner: 'acme', repo: 'app', number: 5 }, mkDeps())
  assert.equal(r.ok, true)
  assert.equal(r.data.ready, true)
  assert.ok(r.data.checks.length >= 4)
})

test('checkMergeReadiness flags missing approval', async () => {
  const r = await checkMergeReadiness({ owner: 'acme', repo: 'app', number: 5 }, mkDeps({
    listPullReviews: async () => ({ ok: true, data: [] }),
  }))
  assert.equal(r.ok, true)
  assert.equal(r.data.ready, false)
  assert.ok(r.data.checks.some((c) => c.name === 'approval' && c.status === 'fail'))
})

test('checkMergeReadiness flags conflicts', async () => {
  const r = await checkMergeReadiness({ owner: 'acme', repo: 'app', number: 5 }, mkDeps({
    getPull: async () => ({ ok: true, data: { number: 5, title: 'x', body: 'd', mergeable: false, merged: false } }),
  }))
  assert.equal(r.ok, true)
  assert.equal(r.data.ready, false)
  assert.ok(r.data.checks.some((c) => c.name === 'conflicts' && c.status === 'fail'))
})

test('checkMergeReadiness handles missing PR data as unknown', async () => {
  const r = await checkMergeReadiness({ owner: 'acme', repo: 'app', number: 99 }, mkDeps({
    getPull: async () => ({ ok: false, error: 'nope' }),
  }))
  assert.equal(r.ok, true)
  assert.equal(r.data.ready, false)
})

// ---- #142 auto-merge gate ----

test('autoMergeIfReady merges when ready and confirm', async () => {
  const merged = []
  const deps = mkDeps({
    getPull: async () => ({ ok: true, data: { number: 1, title: 't', body: 'описание достаточно длинное для прохождения', mergeable: true, merged: false } }),
    mergePull: async (o, r, n) => { merged.push(n); return { ok: true, data: {} } },
  })
  const r = await autoMergeIfReady({ owner: 'acme', repo: 'app', number: 1, confirm: true }, deps)
  assert.equal(r.ok, true)
  assert.equal(r.data.merged, true)
  assert.deepEqual(merged, [1])
})

test('autoMergeIfReady refuses without confirm', async () => {
  const merged = []
  const deps = mkDeps({
    getPull: async () => ({ ok: true, data: { number: 2, title: 't', body: 'описание достаточно длинное для прохождения', mergeable: true, merged: false } }),
    mergePull: async (o, r, n) => { merged.push(n); return { ok: true, data: {} } },
  })
  const r = await autoMergeIfReady({ owner: 'acme', repo: 'app', number: 2 }, deps)
  assert.equal(r.ok, true)
  assert.equal(r.data.merged, false)
  assert.equal(r.data.needConfirm, true)
  assert.deepEqual(merged, [])
})
