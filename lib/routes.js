import { credentialRefStatus } from './secrets.js'
import { isTrustedWriteRequest } from './http-guard.js'
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
        writeJson(res, 200, await configResponse())
        return
      }
      if (req.method !== 'POST') {
        writeJson(res, 405, { ok: false, error: { code: 'method', message: 'GET or POST' } })
        return
      }
      if (!isTrustedWriteRequest(req)) {
        writeJson(res, 403, { ok: false, error: { code: 'forbidden', message: 'Forbidden: same-origin or local loopback only' } })
        return
      }
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
      const current = live()
      const merged = { ...current, ...payload }
      delete merged.webhookSecret
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
        const secret = secretEnv ? await resolveToken(secretEnv) : (cfg.webhookSecret || '')
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
      let cwd = ''
      let sessionId = ''
      let limit = 100
      try {
        const parsedUrl = new URL(req.url, 'http://dsh.local')
        cwd = parsedUrl.searchParams.get('cwd') || ''
        sessionId = parsedUrl.searchParams.get('sessionId') || ''
        limit = parseInt(parsedUrl.searchParams.get('limit') || '100', 10) || 100
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
      const graphRes = await fetchCommitGraph({ gitWrapper: 'git', cwd: repoDir, limit, execFile })
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
}
