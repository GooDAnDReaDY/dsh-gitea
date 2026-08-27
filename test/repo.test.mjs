import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseGitRemote, resolveRepo } from '../lib/repo.js'

test('parseGitRemote: ssh scp format', () => {
  assert.deepEqual(parseGitRemote('git@example.com:acme/app.git'), { owner: 'acme', repo: 'app' })
})

test('parseGitRemote: ssh url with port', () => {
  assert.deepEqual(parseGitRemote('ssh://git@example.com:2222/acme/app.git'), { owner: 'acme', repo: 'app' })
})

test('parseGitRemote: https', () => {
  assert.deepEqual(parseGitRemote('https://example.com/acme/app.git'), { owner: 'acme', repo: 'app' })
})

test('parseGitRemote: http with port', () => {
  assert.deepEqual(parseGitRemote('http://example.com:3000/acme/app.git'), { owner: 'acme', repo: 'app' })
})

test('parseGitRemote: junk returns null', () => {
  assert.equal(parseGitRemote('not-a-url'), null)
  assert.equal(parseGitRemote(''), null)
})

test('resolveRepo: args take priority over settings and remote', () => {
  const result = resolveRepo({
    args: { owner: 'argsOwner', repo: 'argsRepo' },
    settings: { defaultOwner: 'settingsOwner', defaultRepo: 'settingsRepo' },
    remoteUrl: 'https://example.com/remoteOwner/remoteRepo.git',
  })
  assert.deepEqual(result, { ok: true, owner: 'argsOwner', repo: 'argsRepo' })
})

test('resolveRepo: settings take priority over remote', () => {
  const result = resolveRepo({
    settings: { defaultOwner: 'settingsOwner', defaultRepo: 'settingsRepo' },
    remoteUrl: 'https://example.com/remoteOwner/remoteRepo.git',
  })
  assert.deepEqual(result, { ok: true, owner: 'settingsOwner', repo: 'settingsRepo' })
})

test('resolveRepo: falls back to remote', () => {
  const result = resolveRepo({
    remoteUrl: 'https://example.com/remoteOwner/remoteRepo.git',
  })
  assert.deepEqual(result, { ok: true, owner: 'remoteOwner', repo: 'remoteRepo' })
})

test('resolveRepo: miss returns error matching /owner/i', () => {
  const result = resolveRepo({})
  assert.equal(result.ok, false)
  assert.match(result.error, /owner/i)
})
