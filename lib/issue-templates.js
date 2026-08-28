import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const TEMPLATE_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '.gitea', 'ISSUE_TEMPLATE')

/**
 * Список шаблонов issue из каталога .gitea/ISSUE_TEMPLATE.
 * Возвращает [{ name, file }] для файлов *.yaml (кроме config.yaml).
 */
export function listIssueTemplates(dir = TEMPLATE_DIR) {
  let entries = []
  try {
    entries = fs.readdirSync(dir)
  } catch {
    return []
  }
  return entries
    .filter((f) => f.endsWith('.yaml') && f !== 'config.yaml')
    .sort()
    .map((file) => ({
      file,
      name: file.replace(/\.yaml$/, ''),
    }))
}

/**
 * Проверка, что в шаблоне есть обязательные поля YAML-формы Gitea:
 * name, body; body содержит textarea/dropdown с required.
 * Возвращает { ok, errors }.
 */
export function validateIssueTemplate(file, text) {
  const errors = []
  if (!file.endsWith('.yaml')) {
    errors.push(`${file}: не YAML`)
    return { ok: false, errors }
  }
  if (!/^name:\s*\S/m.test(text)) {
    errors.push(`${file}: отсутствует поле name`)
  }
  if (!/^body:\s*$/m.test(text)) {
    errors.push(`${file}: отсутствует секция body`)
  }
  // каждая textarea с required: true должна быть (валидность формы)
  const requiredFields = [...text.matchAll(/id:\s*(\S+)[\s\S]*?validations:[\s\S]*?required:\s*true/g)]
  if (requiredFields.length === 0) {
    errors.push(`${file}: нет ни одного обязательного поля (required: true)`)
  }
  const hasCheckboxes = text.includes('- type: checkboxes')
  const hasTextarea = text.includes('- type: textarea')
  if (!hasTextarea && !hasCheckboxes) {
    errors.push(`${file}: нет полей textarea/checkboxes`)
  }
  return { ok: errors.length === 0, errors }
}

/**
 * Проверка всех шаблонов в каталоге.
 */
export function validateAllTemplates(dir = TEMPLATE_DIR) {
  const templates = listIssueTemplates(dir)
  const results = []
  for (const t of templates) {
    const text = fs.readFileSync(path.join(dir, t.file), 'utf8')
    const r = validateIssueTemplate(t.file, text)
    results.push({ file: t.file, ...r })
  }
  return results
}
