import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildAutoActions, applyAutoActions } from '../lib/auto-actions.js'

const ISSUE = {
  number: 1,
  title: 'security: XSS in login',
  labels: [{ name: 'type/security' }],
  assignees: [],
}

test('buildAutoActions returns actions for security issue', async () => {
  const r = await buildAutoActions({ owner: 'acme', repo: 'app', number: 1 }, { client: { getIssue: async () => ({ ok: true, data: ISSUE }) } })
  assert.equal(r.ok, true)
  assert.ok(r.data.actions.some((a) => a.type === 'comment' && /чек-лист/i.test(a.payload.body)))
  assert.ok(r.data.actions.some((a) => a.type === 'label'))
})

test('buildAutoActions no actions for non-matching issue', async () => {
  const r = await buildAutoActions({ owner: 'acme', repo: 'app', number: 2 }, { client: { getIssue: async () => ({ ok: true, data: { number: 2, title: 'x', labels: [], assignees: [] } }) } })
  assert.equal(r.ok, true)
  assert.equal(r.data.actions.length, 0)
})

test('applyAutoActions requires confirm and dry-runs', async () => {
  const called = []
  const client = {
    getIssue: async () => ({ ok: true, data: ISSUE }),
    commentIssue: async (o, r, n, body) => { called.push(['comment', n]); return { ok: true } },
    addIssueLabels: async (o, r, n, labels) => { called.push(['label', n]); return { ok: true } },
  }
  const r = await applyAutoActions({ owner: 'acme', repo: 'app', number: 1, dryRun: true }, { client })
  assert.equal(r.ok, true)
  assert.equal(r.data.applied, false)
  assert.equal(called.length, 0)
})

test('applyAutoActions applies when confirm', async () => {
  const called = []
  const client = {
    getIssue: async () => ({ ok: true, data: ISSUE }),
    commentIssue: async (o, r, n) => { called.push(['comment', n]); return { ok: true } },
    addIssueLabels: async (o, r, n) => { called.push(['label', n]); return { ok: true } },
  }
  const r = await applyAutoActions({ owner: 'acme', repo: 'app', number: 1, confirm: true }, { client })
  assert.equal(r.ok, true)
  assert.equal(r.data.applied, true)
  assert.ok(called.length >= 2)
})
