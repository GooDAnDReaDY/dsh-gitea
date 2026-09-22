import { test } from 'node:test'
import assert from 'node:assert/strict'
import { planBootstrap, buildTemplateFiles, applyBootstrap } from '../lib/repo-bootstrap.js'

test('planBootstrap returns file manifest and dry-run', () => {
  const r = planBootstrap({ name: 'my-proj', description: 'd', private: true })
  assert.equal(r.ok, true)
  assert.ok(r.data.files.some((f) => f.path === 'README.md'))
  assert.ok(r.data.files.some((f) => f.path === '.gitignore'))
  assert.equal(r.data.dryRun, true)
})

test('buildTemplateFiles includes README, gitignore, CI, templates', () => {
  const files = buildTemplateFiles({ name: 'my-proj', description: 'd' })
  const paths = files.map((f) => f.path)
  assert.ok(paths.includes('README.md'))
  assert.ok(paths.includes('.gitignore'))
  assert.ok(paths.some((p) => p.startsWith('.gitea/ISSUE_TEMPLATE/')))
})

test('applyBootstrap creates repo with files', async () => {
  const calls = []
  const deps = {
    client: {
      createRepo: async (...a) => { calls.push(['createRepo', a]); return { ok: true, data: { name: 'my-proj' } } },
      getContents: async () => ({ ok: false, error: 'nope' }),
    },
  }
  const r = await applyBootstrap({ name: 'my-proj', description: 'd', private: true }, deps)
  assert.equal(r.ok, true)
  assert.ok(calls.some((c) => c[0] === 'createRepo'))
})
