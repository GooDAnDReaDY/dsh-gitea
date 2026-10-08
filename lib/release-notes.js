/**
 * gitea_release_notes: compiles changelog from merged PRs and proposes
 * semver candidate. Preview only; publication requires user approval.
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

async function resolveTagTimestamp(client, owner, repo, tag) {
  if (!tag || !client) return { resolved: false, checked: false, time: null }
  if (!Number.isNaN(Date.parse(tag)) && /^\d{4}-\d{2}-\d{2}/.test(tag)) {
    return { resolved: true, checked: true, time: new Date(tag).getTime() }
  }

  const hasTagMethod = typeof client.listTags === 'function'
  const hasRelMethod = typeof client.listReleases === 'function'
  if (!hasTagMethod && !hasRelMethod) {
    return { resolved: false, checked: false, time: null }
  }

  if (hasTagMethod) {
    try {
      let page = 1
      while (page <= 5) {
        const tagsRes = await client.listTags(owner, repo, { limit: 50, page }).catch(() => null)
        const tags = tagsRes?.ok && Array.isArray(tagsRes.data) ? tagsRes.data : []
        const match = tags.find((t) => t.name === tag || t.id === tag)
        if (match) {
          const raw = match.commit?.created || match.commit?.committer?.date || match.commit?.author?.date || match.created_at
          if (raw) return { resolved: true, checked: true, time: new Date(raw).getTime() }
        }
        if (tags.length < 50) break
        page += 1
      }
    } catch { /* ignore */ }
  }

  if (hasRelMethod) {
    try {
      let page = 1
      while (page <= 5) {
        const relRes = await client.listReleases(owner, repo, { limit: 50, page }).catch(() => null)
        const releases = relRes?.ok && Array.isArray(relRes.data) ? relRes.data : []
        const match = releases.find((r) => r.tag_name === tag || r.name === tag)
        if (match) {
          const raw = match.published_at || match.created_at
          if (raw) return { resolved: true, checked: true, time: new Date(raw).getTime() }
        }
        if (releases.length < 50) break
        page += 1
      }
    } catch { /* ignore */ }
  }

  return { resolved: false, checked: true, time: null }
}

/**
 * @param {{owner: string, repo: string, fromTag?: string, toTag?: string}} args
 * @param {{client: object}} deps
 */
export async function buildReleaseNotes(args = {}, deps = {}) {
  const client = deps.client
  const owner = args.owner
  const repo = args.repo
  const fromTag = args.fromTag ? String(args.fromTag).trim() : ''
  const toTag = args.toTag ? String(args.toTag).trim() : ''

  let fromTime = null
  let toTime = null
  if (fromTag) {
    const res = await resolveTagTimestamp(client, owner, repo, fromTag)
    if (res.checked && !res.resolved) {
      return { ok: false, error: `Could not resolve reference for fromTag: "${fromTag}"` }
    }
    if (res.resolved) fromTime = res.time
  }
  if (toTag) {
    const res = await resolveTagTimestamp(client, owner, repo, toTag)
    if (res.checked && !res.resolved) {
      return { ok: false, error: `Could not resolve reference for toTag: "${toTag}"` }
    }
    if (res.resolved) toTime = res.time
  }

  const pulls = []
  let page = 1
  const maxPages = 5
  while (page <= maxPages) {
    const res = await client.listPulls(owner, repo, { state: 'closed', limit: 50, page }).catch((e) => ({ ok: false, error: String(e) }))
    if (!res?.ok) {
      return { ok: false, error: res?.error || `listPulls failed on page ${page}`, status: res?.status ?? 0 }
    }
    const pageRows = Array.isArray(res.data) ? res.data : []
    pulls.push(...pageRows)
    if (pageRows.length < 50) break
    page += 1
  }

  const targetBase = args.base || args.base_branch || ''
  let changes = pulls
    .filter((p) => p.merged_at && p.state === 'closed' && (!targetBase || !p.base?.ref || p.base.ref === targetBase))
    .map((p) => ({ number: p.number, title: p.title || '', merged_at: p.merged_at }))
    .sort((a, b) => String(a.merged_at).localeCompare(String(b.merged_at)))

  if (fromTime !== null) {
    changes = changes.filter((c) => new Date(c.merged_at).getTime() > fromTime)
  }
  if (toTime !== null) {
    changes = changes.filter((c) => new Date(c.merged_at).getTime() <= toTime)
  }

  const bump = semverBump(changes.map((c) => c.title))
  const notes = changes
    .map((c) => `- #${c.number} ${c.title}`)
    .join('\n')

  return {
    ok: true,
    data: {
      fromTag,
      toTag,
      bump,
      count: changes.length,
      notes,
      preview: true,
      changes,
    },
  }
}