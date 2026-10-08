import { runWorktreeAction } from './git-local.js'

function slugify(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 32)
}

export async function runIssueToPr(args = {}, deps = {}) {
  const issueNumber = Number(args.issue_number || args.number)
  if (!issueNumber || Number.isNaN(issueNumber)) {
    return { ok: false, error: 'Pass issue_number (number) to prepare Issue-to-PR cycle.' }
  }

  const owner = String(args.owner || deps.settings?.defaultOwner || '').trim()
  const repo = String(args.repo || deps.settings?.defaultRepo || '').trim()
  if (!owner || !repo) {
    return { ok: false, error: 'Target owner and repo must be specified or configured.' }
  }

  if (!deps.client || typeof deps.client.getIssue !== 'function') {
    return { ok: false, error: 'Gitea client not configured or missing getIssue capability.' }
  }

  const issueRes = await deps.client.getIssue(owner, repo, issueNumber)
  if (!issueRes?.ok) {
    return {
      ok: false,
      error: issueRes?.error || `Failed to fetch issue #${issueNumber} from ${owner}/${repo}`,
      status: issueRes?.status ?? 0,
    }
  }

  const issue = issueRes.data || {}
  const labels = Array.isArray(issue.labels) ? issue.labels.map((l) => (typeof l === 'object' ? l.name : String(l))) : []
  const isBug = labels.some((l) => l.includes('bug'))
  const prefix = isBug ? 'fix' : 'feat'
  const slug = slugify(issue.title) || 'task'
  const branchName = `${prefix}/issue-${issueNumber}-${slug}`
  const worktreePath = `.worktrees/issue-${issueNumber}`
  const baseBranch = String(args.base_branch || args.base || 'main').trim()

  let worktreeResult = null
  if (args.create_worktree === true) {
    worktreeResult = await runWorktreeAction('add', {
      worktreePath,
      createBranch: branchName,
      branch: baseBranch,
      path: args.path || deps.cwd,
    }, deps)
    if (!worktreeResult.ok) {
      return {
        ok: false,
        error: `Failed to create worktree for issue #${issueNumber}: ${worktreeResult.error}`,
        branch: branchName,
      }
    }
  }

  const prTitle = `${prefix}: resolve #${issueNumber} - ${issue.title || 'untitled'}`
  const worktreeConfigured = Boolean(args.create_worktree && worktreeResult?.ok)
  const prBody = [
    '## Summary',
    `Resolves #${issueNumber}: ${issue.title || ''}`,
    '',
    '## Related Issue',
    `Closes #${issueNumber}`,
    '',
    '## User Impact',
    `Resolves issue #${issueNumber} for repository users and automated workflows.`,
    '',
    '## Verification',
    `- ${worktreeConfigured ? `Automated setup and isolated worktree configured (${worktreePath})` : `Branch prepared (${branchName}); worktree pending setup`}`,
    '- Regression unit tests and compliance checks pending verification',
    '',
    '## Security',
    '- Parameter sanitization, permission boundary, and credential leak scan pending verification',
    '',
    '## Documentation',
    `- Linked with issue #${issueNumber} description and implementation plan`,
    '',
    '## Checklist',
    `- [${worktreeConfigured ? 'x' : ' '}] Isolated branch and worktree configured`,
    '- [ ] Unit tests added / updated',
    '- [ ] Code review completed',
  ].join('\n')

  let pullRequest = null
  if (args.create_pr === true && deps.client?.createPull) {
    const prRes = await deps.client.createPull(owner, repo, {
      title: prTitle,
      body: prBody,
      head: branchName,
      base: baseBranch,
    }).catch((e) => ({ ok: false, error: String(e) }))
    if (prRes?.ok) {
      pullRequest = prRes.data
    } else {
      return {
        ok: false,
        error: `Failed to create Pull Request in Gitea: ${prRes?.error || 'createPull failed'}`,
        data: {
          issue: { number: issue.number ?? issueNumber, title: issue.title || '', state: issue.state || 'open', labels },
          branch: branchName,
          baseBranch,
          worktreePath: args.create_worktree ? worktreePath : null,
          prDraft: { title: prTitle, body: prBody, head: branchName, base: baseBranch },
        },
      }
    }
  }

  return {
    ok: true,
    data: {
      issue: {
        number: issue.number ?? issueNumber,
        title: issue.title || '',
        state: issue.state || 'open',
        labels,
      },
      branch: branchName,
      baseBranch,
      worktreePath: args.create_worktree ? worktreePath : null,
      pullRequest,
      prDraft: {
        title: prTitle,
        body: prBody,
        head: branchName,
        base: baseBranch,
      },
    },
  }
}
