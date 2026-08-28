/**
 * gitea_label_bootstrap: идемпотентная синхронизация канонического набора
 * меток в репозиторий. Dry-run по умолчанию; чужие метки не удаляются.
 */

export const CANONICAL_LABELS = [
  { name: 'type/feature', color: '1d76db', description: 'Новая функциональность' },
  { name: 'type/bug', color: 'd73a4a', description: 'Дефект, ошибка поведения' },
  { name: 'type/tech-debt', color: 'fbca04', description: 'Технический долг' },
  { name: 'type/refactor', color: '0e8a16', description: 'Рефакторинг' },
  { name: 'type/docs', color: '0e8a16', description: 'Документация' },
  { name: 'type/research', color: '5319e7', description: 'Исследование / spike' },
  { name: 'type/security', color: 'b60205', description: 'Безопасность' },
  { name: 'type/incident', color: 'b60205', description: 'Инцидент' },
  { name: 'priority/critical', color: 'b60205', description: 'Критический' },
  { name: 'priority/high', color: 'd93f0b', description: 'Высокий' },
  { name: 'priority/medium', color: 'fbca04', description: 'Средний' },
  { name: 'priority/low', color: '0e8a16', description: 'Низкий' },
  { name: 'status/confirmed', color: '1d76db', description: 'Подтверждено' },
  { name: 'status/needs-info', color: 'fbca04', description: 'Нужна информация' },
  { name: 'status/blocked', color: 'b60205', description: 'Заблокировано' },
  { name: 'status/ready', color: '0e8a16', description: 'Готово к работе' },
  { name: 'status/in-progress', color: '1d9bf0', description: 'В работе' },
  { name: 'status/verification', color: '5319e7', description: 'На проверке' },
  { name: 'scope/agent-tools', color: '1d76db', description: 'Agent tools' },
  { name: 'scope/webui', color: '6f42c1', description: 'Веб-интерфейс' },
  { name: 'scope/settings', color: '5319e7', description: 'Настройки' },
  { name: 'scope/ci', color: '008672', description: 'CI' },
  { name: 'scope/release', color: 'd73a4a', description: 'Релизы' },
  { name: 'scope/worktree', color: '0052cc', description: 'Worktree' },
  { name: 'scope/security', color: 'b60205', description: 'Безопасность' },
  { name: 'scope/docs', color: '0e8a16', description: 'Документация' },
  { name: 'risk/breaking', color: 'd93f0b', description: 'Ломающее изменение' },
  { name: 'risk/data-loss', color: 'b60205', description: 'Риск потери данных' },
  { name: 'risk/external-api', color: 'fbca04', description: 'Внешний API' },
  { name: 'risk/migration', color: 'e99695', description: 'Требует миграции' },
  { name: 'signal/stale', color: 'd4c5f9', description: 'Нет активности' },
  { name: 'signal/ci-failed', color: 'ee0701', description: 'CI упал' },
  { name: 'signal/duplicate', color: 'fef2c0', description: 'Вероятный дубликат' },
  { name: 'signal/needs-reproduction', color: 'f9d0c4', description: 'Нужен reproduction' },
]

async function listExisting(client, owner, repo) {
  const res = await client.listLabels(owner, repo, { limit: 100 }).catch((e) => ({ ok: false, error: String(e) }))
  if (!res?.ok) return { ok: false, error: res?.error || 'listLabels failed' }
  return { ok: true, existing: new Set((Array.isArray(res.data) ? res.data : []).map((l) => l.name)) }
}

export async function buildLabelPlan(args = {}, deps = {}) {
  const { ok, existing, error } = await listExisting(deps.client, args.owner, args.repo)
  if (!ok) return { ok: false, error }
  const missing = CANONICAL_LABELS.filter((l) => !existing.has(l.name))
  return { ok: true, data: { owner: args.owner, repo: args.repo, dryRun: true, missing, existingCount: existing.size, total: CANONICAL_LABELS.length } }
}

export async function applyLabelPlan(args = {}, deps = {}) {
  const { ok, existing, error } = await listExisting(deps.client, args.owner, args.repo)
  if (!ok) return { ok: false, error }
  const created = []
  const failed = []
  for (const label of CANONICAL_LABELS) {
    if (existing.has(label.name)) continue
    const res = await deps.client.createLabel(args.owner, args.repo, label).catch((e) => ({ ok: false, error: String(e) }))
    if (res?.ok) created.push(label.name)
    else failed.push({ name: label.name, error: res?.error || 'unknown' })
  }
  return { ok: true, data: { owner: args.owner, repo: args.repo, dryRun: false, created, failed, existingCount: existing.size } }
}
