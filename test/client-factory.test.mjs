import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createContext, runInNewContext } from 'node:vm'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

test('client factory returns apply after CommonJS shim', () => {
  const srcPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '../lib/client.js')
  const src = readFileSync(srcPath, 'utf8')
  assert.match(src, /var module = \{ exports: \{\} \}/)
  assert.match(src, /var exports = module\.exports/)
  assert.match(src, /return module\.exports/)
  assert.match(src, /inject:\s*\['slots'\]/)
  assert.match(src, /\/dsh-gitea\/config/)
  assert.match(src, /git-status/)
  assert.match(src, /header.utilities/)
  assert.match(src, /Never paste the token/)
  assert.match(src, /useWorkspaces/)
  assert.doesNotMatch(src, /Working copy path/)
  assert.doesNotMatch(src, /Default owner/)
  assert.doesNotMatch(src, /192\.168/)
  assert.doesNotMatch(src, /\/opt\//)
  assert.doesNotMatch(src, /\/mnt\//)
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
  assert.equal(captured.id, '@goodandready/dsh-gitea')
  const fakeReact = {
    createElement() { return null },
    useState(v) { return [v, () => {}] },
    useReducer(fn, init) { return [init, () => {}] },
    useEffect() {},
  }
  const exported = captured.factory((name) => {
    if (name === 'react') return fakeReact
    throw new Error('unexpected require ' + name)
  })
  assert.equal(typeof exported.apply, 'function')
  assert.ok(Array.isArray(exported.inject))
  assert.equal(exported.inject.length, 1)
  assert.equal(exported.inject[0], 'slots')
})
