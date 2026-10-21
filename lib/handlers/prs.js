import { wrap, pickQuery, asNumber, guardMerge } from './common.js'

const PR_TOOLS = new Set([
  'gitea_pr_create',
  'gitea_pr_list',
  'gitea_pr_get',
  'gitea_pr_diff',
  'gitea_pr_comment',
  'gitea_pr_merge',
  'gitea_pr_files',
  'gitea_pr_line_comment',
  'gitea_pr_merge_status',
  'gitea_pr_summary',
  'gitea_pr_impact',
  'gitea_pr_template_check',
  'gitea_pr_policy',
  'gitea_auto_merge',
  'gitea_pr_rebase',
  'gitea_merge_readiness',
  'gitea_pr_stack_status',
  'gitea_pr_stack_rebase',
  'gitea_conflict_analyze',
  'gitea_pr_conflict_resolve',
  'gitea_conflict_resolve',
])

export function isPrTool(name) {
  return PR_TOOLS.has(name)
}

export async function handlePrTool(name, args, deps, ctx) {
  const { client, settings, owner, repo } = ctx

  if (name === 'gitea_conflict_analyze') {
    const { analyzeMergeConflicts } = await import('../conflict-assistant.js')
    const targetOwner = owner || args.owner || deps.settings?.defaultOwner
    const targetRepo = repo || args.repo || deps.settings?.defaultRepo
    return analyzeMergeConflicts({
      owner: targetOwner,
      repo: targetRepo,
      pr_number: asNumber(args.pr_number || args.number),
      head_branch: args.head_branch || args.headBranch,
      base_branch: args.base_branch || args.baseBranch,
      file: args.file,
      content: args.content,
      cwd: args.cwd || deps.cwd || process.cwd(),
    }, {
      ...deps,
      client: client || deps.client,
      settings: settings || deps.settings,
      gitWrapper: deps.gitWrapper || deps.settings?.gitWrapper,
      cwd: deps.cwd || process.cwd(),
    })
  }

  if (name === 'gitea_pr_conflict_resolve' || name === 'gitea_conflict_resolve') {
    const { resolveMergeConflicts } = await import('../conflict-assistant.js')
    const targetOwner = owner || args.owner || deps.settings?.defaultOwner
    const targetRepo = repo || args.repo || deps.settings?.defaultRepo
    return resolveMergeConflicts({
      owner: targetOwner,
      repo: targetRepo,
      pr_number: asNumber(args.pr_number || args.number),
      head_branch: args.head_branch || args.headBranch,
      base_branch: args.base_branch || args.baseBranch,
      resolutions: args.resolutions,
      commit_message: args.commit_message || args.commitMessage,
      push: args.push !== false,
      confirm: args.confirm === true,
      cwd: args.cwd || deps.cwd || process.cwd(),
      content: args.content,
      file: args.file,
    }, {
      ...deps,
      client: client || deps.client,
      settings: settings || deps.settings,
      gitWrapper: deps.gitWrapper || deps.settings?.gitWrapper,
      cwd: deps.cwd || process.cwd(),
    })
  }

  switch (name) {
    case 'gitea_pr_create':
      return wrap(await client.createPull(owner, repo, {
        title: args.title,
        head: args.head,
        base: args.base,
        body: args.body,
      }))
    case 'gitea_pr_list':
      return wrap(await client.listPulls(owner, repo, pickQuery(args, ['state', 'limit', 'page'])))
    case 'gitea_pr_get':
      return wrap(await client.getPull(owner, repo, asNumber(args.number)))
    case 'gitea_pr_diff': {
      const diffRes = await client.getPullDiff(owner, repo, asNumber(args.number))
      if (!diffRes.ok) return diffRes
      const raw = typeof diffRes.data === 'string' ? diffRes.data : String(diffRes.data || '')
      if (args.stat === true) {
        const lines = raw.split('\n')
        let additions = 0
        let deletions = 0
        const filesChanged = []
        for (const line of lines) {
          if (line.startsWith('diff --git a/')) {
            const parts = line.split(' ')
            if (parts[2]) filesChanged.push(parts[2].replace(/^a\//, ''))
          } else if (line.startsWith('+') && !line.startsWith('+++')) {
            additions++
          } else if (line.startsWith('-') && !line.startsWith('---')) {
            deletions++
          }
        }
        return {
          ok: true,
          data: {
            number: asNumber(args.number),
            filesCount: filesChanged.length,
            additions,
            deletions,
            files: filesChanged,
            preview: raw.slice(0, 2000),
          },
        }
      }
      return { ok: true, data: { number: asNumber(args.number), diff: raw } }
    }
    case 'gitea_pr_comment':
      return wrap(await client.commentIssue(owner, repo, asNumber(args.number), args.body))
    case 'gitea_pr_merge': {
      const guard = guardMerge(args)
      if (!guard.ok) return { ok: false, error: guard.error }
      const Do = ['merge', 'rebase', 'squash'].includes(args.Do) ? args.Do : 'merge'
      const res = await client.mergePull(owner, repo, asNumber(args.number), { Do })
      if (res?.ok && res?.data && typeof res.data === 'object' && !res.data.number) {
        res.data.number = asNumber(args.number)
      }
      return wrap(res)
    }
    case 'gitea_pr_files':
      return wrap(await client.listPullFiles(owner, repo, asNumber(args.number), pickQuery(args, ['limit', 'page'])))
    case 'gitea_pr_line_comment': {
      let commentBody = args.body || ''
      if (args.suggestion) {
        const { formatSuggestionBlock, validateSuggestion } = await import('../ai-review.js')
        const val = validateSuggestion(args.suggestion)
        if (!val.valid) {
          return wrap({ ok: false, error: `Invalid suggestion: ${val.reason}` })
        }
        commentBody = formatSuggestionBlock(args.suggestion, commentBody)
      }
      const commentPayload = {
        body: commentBody,
        path: args.path,
        line: args.line ? asNumber(args.line) : undefined,
      }
      if (args.old_line !== undefined) {
        commentPayload.old_line = asNumber(args.old_line)
      }
      return wrap(await client.createPullComment(owner, repo, asNumber(args.number), commentPayload))
    }
    case 'gitea_pr_merge_status': {
      const num = asNumber(args.number)
      const mergeRes = await client.getPullMergeStatus(owner, repo, num)
      let pr = {}
      if (client.getPull) {
        const prRes = await client.getPull(owner, repo, num)
        if (prRes.ok) pr = prRes.data || {}
      }
      const isMerged = Boolean(pr.merged || (mergeRes.ok && mergeRes.data?.merged))
      const isMergeable = isMerged ? false : (pr.mergeable !== undefined ? Boolean(pr.mergeable) : true)
      return wrap({
        ok: true,
        data: {
          number: num,
          state: pr.state || (isMerged ? 'closed' : 'open'),
          merged: isMerged,
          mergeable: isMergeable,
          has_issues: !isMerged && isMergeable === false,
          ...(mergeRes.data && typeof mergeRes.data === 'object' ? mergeRes.data : {}),
          merged: isMerged,
          mergeable: isMergeable,
        }
      })
    }
    case 'gitea_auto_merge': {
      const { autoMergeIfReady } = await import('../merge-gate.js')
      return autoMergeIfReady({ owner, repo, number: asNumber(args.number), confirm: args.confirm === true }, { client })
    }
    case 'gitea_pr_rebase': {
      const { planRebase, runRebase } = await import('../pr-rebase.js')
      if (args.confirm === true) {
        return runRebase({ owner, repo, number: asNumber(args.number), branch: args.branch, confirm: true }, deps)
      }
      return planRebase({ owner, repo, number: asNumber(args.number) }, deps)
    }
    case 'gitea_pr_stack_status': {
      const { buildPullStack } = await import('../pr-stack.js')
      const pullsRes = await client.listPulls(owner, repo, { state: 'all', limit: 50 }).catch((e) => ({ ok: false, error: String(e) }))
      if (!pullsRes?.ok) {
        return { ok: false, error: `Failed to fetch pull requests: ${pullsRes?.error || 'unknown error'}` }
      }
      return buildPullStack(pullsRes.data || [], args.pr_number || args.number)
    }
    case 'gitea_pr_stack_rebase': {
      const { executeStackRebase } = await import('../pr-stack.js')
      return executeStackRebase({
        owner,
        repo,
        pr_number: asNumber(args.pr_number || args.number),
        target_base: args.target_base || args.targetBase,
        confirm: args.confirm === true,
        force: args.force === true,
      }, {
        ...deps,
        client,
        settings,
        gitWrapper: deps.gitWrapper || settings?.gitWrapper,
        cwd: deps.cwd || process.cwd(),
      })
    }
    case 'gitea_pr_summary': {
      const { buildPrSummary } = await import('../pr-summary.js')
      return buildPrSummary({ owner, repo, number: args.number }, { client })
    }
    case 'gitea_merge_readiness': {
      const { checkMergeReadiness } = await import('../merge-gate.js')
      return checkMergeReadiness({ owner, repo, number: args.number }, { client })
    }
    case 'gitea_pr_impact': {
      const { buildImpactMap } = await import('../impact-map.js')
      return buildImpactMap({ owner, repo, number: args.number }, { client })
    }
    case 'gitea_pr_template_check': {
      const { checkPrTemplate, needsRiskChecklist } = await import('../pr-templates.js')
      const bodyCheck = checkPrTemplate(args.body)
      return { ok: true, data: { template: bodyCheck, riskChecklistNeeded: needsRiskChecklist(args.labels || []) } }
    }
    case 'gitea_pr_policy': {
      const { parsePolicy, validatePolicy, evaluatePolicy } = await import('../policy-code.js')
      const res = await client.getContents(owner, repo, '.gitea/pr-policy.yml').catch((e) => ({ ok: false, error: String(e) }))
      if (!res?.ok) {
        return { ok: true, data: { present: false, note: 'Policy file not found (.gitea/pr-policy.yml)', violations: [] } }
      }
      const text = Buffer.from(String(res.data?.content || ''), 'base64').toString('utf8')
      const parsed = parsePolicy(text)
      if (!parsed.ok) return { ok: false, error: parsed.error }
      const v = validatePolicy(parsed.data)
      const evalRes = evaluatePolicy(parsed.data, args.files || [])
      return { ok: true, data: { present: true, policy: parsed.data, validation: v, violations: evalRes.violations } }
    }
    default:
      return { ok: false, error: `Unknown PR tool: ${name}` }
  }
}
