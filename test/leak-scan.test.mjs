import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { scanDirectory } from '../scripts/leak-scan.mjs'

const TEST_TOKEN = ['36c9614607417f02736f', '35565a8340ccdf20437c'].join('')

test('scanDirectory passes clean repository tree', () => {
  const res = scanDirectory(process.cwd())
  assert.equal(res.ok, true, `Expected clean tree, got leaks: ${JSON.stringify(res.leaks)}`)
  assert.equal(res.leaks.length, 0)
  assert.ok(res.filesScanned > 50)
})

test('scanDirectory detects forbidden infra paths and LAN IPs fail-closed (#311)', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'leak-test-'))
  try {
    mkdirSync(join(tmp, 'lib'), { recursive: true })
    writeFileSync(join(tmp, 'lib', 'leaky.js'), 'const internalHost = "192.168.1.99";\nconst p = "/mnt/data";\n')

    const res = scanDirectory(tmp)
    assert.equal(res.ok, false)
    assert.equal(res.leaks.length, 2)
    assert.equal(res.leaks[0].match, '192.168.1.99')
    assert.equal(res.leaks[1].match, '/mnt/data')
  } finally {
    rmSync(tmp, { recursive: true, force: true })
  }
})

test('scanDirectory detects leaked tokens and hashes (#311)', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'leak-test-token-'))
  try {
    mkdirSync(join(tmp, 'lib'), { recursive: true })
    writeFileSync(join(tmp, 'lib', 'bad.js'), `const leakedToken = "${TEST_TOKEN}";\n`)

    const res = scanDirectory(tmp)
    assert.equal(res.ok, false)
    assert.equal(res.leaks.length, 1)
    assert.equal(res.leaks[0].match, TEST_TOKEN)
  } finally {
    rmSync(tmp, { recursive: true, force: true })
  }
})
