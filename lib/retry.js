/**
 * Retry-хелпер для HTTP-клиента: экспоненциальный backoff на 429/5xx.
 */

export function shouldRetry(status) {
  const s = Number(status)
  return s === 429 || s >= 500
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
