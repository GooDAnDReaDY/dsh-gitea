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

const BILINGUAL_PATTERNS = [
  { name: 'Что изменено', re: /##\s*(?:Что изменено|Changes|What\s*\/\s*Summary|Summary)/i },
  { name: 'Связанная задача', re: /(?:##\s*(?:Связанная задача|Related Issue|Issue)|(?:Closes|Fixes|Refs)\s*#\d+)/i },
  { name: 'Пользовательский эффект', re: /##\s*(?:Пользовательский эффект|User Effect|Problem|Why)/i },
  { name: 'Проверки', re: /##\s*(?:Проверки|Testing|Verification|Tests)/i },
  { name: 'Безопасность', re: /##\s*(?:Безопасность|Security|Risk)/i },
  { name: 'Документация', re: /##\s*(?:Документация|Documentation|Docs)/i },
]

export function checkPrTemplate(body = '') {
  const text = String(body || '')
  const missing = BILINGUAL_PATTERNS
    .filter((sec) => !sec.re.test(text))
    .map((sec) => sec.name)
  return { ok: missing.length === 0, missing }
}

export function needsRiskChecklist(labels = []) {
  const riskLabels = ['risk/breaking', 'risk/security', 'risk/data-loss', 'risk/migration']
  return labels.some((l) => riskLabels.includes(l))
}
