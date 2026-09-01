import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8')
const pkg = JSON.parse(read('package.json'))
const name = '@goodandready/dsh-gitea'

test('private package identity matches all loader sites', () => {
  assert.equal(pkg.name, name)
  assert.equal(pkg.private, undefined)
  assert.equal(pkg.publishConfig.registry, 'https://registry.npmjs.org/')
  assert.ok(read('cordis.patch.yml').includes("name: '@goodandready/dsh-gitea'"))
  assert.ok(read('lib/client.js').includes("id: '@goodandready/dsh-gitea'"))
})

test('tracked package sources contain no host-specific infra references', () => {
  const tracked = ['README.md', 'AGENTS.md', 'index.md', 'package.json', 'cordis.patch.yml', 'lib/client.js', 'lib/index.js', 'test/session-git.test.mjs']
  for (const file of tracked) {
    const text = read(file)
    for (const marker of ['/' + 'home/', '/' + 'mnt/', '192.' + '168.', 'f' + 'ile:']) {
      assert.equal(text.includes(marker), false, file + ' contains ' + marker)
    }
  }
})
