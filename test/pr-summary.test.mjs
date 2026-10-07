import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildPrSummary } from '../lib/pr-summary.js'

function mkDeps(over = {}) {
  const client = {
    getPull: async () => ({ ok: true, data: { number: 5, title: 'feat: x', body: 'desc', state: 'open', user: { login: 'alice' } } }),
    listPullFiles: async () => ({ ok: true, data: [
      { filename: 'lib/index.js', additions: 10, deletions: 2 },
      { filename: 'test/index.test.mjs', additions: 5, deletions: 0 },
      { filename: 'db/migration.sql', additions: 20, deletions: 0 },
    ] }),
    listPullReviews: async () => ({ ok: true, data: [{ state: 'APPROVED', user: { login: 'bob' } }] }),
    getPullMergeStatus: async () => ({ ok: true, data: {} }),
    ...over,
  }
  return { client }
}

test('buildPrSummary aggregates files, areas, risks, and review state', async () => {
  const r = await buildPrSummary({ owner: 'acme', repo: 'app', number: 5 }, mkDeps())
  assert.equal(r.ok, true)
  assert.equal(r.data.number, 5)
  assert.ok(r.data.files.length === 3)
  assert.ok(r.data.totalAdditions >= 30)
  assert.ok(r.data.areas.includes('lib'))
  assert.ok(r.data.testFiles.length >= 1)
  assert.ok(r.data.risks.some((x) => /migration/i.test(x.type)))
})

test('buildPrSummary marks missing data explicitly', async () => {
  const r = await buildPrSummary({ owner: 'acme', repo: 'app', number: 5 }, mkDeps({
    listPullFiles: async () => ({ ok: false, error: 'no access' }),
    getPullMergeStatus: async () => ({ ok: false, error: 'n/a' }),
  }))
  assert.equal(r.ok, true)
  assert.ok(r.data.missing.length >= 1)
})

test('buildPrSummary handles empty PR without throwing', async () => {
  const r = await buildPrSummary({ owner: 'acme', repo: 'app', number: 99 }, mkDeps({
    getPull: async () => ({ ok: true, data: null }),
    listPullFiles: async () => ({ ok: true, data: [] }),
  }))
  assert.equal(r.ok, true)
})
