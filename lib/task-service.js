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
    ? [...new Set(input.labels.map((item) => {
        if (typeof item === 'number' && Number.isInteger(item) && item > 0) return item
        if (typeof item === 'string') {
          const s = item.trim()
          if (/^\d+$/.test(s)) {
            const n = parseInt(s, 10)
            if (n > 0) return n
          }
          return s
        }
        return null
      }).filter(Boolean))]
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
          const marker = externalMarker(payload.externalRef)
          let existing = null
          let page = 1
          const maxPages = 5

          while (page <= maxPages) {
            const lookup = await client.searchIssues({
              q: marker,
              state: 'all',
              limit: 50,
              page,
              repo: payload.repo,
              owner: payload.owner,
            })
            if (!lookup?.ok) {
              return {
                ok: false,
                code: 'gitea-lookup-failed',
                status: lookup?.status ?? 0,
                error: lookup?.error || 'Gitea issue lookup failed',
              }
            }
            const rows = issueRows(lookup.data)
            existing = rows.find((issue) => {
              if (typeof issue?.body !== 'string' || !issue.body.includes(marker)) {
                return false
              }
              // #299: Verify repository identity strictly (owner can be string or object; check full_name)
              const issueRepo = issue.repository || issue.repo
              if (issueRepo) {
                const rName = typeof issueRepo.name === 'string' ? issueRepo.name.toLowerCase() : ''
                const rFullName = typeof issueRepo.full_name === 'string' ? issueRepo.full_name.toLowerCase() : ''
                const expectedFullName = `${payload.owner.toLowerCase()}/${payload.repo.toLowerCase()}`
                if (rFullName && rFullName !== expectedFullName) return false

                let rOwner = ''
                if (typeof issueRepo.owner === 'string') {
                  rOwner = issueRepo.owner.toLowerCase()
                } else if (issueRepo.owner && typeof issueRepo.owner === 'object') {
                  rOwner = (issueRepo.owner.login || issueRepo.owner.username || '').toLowerCase()
                }

                if (rName && rName !== payload.repo.toLowerCase()) return false
                if (rOwner && rOwner !== payload.owner.toLowerCase()) return false
              }
              return true
            })
            if (existing) break
            if (rows.length < 50) break
            page += 1
          }

          if (existing) return normalizeIssue(existing, payload.externalRef, true)
        }

        // #298: Resolve string label names to numeric IDs via client.listLabels
        let resolvedLabels = payload.labels
        if (payload.labels.length > 0) {
          const hasStringLabels = payload.labels.some((l) => typeof l === 'string')
          if (hasStringLabels && typeof client.listLabels === 'function') {
            const labelsRes = await client.listLabels(payload.owner, payload.repo, { limit: 100 })
            if (!labelsRes?.ok) {
              return {
                ok: false,
                code: 'label-lookup-failed',
                status: labelsRes?.status ?? 0,
                error: labelsRes?.error || 'Failed to list repository labels',
              }
            }
            const existingLabels = Array.isArray(labelsRes.data) ? labelsRes.data : []
            const mapped = []
            const missing = []
            for (const item of payload.labels) {
              if (typeof item === 'number') {
                mapped.push(item)
              } else {
                const found = existingLabels.find((l) => String(l.name).toLowerCase() === String(item).toLowerCase())
                if (found?.id) {
                  mapped.push(found.id)
                } else {
                  missing.push(item)
                }
              }
            }
            if (missing.length > 0) {
              return {
                ok: false,
                code: 'labels-not-found',
                error: `Label(s) not found in repository: ${missing.join(', ')}`,
              }
            }
            resolvedLabels = [...new Set(mapped)]
          } else if (!hasStringLabels) {
            resolvedLabels = [...new Set(payload.labels.filter((l) => typeof l === 'number'))]
          }
        }

        response = await client.createIssue(payload.owner, payload.repo, {
          title: payload.title,
          body: withExternalMarker(payload.body, payload.externalRef),
          labels: resolvedLabels,
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
