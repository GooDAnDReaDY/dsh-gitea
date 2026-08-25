import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createContext, runInNewContext } from 'node:vm'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const srcPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '../lib/client.js')
const src = readFileSync(srcPath, 'utf8')

function loadClient() {
  let captured
  const window = {
    __ModuleLoader__: {
      load(entry) { captured = entry },
    },
  }
  runInNewContext(src, createContext({
    window,
    document: {
      querySelector() { return null },
      createElement() { return { setAttribute() {}, dataset: {} } },
      head: { appendChild() {} },
    },
  }))
  const fakeReact = {
    createElement() { return null },
    useState(v) { return [v, () => {}] },
    useReducer(fn, init) { return [init, () => {}] },
    useEffect() {},
  }
  return captured.factory((name) => {
    if (name === 'react') return fakeReact
    throw new Error('unexpected require ' + name)
  })
}

function applyWith({ throwPluginItem }) {
  const names = []
  const metas = []
  const exported = loadClient()
  exported.apply({
    effect(fn) { fn(); return () => {} },
    locale: {
      register() {},
      bind() { return (key) => key },
    },
    slots: {
      inject(name, factory) {
        if (throwPluginItem && name === 'settings.plugin.item') throw new Error('missing slot')
        names.push(name)
        factory()
      },
      register(meta) {
        metas.push(meta)
        return () => {}
      },
    },
  })
  return { names, metas }
}

test('client registers settings.plugin.item with settings namespace key', () => {
  assert.match(src, /const NS = 'dsh-gitea'/)
  assert.match(src, /name: 'settings\.plugin\.item'/)
  assert.match(src, /key: NS/)
  assert.match(src, /locale: NS/)
})

test('client keeps settings.section only as fallback', () => {
  assert.match(src, /if \(!tryPluginItem\(\)\)/)
  assert.match(src, /name: 'settings\.section'/)
})

test('client registers en/ru locale dictionaries', () => {
  assert.match(src, /ctx\.locale\.register\(NS, \{ en, ru \}\)/)
  assert.match(src, /title: 'Gitea'/)
  assert.match(src, /tokenEnv: 'Имя учётных данных'/)
})

test('apply prefers plugin card and skips sidebar section', () => {
  const { names, metas } = applyWith({ throwPluginItem: false })
  assert.deepEqual(names, ['settings.plugin.item', 'conversation.session.header.utilities'])
  assert.equal(metas[0].name, 'settings.plugin.item')
  assert.equal(metas[0].key, 'dsh-gitea')
  assert.notEqual(metas[0].key, '@goodandready/dsh-gitea')
})

test('apply falls back to settings.section when plugin item slot is missing', () => {
  const { names, metas } = applyWith({ throwPluginItem: true })
  assert.deepEqual(names, ['settings.section', 'conversation.session.header.utilities'])
  assert.equal(metas[0].name, 'settings.section')
  assert.equal(metas[0].id, '@goodandready/dsh-gitea')
})

test('client card is a PluginCard-shaped list item with discard/save footer', () => {
  assert.match(src, /createElement\('li'/)
  assert.match(src, /dgt-card/)
  assert.match(src, /dgt-cardOpen/)
  assert.match(src, /dgt-head/)
  assert.match(src, /dgt-discard/)
  assert.match(src, /dgt-pending/)
  assert.match(src, /unsaved/)
  assert.doesNotMatch(src, /dgt-wrap/)
  assert.doesNotMatch(src, /dgt-card-head/)
})

test('settings card CSS matches shared PluginCard tokens', () => {
  assert.match(src, /\.dgt-card\{[^}]*border-radius:12px/)
  assert.match(src, /\.dgt-head\{[^}]*padding:14px 16px/)
  assert.match(src, /\.dgt-title\{[^}]*font-size:15px/)
  assert.match(src, /\.dgt-sub\{[^}]*label-secondary/)
  assert.match(src, /\.dgt-body\{[^}]*margin:0 16px/)
  assert.match(src, /\.dgt-foot\{/)
  assert.match(src, /className: 'dgt-title'/)
  assert.match(src, /className: 'dgt-sub'/)
  assert.match(src, /className: 'dgt-foot'/)
  assert.doesNotMatch(src, /#0000/)
})
