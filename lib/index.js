import z from '@deepseek-ai/schemastery'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { credentialRef } from '@deepseek-ai/dsh-credentials'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { GiteaClient, normalizeBaseUrl } from './gitea-client.js'
import { createGiteaTaskService } from './task-service.js'
import { runHandler, formatToolResult } from './handlers.js'
import { stripSecretsFromConfig, credentialRefStatus } from './secrets.js'
import { buildGitSnapshot, isGitDir, SNAPSHOT_CACHE_TTL_MS, clearSnapshotCache } from './git-local.js'
import { EventStore } from './events-store.js'
import { BgScheduler } from './bg-scheduler.js'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { rememberSessionGitDirs, resolveSessionGitDir, sessionIdsFromExec, sessionCwdFromExec, repoCwdFromTool, candidateGitDirsFromExec, candidateGitDirsFromSessionJsonl, selectChipRepoDir } from './session-git.js'
import { addJob, listJobs, runJob } from './scheduler.js'
import { isTrustedWriteRequest } from './http-guard.js'

export const name = '@goodandready/dsh-gitea'
export const inject = ['tools', 'credentials', 'settings', 'webServer']

const NS = 'dsh-gitea'
const execFileAsync = promisify(execFile)


function writeJson(res, code, body) {
  try {
    res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
    res.end(JSON.stringify(body))
  } catch { /* socket closed */ }
}

function readBody(req, maxBytes = 256 * 1024) {
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

export const Config = z.object({
  baseUrl: z.string().default('')
    .description('Gitea or Forgejo instance URL, e.g. https://gitea.example.com'),
  tokenEnv: z.string().role('credential-ref').default('GITEA_TOKEN')
    .description('DSH credential name holding the API token.'),
  defaultOwner: z.string().default('')
    .description('Default repository owner when the tool omits owner/repo.'),
  defaultRepo: z.string().default('')
    .description('Default repository name when the tool omits owner/repo.'),
  gitWrapper: z.string().default('')
    .description('Git wrapper binary (e.g. git-deepseek-harness) used for write operations. Empty disables worktree add/remove.'),
  dodReminder: z.boolean().default(false)
    .description('DoD reminder: after a tool run that changed git files, remind if no issue/PR reference was made. Default off, never blocks.'),
  bgSchedulerEnabled: z.boolean().default(false)
    .description('Background scheduler: periodically runs triage/health and sends digest. Default off.'),
  bgSchedulerIntervalMin: z.number().default(60)
    .description('Background scheduler interval in minutes (default 60).'),
  bgSchedulerOwner: z.string().default('')
    .description('Owner for background triage (default from defaultOwner).'),
  bgSchedulerRepo: z.string().default('')
    .description('Repo for background triage (default from defaultRepo).'),
  bgSchedulerWebhook: z.string().default('')
    .description('Optional webhook URL to deliver the digest to (external channel). Empty = only in-memory events.'),
  notifyWebhook: z.string().default('')
    .description('Webhook URL for push notifications (new PR, failed CI). Empty disables push.'),
  forceHttpsUrls: z.boolean().default(false)
    .description('When DSH is served over HTTPS but Gitea answers with http:// links (reverse proxy), rewrite html_url to https. Default off.'),
  webhookSecretEnv: z.string().role('credential-ref').default('')
    .description('DSH credential name holding the secret for verifying X-Gitea-Signature on POST /dsh-gitea/webhook.'),
  webhookSecret: z.string().default('')
    .description('Deprecated: use webhookSecretEnv credential ref.'),
  instances: z.array(z.object({
    name: z.string(),
    baseUrl: z.string(),
    tokenEnv: z.string().role('credential-ref'),
  })).default([])
    .description('Additional Gitea instances: name, baseUrl, credential name. Tools accept instance param; default is primary (baseUrl/tokenEnv).'),
  timeoutMs: z.number().default(30000)
    .description('HTTP timeout in milliseconds.'),
})

const GITEA_RECORD = {
  type: 'object',
  additionalProperties: false,
  properties: {
    number: { type: 'number' },
    title: { type: 'string' },
    name: { type: 'string' },
    merged: { type: 'boolean' },
    state: { type: 'string' },
    id: { type: 'number' },
    body: { type: 'string' },
    html_url: { type: 'string' },
    full_name: { type: 'string' },
    created_at: { type: 'string' },
    updated_at: { type: 'string' },
    user_login: { type: 'string' },
    login: { type: 'string' },
    path: { type: 'string' },
    branch: { type: 'string' },
    dirty: { type: 'boolean' },
    head: { type: 'string' },
    current: { type: 'boolean' },
    repoDir: { type: 'string' },
  },
}

const OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: true,
  properties: {
    ok: { type: 'boolean' },
    error: { type: 'string' },
    data: { type: 'json' },
  },
}

import { TOOL_DEFS } from './tool-defs.js'


function parseConfig(raw) {
  return Config(stripSecretsFromConfig(raw ?? {}))
}

async function readGitOrigin(cwd = process.cwd()) {
  try {
    const { stdout } = await execFileAsync('git', ['remote', 'get-url', 'origin'], { cwd })
    return String(stdout || '').trim()
  } catch {
    return ''
  }
}

export function apply(ctx, config) {
  const getService = (c, name) => (c && typeof c.get === 'function' ? c.get(name) : (c && c[name]))

  const baseConfig = parseConfig(config)
  let getConfig = () => baseConfig
  const live = () => parseConfig(getConfig())
  let settingsScope

  ctx.inject(['settings'], (sctx) => {
    const settings = getService(sctx, 'settings') || sctx.settings
    const scope = settings.register(NS, Config, { base: baseConfig })
    settingsScope = scope
    getConfig = () => parseConfig(scope.get() ?? baseConfig)
    sctx.effect(() => () => {
      settingsScope = undefined
      getConfig = () => baseConfig
    })
  })

  async function tokenConfigured(tokenEnv) {
    const status = credentialRefStatus(tokenEnv)
    if (!status.ok) return false
    try {
      const creds = getService(ctx, 'credentials') || ctx.credentials
    if (creds && typeof creds.describe === 'function') {
        const described = await creds.describe(credentialRef(status.name))
        return !!(described && described.configured)
      }
      const resolved = await creds.resolve(credentialRef(status.name))
      return !!(resolved && resolved.value)
    } catch {
      return false
    }
  }

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

  // Receive Gitea webhook events (for notifications panel)
  const eventsStore = new EventStore(50)
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
      try {
        const url = new URL(req.url, 'http://dsh.local')
        cwd = url.searchParams.get('cwd') || ''
        sessionId = url.searchParams.get('sessionId') || ''
      } catch { cwd = ''; sessionId = '' }
      const repoDir = await selectChipRepoDir(
        { cwd, sessionId },
        (dir) => isGitDir(dir, execFileAsync),
        pinGitFromSessionLog,
      )
      const refresh = url.searchParams.get('refresh') === '1' || url.searchParams.get('fresh') === '1'
      if (refresh) clearSnapshotCache(repoDir)
      const snap = await buildGitSnapshot({ repoDir, execFile: execFileAsync, maxAgeMs: refresh ? 0 : SNAPSHOT_CACHE_TTL_MS })
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
        const url = new URL(req.url, 'http://dsh.local')
        cwd = url.searchParams.get('cwd') || ''
        sessionId = url.searchParams.get('sessionId') || ''
        limit = parseInt(url.searchParams.get('limit') || '100', 10) || 100
      } catch { cwd = ''; sessionId = '' }
      const repoDir = await selectChipRepoDir(
        { cwd, sessionId },
        (dir) => isGitDir(dir, execFileAsync),
        pinGitFromSessionLog,
      )
      if (!repoDir) {
        writeJson(res, 200, { ok: false, error: 'Not a git repository' })
        return
      }
      const { fetchCommitGraph } = await import('./graph.js')
      const graphRes = await fetchCommitGraph({ gitWrapper: 'git', cwd: repoDir, limit, execFile: execFileAsync })
      if (graphRes.ok && Array.isArray(graphRes.data?.commits)) {
        try {
          const cfg = live()
          const token = await resolveToken(cfg.tokenEnv)
          const snap = await buildGitSnapshot({ repoDir, execFile: execFileAsync })
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

  async function resolveToken(tokenEnv) {
    try {
      const resolved = await ctx.credentials.resolve(credentialRef(tokenEnv))
      if (resolved?.value) return resolved.value
    } catch { /* credential may be unset */ }
    return ''
  }

  const taskService = createGiteaTaskService({
    getConfig: live,
    resolveToken,
  })
  if (typeof ctx.provide === 'function') ctx.provide('dshGitea', taskService)

  async function makeDeps(remoteUrl, instanceName = '') {
    const cfg = live()
    const { resolveInstance } = await import('./instances.js')
    const inst = resolveInstance(cfg, instanceName)
    const tokenEnv = inst.ok ? inst.tokenEnv : cfg.tokenEnv
    const baseUrl = normalizeBaseUrl(inst.ok ? inst.baseUrl : cfg.baseUrl)
    const token = await resolveToken(tokenEnv)
    const client = new GiteaClient({
      baseUrl,
      token,
      timeoutMs: cfg.timeoutMs,
    })
    return {
      client,
      settings: cfg,
      remoteUrl,
      configured: { baseUrl, token },
      execFile: execFileAsync,
    }
  }

  for (const def of TOOL_DEFS) {
    ctx.tools.register(
      defineTool({
        name: def.name,
        description: def.description,
        parameters: def.parameters,
        output: {
          schema: OUTPUT_SCHEMA,
          render: (_args, value) => formatToolResult(def.name, value),
        },
        execute: async (args, exec) => {
          const sessionCwd = sessionCwdFromExec(exec)
          const cwd = repoCwdFromTool({ args, sessionCwd })
          const remoteUrl = cwd ? await readGitOrigin(cwd) : ''
          const deps = await makeDeps(remoteUrl, args.instance)
          deps.cwd = cwd
          deps.instance = args.instance || ''
          const result = await runHandler(def.name, args, deps)
          try { await pinGitFromExec({ ...exec, arguments: args }, result) } catch { /* never break a gitea tool */ }
          // #153: normalize schemes when DSH is on HTTPS and Gitea returns HTTP links
          if (live().forceHttpsUrls && result && typeof result === 'object') {
            try {
              const { normalizeExternalUrl } = await import('./url-safety.js')
              const visit = (node) => {
                if (!node || typeof node !== 'object') return node
                for (const key of Object.keys(node)) {
                  const v = node[key]
                  if (typeof v === 'string' && /^https?:\/\//i.test(v)) {
                    node[key] = normalizeExternalUrl(v, { baseUrl: deps.configured?.baseUrl || '', dshProtocol: 'https:' })
                  } else if (v && typeof v === 'object') {
                    visit(v)
                  }
                }
                return node
              }
              if (result.value && typeof result.value === 'object') visit(result.value)
              else visit(result)
            } catch { /* normalization must not break result */ }
          }
          return result
        },
      }),
    )
  }

  async function pinFirstGitDir(ids, dirs) {
    if (!ids.length) return
    for (const dir of dirs) {
      if (await isGitDir(dir, execFileAsync)) {
        rememberSessionGitDirs(ids, dir)
        return dir
      }
    }
  }

  async function pinGitFromExec(exec, result) {
    await pinFirstGitDir(sessionIdsFromExec(exec), candidateGitDirsFromExec(exec, result))
  }

  const sessionLogInflight = new Map()
  async function pinGitFromSessionLog(sessionId) {
    const id = String(sessionId || '').trim()
    if (!id) return
    if (resolveSessionGitDir({ sessionId: id })) return
    if (sessionLogInflight.has(id)) return sessionLogInflight.get(id)
    const job = (async () => {
      const file = await findSessionLogFile(id)
      if (!file) return
      const text = await readSessionLogText(file)
      await pinFirstGitDir([id], candidateGitDirsFromSessionJsonl(text))
    })()
    sessionLogInflight.set(id, job)
    try { await job } catch { /* chip poll must never throw */ }
    finally { sessionLogInflight.delete(id) }
  }

  async function findSessionLogFile(sessionId) {
    const home = process.env.DSH_HOME || path.join(os.homedir(), '.dsh')
    const root = path.join(home, 'sessions')
    const walk = async (dir, depth) => {
      if (depth > 4) return ''
      let entries = []
      try { entries = await fs.readdir(dir, { withFileTypes: true }) } catch { return '' }
      for (const ent of entries) {
        const full = path.join(dir, ent.name)
        if (!ent.isDirectory()) continue
        if (ent.name === sessionId) {
          for (const name of ['session.jsonl.zstd', 'session.jsonl']) {
            const candidate = path.join(full, name)
            try { await fs.access(candidate); return candidate } catch { /* next name */ }
          }
        }
        const nested = await walk(full, depth + 1)
        if (nested) return nested
      }
      return ''
    }
    return walk(root, 0)
  }

  async function readSessionLogText(file) {
    if (String(file).endsWith('.zstd')) {
      try {
        const { stdout } = await execFileAsync('zstdcat', [file], { maxBuffer: 32 * 1024 * 1024 })
        return String(stdout || '')
      } catch {
        const { stdout } = await execFileAsync('zstd', ['-dc', file], { maxBuffer: 32 * 1024 * 1024 })
        return String(stdout || '')
      }
    }
    return String(await fs.readFile(file, 'utf8'))
  }

  ctx.on('tools/execute', async (exec, next) => {
    const result = await next()
    try { await pinGitFromExec(exec, result) } catch { /* never break another tool */ }
    // DoD reminder (default off): if git files were modified without issue/PR ref
    if (live().dodReminder) {
      try {
        const { checkDoD } = await import('./dod-reminder.js')
        const text = JSON.stringify(exec?.arguments || {}) + ' ' + JSON.stringify(result?.value || '')
        const reminder = checkDoD({ changedGitFiles: /git|commit|push|worktree|add|rm|mv/i.test(text), references: [], text })
        if (reminder.reminder) {
          const note = { type: 'text', text: reminder.message }
          if (result && Array.isArray(result.value)) result.value.push(note)
          else if (result) result.value = [result.value, note]
        }
      } catch { /* never break another tool */ }
    }
    return result
  })

  // Background scheduler (default off): periodic triage/health + optional delivery
  ctx.effect(() => {
    const scheduler = new BgScheduler({ intervalMs: Math.max(1, live().bgSchedulerIntervalMin) * 60000 })
    if (live().bgSchedulerEnabled) {
      scheduler.onTick(async () => {
        const cfg = live()
        const owner = cfg.bgSchedulerOwner || cfg.defaultOwner
        const repo = cfg.bgSchedulerRepo || cfg.defaultRepo
        if (!cfg.baseUrl || !owner || !repo) return { ok: false, error: 'bg scheduler: owner/repo/baseUrl not configured' }
        const token = await resolveToken(cfg.tokenEnv)
        const client2 = new GiteaClient({ baseUrl: cfg.baseUrl, token, timeoutMs: cfg.timeoutMs })
        const { buildTriageDigest } = await import('./triage-digest.js')
        const digest = await buildTriageDigest({ owner, repo }, { client: client2 })
        if (digest?.ok && cfg.bgSchedulerWebhook) {
          const text = `[Triage Digest] ${owner}/${repo}: ${digest.data?.openIssues || 0} open issues, ${digest.data?.openPulls || 0} open PRs`
          try {
            await fetch(cfg.bgSchedulerWebhook, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ text, digest: digest.data }),
            })
          } catch { /* delivery failure should not break bg scheduler */ }
        }
        return digest
      })
      scheduler.start()
    }
    return () => { scheduler.stop() }
  }, 'dsh-gitea: bg scheduler')
}
