/**
 * Issue quality lint: verifies that issue description covers mandatory sections.
 * Returns missing sections and actionable suggestions.
 */

export const REQUIRED_SECTIONS = [
  'Problem/Goal',
  'Facts',
  'Impact',
  'Priority',
  'DoD',
  'Scope',
  'Dependencies',
  'Verification Plan',
]

const SECTION_ALIASES = {
  'Problem/Goal': [/problem/i, /goal/i, /observed/i, /\u043f\u0440\u043e\u0431\u043b\u0435\u043c/i, /\u0446\u0435\u043b\u044c/i, /\u0447\u0442\u043e \u043f\u0440\u043e\u0438\u0437\u043e\u0448\u043b\u043e/i, /问题/i, /目标/i],
  'Facts': [/facts?/i, /environment/i, /version/i, /\u0444\u0430\u043a\u0442/i, /\u043e\u043a\u0440\u0443\u0436\u0435\u043d\u0438/i, /\u0432\u0435\u0440\u0441\u0438/i, /事实/i, /环境/i],
  'Impact': [/impact/i, /affected/i, /\u0432\u043b\u0438\u044f\u043d\u0438/i, /\u0437\u0430\u0442\u0440\u043e\u043d\u0443\u0442/i, /影响/i],
  'Priority': [/priority/i, /urgency/i, /\u043f\u0440\u0438\u043e\u0440\u0438\u0442\u0435\u0442/i, /\u0441\u0440\u043e\u0447\u043d\u043e/i, /优先级/i],
  'DoD': [/dod/i, /definition of done/i, /acceptance/i, /\u0433\u043e\u0442\u043e\u0432/i, /\u043a\u0440\u0438\u0442\u0435\u0440\u0438\u0438 \u043f\u0440\u0438\u0451\u043c\u043a/i, /完成标准/i],
  'Scope': [/scope/i, /boundaries/i, /out of scope/i, /\u0433\u0440\u0430\u043d\u0438\u0446/i, /\u0432\u043d\u0435 scope/i, /范围/i],
  'Dependencies': [/dependenc/i, /related/i, /\u0437\u0430\u0432\u0438\u0441\u0438\u043c\u043e\u0441\u0442/i, /\u0441\u0432\u044f\u0437\u0430\u043d/i, /依赖/i],
  'Verification Plan': [/verification/i, /test plan/i, /tests?/i, /\u043f\u0440\u043e\u0432\u0435\u0440\u043a/i, /\u0442\u0435\u0441\u0442/i, /验证计划/i, /测试/i],
}

export const PRESETS = {
  bug: {
    sections: ['Problem/Goal', 'Facts', 'Impact', 'DoD', 'Verification Plan'],
  },
  feature: {
    sections: ['Problem/Goal', 'Impact', 'DoD', 'Scope', 'Dependencies', 'Verification Plan'],
  },
  chore: {
    sections: ['Problem/Goal', 'Impact', 'DoD'],
  },
}

/**
 * Infer preset from issue title.
 */
function inferPresetFromTitle(title) {
  const t = String(title || '').toLowerCase()
  if (/(bug|defect|fix|\u043e\u0448\u0438\u0431|\u0438\u0441\u043f\u0440\u0430\u0432\u043b)/i.test(t)) return 'bug'
  if (/(feat|feature|add|\u0443\u043b\u0443\u0447\u0448|\u0434\u043e\u0431\u0430\u0432|\u043d\u043e\u0432)/i.test(t)) return 'feature'
  return 'chore'
}

/**
 * Check issue body against required sections.
 */
export function lintIssue(issue, options = {}) {
  const title = issue?.title || ''
  const body = String(issue?.body || '')
  const presetKey = options.preset || inferPresetFromTitle(title)
  const preset = PRESETS[presetKey] || PRESETS.chore
  const required = options.sections || preset.sections

  const present = []
  const missing = []

  for (const section of required) {
    const regexes = SECTION_ALIASES[section] || [new RegExp(section, 'i')]
    const matched = regexes.some((re) => re.test(body))
    if (matched) present.push(section)
    else missing.push(section)
  }

  const suggestions = missing.map((s) => `Add section "${s}" to issue description (see templates in .gitea/ISSUE_TEMPLATE/).`)

  return {
    ok: missing.length === 0,
    preset: presetKey,
    covered: present,
    missing,
    suggestions,
    ratio: required.length ? present.length / required.length : 1,
  }
}
