/**
 * gitea_release_now: single command for release preparation.
 * Compiles changelog from merged PRs, proposes bump, and marks tag.
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
        '1. Changelog from merged PRs (ready)',
        `2. Bump version (${bump})`,
        '3. tag v<version>',
        '4. npm publish + GitHub release — external step behind approval',
      ],
      note: 'Release plan. For actual release: execute bump+tag according to dhs-plugin-release-workflow.',
    },
  }
}

export async function runReleaseNow(args = {}, deps = {}) {
  if (args.confirm !== true) {
    return { ok: false, error: 'Release requires confirm: true (boolean).' }
  }
  return {
    ok: false,
    error: 'Actual npm/GitHub publication must be executed by agent following dhs-plugin-release-workflow (external credentials required). Use plan (dry-run).',
  }
}
