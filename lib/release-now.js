/**
 * gitea_release_now: одна команда для релизного цикла.
 * Собирает changelog из merged PR (buildReleaseNotes), предлагает bump,
 * и (по confirm) отмечает tag через git wrapper. npm/GitHub publish —
 * за approval boundary, вне плагина (нужны внешние ключи).
 */

import { buildReleaseNotes, semverBump } from './release-notes.js'

export async function planReleaseNow(args = {}, deps = {}) {
  const owner = args.owner
  const repo = args.repo

  const notes = await buildReleaseNotes({ owner, repo }, deps)
  if (!notes.ok) return notes

  const titles = Array.isArray(notes.data?.changes) ? notes.data.changes.map((c) => c.title) : []
  const bump = semverBump(titles)

  return {
    ok: true,
    data: {
      dryRun: true,
      owner, repo,
      bump,
      features: notes.data.changes || [],
      steps: [
        '1. changelog из merged PR (готово)',
        `2. bump версии (${bump})`,
        '3. tag v<version>',
        '4. npm publish + GitHub release — внешний шаг за approval',
      ],
      note: 'План. Для фактического релиза: выполните bump+tag по скиллу dhs-plugin-release-workflow.',
    },
  }
}

export async function runReleaseNow(args = {}, deps = {}) {
  if (args.confirm !== true) {
    return { ok: false, error: 'Release requires confirm: true (boolean).' }
  }
  return {
    ok: false,
    error: 'Фактический npm/GitHub publish выполняется агентом по dhs-plugin-release-workflow (нужны внешние ключи). Используйте план (dry-run).',
  }
}
