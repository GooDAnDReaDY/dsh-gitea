import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  rememberSessionGitDir,
  resolveSessionGitDir,
  clearSessionGitDirs,
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
