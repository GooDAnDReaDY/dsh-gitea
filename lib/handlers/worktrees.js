import { resolveRepo } from '../repo.js'
import { runWorktreeAction } from '../git-local.js'
import { LOCAL_TOOLS } from './common.js'

export function isWorktreeTool(name) {
  return LOCAL_TOOLS.has(name) || name === 'gitea_action_card'
}

export async function handleWorktreeTool(name, args, deps, ctx) {
  if (LOCAL_TOOLS.has(name)) {
    if (name === 'gitea_git_graph') {
      const { fetchCommitGraph } = await import('../graph.js')
      const cwd = args.cwd || deps.cwd || process.cwd()
      const gitWrapper = deps.gitWrapper || 'git'
      const graphRes = await fetchCommitGraph({ gitWrapper, cwd, limit: args.limit, skip: args.skip || args.offset, execFile: deps.execFile })
      if (graphRes.ok && deps.client && args.withCiStatus !== false) {
        const resolved = resolveRepo({ args, settings: deps.settings, remoteUrl: deps.remoteUrl })
        if (resolved.ok && Array.isArray(graphRes.data?.commits)) {
          const checkCount = Math.min(10, graphRes.data.commits.length)
          await Promise.allSettled(
            graphRes.data.commits.slice(0, checkCount).map(async (commit) => {
              try {
                const st = await deps.client.getCombinedCommitStatus(resolved.owner, resolved.repo, commit.oid)
                if (st?.ok && st.data?.state) {
                  commit.ciStatus = st.data.state
                }
              } catch { /* ignore CI lookup failures */ }
            })
          )
        }
      }
      return graphRes
    }
    if (name === 'gitea_worktree_gc') {
      const { runWorktreeGc } = await import('../worktree-gc.js')
      return runWorktreeGc(args, deps)
    }
    const action = name.replace('gitea_worktree_', '')
    return runWorktreeAction(action, args, deps)
  }

  if (name === 'gitea_action_card') {
    const client = ctx.client
    const settings = ctx.settings || {}
    const type = String(args.type || '').toLowerCase()
    const targetOwner = String(args.owner || settings.defaultOwner || '').trim()
    const targetRepo = String(args.repo || settings.defaultRepo || '').trim()
    const targetCwd = String(args.cwd || deps.cwd || '').trim() || process.cwd()
    const num = Number(args.number)
    const { buildActionCardHtml } = await import('../action-cards.js')

    if (type === 'issue') {
      if (!num || !targetOwner || !targetRepo) {
        return { ok: false, error: 'Pass number, owner, and repo for issue action card.' }
      }
      const issRes = await client.getIssue(targetOwner, targetRepo, num)
      if (!issRes?.ok) {
        return { ok: false, error: issRes?.error || `Failed to fetch issue #${num}` }
      }
      const iss = issRes.data || {}
      const html = buildActionCardHtml('issue', {
        number: num,
        title: iss.title,
        state: iss.state,
        labels: (iss.labels || []).map((l) => (typeof l === 'object' ? l.name : l)),
        assignee: iss.assignee?.login || iss.assignee?.username,
        owner: targetOwner,
        repo: targetRepo,
        html_url: iss.html_url,
      })
      return {
        ok: true,
        data: {
          type: 'issue',
          number: num,
          title: iss.title,
          state: iss.state,
          labels: iss.labels,
          html,
          summary: `Issue #${num}: ${iss.title} [${(iss.state || 'open').toUpperCase()}]`,
        },
      }
    }

    if (type === 'pr') {
      if (!num || !targetOwner || !targetRepo) {
        return { ok: false, error: 'Pass number, owner, and repo for PR action card.' }
      }
      const prRes = await client.getPull(targetOwner, targetRepo, num)
      if (!prRes?.ok) {
        return { ok: false, error: prRes?.error || `Failed to fetch PR #${num}` }
      }
      const pr = prRes.data || {}
      let ciStatus = 'pending'
      let ciStep = ''
      try {
        const ciRes = await client.getPullCiStatus?.(targetOwner, targetRepo, num)
        if (ciRes?.ok && ciRes.data) {
          ciStatus = ciRes.data.state || ciRes.data.status || 'pending'
          ciStep = ciRes.data.failedStep || ''
        }
      } catch { /* ignore CI query error */ }

      let reviewsCount = 0
      try {
        const revRes = await client.listPullReviews?.(targetOwner, targetRepo, num)
        if (revRes?.ok && Array.isArray(revRes.data)) {
          reviewsCount = revRes.data.filter((r) => r.state === 'APPROVED').length
        }
      } catch { /* ignore review list error */ }

      let needsRebase = false
      try {
        const { buildPullStack } = await import("../pr-stack.js")
        const allPulls = await client.listPulls?.(targetOwner, targetRepo, { state: "all", limit: 25 })
        if (allPulls?.ok && Array.isArray(allPulls.data)) {
          const sRes = buildPullStack(allPulls.data, num)
          if (sRes?.ok && sRes.data?.stack) {
            const current = sRes.data.stack.find((s) => s.number === num)
            needsRebase = Boolean(current?.needsRebase)
          }
        }
      } catch { /* ignore stack query error */ }

      const html = buildActionCardHtml("pr", {
        needs_rebase: needsRebase,
        number: num,
        title: pr.title,
        state: pr.merged ? 'merged' : pr.state,
        ci_status: ciStatus,
        ci_step: ciStep,
        reviews: reviewsCount,
        mergeable: pr.mergeable ?? true,
        owner: targetOwner,
        repo: targetRepo,
        html_url: pr.html_url,
      })
      return {
        ok: true,
        data: {
          type: 'pr',
          number: num,
          title: pr.title,
          state: pr.merged ? 'merged' : pr.state,
          ci_status: ciStatus,
          reviews: reviewsCount,
          html,
          summary: `PR #${num}: ${pr.title} [${(pr.merged ? 'merged' : pr.state).toUpperCase()}] (CI: ${ciStatus})`,
        },
      }
    }

    if (type === 'branch') {
      const { buildGitSnapshot } = await import('../git-local.js')
      const snapRes = await buildGitSnapshot({ repoDir: targetCwd, execFile: deps.execFile })
      const branchName = args.branch || (snapRes?.ok ? snapRes.branch : 'main')
      const html = buildActionCardHtml('branch', {
        branch: branchName,
        dirty: snapRes?.dirty || false,
        dirtyFiles: snapRes?.dirtyFiles || 0,
        ahead: snapRes?.ahead || 0,
        behind: snapRes?.behind || 0,
        head: snapRes?.head || '',
        owner: targetOwner,
        repo: targetRepo,
        cwd: targetCwd,
      })
      return {
        ok: true,
        data: {
          type: 'branch',
          branch: branchName,
          dirty: snapRes?.dirty || false,
          dirtyFiles: snapRes?.dirtyFiles || 0,
          ahead: snapRes?.ahead || 0,
          behind: snapRes?.behind || 0,
          html,
          summary: `Branch "${branchName}": ${snapRes?.dirty ? `${snapRes.dirtyFiles} modified file(s)` : 'clean'} (ahead ${snapRes?.ahead || 0}, behind ${snapRes?.behind || 0})`,
        },
      }
    }

    return { ok: false, error: `Unsupported action card type: ${type}` }
  }

  return { ok: false, error: `Unknown worktree tool: ${name}` }
}
