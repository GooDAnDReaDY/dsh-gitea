import { test } from 'node:test'
import assert from 'node:assert/strict'
import { normalizeExternalUrl, schemeWarning } from '../lib/url-safety.js'

test('normalizeExternalUrl keeps https when base is https', () => {
  const out = normalizeExternalUrl('https://gitea.example.com/x', { baseUrl: 'https://gitea.example.com' })
  assert.equal(out, 'https://gitea.example.com/x')
})

test('normalizeExternalUrl upgrades http base when dsh is https', () => {
  const out = normalizeExternalUrl('http://gitea.example.com/x', { baseUrl: 'http://gitea.example.com', dshProtocol: 'https:' })
  assert.equal(out, 'https://gitea.example.com/x')
})

test('normalizeExternalUrl keeps http when dsh is http', () => {
  const out = normalizeExternalUrl('http://gitea.example.com/x', { baseUrl: 'http://gitea.example.com', dshProtocol: 'http:' })
  assert.equal(out, 'http://gitea.example.com/x')
})

test('normalizeExternalUrl does not downgrade https when dsh is http', () => {
  const out = normalizeExternalUrl('https://gitea.example.com/x', { baseUrl: 'https://gitea.example.com', dshProtocol: 'http:' })
  assert.equal(out, 'https://gitea.example.com/x')
})

test('schemeWarning detects http base under https dsh', () => {
  const w = schemeWarning('http://gitea.example.com', 'https:')
  assert.match(w, /HTTPS|mixed/i)
})

test('schemeWarning empty when schemes match', () => {
  assert.equal(schemeWarning('https://gitea.example.com', 'https:'), '')
  assert.equal(schemeWarning('http://gitea.example.com', 'http:'), '')
})
