import { test } from 'node:test'
import assert from 'node:assert/strict'
import { planBatch, applyBatch } from '../lib/batch-ops.js'

function mkClient(over = {}) {
  const calls = []
  const client = {
    calls,
    listIssues: async () => ({ ok: true, data: [
      { number: 1, title: 'a', labels: [], milestone: null, assignees: [] },
      { number: 2, title: 'b', labels: [], milestone: null, assignees: [] },
    ] }),
    updateIssue: async (...a) => { calls.push(['updateIssue', a]); return { ok: true, data: {} } },
    setIssueLabels: async (...a) => { calls.push(['setIssueLabels', a]); return { ok: true, data: {} } },
    setIssueAssignee: async (...a) => { calls.push(['setIssueAssignee', a]); return { ok: true, data: {} } },
    ...over,
  }
  return client
}

test('planBatch returns preview without applying anything', async () => {
  const client = mkClient()
  const r = await planBatch({ owner: 'acme', repo: 'app', label: 'type/bug' }, { client })
  assert.equal(r.ok, true)
  assert.ok(r.data.preview.length === 2)
  assert.equal(r.data.preview[0].number, 1)
  assert.equal(client.calls.length, 0)
})

test('applyBatch applies labels to selected issues and logs results', async () => {
  const client = mkClient()
  const r = await applyBatch({ owner: 'acme', repo: 'app', label: 'type/bug', numbers: [1, 2] }, { client })
  assert.equal(r.ok, true)
  assert.ok(r.data.results.length === 2)
  assert.ok(r.data.results.every((x) => x.ok === true))
  assert.ok(client.calls.some((c) => c[0] === 'setIssueLabels'))
})

test('applyBatch records per-issue failures without stopping', async () => {
  const client = mkClient({
    setIssueLabels: async (...a) => { client.calls.push(['setIssueLabels', a]); return { ok: false, error: 'boom' } },
  })
  const r = await applyBatch({ owner: 'acme', repo: 'app', label: 'x', numbers: [1, 2] }, { client })
  assert.equal(r.ok, true)
  assert.ok(r.data.results.every((x) => x.ok === false))
  assert.ok(r.data.results.every((x) => x.errors.some((e) => e.includes('boom'))))
})

test('applyBatch applies milestone via updateIssue and records in applied', async () => {
  const client = mkClient()
  const r = await applyBatch({ owner: 'acme', repo: 'app', milestone: 7, numbers: [1] }, { client })
  assert.equal(r.ok, true)
  assert.equal(r.data.results[0].ok, true)
  assert.deepEqual(r.data.results[0].applied, ['milestone'])
  assert.deepEqual(r.data.results[0].errors, [])
  assert.ok(client.calls.some((c) => c[0] === 'updateIssue' && c[1][2] === 1 && c[1][3].milestone === 7))
})

test('applyBatch does not record unapplied milestone in applied on failure', async () => {
  const client = mkClient({
    updateIssue: async () => ({ ok: false, error: 'milestone not found' }),
  })
  const r = await applyBatch({ owner: 'acme', repo: 'app', milestone: 999, label: 'type/bug', numbers: [1] }, { client })
  assert.equal(r.ok, true)
  const res = r.data.results[0]
  assert.equal(res.ok, false)
  // label was applied
  assert.ok(res.applied.includes('labels'))
  // milestone was NOT applied and must NOT be in applied
  assert.ok(!res.applied.includes('milestone'))
  assert.ok(!res.applied.some((a) => a.startsWith('milestone:')))
  assert.ok(res.errors.some((e) => e.includes('milestone')))
})
