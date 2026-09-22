import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildPrReview } from '../lib/pr-review.js'

function mkDeps(files = [], over = {}) {
  const client = {
    listPullFiles: async () => ({ ok: true, data: files }),
    getPullMergeStatus: async () => ({ ok: true, data: { mergeable: true, has_conflicts: false } }),
    listPullReviews: async () => ({ ok: true, data: [] }),
    ...over,
  }
  return { client }
}

test('buildPrReview returns structured review with files', async () => {
  const r = await buildPrReview({ owner: 'acme', repo: 'app', number: 1 }, mkDeps([
    { filename: 'src/api/user.ts', status: 'modified', additions: 12, deletions: 2 },
    { filename: 'db/migration/001.sql', status: 'added', additions: 40, deletions: 0 },
  ]))
  assert.equal(r.ok, true)
  assert.equal(r.data.readOnly, true)
  assert.ok(r.data.files.length === 2)
  assert.ok(r.data.risks.some((x) => x.type === 'migration'))
})

test('buildPrReview flags security-sensitive files', async () => {
  const r = await buildPrReview({ owner: 'acme', repo: 'app', number: 2 }, mkDeps([
    { filename: 'config/.env.example', status: 'modified', additions: 5, deletions: 0 },
  ]))
  assert.ok(r.data.risks.some((x) => x.type === 'security'))
})

test('buildPrReview gives verdict and questions', async () => {
  const r = await buildPrReview({ owner: 'acme', repo: 'app', number: 3 }, mkDeps([
    { filename: 'src/lib/util.ts', status: 'modified', additions: 3, deletions: 1 },
  ]))
  assert.ok(['approve', 'comment', 'request_changes'].includes(r.data.verdict))
  assert.ok(Array.isArray(r.data.questions))
})

test('buildPrReview reports merge status', async () => {
  const r = await buildPrReview({ owner: 'acme', repo: 'app', number: 4 }, mkDeps([
    { filename: 'a.ts', status: 'modified', additions: 1, deletions: 0 },
  ], { getPullMergeStatus: async () => ({ ok: true, data: { mergeable: false, has_conflicts: true } }) }))
  assert.equal(r.data.mergeStatus.has_conflicts, true)
})
