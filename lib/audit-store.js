import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

/**
 * audit-store (issue #396): durable jsonl persistence for the hub mutation
 * audit trail. The ring lives in memory (fast reads); every append is
 * mirrored to a jsonl file so restarts keep the history.
 */

export const AUDIT_LIMIT = 100
const entries = []
let loaded = false

export function auditFile() {
  if (process.env.DSH_GITEA_AUDIT) return process.env.DSH_GITEA_AUDIT
  if (process.env.NODE_TEST_CONTEXT && !process.env.TEST_PERSIST_AUDIT) return ''
  const root = process.env.DSH_HOME || path.join(os.homedir(), '.dsh')
  return path.join(root, 'storages', 'dsh-gitea', 'hub-audit.jsonl')
}

function ensureLoaded() {
  if (loaded) return
  loaded = true
  const file = auditFile()
  if (!file) return
  try {
    const lines = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean)
    for (const line of lines) {
      try {
        entries.push(JSON.parse(line))
      } catch { /* skip corrupt lines */ }
    }
    if (entries.length > AUDIT_LIMIT) entries.splice(0, entries.length - AUDIT_LIMIT)
  } catch { /* missing file is fine */ }
}

export function appendAuditEntry(entry) {
  ensureLoaded()
  const record = { at: new Date().toISOString(), ...entry }
  entries.push(record)
  if (entries.length > AUDIT_LIMIT) entries.splice(0, entries.length - AUDIT_LIMIT)
  saveSyncSafe()
  return record
}

export function loadAuditEntries(limit = AUDIT_LIMIT) {
  ensureLoaded()
  return entries.slice(-Math.max(1, limit))
}

export function resetAuditEntriesForTests() {
  entries.length = 0
  loaded = false
}

function saveSyncSafe() {
  const file = auditFile()
  if (!file) return
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, entries.map((e) => JSON.stringify(e)).join('\n') + '\n', 'utf8')
  } catch { /* never break a tool */ }
}
