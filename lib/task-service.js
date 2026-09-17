import { GiteaClient, normalizeBaseUrl } from './gitea-client.js'

export const TASK_PROVISION_CONTRACT = 'dsh-drives.task-provision.v1'

const SEGMENT = /^[A-Za-z0-9._-]+$/

function text(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function validSegment(value) {
  return value !== '' && value !== '.' && value !== '..' && SEGMENT.test(value)
}

function normalizePayload(input, config) {
  const owner = text(input?.owner) || text(config?.defaultOwner)
  const repo = text(input?.repo) || text(config?.defaultRepo)
  const title = text(input?.title)
  const body = typeof input?.body === 'string' ? input.body : ''
  const externalRef = text(input?.externalRef)
  const labels = Array.isArray(input?.labels)
    ? [...new Set(input.labels.filter((label) => typeof label === 'string').map((label) => label.trim()).filter(Boolean))]
    : []
  if (!validSegment(owner) || !validSegment(repo)) return { ok: false, code: 'target-required' }
  if (!title) return { ok: false, code: 'title-required' }
  if (title.length > 512) return { ok: false, code: 'title-too-long' }
  if (externalRef.length > 256) return { ok: false, code: 'external-ref-too-long' }
  return { ok: true, owner, repo, title, body, labels, externalRef }
}

function externalMarker(externalRef) {
  return '<!-- dsh-external-ref: ' + externalRef + ' -->'
}

function withExternalMarker(body, externalRef) {
  if (!externalRef) return body
  const marker = externalMarker(externalRef)
  return body.includes(marker) ? body : [body, '', marker].join('\n').trim()
}

function issueRows(value) {
  if (Array.isArray(value)) return value
  if (Array.isArray(value?.data)) return value.data
  return []
}

function normalizeIssue(issue, externalRef, alreadyExists = false) {
  return {
    ok: true,
    ...issue,
    number: issue.number ?? issue.index ?? null,
    url: issue.html_url ?? issue.url ?? null,
    externalRef: externalRef || null,
    alreadyExists,
  }
}

export function createGiteaTaskService({ getConfig, resolveToken, clientFactory } = {}) {
  const makeClient = clientFactory || ((options) => new GiteaClient(options))
  return {
    contract: TASK_PROVISION_CONTRACT,
    isConfigured() {
      const config = getConfig?.() || {}
      return Boolean(normalizeBaseUrl(config.baseUrl) && text(config.defaultOwner) && text(config.defaultRepo))
    },
    async createIssue(input = {}) {
      const config = getConfig?.() || {}
      const payload = normalizePayload(input, config)
      if (!payload.ok) return payload
      const baseUrl = normalizeBaseUrl(config.baseUrl)
      if (!baseUrl) return { ok: false, code: 'base-url-not-configured' }
      const token = await resolveToken?.(config.tokenEnv)
      if (!token) return { ok: false, code: 'credential-not-configured' }
      let response
      try {
        const client = makeClient({ baseUrl, token, timeoutMs: config.timeoutMs })
        if (payload.externalRef && typeof client.searchIssues === 'function') {
          const lookup = await client.searchIssues({
            q: externalMarker(payload.externalRef),
            state: 'all',
            limit: 50,
          })
          if (!lookup?.ok) {
            return {
              ok: false,
              code: 'gitea-lookup-failed',
              status: lookup?.status ?? 0,
              error: lookup?.error || 'Gitea issue lookup failed',
            }
          }
          const existing = issueRows(lookup.data).find((issue) => (
            typeof issue?.body === 'string' && issue.body.includes(externalMarker(payload.externalRef))
          ))
          if (existing) return normalizeIssue(existing, payload.externalRef, true)
        }
        response = await client.createIssue(payload.owner, payload.repo, {
          title: payload.title,
          body: withExternalMarker(payload.body, payload.externalRef),
          labels: payload.labels,
        })
      } catch (error) {
        return { ok: false, code: 'client-error', error: String(error?.message || error) }
      }
      if (!response?.ok) {
        return {
          ok: false,
          code: 'gitea-api-error',
          status: response?.status ?? 0,
          error: response?.error || 'Gitea issue creation failed',
        }
      }
      const issue = response.data && typeof response.data === 'object' ? response.data : {}
      return normalizeIssue(issue, payload.externalRef)
    },
  }
}
