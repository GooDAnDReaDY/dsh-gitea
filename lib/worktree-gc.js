import { parseWorktreePorcelain, resolveRepoDir } from './git-local.js'
import { execFile as execFileCb } from 'node:child_process'
import { promisify } from 'node:util'

const defaultExecFile = promisify(execFileCb)

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
    err.code = 'GIT_WRAPPER_REQUIRED'
    throw err
  }
  const exec = execFile || defaultExecFile
  const { stdout, stderr } = await exec(binary, args, { cwd, timeout: 30_000, maxBuffer: 2 * 1024 * 1024 })
  return { stdout: String(stdout || ''), stderr: String(stderr || '') }
}

export async function runWorktreeGc(args = {}, deps = {}) {
  const execFile = deps.execFile
  const settings = deps.settings || {}
  const resolved = resolveRepoDir(settings, args, deps.cwd || '')
  if (!resolved.ok) return resolved
  const cwd = resolved.repoDir
  const dryRun = args.dry_run !== false && args.prune !== true
  const baseBranch = String(args.base || args.baseBranch || 'main').trim()

  try {
    const { stdout } = await readGit(execFile, cwd, ['worktree', 'list', '--porcelain'])
    const trees = parseWorktreePorcelain(stdout)
    if (!trees.length) {
      return { ok: true, data: { checked: 0, candidates: [], pruned: [], skipped: [] } }
    }

    const mainWorktree = trees[0]
    const candidates = []
    const pruned = []
    const skipped = []

    for (const wt of trees) {
      // 1. Protection: Never touch the main worktree repository
      if (wt.path === mainWorktree.path) {
        skipped.push({ path: wt.path, branch: wt.branch, reason: 'main repository worktree protected' })
        continue
      }

      // 2. Protection: Never touch current active working directory
      if (wt.path === cwd) {
        skipped.push({ path: wt.path, branch: wt.branch, reason: 'currently active worktree protected' })
        continue
      }

      // 3. Protection: Never touch main or base branch
      if (wt.branch === 'main' || wt.branch === 'master' || wt.branch === baseBranch) {
        skipped.push({ path: wt.path, branch: wt.branch, reason: 'base branch worktree protected' })
        continue
      }

      // 4. Protection: Never prune a dirty worktree (uncommitted changes)
      let isDirty = false
      try {
        const statusRes = await readGit(execFile, wt.path, ['status', '--porcelain'])
        if (statusRes.stdout.trim().length > 0) {
          isDirty = true
        }
      } catch {
        // If git status fails on the path, mark skipped
        skipped.push({ path: wt.path, branch: wt.branch, reason: 'unable to inspect worktree status' })
        continue
      }

      if (isDirty) {
        skipped.push({ path: wt.path, branch: wt.branch, reason: 'dirty worktree has uncommitted modifications' })
        continue
      }

      // 5. Verification: Check if branch is merged into baseBranch using merge-base --is-ancestor
      let isMerged = false
      if (wt.branch && wt.branch !== 'detached') {
        try {
          await readGit(execFile, cwd, ['merge-base', '--is-ancestor', wt.branch, baseBranch])
          isMerged = true
        } catch {
          isMerged = false
        }
      }

      if (isMerged) {
        candidates.push({
          path: wt.path,
          branch: wt.branch,
          head: wt.head,
          status: 'merged',
          safeToPrune: true,
          reason: `Branch ${wt.branch} is fully merged into ${baseBranch}`,
        })
      } else {
        skipped.push({ path: wt.path, branch: wt.branch, reason: `branch ${wt.branch} not merged into ${baseBranch}` })
      }
    }

    // If prune mode is explicitly requested and dry_run is false
    if (!dryRun && args.prune === true) {
      for (const cand of candidates) {
        if (cand.safeToPrune) {
          try {
            await writeGit(execFile, cwd, ['worktree', 'remove', cand.path], settings)
            pruned.push({ path: cand.path, branch: cand.branch })
          } catch (err) {
            skipped.push({ path: cand.path, branch: cand.branch, error: err?.stderr || err?.message || String(err) })
          }
        }
      }
    }

    return {
      ok: true,
      data: {
        checked: trees.length,
        baseBranch,
        dryRun,
        candidates,
        pruned,
        skipped,
      },
    }
  } catch (err) {
    return { ok: false, error: err?.stderr || err?.message || String(err) }
  }
}
