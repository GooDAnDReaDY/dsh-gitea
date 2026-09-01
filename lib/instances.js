/**
 * Multi-instance: выбор Gitea-инстанса по имени из настроек `instances`.
 * Fallback на legacy-конфиг (baseUrl/tokenEnv) как инстанс "primary".
 */

export function listInstances(cfg = {}) {
  const list = []
  if (cfg.baseUrl) {
    list.push({ name: 'primary', baseUrl: cfg.baseUrl, tokenEnv: cfg.tokenEnv || 'GITEA_TOKEN' })
  }
  for (const inst of Array.isArray(cfg.instances) ? cfg.instances : []) {
    if (inst && inst.name && inst.baseUrl) {
      list.push({ name: inst.name, baseUrl: inst.baseUrl, tokenEnv: inst.tokenEnv || cfg.tokenEnv || 'GITEA_TOKEN' })
    }
  }
  return list
}

export function resolveInstance(cfg = {}, name = '') {
  const requested = String(name || '').trim()
  const instances = listInstances(cfg)
  if (!requested) {
    if (instances.length) return { ok: true, ...instances[0] }
    return { ok: false, error: 'no Gitea instance configured' }
  }
  const found = instances.find((i) => i.name === requested)
  if (!found) return { ok: false, error: `instance not found: ${requested}` }
  return { ok: true, ...found }
}
