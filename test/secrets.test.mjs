import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  stripSecretsFromConfig,
  assertCredentialRef,
  isCredentialRefName,
  looksLikeToken,
  credentialRefStatus,
} from '../lib/secrets.js'

test('stripSecretsFromConfig keeps tokenEnv', () => {
  const out = stripSecretsFromConfig({
    baseUrl: 'https://gitea.example.com',
    tokenEnv: 'GITEA_TOKEN',
    token: 'secret-token',
    apiKey: 'secret-key',
    keys: { foo: 'bar' },
  })
  assert.equal(out.tokenEnv, 'GITEA_TOKEN')
  assert.equal(out.baseUrl, 'https://gitea.example.com')
  assert.equal('token' in out, false)
  assert.equal('apiKey' in out, false)
  assert.equal('keys' in out, false)
})

test('stripSecretsFromConfig: non-object returns empty object', () => {
  assert.deepEqual(stripSecretsFromConfig(null), {})
  assert.deepEqual(stripSecretsFromConfig('x'), {})
})

test('assertCredentialRef accepts valid env names', () => {
  assert.equal(assertCredentialRef('GITEA_TOKEN'), 'GITEA_TOKEN')
})

test('assertCredentialRef rejects invalid names', () => {
  assert.throws(() => assertCredentialRef('bad-name'), /environment variable name/)
})

test('isCredentialRefName rejects hex tokens and names starting with a digit', () => {
  assert.equal(isCredentialRefName('GITEA_TOKEN'), true)
  assert.equal(isCredentialRefName('0000000000000000000000000000000000000000'), false)
})

test('looksLikeToken detects hex API tokens', () => {
  assert.equal(looksLikeToken('0000000000000000000000000000000000000000'), true)
  assert.equal(looksLikeToken('GITEA_TOKEN'), false)
})

test('credentialRefStatus explains token pasted as the name', () => {
  const status = credentialRefStatus('0000000000000000000000000000000000000000')
  assert.equal(status.ok, false)
  assert.match(status.error, /token/i)
  assert.match(status.error, /credential name/i)
})

test('credentialRefStatus accepts GITEA_TOKEN', () => {
  const status = credentialRefStatus('GITEA_TOKEN')
  assert.equal(status.ok, true)
  assert.equal(status.name, 'GITEA_TOKEN')
})
