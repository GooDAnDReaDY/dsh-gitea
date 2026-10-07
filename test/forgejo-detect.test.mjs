import { test } from 'node:test'
import assert from 'node:assert/strict'
import { detectFlavor } from '../lib/forgejo-detect.js'

test('detectFlavor identifies forgejo by version', async () => {
  const client = { getVersion: async () => ({ ok: true, data: { version: '7.0.0+forgejo' } }) }
  const r = await detectFlavor({}, { client })
  assert.equal(r.ok, true)
  assert.equal(r.data.flavor, 'forgejo')
})

test('detectFlavor identifies gitea', async () => {
  const client = { getVersion: async () => ({ ok: true, data: { version: '1.22.0' } }) }
  const r = await detectFlavor({}, { client })
  assert.equal(r.ok, true)
  assert.equal(r.data.flavor, 'gitea')
})

test('detectFlavor notes feature differences for forgejo', async () => {
  const client = { getVersion: async () => ({ ok: true, data: { version: 'x+forgejo' } }) }
  const r = await detectFlavor({}, { client })
  assert.ok(r.data.notes.length > 0)
  assert.match(r.data.notes.join(' '), /Actions|webhook/i)
})
