export function formatToolResult(name, value) {
  if (!value?.ok) {
    const err = value?.error || 'unknown error'
    return [{ type: 'text', text: `${name} failed: ${err}` }]
  }

  const data = value.data
  if (data && typeof data === 'object') {
    if (name === 'gitea_worktree_gc') {
      const mode = data.dryRun ? 'Dry-run inspection' : 'Garbage collection'
      const cands = Array.isArray(data.candidates) ? data.candidates.length : 0
      const pruned = Array.isArray(data.pruned) ? data.pruned.length : 0
      return [{ type: 'text', text: `Worktree GC (${mode}): ${data.checked} trees checked, ${cands} candidate(s), ${pruned} pruned.` }]
    }
    if (name === 'gitea_issue_to_pr') {
      return [{ type: 'text', text: `Issue-to-PR: Branch "${data.branch}" prepared for issue #${data.issue?.number} (${data.issue?.title || ''}). PR draft created.` }]
    }
    if (name === 'gitea_ai_review') {
      return [{ type: 'text', text: data.reviewBody || `AI Review PR #${data.prNumber}: ${data.status}` }]
    }
    if (name === 'gitea_ci_logs_analyze') {
      const step = data.failedStep ? ` (step: ${data.failedStep})` : ''
      const rec = data.recommendation ? `\nRecommendation: ${data.recommendation}` : ''
      return [{ type: 'text', text: `CI Analysis [${data.status}]: ${data.errorSummary || 'No errors found'}${step}${rec}` }]
    }
    if (name === 'gitea_action_card') {
      return [{ type: 'text', text: `Gitea Action Card (${data.type}): ${data.summary || data.title || ''}\n\nInteractive actions ready via DSH Hub.` }]
    }
    if (name === 'gitea_pr_stack_status') {
      return [{ type: 'text', text: `Stacked PR Status: ${data.summary || (data.stack ? `${data.stack.length} PR(s) in stack` : "OK")}` }]
    }
    if (name === 'gitea_conflict_analyze') {
      if (data.clean) {
        return [{ type: 'text', text: 'Conflict Analysis: Clean. ' + (data.summary || 'Branches merge cleanly with no conflicts.') }]
      }
      const filesSummary = Array.isArray(data.files)
        ? data.files.map((f) => '  - ' + f.file + ': ' + (f.hunksCount || 0) + ' conflict hunk(s) [' + (f.conflictType || 'content') + ']').join('\n')
        : ''
      return [{ type: 'text', text: 'Conflict Analysis: ' + (data.conflictsCount || 0) + ' conflicting file(s) found between ' + data.headBranch + ' and ' + data.baseBranch + '.\n' + filesSummary + '\n\nUse gitea_pr_conflict_resolve to preview diff and resolve.' }]
    }
    if (name === 'gitea_pr_conflict_resolve' || name === 'gitea_conflict_resolve') {
      if (data.dryRun) {
        const previewLines = Array.isArray(data.previews)
          ? data.previews.map((p) => '--- File: ' + p.file + ' (strategy: ' + p.strategy + ') ---\n' + (p.previewDiff || '(no diff)')).join('\n\n')
          : ''
        return [{ type: 'text', text: 'Conflict Resolution Preview (' + (data.filesCount || 0) + ' file(s)):\n\n' + previewLines + '\n\nNote: ' + (data.note || 'Pass confirm: true to apply resolutions and commit.') }]
      }
      return [{ type: 'text', text: 'Conflict Resolution Applied: ' + (data.summary || ('Resolved ' + (data.filesResolved?.length || 0) + ' file(s) in commit ' + (data.commitSha ? data.commitSha.slice(0, 8) : 'HEAD') + '.')) }]
    }
    if (name === "gitea_release_plan") {
      const secCount = data.sections ? Object.entries(data.sections).filter(([, v]) => v > 0).length : 0
      const warn = data.securityWarnings?.length ? "\nSecurity warnings: " + data.securityWarnings.join("; ") : ""
      return [{ type: "text", text: "Release Plan: v" + data.nextVersion + " (" + data.bump + " bump from v" + data.currentVersion + ")\nChanges: " + data.changesCount + " across " + secCount + " section(s)." + warn + "\n\n" + (data.changelog || "") }]
    }
    if (name === "gitea_packages_list") {
      const count = data.count ?? (Array.isArray(data.packages) ? data.packages.length : 0)
      const sample = Array.isArray(data.packages) ? data.packages.slice(0, 10).map((p) => "  - [" + p.type + "] " + p.name + "@" + (p.version || "latest")).join("\n") : ""
      return [{ type: "text", text: "Package Registry (" + data.owner + "): " + count + " package(s) found.\n" + sample }]
    }
    if (name === "gitea_package_get") {
      return [{ type: "text", text: "Package: " + (data.name || "") + " [" + (data.type || "") + "]\nVersion: " + (data.version || "") + "\nURL: " + (data.html_url || data.htmlUrl || "") }]
    }
    if (name === "gitea_package_delete") {
      if (data.dryRun) {
        return [{ type: "text", text: "[DRY-RUN] Package Delete: " + data.name + "@" + data.version + " (" + data.type + "). Pass confirm: true to apply." }]
      }
      return [{ type: "text", text: "Package Deleted: " + data.name + "@" + data.version + " (" + data.type + ") removed from registry." }]
    }
    if (name === "gitea_package_config") {
      return [{ type: "text", text: "Package Config [" + data.type + "] (" + data.filename + "):\n\n```\n" + data.snippet + "\n```\n\n" + data.instructions }]
    }
    if (name === 'gitea_pr_stack_rebase') {
      if (data.dryRun) {
        return [{ type: 'text', text: `Stacked Rebase Plan (PR #${data.pr_number}): ${data.head} -> ${data.targetBase} (old: ${data.oldBase})\n${(data.steps || []).join("\n")}\n\nNote: Dry-run preview. Pass confirm: true to apply.` }]
      }
      return [{ type: 'text', text: `Stacked Rebase Completed (PR #${data.pr_number}): ${data.head} rebased onto ${data.targetBase} and pushed to origin.` }]
    }
    if (name === 'gitea_task_tracker_sync') {
      return [{ type: 'text', text: `Task Tracker Sync: ${data.count ?? 1} card(s) processed.` }]
    }
    if (name === 'gitea_memory_brain_sync') {
      return [{ type: 'text', text: `Memory Brain Sync: Fact prepared for ${data.category} in project ${data.project}.` }]
    }
    if (name === 'gitea_incident_report') {
      return [{ type: 'text', text: `Incident Ticket: Created "${data.title}" (sanitized).` }]
    }
    if (name === 'gitea_release_assistant') {
      const passed = data.checks ? data.checks.filter((c) => c.ok).length + '/' + data.checks.length : 'OK'
      return [{ type: 'text', text: `Release Assistant: Preflight ${passed} passed.` }]
    }
    if (name === 'gitea_merge_readiness' || name === 'gitea_auto_merge') {
      const readyStr = data.ready ? 'READY to merge' : 'NOT ready to merge'
      const mergedStr = data.merged ? ' (Merged)' : (data.needConfirm ? ' (Awaiting confirmation)' : '')
      const checkLines = Array.isArray(data.checks)
        ? data.checks.map((c) => `  - [${c.status === 'pass' ? 'x' : ' '}] ${c.name}: ${c.detail || c.status}`).join('\n')
        : ''
      return [{ type: 'text', text: `PR #${data.number} Merge Readiness: ${readyStr}${mergedStr}${checkLines ? '\nChecks:\n' + checkLines : ''}` }]
    }
    if (name === 'gitea_project_health') {
      const score = data.healthScore != null ? `Health Score: ${data.healthScore}/100` : 'Repository Health Report'
      const hasIssueErr = Array.isArray(data.errors) && data.errors.some((e) => /issue/i.test(e))
      const hasPullErr = Array.isArray(data.errors) && data.errors.some((e) => /pull|pr/i.test(e))
      const openIssues = hasIssueErr ? 'unknown (API error)' : (data.openIssues ?? data.issues?.open ?? 0)
      const openPRs = hasPullErr ? 'unknown (API error)' : (data.openPRs ?? data.pulls?.open ?? 0)
      const staleIssues = Array.isArray(data.staleIssues) ? data.staleIssues.length : 0
      const trunc = data.truncated ? ' (sample truncated)' : ''
      const errNote = Array.isArray(data.errors) && data.errors.length ? `\nErrors: ${data.errors.join('; ')}` : ''
      return [{ type: 'text', text: `${score}${trunc}\nOpen Issues: ${openIssues} (${staleIssues} stale), Open PRs: ${openPRs}${errNote}` }]
    }
    if (name === 'gitea_triage_digest') {
      const stale = Array.isArray(data.staleIssues) ? data.staleIssues.length : (data.staleCount ?? 0)
      const noReview = Array.isArray(data.pullRequestsNoReview) ? data.pullRequestsNoReview.length : 0
      const trunc = data.truncated ? ' (sample truncated)' : ''
      const action = data.priorityAction ? `\nPriority: ${data.priorityAction}` : ''
      return [{ type: 'text', text: `Triage Digest${trunc}: ${noReview} PRs awaiting review, ${stale} stale issues.${action}` }]
    }
    if (name === 'gitea_review_inbox') {
      const count = Array.isArray(data.reviews || data.pulls || data.items) ? (data.reviews || data.pulls || data.items).length : (data.count ?? 0)
      return [{ type: 'text', text: `Review Inbox: ${count} pending item(s).` }]
    }
    if (name === 'gitea_repo_analytics') {
      const issuesCount = data.issues?.total ?? (data.totalIssues ?? 0)
      const pullsCount = data.pulls?.total ?? (data.totalPulls ?? 0)
      const trunc = data.truncated ? ' (sample truncated)' : ''
      return [{ type: 'text', text: `Repo Analytics${trunc}: ${issuesCount} issues, ${pullsCount} pull requests analyzed.` }]
    }
    if (name === 'gitea_pr_impact') {
      const files = data.filesCount ?? (Array.isArray(data.files) ? data.files.length : 0)
      const risk = data.riskLevel || data.risk || 'standard'
      return [{ type: 'text', text: `PR #${data.number || ''} Impact Analysis: risk=${risk}, ${files} file(s) affected.` }]
    }
    if (name === 'gitea_label_bootstrap') {
      const created = Array.isArray(data.created) ? data.created.length : 0
      const dry = data.dryRun ? ' (dry-run)' : ''
      return [{ type: 'text', text: `Label Bootstrap${dry}: ${created} label(s) planned/created.` }]
    }
    if (name === 'gitea_reactions') {
      if (Array.isArray(data)) {
        if (data.length === 0) return [{ type: 'text', text: 'No reactions.' }]
        const counts = {}
        for (const r of data) {
          const c = r.content || 'heart'
          counts[c] = (counts[c] || 0) + 1
        }
        const summary = Object.entries(counts).map(([c, n]) => `${c}: ${n}`).join(', ')
        return [{ type: 'text', text: summary }]
      }
      return [{ type: 'text', text: `Reaction ${data.content || 'OK'}` }]
    }
    if (name === 'gitea_issue_timeline' && Array.isArray(data)) {
      if (data.length === 0) return [{ type: 'text', text: 'Timeline is empty.' }]
      const summary = data.map((ev) => `[${ev.type || 'event'}] by ${ev.user_login || ev.user?.login || 'system'}: ${ev.body || ev.comment?.body || ''}`.trim()).join('\n')
      return [{ type: 'text', text: summary }]
    }
    if (name === 'gitea_pr_diff') {
      if (data.stat || data.filesCount !== undefined) {
        return [{ type: 'text', text: `PR #${data.number}: ${data.filesCount} files changed (+${data.additions}, -${data.deletions})` }]
      }
      return [{ type: 'text', text: data.diff || 'Empty diff' }]
    }
    if (Array.isArray(data)) {
            if (name === 'gitea_issue_comments' || name === 'gitea_issue_get_comments') {
        if (data.length === 0) return [{ type: 'text', text: 'No comments found.' }]
        const comments = data.map((c) => {
          const author = c?.user?.login || c?.user_login || c?.user || c?.login || 'unknown'
          const mineTag = c?.mine ? ' (you)' : ''
          const body = c?.body || ''
          const created = c?.created_at ? ` (${c.created_at})` : ''
          return `**${author}**${mineTag}${created}:\n${body}`
        }).join('\n\n---\n\n')
        return [{ type: 'text', text: comments }]
      }
      const lines = data.slice(0, 20).map((item) => {
        if (item?.number != null) return `#${item.number} ${item.title || ''}`.trim()
        if (item?.path != null) return `${item.branch || ''} ${item.path}`.trim()
        if (item?.name != null) return item.name
        return JSON.stringify(item)
      })
      return [{ type: 'text', text: lines.join('\n') || 'OK' }]
    }
    if (name === 'gitea_issue_comment_update') return [{ type: 'text', text: 'Comment updated.' }]
    if (name === 'gitea_issue_comment_delete') {
      if (data?.dryRun) {
        return [{
          type: 'text',
          text: `[DRY-RUN] Comment #${data.commentId} in ${data.owner}/${data.repo} by @${data.author} (${data.createdAt}): "${data.preview}"\nPass confirm: true to permanently delete.`,
        }]
      }
      if (data?.deleted) {
        return [{
          type: 'text',
          text: `Deleted comment #${data.commentId} by @${data.author} (${data.createdAt}): "${data.preview}"`,
        }]
      }
      return [{ type: 'text', text: 'Comment deleted.' }]
    }
    if (data.login) return [{ type: 'text', text: data.login }]
    if (data.path) return [{ type: 'text', text: data.path }]
    if (name === 'gitea_issue_get' && data.number != null) {
      const title = data.title ? ` "${data.title}"` : ''
      let out = `#${data.number}${title}`
      if (data.state) out += ` [${data.state}]`
      if (data.body) out += `\n\n**Description:**\n${data.body}`
      if (Array.isArray(data.comments) && data.comments.length > 0) {
        const comments = data.comments.map((c) => {
          const author = c?.user?.login || c?.user || c?.login || 'unknown'
          const text = c?.body || ''
          return `**${author}:** ${text}`
        }).join('\n\n')
        out += `\n\n**Comments (${data.comments.length}):**\n${comments}`
      }
      return [{ type: 'text', text: out }]
    }
    if (name === 'gitea_issue_comment') {
      const issueRef = data?.issue_number ? ` on #${data.issue_number}` : ''
      const commentId = data?.id ? ` (comment #${data.id})` : ''
      const author = data?.user?.login ? ` by @${data.user.login}` : ''
      return [{ type: 'text', text: `Comment posted${issueRef}${commentId}${author}.` }]
    }
    if (name === 'gitea_pr_merge_status') {
      const prNum = data.number != null ? `PR #${data.number}` : 'PR'
      if (data.merged) {
        return [{ type: 'text', text: `${prNum} is already merged.` }]
      }
      if (data.mergeable) {
        return [{ type: 'text', text: `${prNum} is open and ready to merge (no conflicts detected).` }]
      }
      return [{ type: 'text', text: `${prNum} cannot be merged automatically (conflicts or checks pending).` }]
    }
    if (name === 'gitea_pr_merge' || data.merged) {
      const prNum = data?.number != null ? ` #${data.number}` : ''
      return [{ type: 'text', text: `Pull request${prNum} merged.` }]
    }
    if (data.number != null) {
      const title = data.title ? ` "${data.title}"` : ''
      return [{ type: 'text', text: `#${data.number}${title}` }]
    }
  }

  return [{ type: 'text', text: 'OK' }]
}
