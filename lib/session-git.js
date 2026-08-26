import path from 'node:path'
const dirs = new Map()

export function rememberSessionGitDir(sessionId, repoDir) {
  const dir = String(repoDir || '').trim()
  if (!dir) return
  const id = String(sessionId || '').trim()
  if (id) dirs.set(id, dir)
}

export function rememberSessionGitDirs(sessionIds, repoDir) {
  for (const id of sessionIds || []) rememberSessionGitDir(id, repoDir)
}

export function resolveSessionGitDir({ cwd, sessionId } = {}) {
  const fromQuery = String(cwd || '').trim()
  if (fromQuery) return fromQuery
  const id = String(sessionId || '').trim()
  if (id && dirs.has(id)) return dirs.get(id)
  return ''
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
  return String(args.command || args.cmd || args.script || '').trim()
}

function unquote(token) {
  const value = String(token || '').trim()
  if ((value.startsWith("'") && value.endsWith("'")) || (value.startsWith('"') && value.endsWith('"'))) {
    return value.slice(1, -1)
  }
  return value
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

export function gitDirHintFromBashCommand(command, sessionCwd = '') {
  const base = lastCdDir(command)
  const added = worktreeAddPath(command)
  const resolve = (dir) => {
    const value = String(dir || '').trim()
    if (!value) return ''
    if (path.isAbsolute(value)) return path.normalize(value)
    if (base) return path.normalize(path.join(base, value))
    if (sessionCwd) return path.normalize(path.join(sessionCwd, value))
    return value
  }
  if (added) return resolve(added)
  return resolve(base)
}
