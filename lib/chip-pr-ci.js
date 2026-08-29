/**
 * enrichChip: добавляет к git-чипу данные PR/CI — открытый PR для текущей
 * ветки и статус CI для текущего SHA. Read-only; без Gitea-конфига
 * возвращает нейтральные значения.
 */

export async function enrichChip({ branch = '', headSha = '', owner = '', repo = '' } = {}, deps = {}) {
  const client = deps.client
  if (!client || !owner || !repo) {
    return { ok: true, data: { prNumber: null, ciFailed: false } }
  }

  let prNumber = null
  let ciFailed = false

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

  return { ok: true, data: { prNumber, ciFailed } }
}
