/**
 * BgScheduler: простой host-level планировщик (setInterval) с учётом
 * lastRunAt. Не session-local: живёт в apply() плагина, гасится через
 * ctx.effect. Write-операции не выполняет — только read-only действия.
 */

export function shouldFire({ lastRunAt = 0, intervalMs = 60000, now = Date.now() } = {}) {
  return now - lastRunAt >= intervalMs
}

export class BgScheduler {
  constructor({ intervalMs = 60000 } = {}) {
    this.intervalMs = intervalMs
    this.lastRunAt = 0
    this.timer = null
    this.tick = null
  }

  onTick(fn) {
    this.tick = fn
  }

  async runOnce(now = Date.now()) {
    if (!this.tick) return { ok: false, error: 'no tick handler' }
    if (!shouldFire({ lastRunAt: this.lastRunAt, intervalMs: this.intervalMs, now })) {
      return { ok: true, data: { skipped: true } }
    }
    try {
      const result = await this.tick()
      this.lastRunAt = now
      return { ok: true, data: { ran: true, result } }
    } catch (e) {
      return { ok: false, error: String(e?.message || e) }
    }
  }

  start() {
    if (this.timer) return
    this.timer = setInterval(() => { this.runOnce().catch(() => {}) }, this.intervalMs)
    if (typeof this.timer.unref === 'function') this.timer.unref()
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
  }
}
