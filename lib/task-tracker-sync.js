export const TASK_PROVISION_CONTRACT = 'dsh-drives.task-provision.v1'

export const STATUS_MAPPING = {
  todo: 'status/ready',
  in_progress: 'status/in-progress',
  review: 'status/review',
  done: 'closed',
}

export function giteaStatusToCardStatus(issue = {}) {
  if (issue.state === 'closed') return 'done'
  const labels = Array.isArray(issue.labels)
    ? issue.labels.map((l) => (typeof l === 'object' ? l.name : String(l))).filter(Boolean)
    : []
  if (labels.includes('status/in-progress')) return 'in_progress'
  if (labels.includes('status/review')) return 'review'
  return 'todo'
}

export function issueToTaskCard(issue = {}) {
  const number = issue.number ?? issue.index ?? null
  const labels = Array.isArray(issue.labels)
    ? issue.labels.map((l) => (typeof l === 'object' ? l.name : String(l))).filter(Boolean)
    : []

  return {
    id: `gitea-${number}`,
    externalRef: issue.externalRef || `issue-${number}`,
    number,
    title: issue.title || '',
    description: issue.body || '',
    status: giteaStatusToCardStatus(issue),
    labels,
    assignee: issue.assignee?.login || issue.assignees?.[0]?.login || null,
    milestone: issue.milestone?.title || null,
    url: issue.html_url || issue.url || null,
    createdAt: issue.created_at || null,
    updatedAt: issue.updated_at || null,
    sourceContract: TASK_PROVISION_CONTRACT,
  }
}

export function taskCardToGitea(card = {}) {
  const targetLabel = STATUS_MAPPING[card.status] || 'status/ready'
  const isClosed = card.status === 'done'

  return {
    number: card.number || (card.id ? Number(String(card.id).replace(/\D/g, '')) : null),
    title: card.title || '',
    body: card.description || '',
    state: isClosed ? 'closed' : 'open',
    targetLabel: isClosed ? null : targetLabel,
    externalRef: card.externalRef || null,
  }
}

export async function runTaskTrackerSync(args = {}, deps = {}) {
  const action = args.action || 'export_cards'
  const owner = String(args.owner || deps.settings?.defaultOwner || '').trim()
  const repo = String(args.repo || deps.settings?.defaultRepo || '').trim()

  if (action === 'status_map') {
    return { ok: true, data: { contract: TASK_PROVISION_CONTRACT, mapping: STATUS_MAPPING } }
  }

  if (action === 'export_cards') {
    if (!deps.client || typeof deps.client.listIssues !== 'function') {
      return { ok: false, error: 'Gitea client listIssues not available.' }
    }
    const res = await deps.client.listIssues(owner, repo, { state: args.state || 'all', limit: args.limit || 50 })
    if (!res?.ok) return { ok: false, error: res?.error || 'Failed to list issues for sync' }

    const issues = Array.isArray(res.data) ? res.data : []
    const cards = issues.map(issueToTaskCard)
    return { ok: true, data: { count: cards.length, cards } }
  }

  if (action === 'convert_card') {
    const card = args.card || {}
    return { ok: true, data: taskCardToGitea(card) }
  }

  if (action === 'sync_card') {
    const card = args.card || {}
    const giteaPayload = taskCardToGitea(card)
    let syncRes = null
    if (giteaPayload.number && deps.client?.editIssue) {
      syncRes = await deps.client.editIssue(owner, repo, giteaPayload.number, {
        title: giteaPayload.title,
        body: giteaPayload.body,
        state: giteaPayload.state,
      }).catch(() => null)
    } else if (deps.client?.createIssue) {
      syncRes = await deps.client.createIssue(owner, repo, {
        title: giteaPayload.title,
        body: giteaPayload.body,
      }).catch(() => null)
    }
    const tt = deps.taskTracker || deps.services?.['dsh-task-tracker']
    if (tt && typeof tt.syncCard === 'function') {
      try {
        await tt.syncCard(card)
      } catch { /* ignore */ }
    }
    return { ok: true, data: { card, giteaResult: syncRes?.data || null, synced: true } }
  }

  return { ok: false, error: `Unknown task-tracker sync action: ${action}` }
}
