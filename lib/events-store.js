/**
 * EventStore: кольцевой буфер событий Gitea (последние N) с дедупликацией
 * по id. Для панели уведомлений в плагине.
 */

export class EventStore {
  constructor(max = 50) {
    this.max = max
    this.items = []
    this.seen = new Set()
  }

  push(event) {
    const id = event && (event.id || `${event.type}:${event.number}:${event.at || Date.now()}`)
    if (id && this.seen.has(id)) return false
    if (id) {
      this.seen.add(id)
      if (this.seen.size > this.max * 2) {
        const keep = new Set(this.items.slice(-this.max).map((e) => e.id).filter(Boolean))
        this.seen = keep
      }
    }
    this.items.push(event)
    if (this.items.length > this.max) this.items.shift()
    return true
  }

  list() {
    return [...this.items].reverse()
  }

  clear() {
    this.items = []
    this.seen = new Set()
  }

  /**
   * Преобразует webhook-заголовок X-Gitea-Event + тело в событие.
   */
  fromWebhook({ event = '', action = '', payload = {} } = {}) {
    const base = {
      id: payload?.id || `${event}:${Date.now()}`,
      type: event,
      action,
      at: new Date().toISOString(),
    }
    if (event === 'pull_request') {
      const pr = payload.pull_request || {}
      return { ...base, number: pr.number || payload.number, title: pr.title || '', url: pr.html_url || '' }
    }
    if (event === 'workflow_run' || event === 'actions') {
      return { ...base, number: payload.workflow_run?.id, title: payload.workflow_run?.name || 'workflow', url: payload.workflow_run?.html_url || '', conclusion: payload.workflow_run?.conclusion || '' }
    }
    return { ...base, number: payload.number, title: payload.issue?.title || '' }
  }
}
