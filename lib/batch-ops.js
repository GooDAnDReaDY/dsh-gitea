/**
 * gitea_batch_issue_ops: пакетные операции над issues (labels/milestone/
 * assignee) с preview и dry-run по умолчанию. Запись только при явном apply.
 */

function selectedNumbers(issues, filter) {
  if (Array.isArray(filter.numbers) && filter.numbers.length > 0) {
    return issues.filter((i) => filter.numbers.map(Number).includes(i.number))
  }
  if (filter.state && filter.state !== 'all') {
    return issues.filter((i) => i.state === filter.state)
  }
  return issues
}

async function listIssues(client, owner, repo) {
  const res = await client.listIssues(owner, repo, { state: 'open', limit: 200 }).catch((e) => ({ ok: false, error: String(e) }))
  if (!res?.ok) return { ok: false, error: res?.error || 'list failed' }
  return { ok: true, issues: Array.isArray(res.data) ? res.data : [] }
}

export async function planBatch(args = {}, deps = {}) {
  const { ok, issues, error } = await listIssues(deps.client, args.owner, args.repo)
  if (!ok) return { ok: false, error }
  const selected = selectedNumbers(issues, args)
  const preview = selected.map((i) => ({
    number: i.number,
    title: i.title,
    action: {
      label: args.label || null,
      milestone: args.milestone || null,
      assignee: args.assignee || null,
    },
  }))
  return { ok: true, data: { preview, dryRun: args.apply !== true } }
}

export async function applyBatch(args = {}, deps = {}) {
  const { ok, issues, error } = await listIssues(deps.client, args.owner, args.repo)
  if (!ok) return { ok: false, error }
  const selected = selectedNumbers(issues, args)
  let resolvedLabelIds = null
  if (args.label) {
    const raw = Array.isArray(args.label) ? args.label : [args.label]
    if (typeof deps.client.listLabels === 'function' && !raw.every((x) => typeof x === 'number' || /^\d+$/.test(String(x)))) {
      const labelsRes = await deps.client.listLabels(args.owner, args.repo, { limit: 100 }).catch(() => ({ ok: false }))
      const existing = labelsRes?.ok && Array.isArray(labelsRes.data) ? labelsRes.data : []
      resolvedLabelIds = []
      for (const item of raw) {
        if (typeof item === 'number' || /^\d+$/.test(String(item))) {
          resolvedLabelIds.push(Number(item))
        } else {
          const found = existing.find((l) => l.name === item)
          if (found && found.id != null) resolvedLabelIds.push(found.id)
        }
      }
    } else {
      resolvedLabelIds = raw
    }
  }
  const results = []
  for (const issue of selected) {
    const perIssue = { number: issue.number, ok: true, applied: [], errors: [] }
    if (resolvedLabelIds !== null) {
      const labelRes = await deps.client.setIssueLabels(args.owner, args.repo, issue.number, resolvedLabelIds).catch((e) => ({ ok: false, error: String(e) }))
      if (labelRes?.ok) perIssue.applied.push('labels')
      else { perIssue.ok = false; perIssue.errors.push(`labels: ${labelRes?.error || 'unknown'}`) }
    }
    if (args.milestone) {
      // milestone set via updateIssue body is not directly supported; record as unsupported but non-fatal
      perIssue.applied.push(`milestone:${args.milestone} (not applied — use updateIssue)`)
    }
    if (args.assignee) {
      const aRes = await deps.client.setIssueAssignee(args.owner, args.repo, issue.number, args.assignee).catch((e) => ({ ok: false, error: String(e) }))
      if (aRes?.ok) perIssue.applied.push('assignee')
      else { perIssue.ok = false; perIssue.errors.push(`assignee: ${aRes?.error || 'unknown'}`) }
    }
    results.push(perIssue)
  }
  return { ok: true, data: { results } }
}
