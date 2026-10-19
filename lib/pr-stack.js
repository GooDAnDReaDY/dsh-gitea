/**
 * Stacked Pull Request analysis and automated cascading rebase.
 * Implements dependency tree detection, PR base branch migration,
 * and safe git rebase --onto execution with conflict abort.
 */

import { clearSnapshotCache } from './git-local.js'

export const SAFE_BRANCH_RE = /^[a-zA-Z0-9._/-]+$/

function sanitizeBranch(name) {
  const clean = String(name || '').trim()
  if (!clean || !SAFE_BRANCH_RE.test(clean) || clean.includes('..')) {
    return null
  }
  return clean
}

/**
 * Extracts explicit parent PR references from a PR description.
 * Patterns: "Depends on #123", "Stacked on #123", "Part of #123", "Stack: #123"
 */
export function extractParentPrFromText(text) {
  if (!text || typeof text !== 'string') return null
  const m = text.match(/(?:depends\s+on|stacked\s+on|part\s+of|parent\s+pr|stack)[:\s]*#?(\d+)/i)
  if (m && m[1]) {
    const num = Number(m[1])
    return Number.isInteger(num) && num > 0 ? num : null
  }
  return null
}

/**
 * Builds dependency graph of Pull Requests from list of PRs.
 * Determines parent-child chains based on head -> base matches and body annotations.
 *
 * @param {Array<Object>} prs List of pull request objects from Gitea API.
 * @param {number|null} [focusPrNumber=null] Optional PR number to center the stack on.
 * @returns {Object} Structured stack result with chain array and metadata.
 */
export function buildPullStack(prs = [], focusPrNumber = null) {
  const prList = Array.isArray(prs) ? prs : []
  const prMap = new Map()
  const headToPrMap = new Map()

  for (const pr of prList) {
    if (!pr || typeof pr !== 'object') continue
    const num = Number(pr.number)
    if (!num) continue
    prMap.set(num, pr)
    const headRef = pr.head?.ref || pr.head_branch || pr.headBranch
    if (headRef) {
      headToPrMap.set(headRef, pr)
    }
  }

  // Determine parent-child links for all PRs
  const parentMap = new Map() // childPrNumber -> parentPrNumber
  const childrenMap = new Map() // parentPrNumber -> Set<childPrNumber>

  for (const [num, pr] of prMap.entries()) {
    const baseRef = pr.base?.ref || pr.base_branch || pr.baseBranch
    let parentPr = null

    // 1. Direct branch dependency: this PR base matches another PR head
    if (baseRef && headToPrMap.has(baseRef)) {
      const candidate = headToPrMap.get(baseRef)
      if (candidate && candidate.number !== num) {
        parentPr = candidate.number
      }
    }

    // 2. Explicit body reference if no direct branch match
    if (!parentPr && pr.body) {
      const explicitNum = extractParentPrFromText(pr.body)
      if (explicitNum && prMap.has(explicitNum) && explicitNum !== num) {
        parentPr = explicitNum
      }
    }

    if (parentPr) {
      parentMap.set(num, parentPr)
      if (!childrenMap.has(parentPr)) {
        childrenMap.set(parentPr, new Set())
      }
      childrenMap.get(parentPr).add(num)
    }
  }

  // Helper to trace root of a PR
  function findRoot(num, visited = new Set()) {
    if (visited.has(num)) return num // cycle protection
    visited.add(num)
    const parent = parentMap.get(num)
    if (parent && prMap.has(parent)) {
      return findRoot(parent, visited)
    }
    return num
  }

  // Helper to trace downward stack in order
  function collectChain(rootNum) {
    const stack = []
    const visited = new Set()

    function traverse(num, depth) {
      if (visited.has(num)) return
      visited.add(num)
      const pr = prMap.get(num)
      if (!pr) return

      const parentNum = parentMap.get(num) || null
      const parentPr = parentNum ? prMap.get(parentNum) : null
      const isParentMerged = parentPr ? (parentPr.merged || parentPr.state === 'closed') : false
      const rootBase = (pr.base?.ref && !parentNum) ? pr.base.ref : 'main'

      // Needs rebase if parent PR was merged but this child still points to parent branch
      const curBase = pr.base?.ref || 'main'
      const isMerged = Boolean(pr.merged || (pr.state === 'closed' && pr.merged_at))
      const isOpen = pr.state === 'open' && !isMerged
      const needsRebase = Boolean(
        isOpen &&
        parentPr &&
        isParentMerged &&
        curBase !== rootBase &&
        curBase !== 'main'
      )

      let rebaseReason = ''
      if (needsRebase) {
        rebaseReason = `Parent PR #${parentNum} is merged. Base branch can be migrated from "${curBase}" to "${rootBase}".`
      }

      stack.push({
        number: num,
        title: pr.title || `PR #${num}`,
        head: pr.head?.ref || '',
        headSha: pr.head?.sha || null,
        base: curBase,
        state: isMerged ? 'merged' : (pr.state || 'open'),
        merged: isMerged,
        depth,
        isRoot: !parentNum,
        parentPr: parentNum,
        parentMerged: isParentMerged,
        children: Array.from(childrenMap.get(num) || []),
        needsRebase,
        rebaseReason,
        html_url: pr.html_url || '',
      })

      const children = Array.from(childrenMap.get(num) || []).sort((a, b) => a - b)
      for (const childNum of children) {
        traverse(childNum, depth + 1)
      }
    }

    traverse(rootNum, 0)
    return stack
  }

  // If focus PR is specified
  if (focusPrNumber != null) {
    const focusNum = Number(focusPrNumber)
    if (!prMap.has(focusNum)) {
      return {
        ok: false,
        error: `Pull request #${focusNum} not found in repository.`,
      }
    }

    const rootNum = findRoot(focusNum)
    const stack = collectChain(rootNum)
    const rootPr = prMap.get(rootNum)
    const rootBase = rootPr?.base?.ref || 'main'

    const titles = stack.map((s) => `#${s.number} (${s.merged ? 'merged' : s.state})`).join(' -> ')
    const rebasePending = stack.filter((s) => s.needsRebase).map((s) => `#${s.number}`)

    return {
      ok: true,
      data: {
        focusPr: focusNum,
        rootPr: rootNum,
        rootBase,
        total: stack.length,
        hasChain: stack.length > 1,
        rebasePending,
        stack,
        summary: `Stack of ${stack.length} PR(s): ${titles}${rebasePending.length ? ` [Rebase pending: ${rebasePending.join(', ')}]` : ''}`,
      },
    }
  }

  // No specific PR focused: return all stacks with >= 2 PRs or all active PRs
  const processedRoots = new Set()
  const allStacks = []

  for (const num of prMap.keys()) {
    const rootNum = findRoot(num)
    if (!processedRoots.has(rootNum)) {
      processedRoots.add(rootNum)
      const stack = collectChain(rootNum)
      if (stack.length > 1) {
        allStacks.push(stack)
      }
    }
  }

  return {
    ok: true,
    data: {
      totalStacks: allStacks.length,
      stacks: allStacks,
      summary: allStacks.length === 0
        ? 'No stacked pull request chains detected in repository.'
        : `Found ${allStacks.length} stacked PR chain(s).`,
    },
  }
}

/**
 * Plans cascading rebase for a child pull request in a stack.
 */
export async function planStackRebase(args = {}, deps = {}) {
  const { owner, repo, pr_number, target_base } = args
  const num = Number(pr_number)
  if (!num) return { ok: false, error: 'pr_number is required to plan a stacked rebase.' }
  if (!deps.client?.listPulls) return { ok: false, error: 'Gitea client is required for stack planning.' }

  const pullsRes = await deps.client.listPulls(owner, repo, { state: 'all', limit: 50 }).catch((e) => ({ ok: false, error: String(e) }))
  if (!pullsRes?.ok) {
    return { ok: false, error: `Failed to fetch repository pull requests: ${pullsRes?.error || 'unknown error'}` }
  }

  const stackRes = buildPullStack(pullsRes.data || [], num)
  if (!stackRes.ok) return stackRes

  const stack = stackRes.data.stack || []
  const current = stack.find((s) => s.number === num)
  if (!current) {
    return { ok: false, error: `PR #${num} is not in the resolved stack.` }
  }

  const parentPr = current.parentPr ? stack.find((s) => s.number === current.parentPr) : null
  const defaultTarget = stackRes.data.rootBase || 'main'
  const targetBase = sanitizeBranch(target_base) || defaultTarget
  const oldBase = current.base

  const steps = [
    `1. Inspect clean git workspace in repository directory`,
    `2. Fetch latest branches: git fetch origin ${targetBase} ${oldBase}`,
    `3. Update PR #${num} base branch from "${oldBase}" to "${targetBase}" in Gitea`,
    `4. Execute git rebase --onto origin/${targetBase} ${parentPr?.headSha ? parentPr.headSha.slice(0, 8) : `origin/${oldBase}`} ${current.head}`,
    `5. Push rebased branch with lease: git push --force-with-lease origin ${current.head}`,
  ]

  return {
    ok: true,
    data: {
      dryRun: true,
      pr_number: num,
      title: current.title,
      head: current.head,
      oldBase,
      targetBase,
      parentPr: current.parentPr,
      parentMerged: current.parentMerged,
      needsRebase: current.needsRebase,
      stack: stack.map((s) => ({ number: s.number, head: s.head, base: s.base, state: s.state })),
      steps,
      note: 'Plan generated. Set confirm: true to execute the cascading rebase.',
    },
  }
}

/**
 * Executes cascading rebase for a child pull request in a stack.
 * Requires confirm: true and configured gitWrapper.
 */
export async function executeStackRebase(args = {}, deps = {}) {
  const confirm = args.confirm === true
  const force = args.force === true
  const execFile = deps.execFile
  const gitWrapper = String(deps.gitWrapper || '').trim()
  const cwd = String(deps.cwd || process.cwd()).trim()
  const { owner, repo, pr_number, target_base } = args
  const num = Number(pr_number)

  if (!confirm) {
    return planStackRebase(args, deps)
  }

  if (!num) return { ok: false, error: 'pr_number is required for stacked rebase.' }
  if (!gitWrapper) {
    return { ok: false, error: 'git wrapper not configured: set gitWrapper in Settings for write operations' }
  }
  if (!execFile) {
    return { ok: false, error: 'No execFile provided. Must execute in a valid environment.' }
  }
  if (!deps.client?.listPulls) {
    return { ok: false, error: 'Gitea client is required for stacked rebase.' }
  }

  const run = async (bin, gitArgs) => {
    try {
      const res = await execFile(bin, gitArgs, { cwd, timeout: 45_000, maxBuffer: 2 * 1024 * 1024 })
      return { code: 0, stdout: String(res?.stdout || ''), stderr: String(res?.stderr || '') }
    } catch (e) {
      return {
        code: typeof e?.code === 'number' ? e.code : 1,
        stdout: String(e?.stdout || ''),
        stderr: String(e?.stderr || e?.message || e),
      }
    }
  }

  // 1. Verify working directory is clean
  const statusRes = await run(gitWrapper, ['status', '--porcelain'])
  if (statusRes.code !== 0) {
    return { ok: false, error: `Failed to inspect git status in workspace: ${statusRes.stderr.trim()}` }
  }
  if (statusRes.stdout.trim().length > 0) {
    return {
      ok: false,
      error: 'Workspace working tree contains uncommitted changes. Commit or stash them before rebasing.',
    }
  }

  // 2. Resolve PR stack details via API
  const pullsRes = await deps.client.listPulls(owner, repo, { state: 'all', limit: 50 }).catch((e) => ({ ok: false, error: String(e) }))
  if (!pullsRes?.ok) {
    return { ok: false, error: `Failed to fetch repository pull requests: ${pullsRes?.error || 'unknown error'}` }
  }

  const stackRes = buildPullStack(pullsRes.data || [], num)
  if (!stackRes.ok) return stackRes

  const stack = stackRes.data.stack || []
  const current = stack.find((s) => s.number === num)
  if (!current) {
    return { ok: false, error: `PR #${num} not found in stack.` }
  }

  if (current.merged) {
    return { ok: false, error: `Cannot rebase: PR #${num} is already merged.` }
  }
  if (current.state === 'closed') {
    return { ok: false, error: `Cannot rebase: PR #${num} is closed.` }
  }

  const parentPr = current.parentPr ? stack.find((s) => s.number === current.parentPr) : null
  if (parentPr && !parentPr.merged && !force) {
    return {
      ok: false,
      error: `Parent PR #${parentPr.number} (${parentPr.head}) is not yet merged. Use force: true if you intentionally want to rebase early.`,
    }
  }

  const defaultTarget = stackRes.data.rootBase || 'main'
  const targetBase = sanitizeBranch(target_base) || defaultTarget
  const oldBase = sanitizeBranch(current.base) || 'main'
  const childBranch = sanitizeBranch(current.head)
  if (!childBranch) {
    return { ok: false, error: `Invalid child branch name: ${current.head}` }
  }

  // 3. Switch to child branch if not already on it
  const curBranchRes = await run(gitWrapper, ['rev-parse', '--abbrev-ref', 'HEAD'])
  const curBranch = curBranchRes.stdout.trim()
  if (curBranch !== childBranch) {
    const checkoutRes = await run(gitWrapper, ['checkout', childBranch])
    if (checkoutRes.code !== 0) {
      return { ok: false, error: `Failed to checkout child branch "${childBranch}": ${checkoutRes.stderr.trim()}` }
    }
  }

  // 4. Fetch latest target base from origin
  const fetchRes = await run(gitWrapper, ['fetch', 'origin', targetBase])
  if (fetchRes.code !== 0) {
    return { ok: false, error: `git fetch origin ${targetBase} failed: ${fetchRes.stderr.trim()}` }
  }

  // 5. Update PR base branch in Gitea API if changing
  let baseUpdated = false
  if (oldBase !== targetBase && deps.client.editPull) {
    const editRes = await deps.client.editPull(owner, repo, num, { base: targetBase }).catch((e) => ({ ok: false, error: String(e) }))
    if (!editRes?.ok) {
      return { ok: false, error: `Failed to update PR #${num} base branch to "${targetBase}" in Gitea: ${editRes?.error || 'unknown error'}` }
    }
    baseUpdated = true
  }

  // 6. Execute rebase --onto
  const upstreamRef = parentPr?.headSha ? parentPr.headSha : `origin/${oldBase}`
  const rebaseArgs = ['rebase', '--onto', `origin/${targetBase}`, upstreamRef, childBranch]
  const rebaseRes = await run(gitWrapper, rebaseArgs)

  if (rebaseRes.code !== 0) {
    const combined = `${rebaseRes.stderr} ${rebaseRes.stdout}`
    let conflictFiles = []
    if (/conflict|CONFLICT/i.test(combined) || /rebase in progress/i.test(combined)) {
      const diffRes = await run(gitWrapper, ['diff', '--name-only', '--diff-filter=U'])
      conflictFiles = diffRes.stdout.split('\n').map((s) => s.trim()).filter(Boolean)
    }

    // Always abort automatically to leave working copy clean
    await run(gitWrapper, ['rebase', '--abort']).catch(() => {})

    // Revert Gitea PR base if we changed it and rebase failed
    if (baseUpdated && deps.client.editPull) {
      await deps.client.editPull(owner, repo, num, { base: oldBase }).catch(() => {})
    }

    return {
      ok: false,
      conflict: true,
      files: conflictFiles,
      error: `Rebase conflicts encountered on ${conflictFiles.length ? conflictFiles.join(', ') : 'files'}. Rebase aborted automatically.`,
    }
  }

  // 7. Push rebased branch to remote
  const pushRes = await run(gitWrapper, ['push', '--force-with-lease', 'origin', childBranch])
  if (pushRes.code !== 0) {
    return {
      ok: false,
      error: `git push --force-with-lease origin ${childBranch} failed: ${pushRes.stderr.trim() || pushRes.stdout.trim()}`,
    }
  }

  clearSnapshotCache(cwd)

  return {
    ok: true,
    data: {
      pr_number: num,
      head: childBranch,
      oldBase,
      targetBase,
      baseUpdated,
      rebased: true,
      pushed: true,
      note: `Successfully rebased branch "${childBranch}" onto "${targetBase}" and pushed to origin.`,
    },
  }
}
