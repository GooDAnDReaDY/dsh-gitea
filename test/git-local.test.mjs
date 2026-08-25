import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  parseWorktreePorcelain,
  resolveRepoDir,
  buildGitSnapshot,
  runWorktreeAction,
} from '../lib/git-local.js'

const PORCELAIN = `worktree /tmp/example/app
HEAD abcdef
branch refs/heads/main

worktree /tmp/example/app-feat
HEAD fedcba
branch refs/heads/feat/x
`

test('parseWorktreePorcelain reads path, head, and branch', () => {
  const trees = parseWorktreePorcelain(PORCELAIN)
  assert.equal(trees.length, 2)
  assert.equal(trees[0].path, '/tmp/example/app')
  assert.equal(trees[0].branch, 'main')
  assert.equal(trees[0].head, 'abcdef')
  assert.equal(trees[1].path, '/tmp/example/app-feat')
  assert.equal(trees[1].branch, 'feat/x')
})

test('resolveRepoDir prefers args.path then settings.repoDir', () => {
  assert.equal(resolveRepoDir({ repoDir: '/tmp/a' }, { path: '/tmp/b' }).repoDir, '/tmp/b')
  assert.equal(resolveRepoDir({ repoDir: '/tmp/a' }, {}).repoDir, '/tmp/a')
  assert.equal(resolveRepoDir({}, {}).ok, false)
  assert.match(resolveRepoDir({}, {}).error, /path|workspace/i)
  assert.equal(resolveRepoDir({}, {}, '/tmp/session').repoDir, '/tmp/session')
})

test('runWorktreeAction list uses git worktree list --porcelain', async () => {
  const calls = []
  const execFile = async (bin, args, opts) => {
    calls.push({ bin, args, cwd: opts.cwd })
    return { stdout: PORCELAIN, stderr: '' }
  }
  const result = await runWorktreeAction('list', { path: '/tmp/example/app' }, {
    settings: {},
    execFile,
  })
  assert.equal(result.ok, true)
  assert.equal(result.data.length, 2)
  assert.equal(calls[0].bin, 'git')
  assert.deepEqual(calls[0].args, ['worktree', 'list', '--porcelain'])
  assert.equal(calls[0].cwd, '/tmp/example/app')
})

test('runWorktreeAction add passes path and branch', async () => {
  const calls = []
  const execFile = async (bin, args, opts) => {
    calls.push({ args, cwd: opts.cwd })
    return { stdout: '', stderr: '' }
  }
  const result = await runWorktreeAction('add', {
    path: '/tmp/example/app',
    worktreePath: '/tmp/example/app-feat',
    branch: 'feat/x',
  }, { settings: {}, execFile })
  assert.equal(result.ok, true)
  assert.deepEqual(calls[0].args, ['worktree', 'add', '/tmp/example/app-feat', 'feat/x'])
})

test('runWorktreeAction remove without confirm does not run git', async () => {
  const calls = []
  const execFile = async (bin, args) => {
    calls.push(args)
    return { stdout: '', stderr: '' }
  }
  const result = await runWorktreeAction('remove', {
    path: '/tmp/example/app',
    worktreePath: '/tmp/example/app-feat',
  }, { settings: {}, execFile })
  assert.equal(result.ok, false)
  assert.match(result.error, /confirm/i)
  assert.equal(calls.length, 0)
})

test('runWorktreeAction remove with confirm calls git worktree remove', async () => {
  const calls = []
  const execFile = async (bin, args) => {
    calls.push(args)
    return { stdout: '', stderr: '' }
  }
  const result = await runWorktreeAction('remove', {
    path: '/tmp/example/app',
    worktreePath: '/tmp/example/app-feat',
    confirm: true,
  }, { settings: {}, execFile })
  assert.equal(result.ok, true)
  assert.deepEqual(calls[0], ['worktree', 'remove', '/tmp/example/app-feat'])
})

test('runWorktreeAction use returns the selected path', async () => {
  const result = await runWorktreeAction('use', {
    worktreePath: '/tmp/example/app-feat',
  }, { settings: { repoDir: '/tmp/example/app' }, execFile: async () => ({ stdout: '', stderr: '' }) })
  assert.equal(result.ok, true)
  assert.equal(result.data.path, '/tmp/example/app-feat')
})

test('buildGitSnapshot reports branch, dirty, graph, and diff', async () => {
  const execFile = async (bin, args) => {
    const joined = args.join(' ')
    if (joined === 'rev-parse --abbrev-ref HEAD') return { stdout: 'main\n', stderr: '' }
    if (joined === 'rev-parse --show-toplevel') return { stdout: '/tmp/example/app\n', stderr: '' }
    if (joined === 'status --porcelain') return { stdout: ' M lib/index.js\n', stderr: '' }
    if (args[0] === 'log') return { stdout: '* abc (HEAD -> main) hello\n', stderr: '' }
    if (args[0] === 'diff') return { stdout: 'diff --git a/lib/index.js b/lib/index.js\n', stderr: '' }
    throw new Error('unexpected ' + joined)
  }
  const snap = await buildGitSnapshot({ repoDir: '/tmp/example/app', execFile })
  assert.equal(snap.ok, true)
  assert.equal(snap.branch, 'main')
  assert.equal(snap.dirty, true)
  assert.equal(snap.worktree, '/tmp/example/app')
  assert.match(snap.graph, /HEAD -> main/)
  assert.match(snap.diff, /lib\/index.js/)
})
