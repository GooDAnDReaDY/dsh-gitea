export function parseGitRemote(url) {
  const s = String(url || '').trim()
  if (!s) return null
  let m = s.match(/^git@[^:]+:([^/]+)\/(.+?)(?:\.git)?$/)
  if (m) return { owner: m[1], repo: m[2] }
  m = s.match(/^ssh:\/\/[^/]+\/([^/]+)\/(.+?)(?:\.git)?$/)
  if (m) return { owner: m[1], repo: m[2] }
  m = s.match(/^https?:\/\/[^/]+\/([^/]+)\/(.+?)(?:\.git)?$/)
  if (m) return { owner: m[1], repo: m[2] }
  return null
}

export function resolveRepo({ args = {}, settings = {}, remoteUrl = '' } = {}) {
  const a = { owner: String(args.owner || '').trim(), repo: String(args.repo || '').trim() }
  if (a.owner && a.repo) return { ok: true, ...a }
  const s = { owner: String(settings.defaultOwner || '').trim(), repo: String(settings.defaultRepo || '').trim() }
  if (s.owner && s.repo) return { ok: true, ...s }
  const parsed = parseGitRemote(remoteUrl)
  if (parsed?.owner && parsed?.repo) return { ok: true, ...parsed }
  return { ok: false, error: 'Set owner and repo on the tool, in Settings (default owner/repo), or run inside a git checkout with origin.' }
}
