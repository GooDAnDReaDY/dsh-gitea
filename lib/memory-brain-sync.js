export function formatReleaseMemory({ repo, tag, releaseNotes, version }) {
  const content = [
    `Release ${tag || version} for ${repo} completed.`,
    releaseNotes ? `\n\nRelease notes:\n${releaseNotes}` : '',
  ].join('').trim()

  return {
    content,
    category: 'release',
    action_type: 'commit',
    action_outcome: 'success',
    project: repo || 'dsh-gitea',
    importance: 0.95,
    permanent: true,
    source: 'dsh-gitea',
    reason: `Automated release memory for ${tag || version}`,
  }
}

export function formatPullRequestMemory({ repo, pr, summary }) {
  const prNum = pr?.number ?? pr?.index ?? 'unknown'
  const title = pr?.title || ''
  const content = [
    `Pull Request #${prNum} (${title}) merged into ${repo}.`,
    summary ? `\n\nSummary:\n${summary}` : '',
  ].join('').trim()

  return {
    content,
    category: 'feature',
    action_type: 'review',
    action_outcome: 'success',
    project: repo || 'dsh-gitea',
    importance: 0.8,
    permanent: false,
    source: 'dsh-gitea',
    reason: `Merged pull request #${prNum}`,
  }
}

export async function runMemoryBrainSync(args = {}, deps = {}) {
  const action = args.action || 'format'
  const repo = String(args.repo || deps.settings?.defaultRepo || 'dsh-gitea').trim()

  if (action === 'release_fact') {
    const memory = formatReleaseMemory({
      repo,
      tag: args.tag,
      version: args.version,
      releaseNotes: args.release_notes || args.notes,
    })
    return { ok: true, data: memory }
  }

  if (action === 'pr_fact') {
    const memory = formatPullRequestMemory({
      repo,
      pr: args.pr || { number: args.pr_number, title: args.title },
      summary: args.summary,
    })
    return { ok: true, data: memory }
  }

  return { ok: false, error: `Unknown memory brain action: ${action}` }
}
