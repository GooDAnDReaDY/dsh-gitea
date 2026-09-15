/**
 * EventStore: ring buffer of Gitea events (last N) with deduplication
 * by id. Used for notifications panel in the plugin.
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
   * Converts webhook header X-Gitea-Event + body into normalized event.
   */
  fromWebhook({ event = '', action = '', payload = {} } = {}) {
    const base = {
      id: payload?.id || `${event}:${Date.now()}`,
      type: event,
      action,
      at: new Date().toISOString(),
      sender: payload?.sender?.login || 'system',
    }
    if (event === 'pull_request') {
      const pr = payload.pull_request || {}
      return { ...base, number: pr.number || payload.number, title: pr.title || '', url: pr.html_url || '' }
    }
    if (event === 'workflow_run' || event === 'actions') {
      return { ...base, number: payload.workflow_run?.id, title: payload.workflow_run?.name || 'workflow', url: payload.workflow_run?.html_url || '', conclusion: payload.workflow_run?.conclusion || '' }
    }
    if (event === 'push') {
      const ref = payload.ref || ''
      const branch = ref.replace(/^refs\/heads\//, '')
      const commitsCount = Array.isArray(payload.commits) ? payload.commits.length : 0
      const headCommit = payload.head_commit?.message || (payload.commits && payload.commits[0]?.message) || ''
      return { ...base, branch, commitsCount, title: `Push to ${branch} (${commitsCount} commits): ${headCommit.split('\n')[0]}`.trim(), url: payload.compare_url || '' }
    }
    if (event === 'issue_comment') {
      const isPr = Boolean(payload.issue?.pull_request)
      const num = payload.issue?.number || payload.number
      const body = payload.comment?.body || ''
      return { ...base, number: num, isPr, title: `Comment on #${num}: ${body.slice(0, 100)}`.trim(), url: payload.comment?.html_url || payload.issue?.html_url || '' }
    }
    if (event === 'release') {
      const rel = payload.release || {}
      return { ...base, title: `Release ${rel.tag_name || rel.name || ''}`.trim(), url: rel.html_url || '' }
    }
    return { ...base, number: payload.number || payload.issue?.number, title: payload.issue?.title || '' }
  }
}
