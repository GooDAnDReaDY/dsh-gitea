import z from '@deepseek-ai/schemastery'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { credentialRef } from '@deepseek-ai/dsh-credentials'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { GiteaClient, normalizeBaseUrl } from './gitea-client.js'
import { runHandler, formatToolResult } from './handlers.js'
import { stripSecretsFromConfig } from './secrets.js'

export const name = 'dsh-gitea'
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

function isTrustedSettingsRequest(request) {
  return request.headers['sec-fetch-site'] !== 'cross-site'
}

export const Config = z.object({
  baseUrl: z.string().default('')
    .description('Gitea or Forgejo instance URL, e.g. https://gitea.example.com'),
  tokenEnv: z.string().default('GITEA_TOKEN')
    .description('DSH credential name holding the API token.'),
  defaultOwner: z.string().default('')
    .description('Default repository owner when the tool omits owner/repo.'),
  defaultRepo: z.string().default('')
    .description('Default repository name when the tool omits owner/repo.'),
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
  },
}

export const OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    ok: { type: 'boolean' },
    error: { type: 'string' },
    data: {
      oneOf: [
        { type: 'array', items: GITEA_RECORD },
        GITEA_RECORD,
      ],
    },
  },
}

const TOOL_DEFS = [
  {
    name: 'gitea_issue_create',
    description: 'Create a Gitea/Forgejo issue in a repository.',
    parameters: {
      title: { type: 'string', required: true, description: 'Issue title.' },
      body: { type: 'string', description: 'Issue body.' },
      owner: { type: 'string', description: 'Repository owner.' },
      repo: { type: 'string', description: 'Repository name.' },
    },
  },
  {
    name: 'gitea_issue_list',
    description: 'List Gitea/Forgejo issues in a repository.',
    parameters: {
      state: { type: 'string', description: 'Filter: open, closed, or all.' },
      limit: { type: 'number', description: 'Maximum items to return.' },
      page: { type: 'number', description: 'Page number.' },
      owner: { type: 'string', description: 'Repository owner.' },
      repo: { type: 'string', description: 'Repository name.' },
    },
  },
  {
    name: 'gitea_issue_get',
    description: 'Get a Gitea/Forgejo issue by number.',
    parameters: {
      number: { type: 'number', required: true, description: 'Issue number.' },
      owner: { type: 'string', description: 'Repository owner.' },
      repo: { type: 'string', description: 'Repository name.' },
    },
  },
  {
    name: 'gitea_issue_comment',
    description: 'Add a comment to a Gitea/Forgejo issue.',
    parameters: {
      number: { type: 'number', required: true, description: 'Issue number.' },
      body: { type: 'string', required: true, description: 'Comment text.' },
      owner: { type: 'string', description: 'Repository owner.' },
      repo: { type: 'string', description: 'Repository name.' },
    },
  },
  {
    name: 'gitea_issue_close',
    description: 'Close a Gitea/Forgejo issue.',
    parameters: {
      number: { type: 'number', required: true, description: 'Issue number.' },
      owner: { type: 'string', description: 'Repository owner.' },
      repo: { type: 'string', description: 'Repository name.' },
    },
  },
  {
    name: 'gitea_pr_create',
    description: 'Create a Gitea/Forgejo pull request.',
    parameters: {
      title: { type: 'string', required: true, description: 'Pull request title.' },
      head: { type: 'string', required: true, description: 'Head branch.' },
      base: { type: 'string', required: true, description: 'Base branch.' },
      body: { type: 'string', description: 'Pull request body.' },
      owner: { type: 'string', description: 'Repository owner.' },
      repo: { type: 'string', description: 'Repository name.' },
    },
  },
  {
    name: 'gitea_pr_list',
    description: 'List Gitea/Forgejo pull requests.',
    parameters: {
      state: { type: 'string', description: 'Filter: open, closed, or all.' },
      limit: { type: 'number', description: 'Maximum items to return.' },
      page: { type: 'number', description: 'Page number.' },
      owner: { type: 'string', description: 'Repository owner.' },
      repo: { type: 'string', description: 'Repository name.' },
    },
  },
  {
    name: 'gitea_pr_get',
    description: 'Get a Gitea/Forgejo pull request by number.',
    parameters: {
      number: { type: 'number', required: true, description: 'Pull request number.' },
      owner: { type: 'string', description: 'Repository owner.' },
      repo: { type: 'string', description: 'Repository name.' },
    },
  },
  {
    name: 'gitea_pr_comment',
    description: 'Add a comment to a Gitea/Forgejo pull request.',
    parameters: {
      number: { type: 'number', required: true, description: 'Pull request number.' },
      body: { type: 'string', required: true, description: 'Comment text.' },
      owner: { type: 'string', description: 'Repository owner.' },
      repo: { type: 'string', description: 'Repository name.' },
    },
  },
  {
    name: 'gitea_pr_merge',
    description: 'Merge a Gitea/Forgejo pull request. Requires confirm: true (boolean).',
    parameters: {
      number: { type: 'number', required: true, description: 'Pull request number.' },
      confirm: { type: 'boolean', description: 'Must be true to merge.' },
      Do: { type: 'string', description: 'Merge style: merge, rebase, or squash.' },
      owner: { type: 'string', description: 'Repository owner.' },
      repo: { type: 'string', description: 'Repository name.' },
    },
  },
  {
    name: 'gitea_repo_search',
    description: 'Search repositories on the configured Gitea/Forgejo instance.',
    parameters: {
      q: { type: 'string', required: true, description: 'Search query.' },
      limit: { type: 'number', description: 'Maximum items to return.' },
    },
  },
]

export function parseConfig(raw) {
  return Config(stripSecretsFromConfig(raw ?? {}))
}

export async function readGitOrigin(cwd = process.cwd()) {
  try {
    const { stdout } = await execFileAsync('git', ['remote', 'get-url', 'origin'], { cwd })
    return String(stdout || '').trim()
  } catch {
    return ''
  }
}

export function apply(ctx, config) {
  const baseConfig = parseConfig(config)
  let getConfig = () => baseConfig
  const live = () => parseConfig(getConfig())
  let settingsScope

  ctx.inject(['settings'], (sctx) => {
    const scope = sctx.settings.register(NS, Config, { base: baseConfig })
    settingsScope = scope
    getConfig = () => parseConfig(scope.get() ?? baseConfig)
    sctx.effect(() => () => {
      settingsScope = undefined
      getConfig = () => baseConfig
    })
  })

  async function tokenConfigured(tokenEnv) {
    try {
      if (typeof ctx.credentials.describe === 'function') {
        const described = await ctx.credentials.describe(credentialRef(tokenEnv))
        return !!(described && described.configured)
      }
      const resolved = await ctx.credentials.resolve(credentialRef(tokenEnv))
      return !!(resolved && resolved.value)
    } catch {
      return false
    }
  }

  async function configResponse() {
    const cfg = live()
    return {
      ok: true,
      config: cfg,
      tokenConfigured: await tokenConfigured(cfg.tokenEnv),
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
      if (!isTrustedSettingsRequest(req)) {
        writeJson(res, 403, { ok: false, error: { code: 'forbidden', message: 'same-origin only' } })
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
      let parsed
      try { parsed = parseConfig(payload) } catch (e) {
        writeJson(res, 400, { ok: false, error: { code: 'schema', message: String(e?.message || e) } })
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

  async function resolveToken(tokenEnv) {
    try {
      const resolved = await ctx.credentials.resolve(credentialRef(tokenEnv))
      if (resolved?.value) return resolved.value
    } catch { /* credential may be unset */ }
    return ''
  }

  async function makeDeps(remoteUrl) {
    const cfg = live()
    const token = await resolveToken(cfg.tokenEnv)
    const baseUrl = normalizeBaseUrl(cfg.baseUrl)
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
          const cwd = exec?.cwd || process.cwd()
          const remoteUrl = await readGitOrigin(cwd)
          const deps = await makeDeps(remoteUrl)
          return runHandler(def.name, args, deps)
        },
      }),
    )
  }
}
