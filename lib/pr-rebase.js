import { clearSnapshotCache } from './git-local.js'
/**
 * gitea_pr_rebase: automated rebase of PR branch onto fresh main.
 * Supports plan (read-only) and execution (confirm).
 */

export async function planRebase(args = {}, deps = {}) {
  const { number } = args
  return {
    ok: true,
    data: {
      dryRun: true,
      number,
      steps: [
        '1. Determine PR head branch and main',
        '2. fetch origin main',
        '3. Rebase branch onto origin/main (or merge)',
        '4. On conflicts return file list, otherwise push + rerun CI',
      ],
      note: 'Plan. Actual rebase requires confirm: true.',
    },
  }
}

export async function runRebase(args = {}, deps = {}) {
  const confirm = args.confirm === true
  const execFile = deps.execFile
  const gitWrapper = deps.gitWrapper || 'git'
  const cwd = deps.cwd
  const owner = args.owner
  const repo = args.repo

  if (!confirm) return { ok: false, error: 'Auto-rebase requires confirm: true (boolean).' }
  if (!cwd || !execFile) return { ok: false, error: 'No workspace cwd or execFile provided. Run from a gitea worktree.' }
  if (!repo) return { ok: false, error: 'Cannot rebase: repo not resolved.' }

  const run = async (bin, gitArgs) => {
    const res = await execFile(bin, gitArgs).catch((e) => ({ stdout: '', stderr: String(e?.stderr || e?.message || e) }))
    return res
  }

  try {
    // fetch fresh main
    await run(gitWrapper, ['-C', cwd, 'fetch', 'origin', 'main'])
    // rebase onto origin/main
    const rebaseRes = await run(gitWrapper, ['-C', cwd, 'rebase', 'origin/main'])
    const stderr = String(rebaseRes.stderr || '')
    if (/conflict|CONFLICT|fatal/i.test(stderr) || /rebase in progress/i.test(stderr)) {
      // collect conflict files
      const lsRes = await run(gitWrapper, ['-C', cwd, 'diff', '--name-only', '--diff-filter=U'])
      const files = String(lsRes.stdout || '').split('\n').filter(Boolean)
      return {
        ok: true,
        data: { rebased: false, conflicts: files.length ? files : ['(see git status)'], note: 'Conflicts present — resolve manually and finish rebase (git rebase --continue).' },
      }
    }
    // push
    await run(gitWrapper, ['-C', cwd, 'push', 'origin', `HEAD:${args.branch || 'HEAD'}`])
    clearSnapshotCache(cwd)
    return { ok: true, data: { rebased: true, pushed: true, note: 'Rebase completed, changes pushed.' } }
  } catch (e) {
    return { ok: false, error: String(e?.message || e) }
  }
}
