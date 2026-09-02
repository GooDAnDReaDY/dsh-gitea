/**
 * PR policy as code: парсер/валидатор простого YAML-подобного формата
 * политики репозитория и применение к merge-readiness. Не обходит
 * встроенные branch protections Gitea.
 */

function parseSimpleYaml(text = '') {
  const data = { version: 1, requireApproval: false, requiredChecks: [], protectedPaths: [] }
  const lines = String(text || '').split(/\r?\n/)
  let section = null
  let currentPath = null
  for (const raw of lines) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    if (/^version:\s*\d+/.test(line)) { data.version = Number(line.split(':')[1].trim()); continue }
    if (/^requireApproval:\s*(true|false)/.test(line)) { data.requireApproval = line.split(':')[1].trim() === 'true'; continue }
    if (/^requiredChecks:\s*$/.test(line)) { section = 'requiredChecks'; continue }
    if (/^protectedPaths:\s*$/.test(line)) { section = 'protectedPaths'; continue }
    if (section === 'requiredChecks') {
      const chk = line.match(/^-\s*["']?([^"']+)["']?$/)
      if (chk) { data.requiredChecks.push(chk[1]); continue }
    }
    if (section === 'protectedPaths') {
      const m = line.match(/^-\s*path:\s*["']?([^"']+)["']?$/)
      if (m) { currentPath = { path: m[1], requiresReviewer: false }; data.protectedPaths.push(currentPath); continue }
      const rv = line.match(/^requiresReviewer:\s*(true|false)/)
      if (rv && currentPath) { currentPath.requiresReviewer = rv[1] === 'true'; continue }
    }
  }
  return data
}

export function parsePolicy(text) {
  try {
    const data = parseSimpleYaml(text)
    const recognized = String(text || '').split(/\r?\n/).some((l) => /^(version|requireApproval|requiredChecks|protectedPaths|-\s)/.test(l.trim()))
    if (!recognized && String(text || '').trim()) {
      return { ok: false, error: 'не удалось распознать политику: ожидаются поля version/requireApproval/requiredChecks/protectedPaths' }
    }
    if (!Array.isArray(data.protectedPaths) || !Array.isArray(data.requiredChecks)) {
      return { ok: false, error: 'invalid policy structure' }
    }
    return { ok: true, data }
  } catch (e) {
    return { ok: false, error: String(e?.message || e) }
  }
}

export function validatePolicy(data) {
  const errors = []
  if (!data || typeof data !== 'object') { errors.push('policy is not an object'); return { ok: false, errors } }
  if (!Array.isArray(data.protectedPaths)) errors.push('protectedPaths must be an array')
  if (!Array.isArray(data.requiredChecks)) errors.push('requiredChecks must be an array')
  return { ok: errors.length === 0, errors }
}

export function evaluatePolicy(policy, changedFiles = []) {
  const violations = []
  if (!policy) return { ok: true, violations }
  for (const rule of policy.protectedPaths || []) {
    const glob = String(rule.path || '').replace(/\./g, '\\.').replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*')
    const re = new RegExp(`^${glob}$`)
    for (const file of changedFiles) {
      if (re.test(String(file)) && rule.requiresReviewer) {
        violations.push(`${file} попадает под protected path ${rule.path} — нужен отдельный reviewer`)
      }
    }
  }
  return { ok: true, violations }
}
