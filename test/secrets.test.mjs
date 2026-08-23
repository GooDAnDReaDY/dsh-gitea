import { test } from 'node:test'
import assert from 'node:assert/strict'
import { stripSecretsFromConfig, assertCredentialRef } from '../lib/secrets.js'

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
