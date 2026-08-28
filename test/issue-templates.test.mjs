import { test } from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { listIssueTemplates, validateIssueTemplate, validateAllTemplates } from '../lib/issue-templates.js'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const TEMPLATE_DIR = path.join(ROOT, '.gitea', 'ISSUE_TEMPLATE')

test('listIssueTemplates finds yaml templates excluding config.yaml', () => {
  const templates = listIssueTemplates(TEMPLATE_DIR)
  assert.ok(templates.length >= 4, `expected >=4 templates, got ${templates.length}`)
  const names = templates.map((t) => t.name)
  for (const expected of ['bug', 'feature', 'security', 'research']) {
    assert.ok(names.includes(expected), `missing template ${expected}`)
  }
  assert.ok(!names.includes('config'), 'config.yaml must be excluded')
})

test('validateIssueTemplate accepts a well-formed template', () => {
  const text = `name: Bug report
about: desc
labels:
  - type/bug
body:
  - type: textarea
    id: observed
    attributes:
      label: Observed
    validations:
      required: true
`
  const r = validateIssueTemplate('bug.yaml', text)
  assert.equal(r.ok, true, r.errors.join('; '))
})

test('validateIssueTemplate rejects template without required fields', () => {
  const text = `name: Bug
body:
  - type: textarea
    id: observed
    attributes:
      label: Observed
`
  const r = validateIssueTemplate('bug.yaml', text)
  assert.equal(r.ok, false)
  assert.ok(r.errors.some((e) => /required/.test(e)))
})

test('validateIssueTemplate rejects template without body', () => {
  const r = validateIssueTemplate('bug.yaml', 'name: Bug\nabout: x\n')
  assert.equal(r.ok, false)
})

test('validateAllTemplates passes for the shipped template pack', () => {
  const results = validateAllTemplates(TEMPLATE_DIR)
  assert.ok(results.length >= 4, `expected >=4 results, got ${results.length}`)
  for (const r of results) {
    assert.equal(r.ok, true, `${r.file}: ${r.errors.join('; ')}`)
  }
})
