const CONVENTIONAL_TITLE = /^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\([a-zA-Z0-9_\-./]+\))?: .+/i

const SECRET_PATTERNS = [
  { name: 'Bearer / API Token', re: /(?:bearer\s+|api[_-]?key\s*[:=]\s*|secret\s*[:=]\s*|token\s*[:=]\s*)['\"]?[a-zA-Z0-9_\-\Common]{16,}['\"]?/i, severity: 'error' },
  { name: 'Private Key Block', re: /-----BEGIN (?:RSA )?PRIVATE KEY-----/, severity: 'error' },
  { name: 'GitHub Token', re: /gh[pousr]_[A-Za-z0-9_]{16,}/, severity: 'error' },
  { name: 'Plaintext Password', re: /password\s*[:=]\s*['"][^'"]{8,}['"]/i, severity: 'warning' },
]

const PATH_TRAVERSAL = [
  { name: 'Path traversal sequence', re: /\.\.\//, severity: 'error' },
  { name: 'Root system path', re: /(?:\/etc\/passwd|\/etc\/shadow|\/root\/|\bC:\\Windows\\)/i, severity: 'error' },
]

export function analyzeDiffContent(diffText = '', prTitle = '', prBody = '') {
  const findings = []

  // 1. Check title against Conventional Commits
  if (prTitle && !CONVENTIONAL_TITLE.test(prTitle.trim())) {
    findings.push({
      rule: 'conventional-commits',
      severity: 'warning',
      message: `PR title does not follow Conventional Commits format: "${prTitle}"`,
    })
  }

  // 2. Check PR body checklist
  if (prBody) {
    const uncheckedBoxes = (prBody.match(/- \[\s\]/g) || []).length
    const checkedBoxes = (prBody.match(/- \[[xX]\]/g) || []).length
    if (uncheckedBoxes > 0) {
      findings.push({
        rule: 'checklist-incomplete',
        severity: 'info',
        message: `PR checklist has ${uncheckedBoxes} unchecked items (${checkedBoxes} completed).`,
      })
    }
  }

  // 3. Inspect diff lines for secrets and paths
  const lines = String(diffText || '').split(/\r?\n/)
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    // Only inspect added lines or diff header lines
    if (!line.startsWith('+') && !line.startsWith('+++')) continue
    const content = line.slice(1).trim()

    for (const pat of SECRET_PATTERNS) {
      if (pat.re.test(content)) {
        findings.push({
          rule: 'secret-leak',
          severity: pat.severity,
          line: i + 1,
          message: `Potential credential/secret detected (${pat.name})`,
        })
      }
    }

    for (const pat of PATH_TRAVERSAL) {
      if (pat.re.test(content)) {
        findings.push({
          rule: 'path-traversal',
          severity: pat.severity,
          line: i + 1,
          message: `Suspicious file path or traversal detected (${pat.name})`,
        })
      }
    }
  }

  const hasErrors = findings.some((f) => f.severity === 'error')
  const hasWarnings = findings.some((f) => f.severity === 'warning')
  const status = hasErrors ? 'changes_requested' : (hasWarnings ? 'comment' : 'approved')

  return {
    status,
    findings,
    summary: hasErrors
      ? 'Changes requested: found critical security or policy issues.'
      : (hasWarnings ? 'Approved with comments/warnings.' : 'Approved: all automated checks passed.'),
  }
}

export function formatReviewMarkdown(analysis, prNumber) {
  const lines = [
    `## 🤖 AI Automated Code Review for PR #${prNumber}`,
    `**Verdict**: ${analysis.status.toUpperCase()} — ${analysis.summary}`,
    '',
  ]

  if (analysis.findings.length === 0) {
    lines.push('✅ No security issues, secret leaks, or policy violations found.')
  } else {
    lines.push('### 📋 Findings & Suggestions')
    for (const f of analysis.findings) {
      const icon = f.severity === 'error' ? '❌' : (f.severity === 'warning' ? '⚠️' : 'ℹ️')
      const loc = f.line ? ` (diff line ${f.line})` : ''
      lines.push(`- ${icon} **[${f.rule}]**${loc}: ${f.message}`)
    }
  }

  return lines.join('\n')
}

export async function runAiReview(args = {}, deps = {}) {
  const prNumber = Number(args.pr_number || args.number || args.index)
  if (!prNumber || Number.isNaN(prNumber)) {
    return { ok: false, error: 'Pass pr_number (number) to review.' }
  }

  const owner = String(args.owner || deps.settings?.defaultOwner || '').trim()
  const repo = String(args.repo || deps.settings?.defaultRepo || '').trim()
  if (!owner || !repo) {
    return { ok: false, error: 'Target owner and repo must be specified or configured.' }
  }

  if (!deps.client || typeof deps.client.getPull !== 'function') {
    return { ok: false, error: 'Gitea client not configured or missing getPull capability.' }
  }

  const pullRes = await deps.client.getPull(owner, repo, prNumber)
  if (!pullRes?.ok) {
    return { ok: false, error: pullRes?.error || `Failed to fetch PR #${prNumber}`, status: pullRes?.status ?? 0 }
  }

  const pull = pullRes.data || {}
  let diffText = ''
  if (typeof deps.client.getPullDiff === 'function') {
    const diffRes = await deps.client.getPullDiff(owner, repo, prNumber).catch(() => null)
    if (diffRes?.ok && typeof diffRes.data === 'string') {
      diffText = diffRes.data
    }
  }

  const analysis = analyzeDiffContent(diffText, pull.title || '', pull.body || '')
  const markdown = formatReviewMarkdown(analysis, prNumber)

  let commentPosted = false
  if (args.post_comments === true && typeof deps.client.createIssueComment === 'function') {
    const postRes = await deps.client.createIssueComment(owner, repo, prNumber, markdown).catch(() => null)
    if (postRes?.ok) commentPosted = true
  }

  return {
    ok: true,
    data: {
      prNumber,
      status: analysis.status,
      summary: analysis.summary,
      findings: analysis.findings,
      reviewBody: markdown,
      commentPosted,
    },
  }
}
