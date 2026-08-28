/**
 * gitea_dep_watch: сканирует зависимости репозитория (package.json через
 * Gitea API), формирует рекомендации по обновлениям с дедупликацией.
 * Read-only: не читает секреты, не выполняет обновления, не создаёт issues.
 */

export function parsePackageJson(pkg = {}) {
  const deps = []
  const add = (name, version, kind) => {
    if (name && version) deps.push({ name, version, kind })
  }
  for (const [name, version] of Object.entries(pkg.dependencies || {})) add(name, version, 'prod')
  for (const [name, version] of Object.entries(pkg.devDependencies || {})) add(name, version, 'dev')
  return { deps }
}

export function dedupeFindings(findings = []) {
  const seen = new Set()
  return findings.filter((f) => {
    const key = `${f.package}:${f.cve || f.version || ''}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function decodeBase64(b64) {
  try {
    return Buffer.from(String(b64 || ''), 'base64').toString('utf8')
  } catch {
    return ''
  }
}

export async function buildDepWatch(args = {}, deps = {}) {
  const client = deps.client
  const owner = args.owner
  const repo = args.repo

  const res = await client.getContents(owner, repo, 'package.json').catch((e) => ({ ok: false, error: String(e) }))
  if (!res?.ok) {
    return { ok: false, error: `package.json недоступен: ${res?.error || 'unknown'}` }
  }
  const text = decodeBase64(res.data?.content)
  let pkg
  try {
    pkg = JSON.parse(text)
  } catch {
    return { ok: false, error: 'package.json не является валидным JSON' }
  }
  const { deps: found } = parsePackageJson(pkg)

  // Рекомендации: свежие версии здесь не проверяем (read-only, без внешних источников),
  // но помечаем риск по неконкретным версиям и устаревшим паттернам.
  const findings = found
    .map((d) => {
      const risk = []
      if (/^[\^~]?0\./.test(d.version)) risk.push('major-0: возможны breaking changes')
      if (/^[\^~]?\d+\.\d+\.\d+$/.test(d.version)) risk.push('exact-pin: обновление вручную')
      return { package: d.name, version: d.version, kind: d.kind, source: 'package.json', risk }
    })

  return {
    ok: true,
    data: {
      owner,
      repo,
      deps: found,
      findings: dedupeFindings(findings),
      readOnly: true,
      note: 'Создание issues — только после approval; обновления не выполняются.',
    },
  }
}
