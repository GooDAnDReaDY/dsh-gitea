import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const dirs = new Map()
loadPersistedDirs()

function persistFile() {
  if (process.env.NODE_TEST_CONTEXT) return ''
  if (process.env.DSH_GITEA_SESSION_GIT) return process.env.DSH_GITEA_SESSION_GIT
  const root = process.env.DSH_HOME || path.join(os.homedir(), '.dsh')
  return path.join(root, 'storages', 'dsh-gitea', 'session-git.json')
}

function loadPersistedDirs() {
  const file = persistFile()
  if (!file) return
  try {
    const raw = JSON.parse(fs.readFileSync(file, 'utf8'))
    if (!raw || typeof raw !== 'object') return
    for (const [id, dir] of Object.entries(raw)) {
      const key = String(id || '').trim()
      const value = String(dir || '').trim()
      if (key && value) dirs.set(key, value)
    }
  } catch { /* missing store is fine */ }
}

function savePersistedDirs() {
  const file = persistFile()
  if (!file) return
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, JSON.stringify(Object.fromEntries(dirs)))
  } catch { /* never break a tool */ }
}

export function rememberSessionGitDir(sessionId, repoDir) {
  const dir = String(repoDir || '').trim()
  if (!dir) return
  const id = String(sessionId || '').trim()
  if (!id) return
  dirs.set(id, dir)
  savePersistedDirs()
}

export function rememberSessionGitDirs(sessionIds, repoDir) {
  for (const id of sessionIds || []) rememberSessionGitDir(id, repoDir)
}

export function rememberedSessionGitDir(sessionId) {
  const id = String(sessionId || '').trim()
  if (id && dirs.has(id)) return dirs.get(id)
  return ''
}

export function resolveSessionGitDir({ cwd, sessionId } = {}) {
  const fromQuery = String(cwd || '').trim()
  if (fromQuery) return fromQuery
  return rememberedSessionGitDir(sessionId)
}

export async function selectChipRepoDir({ cwd, sessionId } = {}, isGitDir, recover) {
  const explicit = String(cwd || '').trim()
  if (explicit && await isGitDir(explicit)) return explicit
  let remembered = rememberedSessionGitDir(sessionId)
  if (!remembered && sessionId && recover) {
    await recover(sessionId)
    remembered = rememberedSessionGitDir(sessionId)
  }
  return remembered || ''
}

export function clearSessionGitDirs() {
  dirs.clear()
}

export function sessionIdsFromExec(exec) {
  const ids = []
  const push = (value) => {
    const id = String(value || '').trim()
    if (id && !ids.includes(id)) ids.push(id)
  }
  const agent = exec?.agent
  const session = agent?.session
  push(agent?.id)
  push(agent?.sessionId)
  push(session?.id)
  push(session?.sessionId)
  push(session?.header?.id)
  push(exec?.sessionId)
  return ids
}

export function sessionCwdFromExec(exec) {
  const session = exec?.agent?.session
  return String(
    exec?.cwd
    || session?.header?.cwd
    || session?.cwd
    || '',
  ).trim()
}

export function repoCwdFromTool({ args = {}, sessionCwd = '' } = {}) {
  return String(args.path || args.repoDir || sessionCwd || '').trim()
}

export function pinDirFromTool({ args = {}, result = {}, sessionCwd = '' } = {}) {
  const data = result?.ok && result?.data && !Array.isArray(result.data) ? result.data : null
  return String(
    (data && (data.path || data.repoDir))
    || args.worktreePath
    || args.path
    || args.repoDir
    || sessionCwd
    || '',
  ).trim()
}

export function chipSessionId(props = {}, session = null) {
  return String(
    props.sessionId
    || (session && (session.sessionId || session.id))
    || '',
  ).trim()
}

export function workspaceCwdFrom(session, workspaces) {
  const items = (workspaces && workspaces.items) || []
  const sessionId = session && (session.sessionId || session.id)
  const workspaceId = session && session.workspaceId
  let ws = null
  for (const item of items) {
    if (workspaceId && (item.workspaceId === workspaceId || item.id === workspaceId)) {
      ws = item
      break
    }
    if (sessionId && Array.isArray(item.sessionIds) && item.sessionIds.includes(sessionId)) {
      ws = item
      break
    }
  }
  return String((ws && (ws.path || ws.cwd)) || '').trim()
}

export function commandFromToolArgs(args) {
  if (!args || typeof args !== 'object') return ''
  return String(args.command || args.cmd || args.script || args.commandLine || '').trim()
}

function unquote(token) {
  const value = String(token || '').trim()
  if ((value.startsWith("'") && value.endsWith("'")) || (value.startsWith('"') && value.endsWith('"'))) {
    return value.slice(1, -1)
  }
  return value
}

function normalizeArgs(raw) {
  if (!raw) return {}
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed === 'object') return parsed
    } catch { /* plain command string */ }
    return { command: raw }
  }
  if (typeof raw === 'object') return raw
  return {}
}

function isJunkPath(dir) {
  const value = String(dir || '').trim().replace(/\\/g, '/')
  if (!value || value === '/' || value === '.' || value === '~') return true
  if (/(?:^|\/)(?:\.nvm|node_modules|deepseekharness)(?:\/|$)/.test(value)) return true
  return false
}

function shouldWalkParents(dir) {
  const value = String(dir || '').replace(/\\/g, '/')
  if (value.includes('.worktrees') || value.includes('/worktrees/')) return true
  const base = path.basename(value)
  return Boolean(base) && base.includes('.') && !base.startsWith('.')
}

function resolveDir(dir, base = '') {
  const value = String(dir || '').trim()
  if (!value || value.startsWith('http://') || value.startsWith('https://') || value.startsWith('ssh://')) return ''
  const resolved = path.isAbsolute(value)
    ? path.normalize(value)
    : (base ? path.normalize(path.join(base, value)) : value)
  return isJunkPath(resolved) ? '' : resolved
}

export function lastCdDir(command) {
  const text = String(command || '')
  let found = ''
  const re = /(?:^|[;&\n]|&&)\s*cd\s+(?:--\s+)?((?:'[^']+'|"[^"]+"|[^\s;|&]+))/g
  let match
  while ((match = re.exec(text))) found = unquote(match[1])
  return found
}

export function worktreeAddPath(command) {
  const text = String(command || '')
  const match = text.match(/\bworktree\s+add\b([\s\S]*)/)
  if (!match) return ''
  const tokens = match[1].match(/(?:'[^']+'|"[^"]+"|[^\s]+)/g) || []
  const takesValue = new Set(['-b', '-B', '--reason'])
  for (let i = 0; i < tokens.length; i += 1) {
    const token = unquote(tokens[i])
    if (!token || token === '--') continue
    if (takesValue.has(token)) { i += 1; continue }
    if (token.startsWith('-')) continue
    return token
  }
  return ''
}

export function gitDashCPath(command) {
  const text = String(command || '')
  let found = ''
  const re = /(?:^|[\s;&|])\S*git\S*\s+(?:[^\s-][^\s]*\s+)*-C\s+((?:'[^']+'|"[^"]+"|[^\s;|&]+))/g
  let match
  while ((match = re.exec(text))) found = unquote(match[1])
  if (found) return found
  const loose = /(?:^|[\s;&|])-C\s+((?:'[^']+'|"[^"]+"|[^\s;|&]+))/g
  while ((match = loose.exec(text))) found = unquote(match[1])
  return found
}

export function absoluteUnixPaths(command) {
  const text = String(command || '')
  const found = []
  const re = /(?:^|[\s"'=,:])(\/(?:[A-Za-z0-9._-]+\/)*[A-Za-z0-9._-]+)/g
  let match
  while ((match = re.exec(text))) {
    const value = match[1]
    if (value.startsWith('//')) continue
    found.push(value)
  }
  return found
}

function withParents(dir, rank) {
  const out = []
  let current = dir
  let currentRank = rank
  for (let i = 0; i < 6; i += 1) {
    if (!current || isJunkPath(current)) break
    out.push({ dir: current, rank: currentRank })
    const parent = path.dirname(current)
    if (parent === current) break
    current = parent
    currentRank -= 1
  }
  return out
}

function record(list, dir, rank, base) {
  const resolved = resolveDir(dir, base)
  if (!resolved) return
  if (shouldWalkParents(resolved)) list.push(...withParents(resolved, rank))
  else list.push({ dir: resolved, rank })
}

export function gitDirHintFromBashCommand(command, sessionCwd = '') {
  return candidateGitDirsFromExec({ arguments: { command }, cwd: sessionCwd })[0] || ''
}

export function candidateGitDirsFromExec(exec = {}, result = {}) {
  const args = normalizeArgs(exec?.arguments)
  const command = commandFromToolArgs(args)
  const sessionCwd = sessionCwdFromExec(exec)
  const base = lastCdDir(command) || sessionCwd
  const value = result?.value && typeof result.value === 'object' ? result.value : result
  const data = value && typeof value === 'object' && !Array.isArray(value)
    ? (value.data && !Array.isArray(value.data) ? value.data : value)
    : null
  const ranked = []

  record(ranked, worktreeAddPath(command), 100, base)
  record(ranked, gitDashCPath(command), 90, base)
  record(ranked, data?.worktreePath || data?.path || data?.repoDir || data?.cwd, 85, base)
  record(ranked, args.worktreePath, 80, base)
  record(ranked, args.path || args.repoDir || args.cwd || args.working_directory || args.workdir || args.directory, 70, base)
  for (const abs of absoluteUnixPaths(command)) {
    if (abs.includes('.worktrees') || abs.includes('/worktrees/')) record(ranked, abs, 95, '')
  }
  record(ranked, lastCdDir(command), 30, '')
  record(ranked, sessionCwd, 5, '')

  ranked.sort((a, b) => b.rank - a.rank)
  const seen = new Set()
  const out = []
  for (const item of ranked) {
    if (seen.has(item.dir)) continue
    seen.add(item.dir)
    out.push(item.dir)
  }
  return out
}


export function execsFromSessionJsonl(text) {
  const execs = []
  for (const line of String(text || '').split(/\n+/)) {
    const trimmed = line.trim()
    if (!trimmed) continue
    let obj
    try { obj = JSON.parse(trimmed) } catch { continue }
    if (obj?.type !== 'tool/call') continue
    const data = obj.data && typeof obj.data === 'object' ? obj.data : obj
    execs.push({ arguments: data.arguments, cwd: data.cwd || '' })
  }
  return execs
}

export function candidateGitDirsFromSessionJsonl(text) {
  const execs = execsFromSessionJsonl(text)
  const out = []
  const seen = new Set()
  for (let i = execs.length - 1; i >= 0; i -= 1) {
    for (const dir of candidateGitDirsFromExec(execs[i])) {
      if (seen.has(dir)) continue
      seen.add(dir)
      out.push(dir)
    }
  }
  return out
}
