const dirs = new Map()

export function rememberSessionGitDir(sessionId, repoDir) {
  const dir = String(repoDir || '').trim()
  if (!dir) return
  const id = String(sessionId || '').trim()
  if (id) dirs.set(id, dir)
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
