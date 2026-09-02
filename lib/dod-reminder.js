/**
 * DoD reminder (default off): напоминает, если агент менял git-файлы
 * в ходе без ссылки на issue/PR. Не блокирует — только сообщение.
 */

const ISSUE_REF = /(?:refs|closes?|fixes?|related)\s*:?\s*#\d+|#\d+/i

export function checkDoD({ changedGitFiles = false, references = [], text = '' } = {}) {
  if (!changedGitFiles) return { ok: true, reminder: false }

  const allText = [text, ...(Array.isArray(references) ? references : [])].join(' ')
  const hasRef = ISSUE_REF.test(allText)
  if (hasRef) return { ok: true, reminder: false }

  return {
    ok: true,
    reminder: true,
    message: 'DoD: вы меняли git-файлы в этом ходе, но не сослались на issue/PR. Добавьте ссылку (например Refs: #N) или создайте issue.',
  }
}
