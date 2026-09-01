import { test } from 'node:test'
import assert from 'node:assert/strict'
import { applyLabelRules, RULES } from '../lib/label-auto.js'

test('RULES cover type, risk, and signal', () => {
  assert.ok(RULES.type)
  assert.ok(RULES.risk)
  assert.ok(RULES.signal)
  assert.ok(RULES.type['type/bug'])
})

test('applyLabelRules returns preview actions for bug', async () => {
  const deps = { client: { getIssue: async () => ({ ok: true, data: { number: 1, title: 'bug: x', labels: [{ name: 'type/bug' }, { name: 'status/ready' }] } }) } }
  const r = await applyLabelRules({ owner: 'acme', repo: 'app', number: 1 }, deps)
  assert.equal(r.ok, true)
  assert.ok(r.data.actions.length >= 1)
  assert.equal(r.data.dryRun, true)
})

test('applyLabelRules flags risk checklist for risk labels', async () => {
  const deps = { client: { getIssue: async () => ({ ok: true, data: { number: 2, title: 'x', labels: [{ name: 'risk/breaking' }] } }) } }
  const r = await applyLabelRules({ owner: 'acme', repo: 'app', number: 2 }, deps)
  assert.equal(r.ok, true)
  assert.ok(r.data.actions.some((a) => /risk/i.test(a)))
})

test('applyLabelRules handles issue without labels', async () => {
  const deps = { client: { getIssue: async () => ({ ok: true, data: { number: 3, title: 'x', labels: [] } }) } }
  const r = await applyLabelRules({ owner: 'acme', repo: 'app', number: 3 }, deps)
  assert.equal(r.ok, true)
  assert.equal(r.data.actions.length, 0)
})
