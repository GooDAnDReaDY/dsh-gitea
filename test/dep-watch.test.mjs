import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parsePackageJson, buildDepWatch, dedupeFindings } from '../lib/dep-watch.js'

test('parsePackageJson extracts dependencies', () => {
  const pkg = { dependencies: { lodash: '^4.17.21', react: '^18.2.0' }, devDependencies: { vitest: '^1.0.0' } }
  const r = parsePackageJson(pkg)
  assert.equal(r.deps.length, 3)
  assert.ok(r.deps.some((d) => d.name === 'lodash'))
})

test('parsePackageJson tolerates missing deps', () => {
  const r = parsePackageJson({})
  assert.equal(r.deps.length, 0)
})

test('dedupeFindings deduplicates by package/CVE', () => {
  const findings = [
    { package: 'lodash', cve: 'CVE-1', source: 'npm' },
    { package: 'lodash', cve: 'CVE-1', source: 'other' },
    { package: 'react', cve: 'CVE-2', source: 'npm' },
  ]
  const r = dedupeFindings(findings)
  assert.equal(r.length, 2)
})

test('buildDepWatch returns prioritized recommendations', async () => {
  const deps = { client: { getContents: async () => ({ ok: true, data: { content: Buffer.from(JSON.stringify({ dependencies: { lodash: '^4.17.20' } })).toString('base64') } }) } }
  const r = await buildDepWatch({ owner: 'acme', repo: 'app' }, deps)
  assert.equal(r.ok, true)
  assert.ok(r.data.deps.length >= 1)
  assert.equal(r.data.readOnly, true)
})
