import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  rememberSessionGitDir,
  rememberSessionGitDirs,
  resolveSessionGitDir,
  clearSessionGitDirs,
  sessionIdsFromExec,
  sessionCwdFromExec,
  repoCwdFromTool,
  pinDirFromTool,
  chipSessionId,
  workspaceCwdFrom,
  gitDirHintFromBashCommand,
  candidateGitDirsFromExec,
  candidateGitDirsFromSessionJsonl,
  selectChipRepoDir,
} from '../lib/session-git.js'

test('resolveSessionGitDir prefers explicit cwd over session memory', () => {
  clearSessionGitDirs()
  rememberSessionGitDir('sess-1', '/tmp/from-session')
  assert.equal(resolveSessionGitDir({ cwd: '/tmp/from-query', sessionId: 'sess-1' }), '/tmp/from-query')
})

test('resolveSessionGitDir uses remembered dir when cwd is empty', () => {
  clearSessionGitDirs()
  rememberSessionGitDir('sess-1', '/tmp/from-session')
  assert.equal(resolveSessionGitDir({ cwd: '', sessionId: 'sess-1' }), '/tmp/from-session')
})

test('resolveSessionGitDir does not leak another session dir', () => {
  clearSessionGitDirs()
  rememberSessionGitDir('sess-1', '/tmp/from-session')
  assert.equal(resolveSessionGitDir({ cwd: '', sessionId: 'sess-2' }), '')
})

test('rememberSessionGitDirs stores every session id', () => {
  clearSessionGitDirs()
  rememberSessionGitDirs(['sess-a', 'sess-b'], '/tmp/shared')
  assert.equal(resolveSessionGitDir({ sessionId: 'sess-a' }), '/tmp/shared')
  assert.equal(resolveSessionGitDir({ sessionId: 'sess-b' }), '/tmp/shared')
})

test('sessionIdsFromExec collects agent and session identities', () => {
  assert.deepEqual(sessionIdsFromExec({
    agent: {
      id: 'agent-1',
      session: { id: 'agent-1', header: { id: 'agent-1', cwd: '/tmp/ws' } },
    },
  }), ['agent-1'])
})

test('sessionCwdFromExec reads session header cwd', () => {
  assert.equal(sessionCwdFromExec({
    agent: { session: { header: { cwd: '/tmp/from-header' } } },
  }), '/tmp/from-header')
})

test('repoCwdFromTool uses path, never the new worktree destination', () => {
  assert.equal(repoCwdFromTool({
    args: { path: '/tmp/main', worktreePath: '/tmp/feat' },
    sessionCwd: '/tmp/session',
  }), '/tmp/main')
  assert.equal(repoCwdFromTool({
    args: { worktreePath: '/tmp/feat' },
    sessionCwd: '/tmp/session',
  }), '/tmp/session')
})

test('pinDirFromTool prefers worktree result path', () => {
  assert.equal(pinDirFromTool({
    args: { path: '/tmp/main', worktreePath: '/tmp/feat' },
    result: { ok: true, data: { path: '/tmp/feat' } },
    sessionCwd: '/tmp/session',
  }), '/tmp/feat')
})

test('chipSessionId prefers the framework session kit id', () => {
  assert.equal(chipSessionId({ sessionId: 'kit-1' }, { sessionId: 'snap-1' }), 'kit-1')
  assert.equal(chipSessionId({}, { sessionId: 'snap-1' }), 'snap-1')
})

test('workspaceCwdFrom reads DSH workspace path, not cwd', () => {
  const session = { sessionId: 'sess-1' }
  const workspaces = {
    items: [{
      workspaceId: 'ws-1',
      path: '/tmp/real-repo',
      sessionIds: ['sess-1'],
    }],
  }
  assert.equal(workspaceCwdFrom(session, workspaces), '/tmp/real-repo')
})


test('gitDirHintFromBashCommand resolves git-wrapper worktree add after cd', () => {
  const command = 'cd /mnt/external/Project/DEV/photographer-onepage && export PATH="/home/vadim/.local/bin:$PATH" && git-deepseek-harness worktree add -b feat/1-one-page-photographer-site .worktrees/1-single-page origin/main'
  assert.equal(
    gitDirHintFromBashCommand(command),
    '/mnt/external/Project/DEV/photographer-onepage/.worktrees/1-single-page',
  )
})

test('gitDirHintFromBashCommand uses last cd when there is no worktree add', () => {
  assert.equal(
    gitDirHintFromBashCommand('cd /tmp/repo && git status'),
    '/tmp/repo',
  )
})


const LIVE_WORKTREE_ADD = 'cd /mnt/external/Project/DEV/photographer-onepage && export PATH="/home/vadim/.local/bin:$PATH" && git-deepseek-harness worktree add -b feat/1-one-page-photographer-site .worktrees/1-single-page origin/main'
const LIVE_WORKTREE = '/mnt/external/Project/DEV/photographer-onepage/.worktrees/1-single-page'

test('candidate matrix covers how an agent actually reaches a git folder', () => {
  const cases = [
    { name: 'live wrapper worktree add', exec: { arguments: { command: LIVE_WORKTREE_ADD } }, expect: LIVE_WORKTREE },
    { name: 'git-cursor worktree add', exec: { arguments: { command: 'cd /tmp/app && git-cursor worktree add -b feat/x .worktrees/x origin/main' } }, expect: '/tmp/app/.worktrees/x' },
    { name: 'plain git worktree add abs', exec: { arguments: { command: 'git worktree add /tmp/app/.worktrees/x main' } }, expect: '/tmp/app/.worktrees/x' },
    { name: 'git -C status', exec: { arguments: { command: 'git -C /tmp/app status' } }, expect: '/tmp/app' },
    { name: 'git-cursor -C log', exec: { arguments: { command: 'git-cursor -C /tmp/app log -1' } }, expect: '/tmp/app' },
    { name: 'cd then git status', exec: { arguments: { command: 'cd /tmp/app && git status' } }, expect: '/tmp/app' },
    { name: 'ls absolute worktree', exec: { arguments: { command: 'ls /tmp/app/.worktrees/x' } }, expect: '/tmp/app/.worktrees/x' },
    { name: 'gitea_worktree_use args', exec: { arguments: { worktreePath: '/tmp/app/.worktrees/x' } }, expect: '/tmp/app/.worktrees/x' },
    { name: 'gitea_worktree_add result', exec: { arguments: {} }, result: { ok: true, data: { path: '/tmp/app/.worktrees/x' } }, expect: '/tmp/app/.worktrees/x' },
    { name: 'tool working_directory', exec: { arguments: { working_directory: '/tmp/app' } }, expect: '/tmp/app' },
    { name: 'cmd alias', exec: { arguments: { cmd: 'cd /tmp/app && ls' } }, expect: '/tmp/app' },
  ]
  for (const item of cases) {
    const dirs = candidateGitDirsFromExec(item.exec, item.result || {})
    assert.equal(dirs[0], item.expect, item.name)
  }
})

test('session harness cwd is last resort, not preferred over a worktree', () => {
  const dirs = candidateGitDirsFromExec({
    arguments: { command: LIVE_WORKTREE_ADD },
    cwd: '/home/vadim/deepseekharness',
    agent: { session: { header: { cwd: '/home/vadim/deepseekharness' } } },
  })
  assert.equal(dirs[0], LIVE_WORKTREE)
})


test('quoted cd still resolves a git folder', () => {
  assert.equal(
    candidateGitDirsFromExec({ arguments: { command: "cd '/tmp/app' && git status" } })[0],
    '/tmp/app',
  )
})

test('ls of an unrelated tree is not treated as a git folder', () => {
  const dirs = candidateGitDirsFromExec({ arguments: { command: 'ls /tmp/unrelated/lib' } })
  assert.equal(dirs.length, 0)
})

test('file inside a worktree still keeps the worktree as a candidate', () => {
  const dirs = candidateGitDirsFromExec({ arguments: { command: 'cat /tmp/app/.worktrees/x/index.html' } })
  assert.ok(dirs.includes('/tmp/app/.worktrees/x'))
})

test('harness install cwd is not a candidate', () => {
  const dirs = candidateGitDirsFromExec({
    arguments: { command: 'pwd' },
    cwd: '/home/agent/deepseekharness',
  })
  assert.equal(dirs.includes('/home/agent/deepseekharness'), false)
})

test('session log ignores a later ls of another tree and keeps the worktree add', () => {
  const jsonl = [
    JSON.stringify({ type: 'tool/call', data: { name: 'bash', arguments: JSON.stringify({ command: LIVE_WORKTREE_ADD }) } }),
    JSON.stringify({ type: 'tool/call', data: { name: 'bash', arguments: { command: 'ls /tmp/unrelated/lib' } } }),
  ].join('\n')
  const dirs = candidateGitDirsFromSessionJsonl(jsonl)
  assert.equal(dirs[0], LIVE_WORKTREE)
})

test('session log with only the live worktree add pins that worktree first', () => {
  const jsonl = JSON.stringify({ type: 'tool/call', data: { name: 'bash', arguments: JSON.stringify({ command: LIVE_WORKTREE_ADD }) } })
  assert.equal(candidateGitDirsFromSessionJsonl(jsonl)[0], LIVE_WORKTREE)
})


test('selectChipRepoDir ignores a non-git workspace cwd and keeps the session pin', async () => {
  clearSessionGitDirs()
  rememberSessionGitDir('sess-1', '/tmp/from-session')
  const dir = await selectChipRepoDir(
    { cwd: '/tmp/not-a-repo', sessionId: 'sess-1' },
    async (candidate) => candidate === '/tmp/from-session',
  )
  assert.equal(dir, '/tmp/from-session')
})

test('selectChipRepoDir prefers a real git workspace cwd over the session pin', async () => {
  clearSessionGitDirs()
  rememberSessionGitDir('sess-1', '/tmp/from-session')
  const dir = await selectChipRepoDir(
    { cwd: '/tmp/attached-repo', sessionId: 'sess-1' },
    async (candidate) => candidate === '/tmp/attached-repo',
  )
  assert.equal(dir, '/tmp/attached-repo')
})

test('selectChipRepoDir recovers from the session log when cwd is not git', async () => {
  clearSessionGitDirs()
  let recovered = ''
  const dir = await selectChipRepoDir(
    { cwd: '/tmp/not-a-repo', sessionId: 'sess-1' },
    async () => false,
    async (id) => { recovered = id; rememberSessionGitDir(id, '/tmp/recovered') },
  )
  assert.equal(recovered, 'sess-1')
  assert.equal(dir, '/tmp/recovered')
})
