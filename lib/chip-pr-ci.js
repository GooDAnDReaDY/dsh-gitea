/**
 * enrichChip: enriches git-chip with PR/CI data and mirror synchronization lag.
 * Open PR for current branch, CI status for current SHA, and mirror lag alert.
 * Read-only; returns neutral values if Gitea config is absent.
 */

export async function enrichChip({ branch = '', headSha = '', owner = '', repo = '', repoDir = '' } = {}, deps = {}) {
  const client = deps.client
  if (!client || !owner || !repo) {
    return { ok: true, data: { prNumber: null, ciFailed: false, mirrorWarning: false, mirrorLag: 0 } }
  }

  let prNumber = null
  let ciFailed = false
  let mirrorWarning = false
  let mirrorLag = 0

  if (branch) {
    const pullsRes = await client.listPulls(owner, repo, { state: 'open', limit: 20 }).catch(() => ({ ok: true, data: [] }))
    const pulls = pullsRes?.ok && Array.isArray(pullsRes.data) ? pullsRes.data : []
    const match = pulls.find((p) => p.head?.ref === branch || (p.head?.ref || '').replace('refs/heads/', '') === branch)
    if (match) prNumber = match.number
  }

  if (headSha) {
    const runsRes = await client.listActionsRuns(owner, repo, { limit: 10 }).catch(() => ({ ok: true, data: { workflow_runs: [] } }))
    const runs = runsRes?.ok ? (runsRes.data?.workflow_runs || []) : []
    ciFailed = runs.some((r) => r.head_sha === headSha && (r.status === 'failure' || r.conclusion === 'failure'))
  }

  // Check push mirror status / errors
  try {
    if (typeof client.listPushMirrors === 'function') {
      const pmRes = await client.listPushMirrors(owner, repo).catch(() => null)
      if (pmRes?.ok && Array.isArray(pmRes.data) && pmRes.data.length > 0) {
        const pm = pmRes.data[0]
        if (pm.last_error) {
          mirrorWarning = true
        }
      }
    }
  } catch { /* push mirror query safe */ }

  // Check git mirror lag if repoDir is provided
  if (repoDir && deps.execFile) {
    try {
      const { getMirrorSyncStatus } = await import('./mirror-dashboard.js')
      const ms = await getMirrorSyncStatus({ owner, repo, branch, repoDir }, { client, execFile: deps.execFile })
      if (ms?.ok && ms.data) {
        mirrorLag = ms.data.lag || 0
        if (ms.data.warning || ms.data.lag > 1 || ms.data.status === 'error') {
          mirrorWarning = true
        }
      }
    } catch { /* mirror check must never throw or fail chip */ }
  }

  return { ok: true, data: { prNumber, ciFailed, mirrorWarning, mirrorLag } }
}
