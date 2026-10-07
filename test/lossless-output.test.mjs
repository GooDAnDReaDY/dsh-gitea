import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { toLossless } from '../lib/handlers.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const client = readFileSync(join(root, 'lib/client.js'), 'utf8')
const patch = readFileSync(join(root, 'cordis.patch.yml'), 'utf8')
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))

/** JSON round-trip is the contract the harness enforces ("lossless JSON"). */
const roundTrips = (value) => JSON.stringify(JSON.parse(JSON.stringify(value))) === JSON.stringify(value)

test('#231: an empty payload never yields an undefined field', () => {
  const wrapped = toLossless({ ok: true, data: undefined })
  assert.deepEqual(wrapped, { ok: true })
  assert.ok(roundTrips(wrapped), 'result survives JSON round-trip')
  assert.doesNotMatch(JSON.stringify(wrapped), /undefined/)
})

test('#231: toLossless drops undefined keys and non-finite numbers, keeps the rest', () => {
  const value = toLossless({
    ok: true,
    data: { a: 1, b: undefined, c: Number.NaN, d: [1, undefined, Number.POSITIVE_INFINITY], e: null, f: 'x' },
  })
  assert.deepEqual(value, { ok: true, data: { a: 1, c: null, d: [1, null, null], e: null, f: 'x' } })
  assert.ok(roundTrips(value))
})

test('#231: dates and bigints are serializable', () => {
  const when = new Date('2026-09-18T00:00:00.000Z')
  const value = toLossless({ at: when, id: 10n })
  assert.deepEqual(value, { at: '2026-09-18T00:00:00.000Z', id: '10' })
  assert.ok(roundTrips(value))
})

test('#231: cycles are cut instead of throwing', () => {
  const node = { ok: true }
  node.self = node
  const value = toLossless(node)
  assert.deepEqual(value, { ok: true })
  assert.ok(roundTrips(value))
})

test('row seat key is the package name plus the row id from cordis.patch.yml', () => {
  const rowId = patch.match(/^\s*- id:\s*(\S+)\s*$/m)
  assert.ok(rowId, 'cordis.patch.yml declares a row id')
  assert.equal(pkg.name, '@goodandready/dsh-gitea')
  assert.match(client, /const PKG = '@goodandready\/dsh-gitea'/)
  assert.match(client, new RegExp("const ROW_ID = '" + rowId[1] + "'"))
  assert.match(client, /const ROW_CONFIG_KEY = PKG \+ '#' \+ ROW_ID/)
  const rowSeat = client.indexOf("name: 'plugins.row.config'")
  const legacySeat = client.indexOf("name: 'settings.plugin.item'")
  assert.ok(rowSeat > -1, 'row seat is registered')
  assert.ok(legacySeat > -1, 'legacy seat is kept')
  assert.ok(rowSeat < legacySeat, 'row seat goes first')
})

test('the row seat renders a one-liner for summary and the form without card chrome for page', () => {
  assert.match(client, /props\.view === 'summary'/)
  assert.match(client, /const page = !!\(props && props\.view === 'page'\)/)
  assert.match(client, /page \? 'div' : 'li'/)
  assert.match(client, /page \? 'dgt-page' : 'dgt-card'/)
})
