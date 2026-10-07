import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildLabelPlan, applyLabelPlan, CANONICAL_LABELS } from '../lib/label-bootstrap.js'

test('CANONICAL_LABELS covers type/priority/status/scope/risk/signal', () => {
  const names = CANONICAL_LABELS.map((l) => l.name)
  assert.ok(names.includes('type/bug'))
  assert.ok(names.includes('priority/high'))
  assert.ok(names.includes('status/ready'))
  assert.ok(names.includes('scope/agent-tools'))
  assert.ok(names.includes('risk/breaking'))
  assert.ok(names.includes('signal/stale'))
})

test('buildLabelPlan lists missing labels for a repo', async () => {
  const deps = { client: { listLabels: async () => ({ ok: true, data: [{ name: 'type/bug' }] }) } }
  const r = await buildLabelPlan({ owner: 'acme', repo: 'app' }, deps)
  assert.equal(r.ok, true)
  assert.ok(r.data.missing.length >= CANONICAL_LABELS.length - 1)
  assert.ok(r.data.dryRun, true)
})

test('applyLabelPlan creates only missing labels idempotently', async () => {
  const created = []
  const deps = {
    client: {
      listLabels: async () => ({ ok: true, data: [{ name: 'type/bug' }] }),
      createLabel: async (o, r, body) => { created.push(body.name); return { ok: true, data: body } },
    },
  }
  const r = await applyLabelPlan({ owner: 'acme', repo: 'app' }, deps)
  assert.equal(r.ok, true)
  assert.ok(!created.includes('type/bug'))
  assert.ok(created.includes('priority/high'))
})
