import z from '@deepseek-ai/schemastery'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { credentialRef } from '@deepseek-ai/dsh-credentials'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { GiteaClient, normalizeBaseUrl } from './gitea-client.js'
import { createGiteaTaskService } from './task-service.js'
import { createGiteaEventsService } from './gitea-events.js'
import { registerPluginUpdater } from './plugin-updater.js'

import { runHandler, formatToolResult, toLossless } from './handlers.js'
import { stripSecretsFromConfig, credentialRefStatus } from './secrets.js'
import { isGitDir } from './git-local.js'
import { registerHttpRoutes, writeJson, readBody } from './routes.js'
import { EventStore } from './events-store.js'
import { BgScheduler } from './bg-scheduler.js'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { rememberSessionGitDirs, resolveSessionGitDir, sessionIdsFromExec, sessionCwdFromExec, repoCwdFromTool, candidateGitDirsFromExec, candidateGitDirsFromSessionJsonl, selectChipRepoDir } from './session-git.js'
import { addJob, listJobs, runJob } from './scheduler.js'

export const name = '@goodandready/dsh-gitea'
export const inject = ['tools', 'credentials', 'settings', 'webServer']

const NS = 'dsh-gitea'
const execFileAsync = promisify(execFile)

// Ensure .volatile() helper exists on Schemastery schema prototype
try {
  const schemaProto = Object.getPrototypeOf(z.boolean())
  if (schemaProto && typeof schemaProto.volatile !== 'function') {
    schemaProto.volatile = function () {
      return typeof this.extra === 'function' ? this.extra('volatile', true) : this
    }
  }
} catch {
  // safe fallback
}

export const Config = z.object({
  baseUrl: z.string().default('')
    .description('Gitea or Forgejo instance URL, e.g. https://gitea.example.com')
    .volatile(),
  tokenEnv: z.string().role('credential-ref').default('GITEA_TOKEN')
    .description('DSH credential name holding the API token.')
    .volatile(),
  defaultOwner: z.string().default('')
    .description('Default repository owner when the tool omits owner/repo.')
    .volatile(),
  defaultRepo: z.string().default('')
    .description('Default repository name when the tool omits owner/repo.')
    .volatile(),
  gitWrapper: z.string().default('')
    .description('Git wrapper binary (e.g. git-deepseek-harness) used for write operations. Empty disables worktree add/remove.')
    .volatile(),
  dodReminder: z.boolean().default(false)
    .description('DoD reminder: after a tool run that changed git files, remind if no issue/PR reference was made. Default off, never blocks.')
    .volatile(),
  bgSchedulerEnabled: z.boolean().default(false)
    .description('Background scheduler: periodically runs triage/health and sends digest. Default off.')
    .volatile(),
  bgSchedulerIntervalMin: z.number().default(60)
    .description('Background scheduler interval in minutes (default 60).')
    .volatile(),
  bgSchedulerOwner: z.string().default('')
    .description('Owner for background triage (default from defaultOwner).')
    .volatile(),
  bgSchedulerRepo: z.string().default('')
    .description('Repo for background triage (default from defaultRepo).')
    .volatile(),
  bgSchedulerWebhook: z.string().default('')
    .description('Optional webhook URL to deliver the digest to (external channel). Empty = only in-memory events.')
    .volatile(),
  notifyWebhook: z.string().default('')
    .description('Webhook URL for push notifications (new PR, failed CI). Empty disables push.')
    .volatile(),
  forceHttpsUrls: z.boolean().default(false)
    .description('When DSH is served over HTTPS but Gitea answers with http:// links (reverse proxy), rewrite html_url to https. Default off.')
    .volatile(),
  webhookSecretEnv: z.string().role('credential-ref').default('')
    .description('DSH credential name holding the secret for verifying X-Gitea-Signature on POST /dsh-gitea/webhook.')
    .volatile(),
  webhookSecret: z.string().default('')
    .description('Deprecated: use webhookSecretEnv credential ref.'),
  instances: z.array(z.object({
    name: z.string(),
    baseUrl: z.string(),
    tokenEnv: z.string().role('credential-ref'),
  })).default([])
    .description('Additional Gitea instances: name, baseUrl, credential name. Tools accept instance param; default is primary (baseUrl/tokenEnv).')
    .volatile(),
  timeoutMs: z.number().default(30000)
    .description('HTTP timeout in milliseconds.')
    .volatile(),
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
  let settingsScope = null

  // Fallback scope if settings.register is not available (e.g. modern DSH 0.1.7)
  const fallbackScope = {
    get: () => getConfig(),
    update: async (patch) => {
      const next = parseConfig({ ...getConfig(), ...patch })
      getConfig = () => next
      return next
    },
  }

  ctx.inject(['settings'], (sctx) => {
    try {
      const settings = getService(sctx, 'settings') || sctx.settings
      if (settings && typeof settings.register === 'function') {
        const scope = settings.register(NS, Config, { base: baseConfig })
        settingsScope = scope
        getConfig = () => parseConfig(scope.get() ?? baseConfig)
        sctx.effect(() => () => {
          settingsScope = null
          getConfig = () => baseConfig
        })
      }
    } catch (err) {
      ctx.logger?.warn?.('[dsh-gitea] settings.register unavailable:', err?.message || err)
    }
  })

  // Listen for volatile updates and config changes in modern DSH loaders
  if (typeof ctx?.on === 'function') {
    const applyPatch = (updated) => {
      if (updated && typeof updated === 'object') {
        const incoming = updated[NS] ?? updated
        if (incoming && typeof incoming === 'object') {
          try {
            const next = parseConfig({ ...getConfig(), ...incoming })
            getConfig = () => next
          } catch { /* ignore invalid update */ }
        }
      }
    }
    if (typeof ctx.effect === 'function') {
      ctx.effect(() => ctx.on('loader/volatile-update', applyPatch))
      ctx.effect(() => ctx.on('config', applyPatch))
      ctx.effect(() => ctx.on('settings/document-updated', applyPatch))
    } else {
      ctx.on('loader/volatile-update', applyPatch)
      ctx.on('config', applyPatch)
    }
  }

  // Receive Gitea webhook events (for notifications panel)
  const eventsStore = new EventStore(50)
  const giteaEventsService = createGiteaEventsService()


  ctx.effect(() => registerPluginUpdater(ctx, {
    endpoint: '/api/dsh-gitea/update',
    packageName: '@goodandready/dsh-gitea',
    manifestUrl: new URL('../package.json', import.meta.url),
  }), 'dsh-gitea: /api/dsh-gitea/update')

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

  registerHttpRoutes(ctx, {
    parseConfig,
    live,
    getSettingsScope: () => settingsScope || fallbackScope,
    resolveToken,
    tokenConfigured,
    eventsStore,
    giteaEventsService,
    pinGitFromSessionLog,
    execFile: execFileAsync,
  })

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
  if (typeof ctx.provide === 'function') {
    ctx.provide('dshGitea', taskService)
    ctx.provide('giteaEvents', giteaEventsService)
  }

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
          return toLossless(result)
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
