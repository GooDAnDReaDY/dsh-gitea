import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const LIB_DIR = path.join(ROOT, 'lib')
const PKG_PATH = path.join(ROOT, 'package.json')

test('compliance: zero Cyrillic characters across all files in lib/', () => {
  const cyrillicRegex = /[\u0400-\u04ff]/
  const violations = []

  function scan(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        scan(fullPath)
      } else if (entry.name.endsWith('.js')) {
        const text = fs.readFileSync(fullPath, 'utf8')
        const lines = text.split('\n')
        lines.forEach((line, idx) => {
          if (cyrillicRegex.test(line)) {
            violations.push({
              file: path.relative(ROOT, fullPath),
              line: idx + 1,
              content: line.trim(),
            })
          }
        })
      }
    }
  }

  scan(LIB_DIR)
  assert.equal(
    violations.length,
    0,
    `Found ${violations.length} Cyrillic characters in lib/: \n` +
      violations.map((v) => `  ${v.file}:${v.line}: ${v.content}`).join('\n')
  )
})

test('compliance: package.json files allowlist excludes forbidden directories (.gitea, docs/)', () => {
  const pkg = JSON.parse(fs.readFileSync(PKG_PATH, 'utf8'))
  const files = pkg.files || []

  assert.ok(Array.isArray(files) && files.length > 0, 'package.json must specify explicit files allowlist')
  assert.ok(!files.includes('.gitea/'), '.gitea/ must not be included in npm package files')
  assert.ok(!files.includes('docs/'), 'docs/ must not be included in npm package files')
  assert.ok(files.includes('lib/'), 'lib/ must be in files')
  assert.ok(files.includes('assets/'), 'assets/ must be in files')
  assert.ok(files.includes('README.md'), 'README.md must be in files')
})
