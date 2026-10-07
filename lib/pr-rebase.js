import { clearSnapshotCache } from './git-local.js'

/**
 * gitea_pr_rebase: automated rebase of PR branch onto fresh base branch.
 * Supports plan (read-only) and execution (confirm).
 */

const SAFE_BRANCH_RE = /^[a-zA-Z0-9][a-zA-Z0-9._/-]*$/

export async function planRebase(args = {}, deps = {}) {
  const number = args.number != null ? Number(args.number) : undefined
  const owner = args.owner
  const repo = args.repo

  let headBranch = null
  let baseBranch = null
  if (deps.client?.getPull && owner && repo && number) {
    try {
      const prRes = await deps.client.getPull(owner, repo, number)
      if (prRes?.ok && prRes.data) {
        headBranch = prRes.data.head?.ref || null
        baseBranch = prRes.data.base?.ref || null
      }
    } catch { /* ignore optional plan enrichment error */ }
  }

  return {
    ok: true,
    data: {
      dryRun: true,
      number,
      headBranch,
      baseBranch: baseBranch || 'main',
      steps: [
        `1. Determine PR head branch (${headBranch || 'current'}) and base (${baseBranch || 'main'})`,
        `2. fetch origin ${baseBranch || 'main'}`,
        `3. Rebase branch onto origin/${baseBranch || 'main'}`,
        '4. On conflicts return file list, otherwise push',
      ],
      note: 'Plan. Actual rebase requires confirm: true.',
    },
  }
}

export async function runRebase(args = {}, deps = {}) {
  const confirm = args.confirm === true
  const execFile = deps.execFile
  const gitWrapper = String(deps.gitWrapper || '').trim()
  const cwd = deps.cwd
  const repo = args.repo
  const owner = args.owner
  const number = args.number != null ? Number(args.number) : null

  if (!confirm) return { ok: false, error: 'Auto-rebase requires confirm: true (boolean).' }
  if (!gitWrapper) {
    return { ok: false, error: 'git wrapper not configured: set gitWrapper in Settings for write operations' }
  }
  if (!cwd || !execFile) return { ok: false, error: 'No workspace cwd or execFile provided. Run from a gitea worktree.' }
  if (!repo) return { ok: false, error: 'Cannot rebase: repo not resolved.' }

  const branch = args.branch ? String(args.branch).trim() : ''
  if (branch && (!SAFE_BRANCH_RE.test(branch) || branch.includes('..'))) {
    return { ok: false, error: `Invalid branch name: ${branch}` }
  }

  const run = async (bin, gitArgs) => {
    try {
      const res = await execFile(bin, gitArgs)
      return { code: 0, stdout: String(res?.stdout || ''), stderr: String(res?.stderr || '') }
    } catch (e) {
      return {
        code: typeof e?.code === 'number' ? e.code : 1,
        stdout: String(e?.stdout || ''),
        stderr: String(e?.stderr || e?.message || e),
      }
    }
  }

  // #285: If number is provided, verify PR status and match local branch to PR head
  let baseBranch = 'main'
  let targetHeadRef = branch
  if (number && deps.client?.getPull && owner && repo) {
    const prRes = await deps.client.getPull(owner, repo, number).catch((e) => ({ ok: false, error: String(e) }))
    if (!prRes?.ok) {
      return { ok: false, error: `Cannot verify PR #${number}: ${prRes?.error || 'PR not accessible'}` }
    }
    const pr = prRes.data
    if (pr.state !== 'open' || pr.merged) {
      return { ok: false, error: `Cannot rebase: PR #${number} is closed or already merged.` }
    }
    if (pr.base?.ref) baseBranch = pr.base.ref
    if (pr.head?.ref) targetHeadRef = pr.head.ref

    // Verify current branch in local cwd matches PR head
    const curBranchRes = await run(gitWrapper, ['-C', cwd, 'rev-parse', '--abbrev-ref', 'HEAD'])
    const curBranch = curBranchRes.code === 0 ? curBranchRes.stdout.trim() : ''
    if (targetHeadRef && curBranch && curBranch !== targetHeadRef && curBranch !== 'HEAD') {
      return {
        ok: false,
        error: `Local branch "${curBranch}" does not match PR head branch "${targetHeadRef}". Checkout the PR branch before rebasing.`,
      }
    }
  }

  try {
    // 1. fetch fresh base branch
    const fetchRes = await run(gitWrapper, ['-C', cwd, 'fetch', 'origin', baseBranch])
    if (fetchRes.code !== 0) {
      return { ok: false, error: `git fetch origin ${baseBranch} failed: ${fetchRes.stderr.trim() || fetchRes.stdout.trim()}` }
    }

    // 2. rebase onto origin/baseBranch
    const rebaseRes = await run(gitWrapper, ['-C', cwd, 'rebase', `origin/${baseBranch}`])
    if (rebaseRes.code !== 0) {
      const stderr = String(rebaseRes.stderr || '')
      const stdout = String(rebaseRes.stdout || '')
      const combined = `${stderr} ${stdout}`
      if (/conflict|CONFLICT/i.test(combined) || /rebase in progress/i.test(combined)) {
        // collect conflict files
        const lsRes = await run(gitWrapper, ['-C', cwd, 'diff', '--name-only', '--diff-filter=U'])
        const files = String(lsRes.stdout || '').split('\n').map((s) => s.trim()).filter(Boolean)
        return {
          ok: true,
          data: {
            rebased: false,
            conflicts: files.length ? files : ['(see git status)'],
            note: 'Conflicts present — resolve manually and finish rebase (git rebase --continue).',
          },
        }
      }
      return { ok: false, error: `git rebase failed (exit code ${rebaseRes.code}): ${stderr.trim() || stdout.trim()}` }
    }

    // 3. push
    const targetRef = targetHeadRef ? `HEAD:${targetHeadRef}` : 'HEAD'
    const pushRes = await run(gitWrapper, ['-C', cwd, 'push', 'origin', targetRef])
    if (pushRes.code !== 0) {
      return {
        ok: false,
        error: `git push origin failed (exit code ${pushRes.code}): ${pushRes.stderr.trim() || pushRes.stdout.trim()}`,
      }
    }

    clearSnapshotCache(cwd)
    return { ok: true, data: { rebased: true, pushed: true, baseBranch, note: 'Rebase completed, changes pushed.' } }
  } catch (e) {
    return { ok: false, error: String(e?.message || e) }
  }
}
