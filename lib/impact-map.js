/**
 * gitea_pr_impact: карта влияния PR — файлы, области, ссылки на issue,
 * автор, статус. Каждый edge имеет источник (body/название/файлы);
 * никаких выдуманных зависимостей.
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
  const areas = [...new Set(files.map((f) => areaOf(f.filename)))]

  return {
    ok: true,
    data: {
      number,
      title,
      author: pr?.user?.login || '',
      state: pr?.state || '',
      issueRefs,
      files: files.map((f) => f.filename),
      areas,
      // ограничение размера: не более 50 файлов в карте
      truncated: files.length > 50,
    },
  }
}
