import { test } from 'node:test'
import assert from 'node:assert/strict'
import { branchNameFor, planIssueFlow, createFlowPr } from '../lib/issue-flow.js'

test('branchNameFor uses type/issue-slug convention', () => {
  assert.equal(branchNameFor({ number: 47, title: 'feat: issue flow', type: 'feat' }), 'feat/47-issue-flow')
  assert.equal(branchNameFor({ number: 37, title: 'fix: wrapper', type: 'fix' }), 'fix/37-wrapper')
})

test('planIssueFlow returns branch and worktree path', () => {
  const r = planIssueFlow({ number: 47, title: 'issue to branch', type: 'feat' })
  assert.equal(r.ok, true)
  assert.match(r.data.branch, /^feat\/47-/)
  assert.match(r.data.worktreePath, /\.worktrees\//)
})

test('createFlowPr creates draft PR with issue reference', async () => {
  const calls = []
  const deps = { client: { createPull: async (...a) => { calls.push(a); return { ok: true, data: { number: 10 } } } } }
  const r = await createFlowPr({ owner: 'acme', repo: 'app', head: 'feat/47-x', base: 'main', issue: 47, title: 'x' }, deps)
  assert.equal(r.ok, true)
  assert.equal(calls[0][2].title, 'x')
  assert.match(calls[0][2].body, /#47/)
})
