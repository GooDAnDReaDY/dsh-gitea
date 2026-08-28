/**
 * gitea_issue_duplicates: поиск вероятных дубликатов issue до создания.
 * Ранжирует кандидатов по пересечению слов title/body с порогом.
 * Никогда не создаёт/не закрывает issue автоматически.
 */

const STOPWORDS = new Set(['the', 'a', 'an', 'of', 'to', 'in', 'on', 'for', 'and', 'or', 'with', 'is', 'are', 'it', 'this', 'that', 'add', 'fix', 'feat', 'и', 'в', 'на', 'для', 'с', 'по', 'из', 'не', 'как'])

export function normalizeText(text = '') {
  return String(text || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean)
}

export function tokenSet(text = '') {
  return new Set(normalizeText(text).filter((w) => !STOPWORDS.has(w) && w.length > 2))
}

/**
 * Jaccard-подобие двух текстов (0..1).
 */
export function similarity(a = '', b = '') {
  const sa = tokenSet(a)
  const sb = tokenSet(b)
  if (sa.size === 0 || sb.size === 0) return 0
  let inter = 0
  for (const w of sa) if (sb.has(w)) inter += 1
  const union = sa.size + sb.size - inter
  return union === 0 ? 0 : inter / union
}

/**
 * @param {{owner: string, repo: string, title?: string, body?: string, threshold?: number}} args
 * @param {{client: object}} deps
 */
export async function findDuplicates(args = {}, deps = {}) {
  const client = deps.client
  const owner = args.owner
  const repo = args.repo
  const title = String(args.title || '')
  const body = String(args.body || '')
  const threshold = Number(args.threshold || 0.3)

  const query = title || body
  const res = await client.searchIssues({ q: query, repo: `${owner}/${repo}`, state: 'all', limit: 50 }).catch((e) => ({ ok: false, error: String(e) }))
  if (!res?.ok) {
    return { ok: false, error: res?.error || 'search failed' }
  }
  const issues = Array.isArray(res.data) ? res.data : (res.data && Array.isArray(res.data.data) ? res.data.data : [])

  const combined = `${title} ${body}`
  const candidates = issues
    .map((issue) => {
      const text = `${issue.title || ''} ${issue.body || ''}`
      const score = similarity(combined, text)
      return { number: issue.number, title: issue.title || '', score, reason: score >= threshold ? `Пересечение ключевых слов: ${score.toFixed(2)}` : '' }
    })
    .filter((c) => c.score >= threshold && c.number !== undefined)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)

  return { ok: true, data: { candidates, threshold, total: issues.length } }
}
