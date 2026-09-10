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

test('client uses settings.plugin.item only (no settings.section)', () => {
  assert.doesNotMatch(src, /name: 'settings\.section'/)
})

test('client registers en locale dictionary safely', () => {
  assert.match(src, /localeSvc\.register\(NS, \{ en \}\)/)
  assert.match(src, /title: 'Gitea'/)
})

test('client handles duplicate locale registration error safely without crashing slots', () => {
  const exported = loadClient()
  const names = []
  assert.doesNotThrow(() => {
    exported.apply({
      get(name) { return this[name] },
      effect(fn) { fn(); return () => {} },
      locale: {
        register() { throw new Error('already has locale: dsh-gitea') },
        subscribe() { return () => {} },
        getSnapshot() { return { active: 'en' } },
      },
      slots: {
        inject(name, factory) {
          names.push(name)
          factory()
        },
        register() { return () => {} },
      },
      settingsScope: {
        bind() { return { subscribe() { return () => {} }, getSnapshot() { return { status: 'ready' } } } },
      },
    })
  })
  assert.deepEqual(names, ['settings.plugin.item', 'conversation.session.header.utilities'])
})

test('settings form provides fields for all configurable schema options', () => {
  assert.match(src, /defaultOwner/)
  assert.match(src, /defaultRepo/)
  assert.match(src, /gitWrapper/)
  assert.match(src, /dodReminder/)
  assert.match(src, /forceHttpsUrls/)
  assert.match(src, /timeoutMs/)
  assert.match(src, /webhookSecretEnv/)
  assert.match(src, /notifyWebhook/)
  assert.match(src, /bgSchedulerEnabled/)
  assert.match(src, /bgSchedulerIntervalMin/)
  assert.match(src, /bgSchedulerOwner/)
  assert.match(src, /bgSchedulerRepo/)
  assert.match(src, /bgSchedulerWebhook/)
})

test('apply registers plugin card and skips sidebar section', () => {
  const { names, metas } = applyWith({ throwPluginItem: false })
  assert.deepEqual(names, ['settings.plugin.item', 'conversation.session.header.utilities'])
  assert.equal(metas[0].name, 'settings.plugin.item')
  assert.equal(metas[0].key, 'dsh-gitea')
  assert.notEqual(metas[0].key, '@goodandready/dsh-gitea')
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
