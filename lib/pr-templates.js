/**
 * PR template pack: checks that PR description covers mandatory sections,
 * and determines risk checklist necessity.
 */

export const REQUIRED_SECTIONS = [
  'Summary',
  'Related Issue',
  'User Impact',
  'Verification',
  'Security',
  'Documentation',
]

const BILINGUAL_PATTERNS = [
  { name: 'Summary', re: /##\s*(?:Summary|What\s*\/\s*Summary|Changes|\u0427\u0442\u043e \u0438\u0437\u043c\u0435\u043d\u0435\u043d\u043e|\u53d8\u66f4\u8bf4\u660e)/i },
  { name: 'Related Issue', re: /(?:##\s*(?:Related Issue|Issue|\u0421\u0432\u044f\u0437\u0430\u043d\u043d\u0430\u044f \u0437\u0430\u0434\u0430\u0447\u0430|\u5173\u8054\u95ee\u9898)|(?:Closes|Fixes|Refs)\s*#\d+)/i },
  { name: 'User Impact', re: /##\s*(?:User Impact|Why|Problem|\u041f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u044c\u0441\u043a\u0438\u0439 \u044d\u0444\u0444\u0435\u043a\u0442|\u7528\u6237\u5f71\u54cd)/i },
  { name: 'Verification', re: /##\s*(?:Verification|Testing|Tests|\u041f\u0440\u043e\u0432\u0435\u0440\u043a\u0438|\u9a8c\u8bc1\u6d4b\u8bd5)/i },
  { name: 'Security', re: /##\s*(?:Security|Risk|\u0411\u0435\u0437\u043e\u043f\u0430\u0441\u043d\u043e\u0441\u0442\u044c|\u5b89\u5168\u4e0e\u98ce\u9669)/i },
  { name: 'Documentation', re: /##\s*(?:Documentation|Docs|\u0414\u043e\u043a\u0443\u043c\u0435\u043d\u0442\u0430\u0446\u0438\u044f|\u6587\u6863\u8bf4\u660e)/i },
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
