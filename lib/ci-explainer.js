/**
 * CI failure explainer & Root Cause Analysis (RCA):
 * Parses failed Actions/CI logs, extracts failing steps, primary errors,
 * contextual code snippets, sanitizes secrets, classifies failure types,
 * and provides actionable fix recommendations.
 */

const LOG_CAP = 200_000

// Priority error patterns in logs
const ERROR_PATTERNS = [
  /\berror:\s+.+/i,
  /\bError:\s+.+/,
  /failed to\s+.+/i,
  /cannot find (?:module|file)/i,
  /ENOENT[:\s].+/,
  /AssertionError[:\s].+/,
  /npm ERR!\s+(?!code)\s*.+/,
  /\bFAIL\s+test\/.+/i,
  /##\[error\].+/i,
  /Process completed with exit code \d+/i,
]

const SECRET_PATTERNS = [
  { re: /-----BEGIN (?:[A-Z0-9_-]+ )?PRIVATE KEY-----[\s\S]*?-----END (?:[A-Z0-9_-]+ )?PRIVATE KEY-----/g, rep: '[REDACTED PRIVATE KEY]' },
  { re: /(?:bearer\s+)[A-Za-z0-9_\-\Common]{16,}/gi, rep: 'Bearer ***' },
  { re: /\b(?:gh[pousr]_[A-Za-z0-9_]{16,})/g, rep: 'ghp_***' },
  { re: /\b(?:gitea_[A-Za-z0-9_]{16,})/g, rep: 'gitea_***' },
  { re: /\b(?:glpat-[A-Za-z0-9_\-]{16,})/g, rep: 'glpat-***' },
  { re: /((?:api[_-]?key|secret|token|password|auth)\s*[:=]\s*)(['"])[^'"]{4,}\2/gi, rep: '$1$2***$2' },
  { re: /((?:api[_-]?key|secret|token|password|auth)\s*[:=]\s*)[^\s,;]{8,}/gi, rep: '$1***' },
]

/**
 * Masks tokens, passwords, and sensitive keys from log output.
 * @param {string} text
 * @returns {string}
 */
export function maskSecrets(text = '') {
  let out = String(text || '')
  for (const pat of SECRET_PATTERNS) {
    out = out.replace(pat.re, pat.rep)
  }
  return out
}

/**
 * Extracts first relevant error line from log.
 * @param {string} log
 * @returns {string|null}
 */
export function extractFirstError(log) {
  const text = String(log || '')
  const lines = text.split(/\r?\n/)
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue
    for (const re of ERROR_PATTERNS) {
      const m = trimmed.match(re)
      if (m) {
        const cleaned = m[0].replace(/^##\[error\]\s*/i, '')
        return cleaned.length > 300 ? `${cleaned.slice(0, 300)}…` : cleaned
      }
    }
  }
  return null
}

/**
 * Classifies the type of CI failure based on error message.
 * @param {string} err
 * @returns {'test_failure'|'linter_failure'|'dependency_failure'|'syntax_failure'|'build_failure'|'runtime_failure'|'exit_code'}
 */
export function classifyErrorType(err = '') {
  const s = String(err || '').toLowerCase()
  if (/assertionerror|assert\.|failed \(failures=|test failed|expect\(|\bfail\b.*test/i.test(s)) {
    return 'test_failure'
  }
  if (/cannot find (?:module|file)|modulenotfounderror|importerror|e404|enotfound|err_pnpm|npm err! code e/i.test(s)) {
    return 'dependency_failure'
  }
  if (/eslint|ts\(\d+\)|ts\d+:|prettier|biome|flake8|ruff|pylint|golangci-lint/i.test(s)) {
    return 'linter_failure'
  }
  if (/syntaxerror|unexpected token|parse error|could not compile|cannot compile/i.test(s)) {
    return 'syntax_failure'
  }
  if (/failed to compile|build failed|make:\s*\*\*\*|cargo build|go build/i.test(s)) {
    return 'build_failure'
  }
  if (/process completed with exit code|exited with code/i.test(s)) {
    return 'exit_code'
  }
  return 'runtime_failure'
}

/**
 * Generates an actionable fix recommendation.
 * @param {string} errorType
 * @param {string} summary
 * @returns {string}
 */
export function generateRecommendation(errorType, summary = '') {
  switch (errorType) {
    case 'dependency_failure':
      return 'A required module or package dependency is missing or failed to download. Check package.json/lockfile and verify registry availability.'
    case 'test_failure':
      return 'Automated tests failed on assertions. Check the failing test case in the snippet above and ensure recent changes conform to expected outputs.'
    case 'linter_failure':
      return 'Static analysis or linter checks reported violations. Run local linter/typechecker and apply suggested code formatting.'
    case 'syntax_failure':
      return 'A syntax or parse error prevented execution. Inspect the referenced file and line number for missing brackets, quotes, or language version mismatch.'
    case 'build_failure':
      return 'Compilation or build step failed. Check compiler flags, source types, and build configuration files.'
    case 'exit_code':
      return 'Step script exited with a non-zero exit code. Review the command logs above the exit point for the specific tool error.'
    default:
      return 'Uncaught exception or runtime failure occurred. Inspect the stack trace snippet to identify the crashing module.'
  }
}

/**
 * Extracts the failing step name and a contextual log snippet around the error.
 * @param {string} log
 * @returns {{ failedStep: string|null, errorIndex: number, snippet: string }}
 */
export function extractStepAndSnippet(log) {
  const lines = String(log || '').split(/\r?\n/)
  let currentStep = null
  let failedStep = null
  let errorIndex = -1

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    // Detect Gitea Actions / GitHub Actions step groups
    const groupMatch = line.match(/##\[group\](?:Run\s+)?(.+)/i) || line.match(/##\[step\](.+)/i)
    if (groupMatch) {
      currentStep = groupMatch[1].trim()
    }
    if (errorIndex === -1) {
      for (const re of ERROR_PATTERNS) {
        if (re.test(line)) {
          errorIndex = i
          failedStep = currentStep
          break
        }
      }
    }
  }

  let snippet = ''
  if (errorIndex !== -1) {
    const start = Math.max(0, errorIndex - 4)
    const end = Math.min(lines.length, errorIndex + 6)
    snippet = lines.slice(start, end).join('\n')
  } else if (lines.length > 0) {
    snippet = lines.slice(-10).join('\n')
  }

  return {
    failedStep: failedStep || currentStep || null,
    errorIndex,
    snippet: maskSecrets(snippet),
  }
}

/**
 * Performs deep semantic Root Cause Analysis (RCA) on raw log text.
 * @param {string} log
 * @param {{ jobName?: string, jobId?: number|string, headSha?: string }} meta
 */
export function analyzeCiLog(log = '', meta = {}) {
  const raw = String(log || '')
  const logLength = raw.length
  const capped = logLength > LOG_CAP ? raw.slice(-LOG_CAP) : raw
  const rawError = extractFirstError(capped)
  const errorSummary = rawError ? maskSecrets(rawError) : null
  const { failedStep, snippet } = extractStepAndSnippet(capped)
  const errorType = errorSummary ? classifyErrorType(errorSummary) : 'runtime_failure'
  const recommendation = errorSummary
    ? generateRecommendation(errorType, errorSummary)
    : 'No critical failure errors were identified in the inspected log window.'

  return {
    ok: true,
    jobId: meta.jobId ?? null,
    jobName: meta.jobName || '',
    headSha: meta.headSha || '',
    status: errorSummary ? 'failure' : 'success',
    failedStep,
    errorSummary,
    errorType,
    recommendation,
    snippet,
    logLength,
    capped: logLength > LOG_CAP,
    sanitized: true,
  }
}

/**
 * Legacy explainer compatibility.
 * @param {{id?: number|string, name?: string, status?: string, log?: string, head_sha?: string}} job
 */
export function explainFailedJob(job = {}) {
  const r = analyzeCiLog(job.log, { jobId: job.id, jobName: job.name, headSha: job.head_sha })
  return {
    ok: true,
    jobId: r.jobId,
    jobName: r.jobName,
    status: job.status || (r.errorSummary ? 'failed' : 'unknown'),
    headSha: r.headSha,
    error: r.errorSummary,
    logLength: r.logLength,
    capped: r.capped,
  }
}

/**
 * Resolves CI logs from Gitea Actions API and performs RCA.
 * @param {object} args
 * @param {object} deps
 */
export async function runCiLogsAnalyze(args = {}, deps = {}) {
  const owner = String(args.owner || deps.settings?.defaultOwner || '').trim()
  const repo = String(args.repo || deps.settings?.defaultRepo || '').trim()
  const client = deps.client

  // Direct offline log analysis support
  if (args.log || typeof args.log === 'string') {
    const analysis = analyzeCiLog(args.log, {
      jobId: args.job_id || args.jobId,
      jobName: args.job_name || args.jobName,
      headSha: args.head_sha || args.headSha,
    })
    return { ok: true, data: { owner, repo, ...analysis } }
  }

  if (!owner || !repo) {
    return { ok: false, error: 'Target owner and repo must be specified or configured.' }
  }
  if (!client) {
    return { ok: false, error: 'Gitea client not configured.' }
  }

  let targetJobId = args.job_id || args.jobId || null
  let targetRunId = args.run_id || args.runId || null
  let headSha = args.head_sha || args.headSha || ''
  let jobName = args.job_name || args.jobName || ''

  // 1. Resolve run_id from pr_number if needed
  const prNumber = Number(args.pr_number || args.prNumber || args.number)
  if (!targetRunId && !targetJobId && prNumber && typeof client.getPull === 'function') {
    const pullRes = await client.getPull(owner, repo, prNumber).catch(() => null)
    if (!pullRes?.ok) {
      return { ok: false, error: `Failed to fetch PR #${prNumber}: ${pullRes?.error || 'not found'}` }
    }
    headSha = pullRes.data?.head?.sha || ''
    if (typeof client.listActionsRuns === 'function') {
      const runsRes = await client.listActionsRuns(owner, repo, { limit: 20 }).catch(() => null)
      const runs = runsRes?.ok ? (runsRes.data?.workflow_runs || []) : []
      const matchedRun = runs.find((r) => r.head_sha === headSha && (r.status === 'failure' || r.conclusion === 'failure'))
        || runs.find((r) => r.head_sha === headSha)
      if (matchedRun) {
        targetRunId = matchedRun.id
      }
    }
  }

  // 2. Resolve failed job from run_id if needed
  if (!targetJobId && targetRunId && typeof client.listRunJobs === 'function') {
    const jobsRes = await client.listRunJobs(owner, repo, targetRunId).catch(() => null)
    if (jobsRes?.ok) {
      const jobs = jobsRes.data?.jobs || (Array.isArray(jobsRes.data) ? jobsRes.data : [])
      const failedJob = jobs.find((j) => j.status === 'failure' || j.conclusion === 'failure') || jobs[0]
      if (failedJob) {
        targetJobId = failedJob.id
        jobName = failedJob.name || jobName
        headSha = failedJob.head_sha || headSha
      }
    }
  }

  if (!targetJobId && !targetRunId) {
    return { ok: false, error: 'Specify run_id, job_id, pr_number, or pass direct log text.' }
  }

  // 3. Fetch job logs
  let rawLog = ''
  if (targetJobId && typeof client.getJobLogs === 'function') {
    const logsRes = await client.getJobLogs(owner, repo, targetJobId).catch(() => null)
    if (logsRes?.ok) {
      rawLog = typeof logsRes.data === 'string' ? logsRes.data : JSON.stringify(logsRes.data)
    }
  }

  if (!rawLog && targetJobId && typeof client.getActionsJob === 'function') {
    const jobRes = await client.getActionsJob(owner, repo, targetJobId).catch(() => null)
    if (jobRes?.ok && jobRes.data?.log) {
      rawLog = jobRes.data.log
    }
  }

  const analysis = analyzeCiLog(rawLog, { jobId: targetJobId, jobName, headSha })
  return {
    ok: true,
    data: {
      owner,
      repo,
      prNumber: prNumber || null,
      runId: targetRunId,
      ...analysis,
    },
  }
}
