import { test } from 'node:test'
import assert from 'node:assert/strict'
import { runWorktreeAction } from '../lib/git-local.js'

test('write operation routes through the configured wrapper', async () => {
  const calls = []
  const execFile = async (bin, args, opts) => {
    calls.push({ bin, args, cwd: opts && opts.cwd })
    return { stdout: '', stderr: '' }
  }
  const result = await runWorktreeAction('add', {
    path: '/tmp/example/app',
    worktreePath: '/tmp/example/app-feat',
    branch: 'feat/x',
  }, {
    settings: { gitWrapper: 'git-deepseek-harness' },
    execFile,
  })
  assert.equal(result.ok, true)
  assert.equal(calls.length, 1)
  assert.equal(calls[0].bin, 'git-deepseek-harness')
  assert.deepEqual(calls[0].args, ['worktree', 'add', '/tmp/example/app-feat', 'feat/x'])
})

test('write operation with empty gitWrapper refuses with a clear error', async () => {
  const calls = []
  const execFile = async (bin, args) => {
    calls.push({ bin, args })
    return { stdout: '', stderr: '' }
  }
  const result = await runWorktreeAction('add', {
    path: '/tmp/example/app',
    worktreePath: '/tmp/example/app-feat',
    branch: 'feat/x',
  }, {
    settings: { gitWrapper: '' },
    execFile,
  })
  assert.equal(result.ok, false)
  assert.equal(calls.length, 0)
  assert.match(result.error, /wrapper/i)
})

test('read operation still uses bare git', async () => {
  const calls = []
  const execFile = async (bin, args, opts) => {
    calls.push({ bin, args, cwd: opts && opts.cwd })
    return { stdout: 'worktree /tmp/example/app\nHEAD abc\nbranch refs/heads/main\n', stderr: '' }
  }
  const result = await runWorktreeAction('list', { path: '/tmp/example/app' }, {
    settings: { gitWrapper: '' },
    execFile,
  })
  assert.equal(result.ok, true)
  assert.equal(calls[0].bin, 'git')
})

test('remove with confirm routes through the wrapper', async () => {
  const calls = []
  const execFile = async (bin, args) => {
    calls.push({ bin, args })
    return { stdout: '', stderr: '' }
  }
  const result = await runWorktreeAction('remove', {
    path: '/tmp/example/app',
    worktreePath: '/tmp/example/app-feat',
    confirm: true,
  }, {
    settings: { gitWrapper: 'git-deepseek-harness' },
    execFile,
  })
  assert.equal(result.ok, true)
  assert.equal(calls[0].bin, 'git-deepseek-harness')
  assert.deepEqual(calls[0].args, ['worktree', 'remove', '/tmp/example/app-feat'])
})
