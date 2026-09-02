import { test } from 'node:test'
import assert from 'node:assert/strict'
import { planSprint } from '../lib/sprint-plan.js'

test('planSprint picks status/ready issues and orders by priority', async () => {
  const client = {
    listIssues: async () => ({ ok: true, data: [
      { number: 1, title: 'low task', state: 'open', labels: [{ name: 'status/ready' }, { name: 'priority/low' }] },
      { number: 2, title: 'high task', state: 'open', labels: [{ name: 'status/ready' }, { name: 'priority/high' }] },
      { number: 3, title: 'not ready', state: 'open', labels: [{ name: 'priority/high' }] },
    ] }),
    listMilestones: async () => ({ ok: true, data: [] }),
  }
  const r = await planSprint({ owner: 'acme', repo: 'app' }, { client })
  assert.equal(r.ok, true)
  assert.equal(r.data.dryRun, true)
  assert.equal(r.data.issues.length, 2)
  // high раньше low
  assert.ok(r.data.issues[0].labels.includes('priority/high') || r.data.issues[0].number === 2)
})

test('planSprint empty when no ready issues', async () => {
  const client = { listIssues: async () => ({ ok: true, data: [] }), listMilestones: async () => ({ ok: true, data: [] }) }
  const r = await planSprint({ owner: 'acme', repo: 'app' }, { client })
  assert.equal(r.ok, true)
  assert.equal(r.data.issues.length, 0)
})

test('planSprint suggests milestone', async () => {
  const client = {
    listIssues: async () => ({ ok: true, data: [{ number: 1, title: 'x', state: 'open', labels: [{ name: 'status/ready' }] }] }),
    listMilestones: async () => ({ ok: true, data: [{ id: 7, title: 'v0.5', state: 'open' }] }),
  }
  const r = await planSprint({ owner: 'acme', repo: 'app' }, { client })
  assert.equal(r.ok, true)
  assert.ok(r.data.milestone)
})
