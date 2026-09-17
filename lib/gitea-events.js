/**
 * Safe metadata composition service for external telemetry consumers (e.g. @goodandready/dsh-pulse).
 * Exposes only allowlisted metadata: event, action, timestamps, and safe repo/ref context.
 * Never leaks credentials, tokens, webhook secrets, headers, bodies, or raw payloads.
 */

export function toSafeGiteaEvent({ event = '', action = '', payload = {}, ev = null } = {}) {
  const repoObj = payload?.repository && typeof payload.repository === 'object' ? payload.repository : {}
  const owner = String(repoObj?.owner?.login || repoObj?.owner?.name || payload?.owner || '').trim() || null
  const repo = String(repoObj?.name || payload?.repo || '').trim() || null

  let issue = null
  let pull = null
  let ref = null

  if (payload?.issue && typeof payload.issue === 'object') {
    const num = Number(payload.issue.number)
    if (Number.isInteger(num) && num > 0) {
      if (payload.issue.pull_request) {
        pull = num
      } else {
        issue = num
      }
    }
  } else if (payload?.pull_request && typeof payload.pull_request === 'object') {
    const num = Number(payload.pull_request.number)
    if (Number.isInteger(num) && num > 0) {
      pull = num
    }
  } else if (payload?.number) {
    const num = Number(payload.number)
    if (Number.isInteger(num) && num > 0) {
      if (event === 'pull_request') pull = num
      else issue = num
    }
  }

  if (typeof payload?.ref === 'string' && payload.ref.trim()) {
    ref = payload.ref.replace(/^refs\/heads\//, '').trim() || null
  } else if (typeof payload?.pull_request?.head?.ref === 'string' && payload.pull_request.head.ref.trim()) {
    ref = payload.pull_request.head.ref.trim() || null
  }

  const id = String(ev?.id || payload?.id || `${event}:${Date.now()}`)
  const at = (ev?.at && typeof ev.at === 'string') ? ev.at : new Date().toISOString()

  return {
    id,
    event: String(event || ''),
    action: String(action || ''),
    at,
    giteaContext: {
      owner,
      repo,
      issue,
      pull,
      project: null,
      ref,
    },
  }
}

export function createGiteaEventsService() {
  const subscribers = new Set()

  return {
    subscribe(listener) {
      if (typeof listener !== 'function') return () => {}
      subscribers.add(listener)
      return () => {
        subscribers.delete(listener)
      }
    },
    on(eventName, listener) {
      if (eventName === 'event' && typeof listener === 'function') {
        return this.subscribe(listener)
      }
      return () => {}
    },
    emit(eventData) {
      const safe = toSafeGiteaEvent(eventData)
      if (!safe) return
      for (const sub of subscribers) {
        try {
          sub(safe)
        } catch {
          // Subscriber failures must not interrupt other subscribers or host operations
        }
      }
    },
    get subscriberCount() {
      return subscribers.size
    },
  }
}
