/**
 * gitea_pr_impact: PR impact map — files, areas, issue references,
 * author, and status. Every edge has an explicit source.
 */

export function extractIssueRefs(text = '', source = 'body') {
  const refs = []
  const re = /#(\d+)/g
  let m
  while ((m = re.exec(String(text)))) {
    refs.push({ issue: Number(m[1]), source })
  }
  return refs
}

function areaOf(filename) {
  const parts = String(filename || '').split('/')
  return parts.length > 1 ? parts[0] : '(root)'
}

export async function buildImpactMap(args = {}, deps = {}) {
  const client = deps.client
  const owner = args.owner
  const repo = args.repo
  const number = Number(args.number)

  const [prRes, filesRes] = await Promise.all([
    client.getPull(owner, repo, number).catch((e) => ({ ok: false, error: String(e) })),
    client.listPullFiles(owner, repo, number, {}).catch((e) => ({ ok: false, error: String(e) })),
  ])

  const pr = prRes?.ok ? prRes.data : null
  const files = filesRes?.ok && Array.isArray(filesRes.data) ? filesRes.data : []

  const title = pr?.title || ''
  const body = pr?.body || ''
  const issueRefs = [
    ...extractIssueRefs(title, 'title'),
    ...extractIssueRefs(body, 'body'),
  ]
  const MAX_IMPACT_FILES = 50
  const isTruncated = files.length > MAX_IMPACT_FILES
  const visibleFiles = isTruncated ? files.slice(0, MAX_IMPACT_FILES) : files
  const areas = [...new Set(visibleFiles.map((f) => areaOf(f.filename)))]

  return {
    ok: true,
    data: {
      number,
      title,
      author: pr?.user?.login || '',
      state: pr?.state || '',
      issueRefs,
      files: visibleFiles.map((f) => f.filename),
      areas,
      truncated: isTruncated,
    },
  }
}
