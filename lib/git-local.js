import { execFile as execFileCb } from 'node:child_process'
import path from 'node:path'
import { promisify } from 'node:util'

const defaultExecFile = promisify(execFileCb)
const DIFF_LIMIT = 24_000

export function parseWorktreePorcelain(text) {
  const trees = []
  let current = null
  for (const line of String(text || '').split(/\r?\n/)) {
    if (line.startsWith('worktree ')) {
      if (current) trees.push(current)
      current = { path: line.slice('worktree '.length).trim(), head: '', branch: '', bare: false }
      continue
    }
    if (!current) continue
    if (line.startsWith('HEAD ')) current.head = line.slice('HEAD '.length).trim()
    else if (line.startsWith('branch ')) {
      const ref = line.slice('branch '.length).trim()
      current.branch = ref.replace(/^refs\/heads\//, '')
    } else if (line === 'bare') current.bare = true
    else if (line.startsWith('detached')) current.branch = 'detached'
  }
  if (current) trees.push(current)
  return trees
}

export function resolveRepoDir(settings = {}, args = {}, fallbackCwd = '') {
  const repoDir = String(args.path || args.repoDir || fallbackCwd || settings.repoDir || '').trim()
  if (!repoDir) {
    return { ok: false, error: 'Pass path or run inside a git workspace.' }
  }
  return { ok: true, repoDir }
}

async function readGit(execFile, cwd, args) {
  const exec = execFile || defaultExecFile
  const { stdout, stderr } = await exec('git', args, { cwd, timeout: 20_000, maxBuffer: 2 * 1024 * 1024 })
  return { stdout: String(stdout || ''), stderr: String(stderr || '') }
}

function writeGitBinary(settings = {}) {
  return String(settings.gitWrapper || '').trim()
}

async function writeGit(execFile, cwd, args, settings = {}) {
  const binary = writeGitBinary(settings)
  if (!binary) {
    const err = new Error('git wrapper not configured: set gitWrapper in Settings for write operations')
    err.stderr = err.message
    throw err
  }
  const exec = execFile || defaultExecFile
  const { stdout, stderr } = await exec(binary, args, { cwd, timeout: 30_000, maxBuffer: 2 * 1024 * 1024 })
  return { stdout: String(stdout || ''), stderr: String(stderr || '') }
}

export async function isGitDir(dir, execFile) {
  const cwd = String(dir || '').trim()
  if (!cwd) return false
  try {
    await readGit(execFile, cwd, ['rev-parse', '--show-toplevel'])
    return true
  } catch {
    return false
  }
}

export async function runWorktreeAction(action, args = {}, deps = {}) {
  const execFile = deps.execFile
  const settings = deps.settings || {}
  if (action === 'use') {
    const worktreePath = String(args.worktreePath || args.path || '').trim()
    if (!worktreePath) return { ok: false, error: 'Pass worktreePath to make it current.' }
    return { ok: true, data: { path: worktreePath, repoDir: worktreePath } }
  }

  const resolved = resolveRepoDir(settings, args, deps.cwd || '')
  if (!resolved.ok) return resolved
  const cwd = resolved.repoDir

  try {
    if (action === 'list') {
      const { stdout } = await readGit(execFile, cwd, ['worktree', 'list', '--porcelain'])
      const trees = parseWorktreePorcelain(stdout).map((tree) => ({
        ...tree,
        current: tree.path === cwd,
      }))
      return { ok: true, data: trees }
    }
    if (action === 'add') {
      const worktreePath = String(args.worktreePath || '').trim()
      if (!worktreePath) return { ok: false, error: 'Pass worktreePath for the new worktree.' }
      const gitArgs = ['worktree', 'add']
      if (args.createBranch) gitArgs.push('-b', String(args.createBranch))
      gitArgs.push(worktreePath)
      if (args.branch) gitArgs.push(String(args.branch))
      await writeGit(execFile, cwd, gitArgs, settings)
      return { ok: true, data: { path: worktreePath, branch: args.branch || args.createBranch || '' } }
    }
    if (action === 'remove') {
      if (args.confirm !== true) {
        return { ok: false, error: 'Removing a worktree requires confirm: true (boolean).' }
      }
      const worktreePath = String(args.worktreePath || '').trim()
      if (!worktreePath) return { ok: false, error: 'Pass worktreePath to remove.' }
      await writeGit(execFile, cwd, ['worktree', 'remove', worktreePath], settings)
      return { ok: true, data: { path: worktreePath } }
    }
    return { ok: false, error: `Unknown worktree action: ${action}` }
  } catch (err) {
    return { ok: false, error: err?.stderr || err?.message || String(err) }
  }
}

export function displayRepoName({ worktree = '', remoteUrl = '' } = {}) {
  const remote = String(remoteUrl || '').trim().replace(/\.git$/i, '')
  const scp = remote.match(/:([^/]+\/)?([^/]+)$/)
  if (scp && scp[2]) return scp[2]
  const parts = remote.split('/').filter(Boolean)
  const last = parts[parts.length - 1] || ''
  if (last && last !== remote && !last.includes(':')) return last
  const wt = String(worktree || '').replace(/\\/g, '/')
  const marker = '/.worktrees/'
  const at = wt.indexOf(marker)
  if (at > 0) {
    const parent = wt.slice(0, at).split('/').filter(Boolean).pop()
    if (parent) return parent
  }
  return wt.split('/').filter(Boolean).pop() || ''
}

export async function buildGitSnapshot({ repoDir, execFile } = {}) {
  const dir = String(repoDir || '').trim()
  if (!dir) return { ok: false, error: 'No git workspace cwd.' }
  try {
    let branch = ''
    try {
      branch = (await readGit(execFile, dir, ['rev-parse', '--abbrev-ref', 'HEAD'])).stdout.trim()
    } catch {
      try {
        branch = (await readGit(execFile, dir, ['symbolic-ref', '--short', 'HEAD'])).stdout.trim()
      } catch {
        branch = 'main'
      }
    }
    let head = ''
    try {
      head = (await readGit(execFile, dir, ['rev-parse', 'HEAD'])).stdout.trim()
    } catch { /* empty repo without commits */ }
    const toplevel = (await readGit(execFile, dir, ['rev-parse', '--show-toplevel'])).stdout.trim()
    const porcelain = (await readGit(execFile, dir, ['status', '--porcelain'])).stdout
    let graph = ''
    try {
      graph = (await readGit(execFile, dir, ['log', '--oneline', '-8'])).stdout.trim()
    } catch { /* no commits yet */ }
    let remoteUrl = ''
    try { remoteUrl = (await readGit(execFile, dir, ['remote', 'get-url', 'origin'])).stdout.trim() } catch { /* origin may be missing */ }
    const statusLines = porcelain.trim().split('\n').filter(Boolean)
    const dirty = statusLines.length > 0
    const dirtyFiles = statusLines.length
    let ahead = 0
    let behind = 0
    let upstream = null

    if (head) {
      try {
        const revCount = (await readGit(execFile, dir, ['rev-list', '--left-right', '--count', 'HEAD...@{upstream}'])).stdout.trim()
        const [a, b] = revCount.split(/\s+/)
        ahead = parseInt(a, 10) || 0
        behind = parseInt(b, 10) || 0
        upstream = '@{upstream}'
      } catch {
        if (branch && branch !== 'HEAD') {
          try {
            const revCount = (await readGit(execFile, dir, ['rev-list', '--left-right', '--count', `HEAD...origin/${branch}`])).stdout.trim()
            const [a, b] = revCount.split(/\s+/)
            ahead = parseInt(a, 10) || 0
            behind = parseInt(b, 10) || 0
            upstream = `origin/${branch}`
          } catch { /* no remote branch */ }
        }
      }
    }

    let diff = ''
    if (dirty) {
      try {
        diff = (await readGit(execFile, dir, head ? ['diff', 'HEAD'] : ['diff'])).stdout
      } catch {
        diff = porcelain
      }
      if (diff.length > DIFF_LIMIT) diff = `${diff.slice(0, DIFF_LIMIT)}\n…truncated`
    }
    return {
      ok: true,
      repoDir: dir,
      worktree: toplevel || dir,
      repoName: displayRepoName({ worktree: toplevel || dir, remoteUrl }),
      branch,
      head,
      dirty,
      dirtyFiles,
      ahead,
      behind,
      upstream,
      graph,
      diff,
    }
  } catch (err) {
    return { ok: false, error: err?.stderr || err?.message || String(err) }
  }
}
