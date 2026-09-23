import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

test('useCrossTabGitStatus ignores AbortError on unmount and avoids recreating BroadcastChannel', () => {
  const srcPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '../lib/client.js')
  const src = readFileSync(srcPath, 'utf8')

  // Verify that new BroadcastChannel is NOT inside fetchStatus
  const fetchStatusMatch = src.match(/const fetchStatus = React\.useCallback\([\s\S]*?\n\s{6}\}, \[cwd, sessionId\]\)/)
  assert.ok(fetchStatusMatch, 'fetchStatus definition found')
  assert.equal(fetchStatusMatch[0].includes('new BroadcastChannel'), false, 'fetchStatus should not instantiate new BroadcastChannel')
  assert.ok(fetchStatusMatch[0].includes('channelRef.current'), 'fetchStatus should use channelRef.current')
  assert.ok(fetchStatusMatch[0].includes('aliveRef.current'), 'fetchStatus should guard on aliveRef.current')

  // Verify AbortError handling in locks catch
  assert.match(src, /err\.name === 'AbortError' \|\| abortController\.signal\.aborted/)

  // Verify aliveRef reset on unmount
  assert.match(src, /aliveRef\.current = false/)
})
