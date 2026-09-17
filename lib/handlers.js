import { resolveRepo } from './repo.js'
import { credentialRefStatus } from './secrets.js'
import { runWorktreeAction } from './git-local.js'

const schedulerStore = { jobs: new Map() }

export function guardMerge(args = {}) {
  if (args.confirm === true) return { ok: true }
  return { ok: false, error: 'Merge requires confirm: true (boolean).' }
}

const LOCAL_TOOLS = new Set([
  'gitea_worktree_list',
  'gitea_worktree_add',
  'gitea_worktree_use',
  'gitea_worktree_remove',
  'gitea_git_graph',
])

const NO_REPO = new Set([
  'gitea_repo_search',
  'gitea_flavor',
  'gitea_whoami',
  'gitea_issue_search',
  'gitea_issue_lint',
  'gitea_user_search',
  'gitea_notifications',
  'gitea_notifications_mark_read',
  'gitea_mirror_public',
  'gitea_repo_bootstrap',
  'gitea_issue_templates',
  ...LOCAL_TOOLS,
])

function configuredError(deps) {
  const cred = credentialRefStatus(deps.settings?.tokenEnv || 'GITEA_TOKEN')
  if (!cred.ok) return { ok: false, error: cred.error }
  if (!deps.configured?.baseUrl) {
    return { ok: false, error: 'Configure the Gitea instance URL in Settings.' }
  }
  if (!deps.configured?.token) {
    return { ok: false, error: `Set the credential named ${cred.name} in DSH credentials.` }
  }
  return null
}

const RECORD_KEYS = [
  'number', 'title', 'name', 'merged', 'state', 'id',
  'body', 'html_url', 'full_name', 'created_at', 'updated_at',
  'login', 'path', 'branch', 'dirty', 'head', 'current', 'repoDir',
  'comments', 'content', 'type', 'mine',
]

function slimRecord(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value
  const out = {}
  for (const key of RECORD_KEYS) {
    if (value[key] !== undefined && value[key] !== null) out[key] = value[key]
  }
  if (value.user?.login) out.user_login = value.user.login
  if (value.mine !== undefined) out.mine = Boolean(value.mine)
  if (Array.isArray(value.comments)) {
    out.comments = value.comments.map((c) => ({
      id: c.id,
      user: c.user?.login || c.user_login || c.login || 'unknown',
      body: c.body || '',
      created_at: c.created_at,
      updated_at: c.updated_at,
      ...(c.mine !== undefined ? { mine: Boolean(c.mine) } : {}),
    }))
  }
  return out
}

async function annotateCommentsWithMine(comments, client) {
  if (!Array.isArray(comments) || comments.length === 0 || !client?.getUser) return comments
  let meLogin = ''
  try {
    const meRes = await client.getUser()
    if (meRes?.ok && meRes.data?.login) {
      meLogin = String(meRes.data.login).toLowerCase()
    } else if (meRes && !meRes.ok) {
      /* bestEffort: mine is not critical for reading comments */
      console.warn('[dsh-gitea] getUser returned non-ok response:', meRes.error || meRes.status)
    }
  } catch (err) {
    /* bestEffort: mine is not critical for reading comments */
    console.warn('[dsh-gitea] getUser failed while annotating comments:', err?.message || String(err))
  }
  if (!meLogin) {
    return comments
  }
  for (const c of comments) {
    if (c && typeof c === 'object') {
      const authorLogin = String(c.user?.login || c.user?.username || c.user_login || c.login || '').toLowerCase()
      c.mine = Boolean(authorLogin && authorLogin === meLogin)
    }
  }
  return comments
}

function unwrapPayload(raw) {
  if (raw && typeof raw === 'object' && !Array.isArray(raw) && Array.isArray(raw.data)) {
    return raw.data
  }
  return raw
}

function wrap(apiResult) {
  if (!apiResult?.ok) {
    return { ok: false, error: apiResult?.error || `HTTP ${apiResult?.status || 0}` }
  }
  const raw = unwrapPayload(apiResult.data)
  if (Array.isArray(raw)) {
    return { ok: true, data: raw.map(slimRecord) }
  }
  return { ok: true, data: slimRecord(raw) }
}

function asNumber(value) {
  const n = Number(value)
  return Number.isFinite(n) ? n : value
}

function pickQuery(args, keys) {
  const query = {}
  for (const key of keys) {
    const value = args[key]
    if (value !== undefined && value !== null && value !== '') query[key] = value
  }
  return query
}

const LEGACY_MAP = {
  gitea_label_list: ['gitea_labels', 'list'],
  gitea_label_create: ['gitea_labels', 'create'],
  gitea_label_delete: ['gitea_labels', 'delete'],
  gitea_issue_set_labels: ['gitea_labels', 'set'],
  gitea_milestone_list: ['gitea_milestones', 'list'],
  gitea_milestone_create: ['gitea_milestones', 'create'],
  gitea_milestone_update: ['gitea_milestones', 'update'],
  gitea_milestone_delete: ['gitea_milestones', 'delete'],
  gitea_reaction_add: ['gitea_reactions', 'add'],
  gitea_reaction_delete: ['gitea_reactions', 'delete'],
  gitea_reaction_list: ['gitea_reactions', 'list'],
  gitea_release_list: ['gitea_releases', 'list'],
  gitea_release_create: ['gitea_releases', 'create'],
  gitea_release_update: ['gitea_releases', 'update'],
  gitea_release_delete: ['gitea_releases', 'delete'],
  gitea_release_now: ['gitea_releases', 'plan'],
  gitea_release_notes: ['gitea_releases', 'notes'],
  gitea_ci_status: ['gitea_ci', 'status'],
  gitea_ci_jobs: ['gitea_ci', 'jobs'],
  gitea_ci_rerun: ['gitea_ci', 'rerun'],
  gitea_ci_explain: ['gitea_ci', 'explain'],
  gitea_repo_branches: ['gitea_branches', 'list'],
  gitea_repo_branch_create: ['gitea_branches', 'create'],
  gitea_repo_branch_delete: ['gitea_branches', 'delete'],
  gitea_repo_tags: ['gitea_tags', 'list'],
  gitea_repo_tag_create: ['gitea_tags', 'create'],
  gitea_repo_tag_delete: ['gitea_tags', 'delete'],
  gitea_webhook_list: ['gitea_webhooks', 'list'],
  gitea_webhook_create: ['gitea_webhooks', 'create'],
  gitea_webhook_delete: ['gitea_webhooks', 'delete'],
  gitea_org_list: ['gitea_org', 'list'],
  gitea_org_repos: ['gitea_org', 'repos'],
  gitea_org_members: ['gitea_org', 'members'],
  gitea_org_teams: ['gitea_org', 'teams'],
  gitea_repo_create_org: ['gitea_org', 'create_repo'],
  gitea_wiki_pages: ['gitea_wiki', 'list'],
  gitea_wiki_page: ['gitea_wiki', 'get'],
}

export async function runHandler(name, args = {}, deps = {}) {
  if (LEGACY_MAP[name]) {
    const [target, action] = LEGACY_MAP[name]
    name = target
    args = { ...args, action: args.action || action }
  }
  if (LOCAL_TOOLS.has(name)) {
    if (name === 'gitea_git_graph') {
      const { fetchCommitGraph } = await import('./graph.js')
      const cwd = args.cwd || deps.cwd || process.cwd()
      const gitWrapper = deps.gitWrapper || 'git'
      const graphRes = await fetchCommitGraph({ gitWrapper, cwd, limit: args.limit, execFile: deps.execFile })
      if (graphRes.ok && deps.client && args.withCiStatus !== false) {
        const resolved = resolveRepo({ args, settings: deps.settings, remoteUrl: deps.remoteUrl })
        if (resolved.ok && Array.isArray(graphRes.data?.commits)) {
          const checkCount = Math.min(10, graphRes.data.commits.length)
          await Promise.allSettled(
            graphRes.data.commits.slice(0, checkCount).map(async (commit) => {
              try {
                const st = await deps.client.getCombinedCommitStatus(resolved.owner, resolved.repo, commit.oid)
                if (st?.ok && st.data?.state) {
                  commit.ciStatus = st.data.state
                }
              } catch { /* ignore CI lookup failures */ }
            })
          )
        }
      }
      return graphRes
    }
    const action = name.replace('gitea_worktree_', '')
    return runWorktreeAction(action, args, deps)
  }

  if (name === 'gitea_issue_lint') {
    const { lintIssue } = await import('./issue-lint.js')
    const result = lintIssue({ title: args.title, body: args.body }, { preset: args.preset })
    return { ok: true, data: result }
  }

  if (name === 'gitea_issue_templates') {
    const { listIssueTemplates, validateAllTemplates } = await import('./issue-templates.js')
    const templates = listIssueTemplates(args.dir)
    const validation = validateAllTemplates(args.dir)
    return { ok: true, data: { templates, validation } }
  }

  const pre = configuredError(deps)
  if (pre) return pre

  const client = deps.client
  const settings = deps.settings || {}
  const remoteUrl = deps.remoteUrl || ''

  if (name === 'gitea_whoami') {
    return wrap(await client.getUser())
  }

  if (name === 'gitea_flavor') {
    const { detectFlavor } = await import('./forgejo-detect.js')
    return detectFlavor({}, { client })
  }

  const needsRepo = !NO_REPO.has(name)
    && !(name === 'gitea_scheduled_checks' && args.action === 'list')
    && !(name === 'gitea_org')
    && !(name === 'gitea_ci' && args.action === 'explain')

  let owner
  let repo
  if (needsRepo) {
    const resolved = resolveRepo({ args, settings, remoteUrl })
    if (!resolved.ok) return { ok: false, error: resolved.error }
    owner = resolved.owner
    repo = resolved.repo
  }

  switch (name) {
    // ---- 1. gitea_labels ----
    case 'gitea_labels': {
      const action = args.action || 'list'
      if (action === 'list') {
        return wrap(await client.listLabels(owner, repo, pickQuery(args, ['limit', 'page'])))
      }
      if (action === 'create') {
        return wrap(await client.createLabel(owner, repo, {
          name: args.name,
          color: args.color,
          description: args.description,
        }))
      }
      if (action === 'delete') {
        return wrap(await client.deleteLabel(owner, repo, asNumber(args.label_id)))
      }
      if (action === 'set') {
        return wrap(await client.setIssueLabels(owner, repo, asNumber(args.number), (args.labels || []).map(Number)))
      }
      if (action === 'add_to_issue') {
        return wrap(await client.addIssueLabels(owner, repo, asNumber(args.number), (args.labels || []).map(Number)))
      }
      return { ok: false, error: `unknown action: ${action}` }
    }

    // ---- 2. gitea_milestones ----
    case 'gitea_milestones': {
      const action = args.action || 'list'
      if (action === 'list') {
        return wrap(await client.listMilestones(owner, repo, pickQuery(args, ['state', 'limit', 'page'])))
      }
      if (action === 'create') {
        return wrap(await client.createMilestone(owner, repo, {
          title: args.title,
          description: args.description,
          due_on: args.due_on,
        }))
      }
      if (action === 'update') {
        return wrap(await client.updateMilestone(owner, repo, asNumber(args.milestone_id), {
          title: args.title, state: args.state, due_on: args.due_on,
        }))
      }
      if (action === 'delete') {
        if (args.confirm !== true) return { ok: false, error: 'Deleting a milestone requires confirm: true (boolean).' }
        return wrap(await client.deleteMilestone(owner, repo, asNumber(args.milestone_id)))
      }
      return { ok: false, error: `unknown action: ${action}` }
    }

    // ---- 3. gitea_releases ----
    case 'gitea_releases': {
      const action = args.action || 'list'
      if (action === 'list') {
        return wrap(await client.listReleases(owner, repo, pickQuery(args, ['limit', 'page'])))
      }
      if (action === 'create') {
        return wrap(await client.createRelease(owner, repo, {
          tag_name: args.tag_name,
          name: args.name,
          body: args.body,
        }))
      }
      if (action === 'update') {
        return wrap(await client.updateRelease(owner, repo, asNumber(args.release_id), { name: args.name, body: args.body }))
      }
      if (action === 'delete') {
        if (args.confirm !== true) {
          return { ok: false, error: 'Deleting a release requires confirm: true (boolean).' }
        }
        return wrap(await client.deleteRelease(owner, repo, asNumber(args.release_id)))
      }
      if (action === 'plan') {
        const { planReleaseNow } = await import('./release-now.js')
        return planReleaseNow({ owner, repo }, deps)
      }
      if (action === 'notes') {
        const { buildReleaseNotes } = await import('./release-notes.js')
        return buildReleaseNotes({ owner, repo, fromTag: args.fromTag, toTag: args.toTag }, { client })
      }
      return { ok: false, error: `unknown action: ${action}` }
    }

    // ---- 4. gitea_ci ----
    case 'gitea_ci': {
      const action = args.action || 'status'
      if (action === 'status') {
        return wrap(await client.listActionsRuns(owner, repo, pickQuery(args, ['branch', 'sha', 'limit', 'page'])))
      }
      if (action === 'jobs') {
        return wrap(await client.listRunJobs(owner, repo, asNumber(args.run_id), {}))
      }
      if (action === 'run') {
        return wrap(await client.getActionsRun(owner, repo, asNumber(args.run_id)))
      }
      if (action === 'logs') {
        return wrap(await client.getJobLogs(owner, repo, asNumber(args.job_id)))
      }
      if (action === 'rerun') {
        if (args.confirm !== true) return { ok: false, error: 'Rerunning a job requires confirm: true (boolean).' }
        return wrap(await client.rerunActionsJob(owner, repo, asNumber(args.job_id)))
      }
      if (action === 'explain') {
        const { explainFailedJob } = await import('./ci-explainer.js')
        return { ok: true, data: explainFailedJob(args.job || {}) }
      }
      return { ok: false, error: `unknown action: ${action}` }
    }

    // ---- 5. gitea_branches ----
    case 'gitea_branches': {
      const action = args.action || 'list'
      if (action === 'list') {
        return wrap(await client.listBranches(owner, repo, pickQuery(args, ['limit', 'page'])))
      }
      if (action === 'create') {
        return wrap(await client.createBranch(owner, repo, { branch_name: args.branch_name, ref: args.ref || 'main' }))
      }
      if (action === 'delete') {
        if (args.confirm !== true) return { ok: false, error: 'Deleting a branch requires confirm: true (boolean).' }
        return wrap(await client.deleteBranch(owner, repo, args.branch))
      }
      return { ok: false, error: `unknown action: ${action}` }
    }

    // ---- 6. gitea_tags ----
    case 'gitea_tags': {
      const action = args.action || 'list'
      if (action === 'list') {
        return wrap(await client.listTags(owner, repo, pickQuery(args, ['limit', 'page'])))
      }
      if (action === 'create') {
        return wrap(await client.createTag(owner, repo, { tag_name: args.tag_name, target: args.target || 'main' }))
      }
      if (action === 'delete') {
        if (args.confirm !== true) return { ok: false, error: 'Deleting a tag requires confirm: true (boolean).' }
        return wrap(await client.deleteTag(owner, repo, args.tag))
      }
      return { ok: false, error: `unknown action: ${action}` }
    }

    // ---- 7. gitea_webhooks ----
    case 'gitea_webhooks': {
      const action = args.action || 'list'
      if (action === 'list') {
        return wrap(await client.listWebhooks(owner, repo))
      }
      if (action === 'create') {
        return wrap(await client.createWebhook(owner, repo, { type: args.type || 'gitea', config: { url: args.url }, events: args.events }))
      }
      if (action === 'delete') {
        if (args.confirm !== true) return { ok: false, error: 'Deleting a webhook requires confirm: true (boolean).' }
        return wrap(await client.deleteWebhook(owner, repo, asNumber(args.hook_id)))
      }
      return { ok: false, error: `unknown action: ${action}` }
    }

    // ---- 8. gitea_org ----
    case 'gitea_org': {
      const action = args.action || 'list'
      if (action === 'list') {
        return wrap(await client.listUserOrgs())
      }
      if (action === 'repos') {
        return wrap(await client.listOrgRepos(args.org, pickQuery(args, ['limit', 'page'])))
      }
      if (action === 'members') {
        return wrap(await client.listOrgMembers(args.org, pickQuery(args, ['limit', 'page'])))
      }
      if (action === 'teams') {
        return wrap(await client.listOrgTeams(args.org))
      }
      if (action === 'create_repo') {
        return wrap(await client.createOrgRepo(args.org, { name: args.name, description: args.description, private: args.private !== false }))
      }
      return { ok: false, error: `unknown action: ${action}` }
    }

    // ---- 9. gitea_wiki ----
    case 'gitea_wiki': {
      const action = args.action || 'list'
      if (action === 'list') {
        return wrap(await client.listWikiPages(owner, repo, pickQuery(args, ['limit', 'page'])))
      }
      if (action === 'get') {
        return wrap(await client.getWikiPage(owner, repo, args.pageName))
      }
      return { ok: false, error: `unknown action: ${action}` }
    }

    case 'gitea_issue_create':
      return wrap(await client.createIssue(owner, repo, {
        title: args.title,
        body: args.body,
      }))
    case 'gitea_issue_list':
      return wrap(await client.listIssues(owner, repo, pickQuery(args, ['state', 'limit', 'page'])))
    case 'gitea_issue_get': {
      const issue = await client.getIssue(owner, repo, asNumber(args.number))
      if (!issue?.ok) return issue
      if (args.include_comments || args.comments) {
        const comments = await client.listIssueComments(owner, repo, asNumber(args.number), pickQuery(args, ['limit', 'page']))
        if (comments?.ok) {
          await annotateCommentsWithMine(comments.data, client)
          issue.data.comments = comments.data || []
        }
      }
      return wrap(issue)
    }
    case 'gitea_issue_comments':
    case 'gitea_issue_get_comments': {
      const res = await client.listIssueComments(owner, repo, asNumber(args.number), pickQuery(args, ['limit', 'page']))
      if (res?.ok && Array.isArray(res.data)) {
        await annotateCommentsWithMine(res.data, client)
      }
      return wrap(res)
    }
    case 'gitea_issue_comment':
      return wrap(await client.commentIssue(owner, repo, asNumber(args.number), args.body))
    case 'gitea_issue_comment_update':
      return wrap(await client.updateIssueComment(owner, repo, asNumber(args.id || args.comment_id), args.body))
    case 'gitea_issue_comment_delete': {
      const commentId = asNumber(args.comment_id || args.id)
      if (!commentId) {
        return { ok: false, error: 'comment_id is required and must be a number.' }
      }
      const commentRes = await client.getIssueComment(owner, repo, commentId)
      if (!commentRes?.ok) {
        return wrap(commentRes)
      }
      const comment = commentRes.data || {}
      const author = comment.user?.login || comment.user?.username || comment.user_login || comment.login || ''

      let meLogin = ''
      try {
        const meRes = await client.getUser()
        if (meRes?.ok && meRes.data?.login) {
          meLogin = meRes.data.login
        }
      } catch (err) {
        return { ok: false, error: `Failed to fetch authenticated user: ${err?.message || String(err)}` }
      }

      if (!meLogin) {
        return { ok: false, error: 'Could not determine authenticated user for permission verification.' }
      }

      if (String(author).toLowerCase() !== String(meLogin).toLowerCase()) {
        return {
          ok: false,
          error: `Refusing to delete comment #${commentId} by '${author || 'unknown'}': only comments authored by the authenticated user ('${meLogin}') can be deleted.`,
        }
      }

      const preview = String(comment.body || '').slice(0, 80)
      const createdAt = comment.created_at || ''

      if (!args.confirm) {
        return {
          ok: true,
          data: {
            dryRun: true,
            message: 'Dry-run: pass confirm: true to permanently delete this comment.',
            commentId,
            owner,
            repo,
            author,
            createdAt,
            preview,
          },
        }
      }

      const delRes = await client.deleteIssueComment(owner, repo, commentId)
      if (!delRes?.ok) {
        return wrap(delRes)
      }
      return {
        ok: true,
        data: {
          deleted: true,
          commentId,
          owner,
          repo,
          author,
          createdAt,
          preview,
        },
      }
    }
    case 'gitea_issue_close':
      return wrap(await client.closeIssue(owner, repo, asNumber(args.number)))
    case 'gitea_issue_update':
      return wrap(await client.updateIssue(owner, repo, asNumber(args.number), {
        title: args.title,
        body: args.body,
        state: args.state,
      }))
    case 'gitea_issue_search':
      return wrap(await client.searchIssues(pickQuery(args, ['q', 'repo', 'state', 'limit', 'page', 'type', 'labels'])))
    case 'gitea_issue_set_assignee':
      return wrap(await client.setIssueAssignee(owner, repo, asNumber(args.number), args.assignee))
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
    case 'gitea_issue_timeline':
      return wrap(await client.getIssueTimeline(owner, repo, asNumber(args.number), pickQuery(args, ['since', 'before', 'limit', 'page'])))
    case 'gitea_reactions': {
      const action = args.action || 'list'
      const target = args.target || (args.comment_id != null ? 'comment' : 'issue')
      if (target === 'comment') {
        const cid = asNumber(args.comment_id || args.id)
        if (action === 'list') {
          return wrap(await client.listCommentReactions(owner, repo, cid, pickQuery(args, ['limit', 'page'])))
        }
        if (action === 'add') {
          return wrap(await client.addCommentReaction(owner, repo, cid, args.content))
        }
        if (action === 'delete') {
          return wrap(await client.deleteCommentReaction(owner, repo, cid, args.content))
        }
      } else {
        const num = asNumber(args.number || args.issue)
        if (action === 'list') {
          return wrap(await client.listIssueReactions(owner, repo, num, pickQuery(args, ['limit', 'page'])))
        }
        if (action === 'add') {
          return wrap(await client.addIssueReaction(owner, repo, num, args.content))
        }
        if (action === 'delete') {
          return wrap(await client.deleteIssueReaction(owner, repo, num, args.content))
        }
      }
      return { ok: false, error: `unknown action: ${action}` }
    }
    case 'gitea_pr_comment':
      return wrap(await client.commentIssue(owner, repo, asNumber(args.number), args.body))
    case 'gitea_pr_merge': {
      const guard = guardMerge(args)
      if (!guard.ok) return { ok: false, error: guard.error }
      const Do = ['merge', 'rebase', 'squash'].includes(args.Do) ? args.Do : 'merge'
      return wrap(await client.mergePull(owner, repo, asNumber(args.number), { Do }))
    }
    case 'gitea_pr_files':
      return wrap(await client.listPullFiles(owner, repo, asNumber(args.number), pickQuery(args, ['limit', 'page'])))
    case 'gitea_pr_reviews':
      return wrap(await client.listPullReviews(owner, repo, asNumber(args.number), pickQuery(args, ['limit', 'page'])))
    case 'gitea_pr_submit_review':
      return wrap(await client.submitPullReview(owner, repo, asNumber(args.number), {
        event: args.event,
        body: args.body,
      }))
    case 'gitea_pr_line_comment':
      return wrap(await client.createPullComment(owner, repo, asNumber(args.number), {
        body: args.body,
        path: args.path,
        line: args.line ? asNumber(args.line) : undefined,
      }))
    case 'gitea_pr_merge_status':
      return wrap(await client.getPullMergeStatus(owner, repo, asNumber(args.number)))
    case 'gitea_code_search':
      return wrap(await client.searchCode(owner, repo, pickQuery(args, ['q', 'branch', 'limit'])))
    case 'gitea_repo_search':
      return wrap(await client.searchRepos(pickQuery(args, ['q', 'limit'])))
    case 'gitea_repo_contents':
      return wrap(await client.getContents(owner, repo, args.path, pickQuery(args, ['ref'])))
    case 'gitea_repo_commits':
      return wrap(await client.listCommits(owner, repo, pickQuery(args, ['sha', 'limit', 'page'])))
    case 'gitea_repo_compare':
      return wrap(await client.compareCommits(owner, repo, args.range))
    case 'gitea_notifications':
      return wrap(await client.listNotifications(pickQuery(args, ['status', 'limit', 'page'])))
    case 'gitea_notifications_mark_read': {
      if (args.confirm !== true) {
        return { ok: false, error: 'Marking notifications read requires confirm: true (boolean).' }
      }
      return wrap(await client.markNotificationsRead())
    }
    case 'gitea_user_search':
      return wrap(await client.searchUsers(pickQuery(args, ['q', 'limit'])))
    case 'gitea_project_health': {
      const { buildHealthReport } = await import('./project-health.js')
      return buildHealthReport({ owner, repo, staleDays: args.staleDays }, { client })
    }
    case 'gitea_review_escalate': {
      const { escalate } = await import('./review-escalation.js')
      return escalate({ owner, repo, staleDays: args.staleDays, confirm: args.confirm, dryRun: args.confirm !== true }, deps)
    }
    case 'gitea_review_inbox': {
      const { buildReviewInbox } = await import('./review-inbox.js')
      return buildReviewInbox({ owner, repo, user: args.user }, { client })
    }
    case 'gitea_repo_analytics': {
      const { buildAnalytics } = await import('./analytics.js')
      return buildAnalytics({ owner, repo }, { client })
    }
    case 'gitea_mirror_public': {
      const { prepareMirror } = await import('./mirror-public.js')
      return prepareMirror({ source: args.source, target: args.target }, {})
    }
    case 'gitea_auto_merge': {
      const { autoMergeIfReady } = await import('./merge-gate.js')
      return autoMergeIfReady({ owner, repo, number: asNumber(args.number), confirm: args.confirm === true }, { client })
    }
    case 'gitea_pr_rebase': {
      const { planRebase, runRebase } = await import('./pr-rebase.js')
      if (args.confirm === true) {
        return runRebase({ owner, repo, number: asNumber(args.number), branch: args.branch, confirm: true }, deps)
      }
      return planRebase({ owner, repo, number: asNumber(args.number) }, deps)
    }
    case 'gitea_pr_review': {
      const { buildPrReview } = await import('./pr-review.js')
      return buildPrReview({ owner, repo, number: asNumber(args.number) }, { client })
    }
    case 'gitea_pr_summary': {
      const { buildPrSummary } = await import('./pr-summary.js')
      return buildPrSummary({ owner, repo, number: args.number }, { client })
    }
    case 'gitea_issue_duplicates': {
      const { findDuplicates } = await import('./dup-detect.js')
      return findDuplicates({ owner, repo, title: args.title, body: args.body, threshold: args.threshold }, { client })
    }
    case 'gitea_batch_issue_ops': {
      const { planBatch, applyBatch } = await import('./batch-ops.js')
      if (args.apply === true) {
        return applyBatch({ owner, repo, numbers: args.numbers, label: args.label, assignee: args.assignee }, { client })
      }
      return planBatch({ owner, repo, numbers: args.numbers, label: args.label, assignee: args.assignee }, { client })
    }
    case 'gitea_merge_readiness': {
      const { checkMergeReadiness } = await import('./merge-gate.js')
      return checkMergeReadiness({ owner, repo, number: args.number }, { client })
    }
    case 'gitea_triage_digest': {
      const { buildTriageDigest } = await import('./triage-digest.js')
      return buildTriageDigest({ owner, repo, staleDays: args.staleDays }, { client })
    }
    case 'gitea_pr_impact': {
      const { buildImpactMap } = await import('./impact-map.js')
      return buildImpactMap({ owner, repo, number: args.number }, { client })
    }
    case 'gitea_label_bootstrap': {
      const { buildLabelPlan, applyLabelPlan } = await import('./label-bootstrap.js')
      if (args.apply === true) return applyLabelPlan({ owner, repo }, { client })
      return buildLabelPlan({ owner, repo }, { client })
    }
    case 'gitea_pr_template_check': {
      const { checkPrTemplate, needsRiskChecklist } = await import('./pr-templates.js')
      const bodyCheck = checkPrTemplate(args.body)
      return { ok: true, data: { template: bodyCheck, riskChecklistNeeded: needsRiskChecklist(args.labels || []) } }
    }
    case 'gitea_issue_flow': {
      const { planIssueFlow, createFlowPr } = await import('./issue-flow.js')
      if (args.action === 'plan') return planIssueFlow({ issue: args.issue, title: args.title, type: args.type })
      if (args.action === 'create') return createFlowPr({ owner, repo, head: args.head, base: args.base, issue: args.issue, title: args.title }, { client })
      return { ok: false, error: `unknown action: ${args.action}` }
    }
    case 'gitea_repo_bootstrap': {
      const { planBootstrap, applyBootstrap } = await import('./repo-bootstrap.js')
      if (args.apply === true) return applyBootstrap({ name: args.name, description: args.description, private: args.private }, { client })
      return planBootstrap({ name: args.name, description: args.description, private: args.private })
    }
    case 'gitea_duty_report': {
      const { buildDutyReport } = await import('./duty-officer.js')
      return buildDutyReport({ owner, repo, lastCheckAt: args.lastCheckAt, staleDays: args.staleDays }, { client })
    }
    case 'gitea_label_auto': {
      const { applyLabelRules } = await import('./label-auto.js')
      return applyLabelRules({ owner, repo, number: args.number }, { client })
    }
    case 'gitea_scheduled_checks': {
      const { addJob, listJobs, runJob } = await import('./scheduler.js')
      if (args.action === 'list') {
        return { ok: true, data: { jobs: listJobs(schedulerStore) } }
      }
      if (args.action === 'add') {
        const r = addJob(schedulerStore, { name: args.name, schedule: args.schedule, owner, repo, action: args.checkType || 'health', dryRun: args.dryRun !== false })
        return r
      }
      if (args.action === 'run') {
        const job = schedulerStore.jobs.get(String(args.name || ''))
        if (!job) return { ok: false, error: `job not found: ${args.name}` }
        const executor = job.action === 'triage'
          ? async () => (await import('./triage-digest.js')).buildTriageDigest({ owner: job.owner, repo: job.repo }, { client })
          : job.action === 'inbox'
            ? async () => (await import('./review-inbox.js')).buildReviewInbox({ owner: job.owner, repo: job.repo, user: '' }, { client })
            : async () => (await import('./project-health.js')).buildHealthReport({ owner: job.owner, repo: job.repo }, { client })
        return runJob(job, executor)
      }
      return { ok: false, error: `unknown action: ${args.action}` }
    }
    case 'gitea_pr_policy': {
      const { parsePolicy, validatePolicy, evaluatePolicy } = await import('./policy-code.js')
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
      return { ok: false, error: `Unknown tool: ${name}` }
  }
}

export function formatToolResult(name, value) {
  if (!value?.ok) {
    const err = value?.error || 'unknown error'
    return [{ type: 'text', text: `${name} failed: ${err}` }]
  }

  const data = value.data
  if (data && typeof data === 'object') {
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
    if (name === 'gitea_pr_diff') {
      if (data.stat) {
        return [{ type: 'text', text: `PR #${data.number}: ${data.filesCount} files changed (+${data.additions}, -${data.deletions})` }]
      }
      return [{ type: 'text', text: data.diff || 'Empty diff' }]
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
      const summary = data.map((ev) => `[${ev.type || 'event'}] by ${ev.user?.login || 'system'}: ${ev.body || ev.comment?.body || ''}`.trim()).join('\n')
      return [{ type: 'text', text: summary }]
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
    if (data.number != null) {
      const title = data.title ? ` "${data.title}"` : ''
      return [{ type: 'text', text: `#${data.number}${title}` }]
    }
    if (data.merged) {
      return [{ type: 'text', text: 'Pull request merged.' }]
    }
  }

  return [{ type: 'text', text: 'OK' }]
}
