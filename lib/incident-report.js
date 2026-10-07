export function sanitizeIncidentLogs(text = '') {
  return String(text || '')
    .replace(/(?:bearer\s+|token\s*[:=]\s*|apikey\s*[:=]\s*|secret\s*[:=]\s*)['"]?[a-zA-Z0-9_\-\.]{12,}['"]?/gi, '[REDACTED_CREDENTIAL]')
    .replace(/password\s*[:=]\s*['"]?[^\s'"]+['"]?/gi, 'password=[REDACTED_PASSWORD]')
    .replace(/-----BEGIN (?:RSA )?PRIVATE KEY-----[\s\S]+?-----END (?:RSA )?PRIVATE KEY-----/g, '[REDACTED_PRIVATE_KEY]')
    .replace(/gh[pousr]_[A-Za-z0-9_]{16,}/g, '[REDACTED_GITHUB_TOKEN]')
}

export function buildIncidentBody({ service = '', alert = '', errorLogs = '', impact = '', mitigation = '', timeline = '' }) {
  const sanitizedLogs = sanitizeIncidentLogs(errorLogs)
  const lines = [
    `### Incident Description`,
    `**Affected Service**: ${service || 'Unknown'}`,
    `**Alert Summary**: ${alert || 'Production service alert'}`,
    timeline ? `**Timeline**: ${timeline}` : '',
    impact ? `**Impact**: ${impact}` : '',
    '',
    `#### Error Logs & Diagnostics`,
    '```',
    sanitizedLogs || 'No diagnostic logs provided.',
    '```',
    '',
    `### Mitigation & Resolution`,
    mitigation || '- Service investigated; pending diagnostic triage and remediation.',
  ].filter(Boolean)

  return lines.join('\n')
}

export async function runIncidentReport(args = {}, deps = {}) {
  const service = String(args.service || 'System').trim()
  const alert = String(args.alert || args.title || 'Service alert').trim()
  const owner = String(args.owner || deps.settings?.defaultOwner || '').trim()
  const repo = String(args.repo || deps.settings?.defaultRepo || '').trim()

  if (!owner || !repo) {
    return { ok: false, error: 'Target owner and repo must be specified or configured.' }
  }

  const title = `[INCIDENT] ${service}: ${alert}`
  const body = buildIncidentBody({
    service,
    alert,
    errorLogs: args.error_logs || args.logs || '',
    impact: args.impact || '',
    mitigation: args.mitigation || '',
    timeline: args.timeline || '',
  })

  const labels = ['type/incident', 'priority/critical', 'status/ready']

  if (args.dry_run === true) {
    return {
      ok: true,
      data: {
        dryRun: true,
        title,
        body,
        labels,
        sanitizedLogs: sanitizeIncidentLogs(args.error_logs || args.logs || ''),
      },
    }
  }

  if (!deps.client || typeof deps.client.createIssue !== 'function') {
    return { ok: false, error: 'Gitea client createIssue not available.' }
  }

  // Resolve label IDs if client supports listLabels
  let resolvedLabels = labels
  if (typeof deps.client.listLabels === 'function') {
    const listRes = await deps.client.listLabels(owner, repo, { limit: 100 }).catch(() => null)
    if (listRes?.ok && Array.isArray(listRes.data)) {
      const existing = listRes.data
      const ids = []
      for (const name of labels) {
        const found = existing.find((l) => String(l.name).toLowerCase() === name.toLowerCase())
        if (found?.id) ids.push(found.id)
      }
      if (ids.length > 0) resolvedLabels = ids
    }
  }

  const res = await deps.client.createIssue(owner, repo, {
    title,
    body,
    labels: resolvedLabels,
  })

  if (!res?.ok) {
    return { ok: false, error: res?.error || 'Failed to create incident issue', status: res?.status ?? 0 }
  }

  return {
    ok: true,
    data: {
      issue: res.data,
      title,
      sanitized: true,
    },
  }
}
