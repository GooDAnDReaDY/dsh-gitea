/**
 * DoD reminder (default off): reminds agent when git files were changed in turn
 * without referencing an issue/PR. Non-blocking informative notice.
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
    message: 'DoD: You modified git tracked files in this turn without referencing an issue/PR. Please add a reference (e.g. Refs: #N) or open an issue.',
  }
}
