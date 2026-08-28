/**
 * PR template pack: проверка, что PR-описание покрывает обязательные
 * секции шаблона, и определение необходимости risk-чеклиста.
 */

export const REQUIRED_SECTIONS = [
  'Что изменено',
  'Связанная задача',
  'Пользовательский эффект',
  'Проверки',
  'Безопасность',
  'Документация',
]

export function checkPrTemplate(body = '') {
  const text = String(body || '')
  const missing = REQUIRED_SECTIONS.filter((s) => !text.includes(`## ${s}`))
  return { ok: missing.length === 0, missing }
}

export function needsRiskChecklist(labels = []) {
  const riskLabels = ['risk/breaking', 'risk/security', 'risk/data-loss', 'risk/migration']
  return labels.some((l) => riskLabels.includes(l))
}
