import { test } from 'node:test'
import assert from 'node:assert/strict'
import { checkMergeReadiness } from '../lib/merge-gate.js'

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
