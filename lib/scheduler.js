/**
 * Scheduled project checks: мини-планировщик повторяющихся read-only
 * проверок с историей. Host-уровневый (не session-local timers).
 * Write-операции не допускаются без отдельного approval.
 */

const DAY_MS = 86400000

export function nextRunAt(schedule = 'daily', now = new Date()) {
  const next = new Date(now.getTime())
  if (schedule === 'hourly') next.setUTCHours(next.getUTCHours() + 1)
  else if (schedule === 'weekly') next.setUTCDate(next.getUTCDate() + 7)
  else next.setUTCDate(next.getUTCDate() + 1) // daily по умолчанию
  next.setUTCSeconds(0, 0)
  return next.toISOString()
}

export function addJob(store, spec = {}) {
  const name = String(spec.name || '').trim()
  if (!name) return { ok: false, error: 'name is required' }
  const schedule = ['hourly', 'daily', 'weekly'].includes(spec.schedule) ? spec.schedule : 'daily'
  const job = {
    id: name,
    name,
    schedule,
    owner: spec.owner || '',
    repo: spec.repo || '',
    action: spec.action || 'health',
    dryRun: spec.dryRun !== false,
    createdAt: new Date().toISOString(),
    lastRunAt: null,
    history: [],
  }
  store.jobs.set(name, job)
  return { ok: true, id: name, data: job }
}

export function listJobs(store) {
  const now = new Date()
  return [...store.jobs.values()].map((j) => ({
    ...j,
    nextRunAt: nextRunAt(j.schedule, now),
  }))
}

export async function runJob(job, executor) {
  const started = new Date().toISOString()
  const result = await executor(job)
  const record = { at: started, ok: !!result?.ok, dryRun: job.dryRun, error: result?.error || '' }
  job.lastRunAt = started
  job.history = [...(job.history || []), record].slice(-20)
  return {
    ok: true,
    data: {
      id: job.id,
      dryRun: job.dryRun,
      result,
      history: job.history,
    },
  }
}
