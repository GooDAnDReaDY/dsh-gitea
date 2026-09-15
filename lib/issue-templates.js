import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ASSETS_TEMPLATE_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'issue-templates')
const GITEA_TEMPLATE_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '.gitea', 'ISSUE_TEMPLATE')
const TEMPLATE_DIR = fs.existsSync(ASSETS_TEMPLATE_DIR) ? ASSETS_TEMPLATE_DIR : GITEA_TEMPLATE_DIR

/**
 * List issue templates from template directory.
 * Returns [{ name, file }] for *.yaml files (excluding config.yaml).
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
 * Validate that template contains mandatory Gitea YAML issue form fields:
 * name, body; body contains textarea/dropdown with required.
 * Returns { ok, errors }.
 */
export function validateIssueTemplate(file, text) {
  const errors = []
  if (!file.endsWith('.yaml')) {
    errors.push(`${file}: not a YAML file`)
    return { ok: false, errors }
  }
  if (!/^name:\s*\S/m.test(text)) {
    errors.push(`${file}: missing name field`)
  }
  if (!/^body:\s*$/m.test(text)) {
    errors.push(`${file}: missing body section`)
  }
  const requiredFields = [...text.matchAll(/id:\s*(\S+)[\s\S]*?validations:[\s\S]*?required:\s*true/g)]
  if (requiredFields.length === 0) {
    errors.push(`${file}: no required fields (required: true)`)
  }
  const hasCheckboxes = text.includes('- type: checkboxes')
  const hasTextarea = text.includes('- type: textarea')
  if (!hasTextarea && !hasCheckboxes) {
    errors.push(`${file}: missing textarea/checkboxes fields`)
  }
  return { ok: errors.length === 0, errors }
}

/**
 * Validate all templates in directory.
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
