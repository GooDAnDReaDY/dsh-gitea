const CONVENTIONAL_TITLE = /^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\([a-zA-Z0-9_\-./]+\))?: .+/i

const SECRET_PATTERNS = [
  { name: 'Bearer / API Token', re: /(?:bearer\s+|api[_-]?key\s*[:=]\s*|secret\s*[:=]\s*|token\s*[:=]\s*)['\"]?[a-zA-Z0-9_\-\Common]{16,}['\"]?/i, severity: 'error' },
  { name: 'Private Key Block', re: /-----BEGIN (?:RSA )?PRIVATE KEY-----/, severity: 'error' },
  { name: 'GitHub Token', re: /gh[pousr]_[A-Za-z0-9_]{16,}/, severity: 'error' },
  { name: 'Plaintext Password', re: /password\s*[:=]\s*['\"][^'\"]{8,}['\"]/i, severity: 'warning' },
]

const PATH_TRAVERSAL = [
  { name: 'Path traversal sequence', re: /\.\.\//, severity: 'error' },
  { name: 'Root system path', re: /(?:\/etc\/passwd|\/etc\/shadow|\/root\/|\bC:\\Windows\\)/i, severity: 'error' },
]

/**
 * Robust unified diff parser extracting files, hunks, and lines with exact old/new positions.
 */
export function parseDiffHunks(diffText = '') {
  const lines = String(diffText || '').split(/\r?\n/)
  const files = []
  let currentFile = null
  let currentHunk = null
  let oldLine = 0
  let newLine = 0

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]

    if (raw.startsWith('diff --git ')) {
      const match = raw.match(/^diff --git a\/(.+?) b\/(.+)$/)
      currentFile = {
        path: match ? match[2] : '',
        oldPath: match ? match[1] : '',
        hunks: [],
      }
      files.push(currentFile)
      currentHunk = null
      continue
    }

    if (raw.startsWith('--- a/')) {
      if (currentFile) currentFile.oldPath = raw.slice('--- a/'.length).trim()
      continue
    }
    if (raw.startsWith('+++ b/')) {
      if (currentFile) currentFile.path = raw.slice('+++ b/'.length).trim()
      continue
    }

    if (raw.startsWith('@@ ')) {
      const hunkMatch = raw.match(/@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(.*)/)
      if (hunkMatch) {
        const oldStart = parseInt(hunkMatch[1], 10)
        const oldCount = hunkMatch[2] !== undefined ? parseInt(hunkMatch[2], 10) : 1
        const newStart = parseInt(hunkMatch[3], 10)
        const newCount = hunkMatch[4] !== undefined ? parseInt(hunkMatch[4], 10) : 1
        oldLine = oldStart
        newLine = newStart

        currentHunk = {
          oldStart,
          oldCount,
          newStart,
          newCount,
          heading: (hunkMatch[5] || '').trim(),
          lines: [],
        }
        if (currentFile) {
          currentFile.hunks.push(currentHunk)
        } else {
          currentFile = { path: 'unknown', oldPath: 'unknown', hunks: [currentHunk] }
          files.push(currentFile)
        }
      }
      continue
    }

    if (raw.startsWith('+') && !raw.startsWith('+++')) {
      if (!currentHunk) {
        currentHunk = { oldStart: 1, oldCount: 0, newStart: 1, newCount: 0, heading: '', lines: [] }
        oldLine = 1
        newLine = 1
        if (currentFile) {
          currentFile.hunks.push(currentHunk)
        } else {
          currentFile = { path: 'unknown', oldPath: 'unknown', hunks: [currentHunk] }
          files.push(currentFile)
        }
      }
      const content = raw.slice(1)
      const indent = (content.match(/^[ \t]*/) || [''])[0]
      const prevLine = currentHunk.lines[currentHunk.lines.length - 1]
      const pairedOldLine = (prevLine && prevLine.type === 'del') ? prevLine.oldLine : null

      currentHunk.lines.push({
        type: 'add',
        oldLine: pairedOldLine,
        newLine: newLine++,
        content,
        raw,
        indent,
        diffLine: i + 1,
      })
    } else if (raw.startsWith('-') && !raw.startsWith('---')) {
      if (!currentHunk) {
        currentHunk = { oldStart: 1, oldCount: 0, newStart: 1, newCount: 0, heading: '', lines: [] }
        oldLine = 1
        newLine = 1
        if (currentFile) {
          currentFile.hunks.push(currentHunk)
        } else {
          currentFile = { path: 'unknown', oldPath: 'unknown', hunks: [currentHunk] }
          files.push(currentFile)
        }
      }
      const content = raw.slice(1)
      const indent = (content.match(/^[ \t]*/) || [''])[0]
      currentHunk.lines.push({
        type: 'del',
        oldLine: oldLine++,
        newLine: null,
        content,
        raw,
        indent,
        diffLine: i + 1,
      })
    } else if (raw.startsWith('\\')) {
      continue
    } else if (raw.startsWith(' ') || (currentHunk && raw.length > 0)) {
      if (!currentHunk) {
        currentHunk = { oldStart: 1, oldCount: 0, newStart: 1, newCount: 0, heading: '', lines: [] }
        oldLine = 1
        newLine = 1
        if (currentFile) {
          currentFile.hunks.push(currentHunk)
        } else {
          currentFile = { path: 'unknown', oldPath: 'unknown', hunks: [currentHunk] }
          files.push(currentFile)
        }
      }
      const content = raw.startsWith(' ') ? raw.slice(1) : raw
      const indent = (content.match(/^[ \t]*/) || [''])[0]
      currentHunk.lines.push({
        type: 'context',
        oldLine: oldLine++,
        newLine: newLine++,
        content,
        raw,
        indent,
        diffLine: i + 1,
      })
    }
  }

  return files
}

/**
 * Validates syntax, indentation, and structure of a proposed suggestion replacement.
 */
export function validateSuggestion(suggestion, originalLine = '', options = {}) {
  if (typeof suggestion !== 'string') {
    return { valid: false, reason: 'Suggestion must be a string' }
  }
  const trimmed = suggestion.trim()
  if (!trimmed) {
    return { valid: false, reason: 'Suggestion cannot be empty' }
  }

  if (suggestion.includes('```')) {
    return { valid: false, reason: 'Suggestion cannot contain markdown code fence delimiters (```)' }
  }

  if (originalLine) {
    const origIndent = (originalLine.match(/^[ \t]*/) || [''])[0]
    const firstNonEmpty = suggestion.split(/\r?\n/).find((l) => l.trim().length > 0) || ''
    const suggIndent = (firstNonEmpty.match(/^[ \t]*/) || [''])[0]

    if (/[ ]\t|\t[ ]/.test(suggIndent)) {
      return { valid: false, reason: 'Suggestion contains mixed tab and space indentation' }
    }

    if (options.strictIndent === true && origIndent !== suggIndent) {
      return {
        valid: false,
        reason: `Indentation mismatch: expected "${origIndent.length}" characters of indentation but got "${suggIndent.length}"`,
      }
    }

    if (trimmed === originalLine.trim()) {
      return { valid: false, reason: 'Suggestion is identical to original line' }
    }
  }

  const singleQuotes = (suggestion.replace(/\\'/g, '').match(/'/g) || []).length
  const doubleQuotes = (suggestion.replace(/\\"/g, '').match(/"/g) || []).length
  const backticks = (suggestion.replace(/\\`/g, '').match(/`/g) || []).length

  const lines = suggestion.split(/\r?\n/)
  if (lines.length === 1) {
    if (singleQuotes % 2 !== 0 || doubleQuotes % 2 !== 0 || backticks % 2 !== 0) {
      return { valid: false, reason: 'Unbalanced quotes in suggestion replacement' }
    }
  }

  const parensOpen = (suggestion.match(/\(/g) || []).length
  const parensClose = (suggestion.match(/\)/g) || []).length
  const curlyOpen = (suggestion.match(/\{/g) || []).length
  const curlyClose = (suggestion.match(/\}/g) || []).length
  const squareOpen = (suggestion.match(/\[/g) || []).length
  const squareClose = (suggestion.match(/\]/g) || []).length

  if (parensOpen !== parensClose || curlyOpen !== curlyClose || squareOpen !== squareClose) {
    if (originalLine) {
      const origCurlyDiff = (originalLine.match(/\{/g) || []).length - (originalLine.match(/\}/g) || []).length
      const suggCurlyDiff = curlyOpen - curlyClose
      const origParensDiff = (originalLine.match(/\(/g) || []).length - (originalLine.match(/\)/g) || []).length
      const suggParensDiff = parensOpen - parensClose
      const origSquareDiff = (originalLine.match(/\[/g) || []).length - (originalLine.match(/\]/g) || []).length
      const suggSquareDiff = squareOpen - squareClose
      if (origCurlyDiff !== suggCurlyDiff || origParensDiff !== suggParensDiff || origSquareDiff !== suggSquareDiff) {
        return { valid: false, reason: 'Unbalanced bracket structure in replacement' }
      }
    } else {
      return { valid: false, reason: 'Unbalanced bracket structure in replacement' }
    }
  }

  return { valid: true }
}

/**
 * Aligns suggestion indentation with original line.
 */
export function alignIndentation(suggestion, originalLine = '') {
  if (!suggestion || typeof suggestion !== 'string') return ''
  const origIndent = (originalLine.match(/^[ \t]*/) || [''])[0]
  if (!origIndent) return suggestion

  const lines = suggestion.split(/\r?\n/)
  const firstNonEmpty = lines.find((l) => l.trim().length > 0) || ''
  const suggIndent = (firstNonEmpty.match(/^[ \t]*/) || [''])[0]
  if (suggIndent.startsWith(origIndent)) {
    return suggestion
  }

  return lines
    .map((line) => (line.trim().length > 0 ? `${origIndent}${line.replace(/^[ \t]*/, '')}` : line))
    .join('\n')
}

/**
 * Formats an interactive ```suggestion block for Gitea PR review comments.
 */
export function formatSuggestionBlock(suggestion = '', explanation = '') {
  const cleanSuggestion = String(suggestion || '').replace(/\r?\n$/, '')
  const block = `\`\`\`suggestion\n${cleanSuggestion}\n\`\`\``
  if (explanation && typeof explanation === 'string' && explanation.trim()) {
    return `${explanation.trim()}\n\n${block}`
  }
  return block
}

/**
 * Extracts raw suggestion code blocks from markdown text.
 */
export function extractSuggestionBlocks(text = '') {
  const blocks = []
  const re = /```suggestion\r?\n([\s\S]*?)```/g
  let match
  while ((match = re.exec(text)) !== null) {
    blocks.push(match[1])
  }
  return blocks
}

/**
 * Generates an automatic suggestion replacement for identified violations.
 */
export function generateSuggestion(rule, originalContent = '') {
  const indent = (originalContent.match(/^[ \t]*/) || [''])[0]
  const content = originalContent.slice(indent.length)

  if (rule === 'secret-leak') {
    const assignMatch = content.match(/^(const|let|var)\s+([a-zA-Z0-9_$]+)\s*=\s*(.+)$/)
    if (assignMatch) {
      const decl = assignMatch[1]
      const varName = assignMatch[2]
      const envName = varName.replace(/([A-Z])/g, '_$1').toUpperCase().replace(/^_/, '')
      return `${indent}${decl} ${varName} = process.env.${envName} || '';`
    }
    const propMatch = content.match(/^([a-zA-Z0-9_$]+)\s*:\s*(.+?)(,?)$/)
    if (propMatch) {
      const propName = propMatch[1]
      const trailing = propMatch[3] || ''
      const envName = propName.replace(/([A-Z])/g, '_$1').toUpperCase().replace(/^_/, '')
      return `${indent}${propName}: process.env.${envName} || ''${trailing}`
    }
    return `${indent}// TODO: load secret from environment or secrets vault`
  }

  if (rule === 'path-traversal') {
    const assignMatch = content.match(/^(const|let|var)\s+([a-zA-Z0-9_$]+)\s*=\s*(.+)$/)
    if (assignMatch) {
      const decl = assignMatch[1]
      const varName = assignMatch[2]
      return `${indent}${decl} ${varName} = path.resolve(ALLOWED_BASE_DIR, path.basename(filePath));`
    }
    return `${indent}const safePath = path.resolve(ALLOWED_BASE_DIR, path.basename(targetPath));`
  }

  return null
}

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

  // 3. Inspect diff hunks for secrets and paths
  const files = parseDiffHunks(diffText)
  for (const file of files) {
    const filePath = file.path || 'unknown'
    for (const hunk of file.hunks) {
      for (const line of hunk.lines) {
        if (line.type !== 'add') continue
        const content = line.content.trim()

        for (const pat of SECRET_PATTERNS) {
          if (pat.re.test(content)) {
            const suggestion = generateSuggestion('secret-leak', line.content)
            const suggestionBlock = suggestion ? formatSuggestionBlock(suggestion) : null
            findings.push({
              rule: 'secret-leak',
              severity: pat.severity,
              path: filePath,
              line: line.newLine,
              old_line: line.oldLine,
              diffLine: line.diffLine,
              message: `Potential credential/secret detected (${pat.name})`,
              originalContent: line.content,
              suggestion,
              suggestionBlock,
            })
          }
        }

        for (const pat of PATH_TRAVERSAL) {
          if (pat.re.test(content)) {
            const suggestion = generateSuggestion('path-traversal', line.content)
            const suggestionBlock = suggestion ? formatSuggestionBlock(suggestion) : null
            findings.push({
              rule: 'path-traversal',
              severity: pat.severity,
              path: filePath,
              line: line.newLine,
              old_line: line.oldLine,
              diffLine: line.diffLine,
              message: `Suspicious file path or traversal detected (${pat.name})`,
              originalContent: line.content,
              suggestion,
              suggestionBlock,
            })
          }
        }
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
      const loc = f.path && f.line ? ` (${f.path}:${f.line})` : (f.line ? ` (diff line ${f.line})` : '')
      lines.push(`- ${icon} **[${f.rule}]**${loc}: ${f.message}`)
      if (f.suggestionBlock) {
        lines.push('')
        lines.push(f.suggestionBlock)
      }
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
        old_position: f.old_line || 0,
        body: f.suggestionBlock
          ? `[${f.rule}] ${f.message}\n\n${f.suggestionBlock}`
          : `[${f.rule}] ${f.message}`,
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
