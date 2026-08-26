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
