/**
 * Intelligent reviewer suggestion based on CODEOWNERS and git history/contributors.
 */

import { asNumber } from './handlers/common.js'

export const CODEOWNERS_LOCATIONS = [
  'CODEOWNERS',
  '.gitea/CODEOWNERS',
  '.github/CODEOWNERS',
  'docs/CODEOWNERS',
]

export function parseCodeowners(text = '') {
  const lines = String(text || '').split('\n')
  const rules = []

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i].trim()
    if (!raw || raw.startsWith('#')) continue

    const parts = raw.split(/\s+/)
    if (parts.length >= 2) {
      const pattern = parts[0]
      const owners = parts.slice(1).map((o) => o.replace(/^@/, ''))
      rules.push({ pattern, owners, line: i + 1 })
    }
  }

  return rules
}

export function matchPathRule(filePath, pattern) {
  const normFile = String(filePath || '').replace(/^\/+/, '')
  const normPat = String(pattern || '').trim()

  if (normPat === '*') return true

  // Extension pattern: *.js
  if (normPat.startsWith('*.')) {
    const ext = normPat.slice(1)
    return normFile.endsWith(ext)
  }

  // Rooted directory or file: /lib/
  if (normPat.startsWith('/')) {
    const clean = normPat.slice(1)
    if (clean.endsWith('/')) {
      return normFile.startsWith(clean)
    }
    return normFile === clean || normFile.startsWith(clean + '/')
  }

  // General path matching
  const cleanPat = normPat.replace(/\/+$/, '')
  return normFile.startsWith(cleanPat + '/') || normFile === cleanPat || normFile.includes('/' + cleanPat + '/')
}

export function matchCodeowners(filePath, rules = []) {
  let matched = null
  // Later rules take precedence
  for (const rule of rules) {
    if (matchPathRule(filePath, rule.pattern)) {
      matched = rule
    }
  }
  return matched
}

export async function readCodeownersFile(deps, owner, repo, cwd) {
  // 1. Try local filesystem if cwd is available
  if (cwd && typeof deps.readFile === 'function') {
    for (const loc of CODEOWNERS_LOCATIONS) {
      try {
        const full = `${cwd.replace(/\/+$/, '')}/${loc}`
        const content = await deps.readFile(full, 'utf8')
        if (content) return { location: loc, content }
      } catch { /* try next */ }
    }
  }

  // 2. Try remote Gitea contents API
  if (deps.client && deps.client.getContents && owner && repo) {
    for (const loc of CODEOWNERS_LOCATIONS) {
      try {
        const res = await deps.client.getContents(owner, repo, loc)
        if (res?.ok && res.data?.content) {
          const content = Buffer.from(String(res.data.content), 'base64').toString('utf8')
          return { location: loc, content }
        }
      } catch { /* try next */ }
    }
  }

  return null
}

export async function analyzeGitContributors(files = [], cwd = '', execFile = null) {
  if (!cwd || typeof execFile !== 'function' || files.length === 0) {
    return []
  }

  const scores = new Map()

  for (const file of files.slice(0, 20)) {
    try {
      const runExec = (cmd, args, opts) => new Promise((resolve, reject) => {
        execFile(cmd, args, opts, (err, stdout) => {
          if (err) reject(err)
          else resolve(stdout)
        })
      })

      const out = await runExec('git', ['log', '-n', '25', '--format=%an', '--', file], { cwd })
      const authors = String(out || '').split('\n').filter(Boolean)

      for (const author of authors) {
        scores.set(author, (scores.get(author) || 0) + 1)
      }
    } catch { /* ignore individual file log errors */ }
  }

  const sorted = [...scores.entries()]
    .map(([author, count]) => ({ user: author, commits: count }))
    .sort((a, b) => b.commits - a.commits)

  return sorted.slice(0, 5)
}

export async function suggestReviewers(args = {}, deps = {}) {
  const client = deps.client
  const owner = String(args.owner || deps.settings?.defaultOwner || '').trim()
  const repo = String(args.repo || deps.settings?.defaultRepo || '').trim()
  const cwd = String(args.cwd || deps.cwd || '').trim()
  const prNumber = asNumber(args.pr_number || args.number)

  let files = Array.isArray(args.files) ? args.files.map(String) : []

  // If files not explicitly passed, inspect PR files
  if (files.length === 0 && prNumber && client && client.listPullFiles) {
    try {
      const filesRes = await client.listPullFiles(owner, repo, prNumber)
      if (filesRes?.ok && Array.isArray(filesRes.data)) {
        files = filesRes.data.map((f) => f.filename || f.path || f).filter(Boolean)
      }
    } catch { /* ignore */ }
  }

  const co = await readCodeownersFile(deps, owner, repo, cwd)
  const candidateScores = new Map()
  let matchedFilesCount = 0

  if (co && co.content) {
    const rules = parseCodeowners(co.content)
    for (const file of files) {
      const rule = matchCodeowners(file, rules)
      if (rule) {
        matchedFilesCount++
        for (const ownerName of rule.owners) {
          const prev = candidateScores.get(ownerName) || { user: ownerName, score: 0, reasons: [], sources: new Set() }
          prev.score += 10
          prev.sources.add('codeowners')
          if (!prev.reasons.some((r) => r.includes(rule.pattern))) {
            prev.reasons.push(`CODEOWNERS rule: ${rule.pattern} (${file})`)
          }
          candidateScores.set(ownerName, prev)
        }
      }
    }
  }

  // Fallback or complement with git contributor analysis
  if (cwd && typeof deps.execFile === 'function') {
    const contributors = await analyzeGitContributors(files, cwd, deps.execFile)
    for (const cont of contributors) {
      const prev = candidateScores.get(cont.user) || { user: cont.user, score: 0, reasons: [], sources: new Set() }
      prev.score += Math.min(cont.commits * 2, 8)
      prev.sources.add('git-history')
      prev.reasons.push(`Top contributor: ${cont.commits} recent commits across touched files`)
      candidateScores.set(cont.user, prev)
    }
  }

  const reviewers = [...candidateScores.values()]
    .map((c) => ({
      user: c.user,
      score: c.score,
      confidence: c.sources.has('codeowners') ? 'high' : 'medium',
      sources: [...c.sources],
      reasons: c.reasons.slice(0, 3),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)

  return {
    ok: true,
    data: {
      owner,
      repo,
      pr_number: prNumber || null,
      filesChecked: files.length,
      matchedFilesCount,
      codeownersFound: Boolean(co),
      codeownersLocation: co?.location || null,
      reviewers,
      summary: reviewers.length > 0
        ? `Found ${reviewers.length} reviewer candidate(s): ${reviewers.map((r) => `@${r.user} (${r.confidence})`).join(', ')}`
        : 'No specific reviewers determined. Default reviewers or maintainers recommended.',
    },
  }
}
