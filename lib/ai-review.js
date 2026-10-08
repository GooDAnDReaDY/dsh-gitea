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
  let currentFile = ''
  let targetLine = 0
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (line.startsWith('diff --git ')) {
      const match = line.match(/^diff --git a\/(.+?) b\/(.+)$/)
      if (match) currentFile = match[2]
      continue
    }
    if (line.startsWith('+++ b/')) {
      currentFile = line.slice('+++ b/'.length).trim()
      continue
    }
    if (line.startsWith('@@ ')) {
      const hunkMatch = line.match(/@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/)
      if (hunkMatch) targetLine = parseInt(hunkMatch[1], 10) - 1
      continue
    }
    if (line.startsWith('+') && !line.startsWith('+++')) {
      targetLine++
      const content = line.slice(1).trim()
      for (const pat of SECRET_PATTERNS) {
        if (pat.re.test(content)) {
          findings.push({
            rule: 'secret-leak',
            severity: pat.severity,
            path: currentFile || 'unknown',
            line: targetLine,
            diffLine: i + 1,
            message: `Potential credential/secret detected (${pat.name})`,
          })
        }
      }
      for (const pat of PATH_TRAVERSAL) {
        if (pat.re.test(content)) {
          findings.push({
            rule: 'path-traversal',
            severity: pat.severity,
            path: currentFile || 'unknown',
            line: targetLine,
            diffLine: i + 1,
            message: `Suspicious file path or traversal detected (${pat.name})`,
          })
        }
      }
      continue
    }
    if (!line.startsWith('-')) {
      targetLine++
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
  let diffAccessible = true
  if (typeof deps.client.getPullDiff === 'function') {
    const diffRes = await deps.client.getPullDiff(owner, repo, prNumber).catch(() => null)
    if (diffRes?.ok && typeof diffRes.data === 'string') {
      diffText = diffRes.data
    } else if (diffRes && !diffRes.ok) {
      diffAccessible = false
    }
  }

  const analysis = analyzeDiffContent(diffText, pull.title || '', pull.body || '')
  if (!diffAccessible) {
    analysis.findings.push({
      rule: 'diff-inaccessible',
      severity: 'warning',
      message: 'Pull request diff could not be fetched for automated review',
    })
    if (analysis.status === 'approved') analysis.status = 'comment'
  }
  const markdown = formatReviewMarkdown(analysis, prNumber)

  let commentPosted = false
  let reviewSubmitted = false
  if (args.post_comments === true) {
    const inlineComments = analysis.findings
      .filter((f) => f.path && f.line)
      .map((f) => ({
        path: f.path,
        new_position: f.line,
        body: "[" + f.rule + "] " + f.message,
      }))
    const event = analysis.status === 'changes_requested' ? 'REQUEST_CHANGES' : (analysis.status === 'approved' ? 'APPROVED' : 'COMMENT')
    const submitReviewFn = deps.client?.createPullReview || deps.client?.submitPullReview
    if (typeof submitReviewFn === 'function') {
      const revRes = await submitReviewFn.call(deps.client, owner, repo, prNumber, {
        body: markdown,
        event,
        comments: inlineComments,
      }).catch(() => null)
      if (revRes?.ok) {
        reviewSubmitted = true
        commentPosted = true
      }
    }
    if (!reviewSubmitted && typeof deps.client?.createIssueComment === 'function') {
      const postRes = await deps.client.createIssueComment(owner, repo, prNumber, markdown).catch(() => null)
      if (postRes?.ok) commentPosted = true
    }
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
      reviewSubmitted,
    },
  }
}
