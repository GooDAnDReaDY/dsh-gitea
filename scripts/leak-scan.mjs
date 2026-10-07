#!/usr/bin/env node
/**
 * scripts/leak-scan.mjs
 *
 * Fail-closed repository scanner to ensure no infrastructure paths, internal
 * mounts, developer usernames, leaked hashes, or real credentials exist in
 * publishable product files or repository sources.
 *
 * Exit codes:
 *   0 - Clean (no leaks found)
 *   1 - Leak found (details printed to stderr)
 *   2 - Scanner error / failure (fail-closed)
 */

import { readdirSync, statSync, readFileSync, existsSync } from 'node:fs'
import { join, relative } from 'node:path'

const PRODUCT_PATTERNS = [
  { name: 'Private LAN IP', regex: /192\.168\.\d{1,3}\.\d{1,3}/ },
  { name: 'Internal mount path', regex: /\/(?:mnt|opt)\/[A-Za-z0-9._-]+/ },
  { name: 'Developer username', regex: /\/home\/vadim\b|\bvadim\b/ },
  { name: 'Leaked commit/token literal', regex: /36c9614607417f02736f35565a8340ccdf20437c/ },
  { name: 'Internal build marker', regex: /INSTALLED_PATH\/|DEV_SOURCE/ },
]

const TEST_SECRET_PATTERNS = [
  { name: 'Leaked commit/token literal', regex: /36c9614607417f02736f35565a8340ccdf20437c/ },
  { name: 'Private SSH / RSA key', regex: /-----BEGIN (?:[A-Z0-9 ]+ )?PRIVATE KEY-----/ },
  { name: 'GitHub Personal Access Token', regex: /ghp_[A-Za-z0-9]{36}/ },
]

export function scanDirectory(rootDir = process.cwd()) {
  const leaks = []
  let filesScanned = 0

  function walk(dir, isTestDir = false) {
    if (!existsSync(dir)) return
    const entries = readdirSync(dir)
    for (const entry of entries) {
      if (entry === '.git' || entry === 'node_modules' || entry === '.worktrees') continue
      const fullPath = join(dir, entry)
      const st = statSync(fullPath)
      if (st.isDirectory()) {
        walk(fullPath, isTestDir || entry === 'test')
      } else if (st.isFile()) {
        // Skip binary or image files
        if (/\.(png|jpg|jpeg|gif|ico|webp|woff|woff2|ttf|eot)$/i.test(entry)) continue
        // Skip this scanner script itself when scanning scripts/
        if (entry === 'leak-scan.mjs' || entry === 'leak-scan.test.mjs') continue

        filesScanned++
        const content = readFileSync(fullPath, 'utf8')
        const lines = content.split(/\r?\n/)

        const rules = isTestDir ? TEST_SECRET_PATTERNS : PRODUCT_PATTERNS

        for (let idx = 0; idx < lines.length; idx++) {
          const line = lines[idx]
          for (const rule of rules) {
            const m = rule.regex.exec(line)
            if (m) {
              const rel = relative(rootDir, fullPath)
              leaks.push({
                file: rel,
                line: idx + 1,
                rule: rule.name,
                match: m[0],
                snippet: line.trim().slice(0, 120),
              })
            }
          }
        }
      }
    }
  }

  // Scan product directories and files
  const productDirs = ['lib', 'assets', '.gitea']
  for (const d of productDirs) {
    walk(join(rootDir, d), false)
  }

  const rootFiles = ['README.md', 'README.ru.md', 'README.zh.md', 'cordis.patch.yml', 'package.json']
  for (const rf of rootFiles) {
    const full = join(rootDir, rf)
    if (existsSync(full)) {
      filesScanned++
      const content = readFileSync(full, 'utf8')
      const lines = content.split(/\r?\n/)
      for (let idx = 0; idx < lines.length; idx++) {
        const line = lines[idx]
        for (const rule of PRODUCT_PATTERNS) {
          const m = rule.regex.exec(line)
          if (m) {
            leaks.push({
              file: rf,
              line: idx + 1,
              rule: rule.name,
              match: m[0],
              snippet: line.trim().slice(0, 120),
            })
          }
        }
      }
    }
  }

  // Scan test directory for real secrets
  walk(join(rootDir, 'test'), true)

  return { ok: leaks.length === 0, leaks, filesScanned }
}

// Run CLI if invoked directly
const isDirectExecution = process.argv[1] && process.argv[1].endsWith('leak-scan.mjs')
if (isDirectExecution) {
  try {
    const root = process.cwd()
    const { ok, leaks, filesScanned } = scanDirectory(root)
    if (!ok) {
      console.error(`\n❌ LEAK SCAN FAILED: Found ${leaks.length} leak(s):`)
      for (const l of leaks) {
        console.error(`  [${l.rule}] ${l.file}:${l.line} -> "${l.match}"`)
        console.error(`    ${l.snippet}`)
      }
      process.exit(1)
    }
    console.log(`✓ Leak scan passed: 0 leaks found across ${filesScanned} files.`)
    process.exit(0)
  } catch (err) {
    console.error(`❌ Scanner runtime error: ${err.message}`)
    process.exit(2)
  }
}
