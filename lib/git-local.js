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

async function git(execFile, cwd, args) {
  const exec = execFile || defaultExecFile
  const { stdout, stderr } = await exec('git', args, { cwd, timeout: 20_000, maxBuffer: 2 * 1024 * 1024 })
  return { stdout: String(stdout || ''), stderr: String(stderr || '') }
}

export async function isGitDir(dir, execFile) {
  const cwd = String(dir || '').trim()
  if (!cwd) return false
  try {
    await git(execFile, cwd, ['rev-parse', '--show-toplevel'])
    return true
  } catch {
    return false
  }
}

export async function runWorktreeAction(action, args = {}, deps = {}) {
  const execFile = deps.execFile
  if (action === 'use') {
    const worktreePath = String(args.worktreePath || args.path || '').trim()
    if (!worktreePath) return { ok: false, error: 'Pass worktreePath to make it current.' }
    return { ok: true, data: { path: worktreePath, repoDir: worktreePath } }
  }

  const resolved = resolveRepoDir(deps.settings || {}, args, deps.cwd || '')
  if (!resolved.ok) return resolved
  const cwd = resolved.repoDir

  try {
    if (action === 'list') {
      const { stdout } = await git(execFile, cwd, ['worktree', 'list', '--porcelain'])
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
      await git(execFile, cwd, gitArgs)
      return { ok: true, data: { path: worktreePath, branch: args.branch || args.createBranch || '' } }
    }
    if (action === 'remove') {
      if (args.confirm !== true) {
        return { ok: false, error: 'Removing a worktree requires confirm: true (boolean).' }
      }
      const worktreePath = String(args.worktreePath || '').trim()
      if (!worktreePath) return { ok: false, error: 'Pass worktreePath to remove.' }
      await git(execFile, cwd, ['worktree', 'remove', worktreePath])
      return { ok: true, data: { path: worktreePath } }
    }
    return { ok: false, error: `Unknown worktree action: ${action}` }
  } catch (err) {
    return { ok: false, error: err?.stderr || err?.message || String(err) }
  }
}

export async function buildGitSnapshot({ repoDir, execFile } = {}) {
  const dir = String(repoDir || '').trim()
  if (!dir) return { ok: false, error: 'No git workspace cwd.' }
  try {
    const branch = (await git(execFile, dir, ['rev-parse', '--abbrev-ref', 'HEAD'])).stdout.trim()
    const toplevel = (await git(execFile, dir, ['rev-parse', '--show-toplevel'])).stdout.trim()
    const porcelain = (await git(execFile, dir, ['status', '--porcelain'])).stdout
    const graph = (await git(execFile, dir, ['log', '--oneline', '--decorate', '--graph', '-20'])).stdout.trim()
    let diff = (await git(execFile, dir, ['diff', 'HEAD'])).stdout
    if (diff.length > DIFF_LIMIT) diff = `${diff.slice(0, DIFF_LIMIT)}\n…truncated`
    return {
      ok: true,
      repoDir: dir,
      worktree: toplevel || dir,
      repoName: path.basename(toplevel || dir),
      branch,
      dirty: porcelain.trim().length > 0,
      graph,
      diff,
    }
  } catch (err) {
    return { ok: false, error: err?.stderr || err?.message || String(err) }
  }
}
