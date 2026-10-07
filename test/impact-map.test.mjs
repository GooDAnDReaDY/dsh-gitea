import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildImpactMap, extractIssueRefs } from '../lib/impact-map.js'

test('extractIssueRefs finds #N references with context', () => {
  const refs = extractIssueRefs('Closes #37, Refs #16 related to #45')
  assert.equal(refs.length, 3)
  assert.ok(refs.every((r) => r.source === 'body'))
})

test('buildImpactMap maps files, areas, and issue refs', async () => {
  const deps = {
    client: {
      getPull: async () => ({ ok: true, data: { number: 5, title: 'feat: x (#16)', body: 'Closes #16', user: { login: 'alice' } } }),
      listPullFiles: async () => ({ ok: true, data: [{ filename: 'lib/a.js' }, { filename: 'test/b.test.mjs' }] }),
    },
  }
  const r = await buildImpactMap({ owner: 'acme', repo: 'app', number: 5 }, deps)
  assert.equal(r.ok, true)
  assert.ok(r.data.issueRefs.length >= 1)
  assert.ok(r.data.files.length === 2)
  assert.ok(r.data.areas.includes('lib'))
})

test('buildImpactMap handles missing data', async () => {
  const deps = { client: { getPull: async () => ({ ok: false, error: 'x' }), listPullFiles: async () => ({ ok: true, data: [] }) } }
  const r = await buildImpactMap({ owner: 'acme', repo: 'app', number: 9 }, deps)
  assert.equal(r.ok, true)
  assert.equal(r.data.files.length, 0)
})
