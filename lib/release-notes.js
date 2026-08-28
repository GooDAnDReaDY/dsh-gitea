/**
 * gitea_release_notes: собирает changelog из merged PR и предлагает
 * semver-кандидат. Preview только; публикация — строго за approval boundary.
 */

export function semverBump(titles = []) {
  let major = false
  let minor = false
  for (const t of titles) {
    const s = String(t || '')
    if (/^feat!:/.test(s) || /^feat\([^)]*\)!:/.test(s) || /breaking/i.test(s)) major = true
    else if (/^feat/.test(s)) minor = true
  }
  if (major) return 'major'
  if (minor) return 'minor'
  return 'patch'
}

/**
 * @param {{owner: string, repo: string, fromTag?: string, toTag?: string}} args
 * @param {{client: object}} deps
 */
export async function buildReleaseNotes(args = {}, deps = {}) {
  const client = deps.client
  const owner = args.owner
  const repo = args.repo

  const res = await client.listPulls(owner, repo, { state: 'closed', limit: 100 }).catch((e) => ({ ok: false, error: String(e) }))
  if (!res?.ok) return { ok: false, error: res?.error || 'listPulls failed' }
  const pulls = Array.isArray(res.data) ? res.data : []

  const changes = pulls
    .filter((p) => p.merged_at && p.state === 'closed')
    .map((p) => ({ number: p.number, title: p.title || '', merged_at: p.merged_at }))
    .sort((a, b) => String(a.merged_at).localeCompare(String(b.merged_at)))

  const bump = semverBump(changes.map((c) => c.title))
  const notes = changes
    .map((c) => `- #${c.number} ${c.title}`)
    .join('\n')

  return {
    ok: true,
    data: {
      fromTag: args.fromTag || '',
      toTag: args.toTag || '',
      bump,
      count: changes.length,
      notes,
      preview: true,
      changes,
    },
  }
}
