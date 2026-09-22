import { test } from 'node:test'
import assert from 'node:assert/strict'
import { enrichChip } from '../lib/chip-pr-ci.js'

function mkDeps(over = {}) {
  const client = {
    listPulls: async () => ({ ok: true, data: [{ number: 3, title: 'feat: x', state: 'open', head: { ref: 'feat/x' } }] }),
    listActionsRuns: async () => ({ ok: true, data: { workflow_runs: [{ id: 1, status: 'failure', head_sha: 'abc' }] } }),
    ...over,
  }
  return { client }
}

test('enrichChip finds open PR for current branch', async () => {
  const r = await enrichChip({ branch: 'feat/x', headSha: 'abc', owner: 'acme', repo: 'app' }, mkDeps())
  assert.equal(r.ok, true)
  assert.equal(r.data.prNumber, 3)
})

test('enrichChip reports CI failure for current sha', async () => {
  const r = await enrichChip({ branch: 'main', headSha: 'abc', owner: 'acme', repo: 'app' }, mkDeps())
  assert.equal(r.ok, true)
  assert.equal(r.data.ciFailed, true)
})

test('enrichChip handles missing config (no client calls)', async () => {
  const r = await enrichChip({ branch: 'main', headSha: '', owner: '', repo: '' }, mkDeps())
  assert.equal(r.ok, true)
  assert.equal(r.data.prNumber, null)
  assert.equal(r.data.ciFailed, false)
})
