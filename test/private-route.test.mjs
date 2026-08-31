import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8')
const pkg = JSON.parse(read('package.json'))
const name = '@goodandready/dsh-gitea'

test('package identity matches all loader sites', () => {
  assert.equal(pkg.name, name)
  assert.equal(pkg.private, undefined)
  assert.equal(pkg.publishConfig.access, 'public')
  assert.ok(read('cordis.patch.yml').includes("name: '@goodandready/dsh-gitea'"))
  assert.ok(read('lib/client.js').includes("id: '@goodandready/dsh-gitea'"))
})

test('tracked package sources contain no host-specific infra references', () => {
  const tracked = ['README.md', 'README.ru.md', 'README.zh.md', 'package.json', 'cordis.patch.yml', 'lib/client.js', 'lib/index.js', 'test/session-git.test.mjs']
  for (const file of tracked) {
    if (!fs.existsSync(path.join(root, file))) continue
    const text = read(file)
    for (const marker of ['/' + 'home/user', '/' + 'path/to', '127.0.0.1']) {
      assert.equal(text.includes(marker), false, file + ' contains ' + marker)
    }
  }
})
