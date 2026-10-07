import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resolveInstance, listInstances } from '../lib/instances.js'

const CFG = {
  baseUrl: 'https://primary.example.com',
  tokenEnv: 'GITEA_TOKEN',
  instances: [
    { name: 'work', baseUrl: 'https://work.example.com', tokenEnv: 'WORK_TOKEN' },
    { name: 'home', baseUrl: 'https://home.example.com', tokenEnv: 'HOME_TOKEN' },
  ],
}

test('listInstances returns configured instances + legacy primary', () => {
  const list = listInstances(CFG)
  assert.ok(list.length >= 3)
  assert.ok(list.some((i) => i.name === 'work'))
  assert.ok(list.some((i) => i.name === 'primary'))
})

test('resolveInstance returns named instance', () => {
  const r = resolveInstance(CFG, 'home')
  assert.equal(r.ok, true)
  assert.equal(r.baseUrl, 'https://home.example.com')
  assert.equal(r.tokenEnv, 'HOME_TOKEN')
})

test('resolveInstance falls back to primary legacy config', () => {
  const r = resolveInstance(CFG, 'primary')
  assert.equal(r.ok, true)
  assert.equal(r.baseUrl, 'https://primary.example.com')
})

test('resolveInstance unknown name returns error', () => {
  const r = resolveInstance(CFG, 'nope')
  assert.equal(r.ok, false)
})

test('resolveInstance works with no instances (legacy only)', () => {
  const r = resolveInstance({ baseUrl: 'https://x', tokenEnv: 'T' }, '')
  assert.equal(r.ok, true)
  assert.equal(r.baseUrl, 'https://x')
})
