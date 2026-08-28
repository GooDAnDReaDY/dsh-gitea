/**
 * Issue quality lint: проверяет, что текст issue покрывает обязательные
 * разделы. Не блокирует создание, если политика проекта не требует — просто
 * возвращает список недостающего (см. #54).
 */

export const REQUIRED_SECTIONS = [
  'Проблема/Цель',
  'Факты',
  'Влияние',
  'Приоритет',
  'DoD',
  'Границы',
  'Зависимости',
  'План проверки',
]

// Соответствие: заголовок раздела (в body issue) -> канонический ключ
const SECTION_ALIASES = {
  'Проблема/Цель': ['проблем', 'цель', 'что произошло', 'observed', 'problem', 'goal'],
  'Факты': ['факт', 'подтвержд', 'окружени', 'environment', 'верси', 'version'],
  'Влияние': ['влияни', 'impact', 'затронут'],
  'Приоритет': ['приоритет', 'priority', 'срочно'],
  'DoD': ['dod', 'definition of done', 'готов', 'acceptance', 'критерии приёмк', 'definition of done'],
  'Границы': ['границ', 'scope', 'вне scope', 'out of scope'],
  'Зависимости': ['зависимост', 'dependencies', 'связан'],
  'План проверки': ['план проверки', 'проверк', 'тест', 'verification', 'test plan'],
}

const SECTION_KEYWORDS = {
  'Проблема/Цель': [/проблем/i, /цель/i, /что произошло/i, /observed/i, /problem/i, /goal/i],
  'Факты': [/факт/i, /окружени/i, /environment/i, /верси/i, /version/i],
  'Влияние': [/влияни/i, /impact/i, /затронут/i],
  'Приоритет': [/приоритет/i, /priority/i],
  'DoD': [/dod/i, /definition of done/i, /готов/i, /критерии приёмк/i, /acceptance/i],
  'Границы': [/границ/i, /scope/i, /вне scope/i],
  'Зависимости': [/зависимост/i, /dependencies/i, /связан/i],
  'План проверки': [/план проверки/i, /проверк/i, /тест/i, /verification/i, /test plan/i],
}

export const PRESETS = {
  bug: {
    sections: ['Проблема/Цель', 'Факты', 'Влияние', 'DoD', 'План проверки'],
  },
  feature: {
    sections: ['Проблема/Цель', 'Влияние', 'DoD', 'Границы', 'Зависимости', 'План проверки'],
  },
  chore: {
    sections: ['Проблема/Цель', 'Влияние', 'DoD'],
  },
}

/**
 * Определить пресет по названию issue.
 * bug/defect/ошибка -> bug; feature/feat/улучш -> feature; иначе chore.
 */
export function detectPreset(title = '') {
  const t = String(title || '')
  if (/(bug|defect|ошиб|fix|исправл)/i.test(t)) return 'bug'
  if (/(feat|feature|улучш|добав|нов)/i.test(t)) return 'feature'
  return 'chore'
}

/**
 * Проверить issue на покрытие обязательных разделов.
 * @param {{title?: string, body?: string, labels?: string[]}} issue
 * @param {{preset?: string, block?: boolean}} opts
 * @returns {{ok: boolean, preset: string, missing: string[], present: string[], suggestions: string[]}}
 */
export function lintIssue(issue = {}, opts = {}) {
  const title = String(issue.title || '')
  const body = String(issue.body || '')
  const presetName = opts.preset || detectPreset(title)
  const preset = PRESETS[presetName] || PRESETS.chore

  const present = new Set()
  for (const section of REQUIRED_SECTIONS) {
    const keywords = SECTION_KEYWORDS[section] || []
    const found = keywords.some((re) => re.test(body))
    if (found) present.add(section)
  }

  const required = preset.sections
  const missing = required.filter((s) => !present.has(s))

  const suggestions = missing.map((s) => `Добавьте раздел «${s}» в описание issue (см. шаблон в .gitea/ISSUE_TEMPLATE/).`)

  return {
    ok: missing.length === 0,
    preset: presetName,
    present: [...present],
    missing,
    suggestions,
  }
}
