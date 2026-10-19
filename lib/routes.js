import { credentialRefStatus } from './secrets.js'
import { isTrustedWriteRequest, rejectUntrustedRequest, rejectUntrustedWrite } from './http-guard.js'
import { buildGitSnapshot, isGitDir, SNAPSHOT_CACHE_TTL_MS, clearSnapshotCache } from './git-local.js'
import { selectChipRepoDir } from './session-git.js'
import { GiteaClient } from './gitea-client.js'

export function writeJson(res, code, body) {
  try {
    res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
    res.end(JSON.stringify(body))
  } catch { /* socket closed */ }
}

export function readBody(req, maxBytes = 256 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    req.on('data', (c) => {
      size += c.length
      if (size > maxBytes) { reject(new Error('body too large')); req.destroy(); return }
      chunks.push(c)
    })
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

export function registerHttpRoutes(ctx, options) {
  const {
    parseConfig,
    live,
    getSettingsScope,
    resolveToken,
    eventsStore,
    giteaEventsService,
    pinGitFromSessionLog,
    execFile,
  } = options

  const getService = (c, name) => (c && typeof c.get === 'function' ? c.get(name) : (c && c[name]))

  const tokenConfigured = options.tokenConfigured || (async (tokenEnv) => {
    try {
      const val = await resolveToken(tokenEnv)
      return !!val
    } catch { return false }
  })

  const resolveConnection = options.resolveConnection || (() => {
    try {
      if (ctx && typeof ctx.get === 'function') {
        return ctx.get('connection')
      }
    } catch { /* ignore */ }
    try {
      if (ctx && ctx.connection) {
        return ctx.connection
      }
    } catch { /* ignore */ }
    return undefined
  })

  const routeOptions = () => ({
    get connection() {
      return options.connection || resolveConnection()
    },
  })


  async function configResponse() {
    const cfg = { ...live() }
    delete cfg.webhookSecret
    const status = credentialRefStatus(cfg.tokenEnv)
    return {
      ok: true,
      config: cfg,
      tokenConfigured: await tokenConfigured(cfg.tokenEnv),
      tokenEnvError: status.ok ? '' : status.error,
    }
  }

  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: '/dsh-gitea/config',
    handler: async (req, res) => {
      if (req.method === 'GET') {
        if (rejectUntrustedRequest(req, res, routeOptions())) return
        writeJson(res, 200, await configResponse())
        return
      }
      if (req.method !== 'POST') {
        writeJson(res, 405, { ok: false, error: { code: 'method', message: 'GET or POST' } })
        return
      }
      if (rejectUntrustedWrite(req, res, routeOptions())) return
      const settingsScope = getSettingsScope()
      if (!settingsScope) {
        writeJson(res, 503, { ok: false, error: { code: 'settings', message: 'settings not ready' } })
        return
      }
      let raw
      try { raw = await readBody(req) } catch (e) {
        writeJson(res, 400, { ok: false, error: { code: 'body', message: e.message } })
        return
      }
      let payload
      try { payload = JSON.parse(raw.toString('utf8') || '{}') } catch {
        writeJson(res, 400, { ok: false, error: { code: 'json', message: 'invalid json' } })
        return
      }
      if (payload && typeof payload.config === 'object') payload = payload.config
      const rawCurrent = (typeof getSettingsScope === 'function' && getSettingsScope()?.get?.()) || live() || {}
      const current = live()
      const merged = { ...current, ...payload }
      // #314 & #331: Preserve existing webhookSecret in settings document when UI form submits without it
      if (rawCurrent && ('webhookSecret' in rawCurrent) && !('webhookSecret' in payload)) {
        merged.webhookSecret = rawCurrent.webhookSecret
      } else if (payload && ('webhookSecret' in payload)) {
        merged.webhookSecret = payload.webhookSecret
      }
      let parsed
      try { parsed = parseConfig(merged) } catch (e) {
        writeJson(res, 400, { ok: false, error: { code: 'schema', message: String(e?.message || e) } })
        return
      }
      const cred = credentialRefStatus(parsed.tokenEnv)
      if (!cred.ok) {
        writeJson(res, 400, { ok: false, error: { code: 'tokenEnv', message: cred.error } })
        return
      }
      try {
        await settingsScope.update(parsed)
        writeJson(res, 200, await configResponse())
      } catch (e) {
        writeJson(res, 500, { ok: false, error: { code: 'save', message: String(e?.message || e) } })
      }
    },
  }), 'dsh-gitea: /config')

  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: '/dsh-gitea/webhook',
    handler: async (req, res) => {
      if (req.method !== 'POST') {
        writeJson(res, 405, { ok: false, error: { code: 'method', message: 'POST' } })
        return
      }
      try {
        const raw = await readBody(req, 1024 * 1024)
        const bodyText = raw.toString('utf8')
        const { verifySignature } = await import('./webhook-signature.js')
        const cfg = live()
        const secretEnv = cfg.webhookSecretEnv || ''
        if (!secretEnv) {
          writeJson(res, 401, { ok: false, error: { code: 'signature', message: 'webhook secret not configured' } })
          return
        }
        const secret = await resolveToken(secretEnv)
        if (!secret) {
          writeJson(res, 401, { ok: false, error: { code: 'signature', message: 'webhook secret not configured' } })
          return
        }
        const signature = String(req.headers['x-gitea-signature'] || req.headers['x-hub-signature-256'] || '')
          .replace(/^sha256=/, '')
        if (!verifySignature(secret, bodyText, signature)) {
          writeJson(res, 401, { ok: false, error: { code: 'signature', message: 'invalid webhook signature' } })
          return
        }
        const payload = JSON.parse(bodyText || '{}')
        const event = String(req.headers['x-gitea-event'] || req.headers['x-github-event'] || '')
        const action = String(payload.action || '')
        const ev = eventsStore.fromWebhook({ event, action, payload })
        eventsStore.push(ev)
        try {
          giteaEventsService.emit({ event, action, payload, ev })
        } catch { /* isolated */ }
        // push notifications for critical events (new PR / failed CI)
        try {
          const { pushNotify } = await import('./push-notify.js')
          await pushNotify(ev, { webhookUrl: live().notifyWebhook })
        } catch { /* notification failure must not fail webhook */ }
        writeJson(res, 200, { ok: true, event: ev.type })
      } catch (e) {
        writeJson(res, 400, { ok: false, error: { code: 'webhook', message: String(e?.message || e) } })
      }
    },
  }), 'dsh-gitea: /webhook')

  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: '/dsh-gitea/events',
    handler: async (req, res) => {
      if (req.method !== 'GET') {
        writeJson(res, 405, { ok: false, error: { code: 'method', message: 'GET' } })
        return
      }
      if (rejectUntrustedRequest(req, res, routeOptions())) return
      writeJson(res, 200, { ok: true, data: eventsStore.list() })
    },
  }), 'dsh-gitea: /events')

  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: '/dsh-gitea/git-status',
    handler: async (req, res) => {
      if (req.method !== 'GET') {
        writeJson(res, 405, { ok: false, error: { code: 'method', message: 'GET' } })
        return
      }
      if (rejectUntrustedRequest(req, res, routeOptions())) return
      let cwd = ''
      let sessionId = ''
      let refresh = false
      try {
        const parsedUrl = new URL(req.url, 'http://dsh.local')
        cwd = parsedUrl.searchParams.get('cwd') || ''
        sessionId = parsedUrl.searchParams.get('sessionId') || ''
        refresh = parsedUrl.searchParams.get('refresh') === '1' || parsedUrl.searchParams.get('fresh') === '1'
      } catch { /* ignore malformed url */ }
      const repoDir = await selectChipRepoDir(
        { cwd, sessionId },
        (dir) => isGitDir(dir, execFile),
        pinGitFromSessionLog,
      )
      if (refresh) clearSnapshotCache(repoDir)
      const snap = await buildGitSnapshot({ repoDir, execFile, maxAgeMs: refresh ? 0 : SNAPSHOT_CACHE_TTL_MS })
      // enrich chip with PR/CI status (if Gitea configured)
      try {
        const cfg = live()
        const token = await resolveToken(cfg.tokenEnv)
        if (cfg.baseUrl && token && snap?.ok && snap.repoName) {
          const client2 = new GiteaClient({ baseUrl: cfg.baseUrl, token, timeoutMs: cfg.timeoutMs })
          const { enrichChip } = await import('./chip-pr-ci.js')
          const enriched = await enrichChip({
            branch: snap.branch,
            headSha: snap.head || '',
            owner: cfg.defaultOwner || '',
            repo: snap.repoName,
          }, { client: client2 })
          if (enriched.ok) snap.pr = enriched.data
        }
      } catch { /* chip must never fail due to enrichment */ }
      writeJson(res, 200, snap)
    },
  }), 'dsh-gitea: /git-status')

  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: '/dsh-gitea/git-graph',
    handler: async (req, res) => {
      if (req.method !== 'GET') {
        writeJson(res, 405, { ok: false, error: { code: 'method', message: 'GET' } })
        return
      }
      if (rejectUntrustedRequest(req, res, routeOptions())) return
      let cwd = ''
      let sessionId = ''
      let limit = 100
      let skip = 0
      try {
        const parsedUrl = new URL(req.url, 'http://dsh.local')
        cwd = parsedUrl.searchParams.get('cwd') || ''
        sessionId = parsedUrl.searchParams.get('sessionId') || ''
        limit = parseInt(parsedUrl.searchParams.get('limit') || '100', 10) || 100
        skip = parseInt(parsedUrl.searchParams.get('skip') || parsedUrl.searchParams.get('offset') || '0', 10) || 0
      } catch { /* ignore malformed url */ }
      const repoDir = await selectChipRepoDir(
        { cwd, sessionId },
        (dir) => isGitDir(dir, execFile),
        pinGitFromSessionLog,
      )
      if (!repoDir) {
        writeJson(res, 200, { ok: false, error: 'Not a git repository' })
        return
      }
      const { fetchCommitGraph } = await import('./graph.js')
      const graphRes = await fetchCommitGraph({ gitWrapper: 'git', cwd: repoDir, limit, skip, execFile })
      if (graphRes.ok && Array.isArray(graphRes.data?.commits)) {
        try {
          const cfg = live()
          const token = await resolveToken(cfg.tokenEnv)
          const snap = await buildGitSnapshot({ repoDir, execFile })
          if (cfg.baseUrl && token && snap?.repoName) {
            const client2 = new GiteaClient({ baseUrl: cfg.baseUrl, token, timeoutMs: cfg.timeoutMs })
            const owner = cfg.defaultOwner || ''
            const repo = snap.repoName
            const checkCount = Math.min(15, graphRes.data.commits.length)
            await Promise.allSettled(
              graphRes.data.commits.slice(0, checkCount).map(async (commit) => {
                try {
                  const st = await client2.getCombinedCommitStatus(owner, repo, commit.oid)
                  if (st?.ok && st.data?.state) {
                    commit.ciStatus = st.data.state
                  }
                } catch { /* ignore commit status failure */ }
              })
            )
            graphRes.data.baseUrl = cfg.baseUrl
            graphRes.data.owner = owner
            graphRes.data.repo = repo
          }
        } catch { /* ignore Gitea enrichment failures */ }
      }
      writeJson(res, 200, graphRes)
    },
  }), 'dsh-gitea: /git-graph')
  // #255: Server-Sent Events (SSE) streaming endpoint
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: '/dsh-gitea/sse',
    handler: async (req, res) => {
      if (req.method !== 'GET') {
        writeJson(res, 405, { ok: false, error: { code: 'method', message: 'GET' } })
        return
      }
      if (rejectUntrustedRequest(req, res, routeOptions())) return

      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      })
      res.write(': connected\n\n')
      res.write(`event: ready\ndata: ${JSON.stringify({ ok: true, timestamp: Date.now() })}\n\n`)

      let unsubscribe = null
      if (giteaEventsService && typeof giteaEventsService.subscribe === 'function') {
        unsubscribe = giteaEventsService.subscribe((safeEv) => {
          try {
            res.write(`event: gitea-event\ndata: ${JSON.stringify(safeEv)}\n\n`)
          } catch {
            if (unsubscribe) { unsubscribe(); unsubscribe = null }
          }
        })
      }

      const pingTimer = setInterval(() => {
        try {
          res.write(`event: ping\ndata: ${JSON.stringify({ time: Date.now() })}\n\n`)
        } catch {
          clearInterval(pingTimer)
          if (unsubscribe) { unsubscribe(); unsubscribe = null }
        }
      }, 20_000)

      req.on('close', () => {
        clearInterval(pingTimer)
        if (unsubscribe) { unsubscribe(); unsubscribe = null }
      })
    },
  }), 'dsh-gitea: /sse')

  // #255: One-Click Release Assistant endpoint
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: '/dsh-gitea/release-assistant',
    handler: async (req, res) => {
      if (rejectUntrustedRequest(req, res, routeOptions())) return
      const { runReleaseAssistant } = await import('./release-assistant.js')
      if (req.method === 'GET') {
        let targetVersion = ''
        try {
          const parsedUrl = new URL(req.url, 'http://dsh.local')
          targetVersion = parsedUrl.searchParams.get('targetVersion') || ''
        } catch { /* ignore */ }
        const result = await runReleaseAssistant({ action: 'preflight', targetVersion }, { execFile, cwd: process.cwd() })
        writeJson(res, 200, result)
        return
      }
      if (req.method === 'POST') {
        if (rejectUntrustedWrite(req, res, routeOptions())) return
        let raw
        try { raw = await readBody(req) } catch (e) {
          writeJson(res, 400, { ok: false, error: { code: 'body', message: e.message } })
          return
        }
        let payload
        try { payload = JSON.parse(raw.toString('utf8') || '{}') } catch {
          writeJson(res, 400, { ok: false, error: { code: 'json', message: 'invalid json' } })
          return
        }
        const result = await runReleaseAssistant(payload, { execFile, cwd: process.cwd() })
        writeJson(res, 200, result)
        return
      }
      writeJson(res, 405, { ok: false, error: { code: 'method', message: 'GET or POST' } })
    },
  }), 'dsh-gitea: /release-assistant')

  // #252: Gitea Hub endpoint (Assigned issues, Open PRs)
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: '/dsh-gitea/hub',
    handler: async (req, res) => {
      if (req.method !== 'GET' && req.method !== 'POST') {
        writeJson(res, 405, { ok: false, error: { code: 'method', message: 'GET or POST' } })
        return
      }
      if (req.method === 'POST') {
        if (rejectUntrustedWrite(req, res, routeOptions())) return
      } else {
        if (rejectUntrustedRequest(req, res, routeOptions())) return
      }
      const cfg = live()
      const token = await resolveToken(cfg.tokenEnv)
      if (!cfg.baseUrl || !token) {
        writeJson(res, 200, { ok: false, error: 'Gitea instance or credential not configured' })
        return
      }
      const client = options?.client || new GiteaClient({ baseUrl: cfg.baseUrl, token, timeoutMs: cfg.timeoutMs })

      if (req.method === 'POST') {
        let body = {}
        try {
          const raw = await readBody(req)
          body = JSON.parse(raw.toString('utf8'))
        } catch {
          writeJson(res, 400, { ok: false, error: 'Invalid JSON body' })
          return
        }
        const action = String(body.action || '').toLowerCase()
        const owner = body.owner || cfg.defaultOwner || ''
        const repo = body.repo || cfg.defaultRepo || ''
        const number = Number(body.number)
        try {
          let result = null
          if (action === 'approve') {
            result = await client.submitPullReview(owner, repo, number, { event: 'APPROVED', body: 'Approved via Gitea Hub' })
          } else if (action === 'merge') {
            result = await client.mergePull(owner, repo, number, { Do: 'merge' })
          } else if (action === 'close') {
            if (body.type === 'pr') {
              result = await client.editPull(owner, repo, number, { state: 'closed' })
            } else {
              result = await client.closeIssue(owner, repo, number)
            }
          } else if (action === 'switch' || action === 'use') {
            const { runWorktreeAction } = await import('./git-local.js')
            result = await runWorktreeAction('use', { worktreePath: body.path, repoCwd: process.cwd() }, { execFile: ctx?.execFile || execFile, gitWrapper: cfg.gitWrapper })
          } else if (action === 'clean' || action === 'gc') {
            const { runWorktreeGc } = await import('./worktree-gc.js')
            result = await runWorktreeGc({ confirm: true }, { cwd: process.cwd(), execFile: ctx?.execFile || execFile, gitWrapper: cfg.gitWrapper })
          } else if (action === 'ci-analyze' || action === 'explain-ci') {
            const { runCiLogsAnalyze } = await import('./ci-explainer.js')
            result = await runCiLogsAnalyze({
              owner,
              repo,
              run_id: body.run_id || body.runId,
              job_id: body.job_id || body.jobId,
              pr_number: number || body.pr_number || body.prNumber,
            }, { client, settings: cfg })
          } else if (action === 'worktree-open' || action === 'open-worktree') {
            const targetNum = number || body.issue_number
            const branchName = body.branch || (targetNum ? `feat/issue-${targetNum}` : 'feat/patch')
            const wtPath = body.path || `.worktrees/issue-${targetNum || Date.now()}`
            const { runWorktreeAction } = await import('./git-local.js')
            result = await runWorktreeAction('add', {
              worktreePath: wtPath,
              createBranch: branchName,
              repoCwd: body.cwd || process.cwd(),
            }, { execFile: ctx?.execFile || execFile, gitWrapper: cfg.gitWrapper, settings: cfg })
            if (!result?.ok && String(result?.error || '').includes('already exists')) {
              result = await runWorktreeAction('use', {
                worktreePath: wtPath,
                repoCwd: body.cwd || process.cwd(),
              }, { execFile: ctx?.execFile || execFile, gitWrapper: cfg.gitWrapper, settings: cfg })
            }
          } else if (action === 'assign-me' || action === 'assign') {
            const whoRes = await (client.getCurrentUser ? client.getCurrentUser() : (client.getUser ? client.getUser() : Promise.resolve(null))).catch(() => null)
            const username = whoRes?.data?.login || whoRes?.data?.username || cfg.defaultOwner
            if (!username) {
              writeJson(res, 200, { ok: false, error: 'Cannot determine current username to assign' })
              return
            }
            result = await client.setIssueAssignee(owner, repo, number, username)
            if (result?.ok) {
              result.data = { ...(result.data || {}), assignee: username }
            }
          } else if (action === 'branch-commit' || action === 'commit') {
            const { runGitCommit } = await import('./git-local.js')
            result = await runGitCommit({
              cwd: body.cwd || process.cwd(),
              message: body.message || 'chore: quick commit via Gitea card',
            }, { execFile: ctx?.execFile || execFile, gitWrapper: cfg.gitWrapper, settings: cfg })
          } else if (action === 'branch-push' || action === 'push') {
            const { runGitPush } = await import('./git-local.js')
            result = await runGitPush({
              cwd: body.cwd || process.cwd(),
              branch: body.branch,
            }, { execFile: ctx?.execFile || execFile, gitWrapper: cfg.gitWrapper, settings: cfg })
          } else if (action === 'stack-status' || action === 'pr-stack') {
            const { buildPullStack } = await import('./pr-stack.js')
            const pullsRes = await client.listPulls(owner, repo, { state: 'all', limit: 50 }).catch((e) => ({ ok: false, error: String(e) }))
            if (!pullsRes?.ok) {
              writeJson(res, 200, { ok: false, error: pullsRes?.error || 'Failed to fetch PRs' })
              return
            }
            result = buildPullStack(pullsRes.data || [], number || body.pr_number)
          } else if (action === 'stack-rebase') {
            const { executeStackRebase } = await import('./pr-stack.js')
            result = await executeStackRebase({
              owner,
              repo,
              pr_number: number || body.pr_number,
              target_base: body.target_base || body.targetBase,
              confirm: body.confirm !== false,
              force: Boolean(body.force),
            }, {
              client,
              settings: cfg,
              gitWrapper: cfg.gitWrapper,
              execFile: ctx?.execFile || execFile,
              cwd: body.cwd || process.cwd(),
            })
          } else {
            writeJson(res, 400, { ok: false, error: `Unsupported hub action: ${action}` })
            return
          }
          writeJson(res, 200, { ok: result?.ok ?? true, data: result?.data ?? null })
        } catch (err) {
          writeJson(res, 200, { ok: false, error: String(err?.message || err) })
        }
        return
      }

      const url = new URL(req.url, 'http://localhost')
      const owner = url.searchParams.get('owner') || cfg.defaultOwner || ''
      const repo = url.searchParams.get('repo') || cfg.defaultRepo || ''
      const assignee = url.searchParams.get('assignee') || undefined
      let issues = []
      let pulls = []
      let runners = []
      let worktrees = []
      try {
        if (owner && repo) {
          const issueQuery = { state: 'open', limit: 20 }
          if (assignee) issueQuery.assignee = assignee
          const [issuesRes, pullsRes, runnersRes, runsRes] = await Promise.allSettled([
            client.listIssues(owner, repo, issueQuery),
            client.listPulls(owner, repo, { state: 'open', limit: 20 }),
            client.listRunners(owner, repo),
            client.listActionsRuns(owner, repo, { limit: 20 }),
          ])
          if (issuesRes.status === 'fulfilled' && issuesRes.value?.ok) {
            issues = Array.isArray(issuesRes.value.data) ? issuesRes.value.data : []
          }
          if (pullsRes.status === 'fulfilled' && pullsRes.value?.ok) {
            pulls = Array.isArray(pullsRes.value.data) ? pullsRes.value.data : []
            const runs = (runsRes.status === 'fulfilled' && runsRes.value?.ok)
              ? (runsRes.value.data?.workflow_runs || [])
              : []
            for (const p of pulls) {
              const headSha = p.head?.sha
              if (headSha) {
                const matchRun = runs.find((r) => r.head_sha === headSha)
                if (matchRun) {
                  p.ciStatus = matchRun.conclusion || matchRun.status || null
                  p.runId = matchRun.id || null
                }
              }
            }
          }
          if (runnersRes.status === 'fulfilled' && runnersRes.value?.ok) {
            const rawRunners = runnersRes.value.data?.runners || runnersRes.value.data
            runners = Array.isArray(rawRunners) ? rawRunners : []
          }
        }
        try {
          const { runWorktreeAction } = await import('./git-local.js')
          const wtRes = await runWorktreeAction('list', { repoCwd: process.cwd() }, { execFile: ctx?.execFile, gitWrapper: cfg.gitWrapper })
          if (wtRes?.ok && Array.isArray(wtRes.data)) {
            worktrees = wtRes.data
          }
        } catch { /* ignore worktree discovery error */ }
      } catch (err) {
        writeJson(res, 200, { ok: false, error: String(err?.message || err) })
        return
      }
      writeJson(res, 200, { ok: true, data: { owner, repo, issues, pulls, runners, worktrees } })
    },
  }), 'dsh-gitea: /hub')
}
