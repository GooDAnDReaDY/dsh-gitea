/**
 * Retry helper for HTTP client: exponential backoff on 429/5xx.
 */

export function shouldRetry(status) {
  const s = Number(status)
  return s === 0 || s === 429 || s >= 500
}

export async function retryWithBackoff(fn, { retries = 2, baseDelayMs = 500 } = {}) {
  let last
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    last = await fn()
    if (last?.ok || !shouldRetry(last?.status)) return last
    if (attempt < retries) {
      const delay = baseDelayMs * 2 ** attempt
      await new Promise((resolve) => setTimeout(resolve, delay))
    }
  }
  return last
}

export async function mapConcurrent(items, limit = 8, fn) {
  if (!Array.isArray(items) || items.length === 0) return []
  const concurrency = Math.max(1, Math.min(Number(limit) || 8, items.length))
  const results = new Array(items.length)
  let nextIndex = 0

  async function worker() {
    while (nextIndex < items.length) {
      const idx = nextIndex++
      results[idx] = await fn(items[idx], idx)
    }
  }

  const workers = Array.from({ length: concurrency }, () => worker())
  await Promise.all(workers)
  return results
}
