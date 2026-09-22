import { test } from 'node:test'
import assert from 'node:assert/strict'
import { planRebase, runRebase } from '../lib/pr-rebase.js'

test('planRebase returns read-only plan', async () => {
  const r = await planRebase({ owner: 'acme', repo: 'app', number: 3 }, {})
  assert.equal(r.ok, true)
  assert.equal(r.data.dryRun, true)
  assert.ok(r.data.steps.length >= 3)
})

test('runRebase without confirm refuses', async () => {
  const r = await runRebase({ owner: 'acme', repo: 'app', number: 3 }, {})
  assert.equal(r.ok, false)
  assert.match(r.error, /confirm/i)
})

test('runRebase performs rebase via exec', async () => {
  const execCalls = []
  const execFile = async (bin, args) => {
    execCalls.push(args.join(' '))
    if (args[0] === 'remote' || args.includes('get-url')) return { stdout: 'git@gitea:acme/app.git\n', stderr: '' }
    if (args.includes('rev-parse')) return { stdout: 'abc123\n', stderr: '' }
    if (args.includes('branch')) return { stdout: 'feat/3\n', stderr: '' }
    if (args[0] === 'rebase' || args.includes('merge')) return { stdout: '', stderr: '' }
    if (args[0] === 'push' || args[1] === 'push') return { stdout: '', stderr: '' }
    if (args.includes('ls-files') || args.includes('diff')) return { stdout: '', stderr: '' }
    if (args.includes('checkout')) return { stdout: '', stderr: '' }
    return { stdout: '', stderr: '' }
  }
  const deps = { execFile, gitWrapper: 'git-agent', cwd: '/tmp/worktrees/app' }
  const r = await runRebase({ owner: 'acme', repo: 'app', number: 3, confirm: true }, deps)
  assert.equal(r.ok, true)
  assert.equal(r.data.rebased, true)
  assert.ok(execCalls.length >= 2)
})
