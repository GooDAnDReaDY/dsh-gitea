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
