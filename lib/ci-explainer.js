/**
 * CI failure explainer: берёт лог упавшего job, выделяет первую релевантную
 * ошибку и ограничивает размер входного лога. Read-only.
 */

const LOG_CAP = 200_000

// Приоритет: реальные error-строки (не npm-обвязка)
const ERROR_PATTERNS = [
  /\berror:\s+.+/i,
  /\bError:\s+.+/,
  /failed to\s+.+/i,
  /cannot find (module|file)/i,
  /ENOENT[:\s].+/,
  /AssertionError[:\s].+/,
  /npm ERR!\s+(?!code)\s*.+/,
]

/**
 * Извлекает первую релевантную ошибку из лога.
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
      if (m) return m[0].length > 300 ? `${m[0].slice(0, 300)}…` : m[0]
    }
  }
  return null
}

/**
 * Объясняет failed job: первая ошибка + метаданные.
 * @param {{id?: number|string, name?: string, status?: string, log?: string, head_sha?: string}} job
 */
export function explainFailedJob(job = {}) {
  const rawLog = String(job.log || '')
  const logLength = rawLog.length
  const capped = logLength > LOG_CAP ? rawLog.slice(-LOG_CAP) : rawLog
  const error = extractFirstError(capped)
  return {
    ok: true,
    jobId: job.id ?? null,
    jobName: job.name || '',
    status: job.status || 'unknown',
    headSha: job.head_sha || '',
    error,
    logLength,
    capped: logLength > LOG_CAP,
  }
}
