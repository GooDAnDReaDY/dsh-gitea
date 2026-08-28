import { test } from 'node:test'
import assert from 'node:assert/strict'
import { addJob, listJobs, nextRunAt, runJob } from '../lib/scheduler.js'

const store = () => ({ jobs: new Map() })

test('addJob registers a job with cron-like spec', () => {
  const s = store()
  const r = addJob(s, { name: 'triage', schedule: 'daily', owner: 'acme', repo: 'app', action: 'triage' })
  assert.equal(r.ok, true)
  assert.equal(r.id, 'triage')
  assert.equal(listJobs(s).length, 1)
})

test('listJobs returns jobs with nextRunAt', () => {
  const s = store()
  addJob(s, { name: 'x', schedule: 'daily', owner: 'acme', repo: 'app', action: 'health' })
  const jobs = listJobs(s)
  assert.equal(jobs.length, 1)
  assert.ok(jobs[0].nextRunAt)
})

test('nextRunAt for daily is tomorrow at same hour', () => {
  const now = new Date('2026-08-28T09:00:00Z')
  const next = new Date(nextRunAt('daily', now))
  assert.equal(next.getUTCDate(), 29)
  assert.equal(next.getUTCHours(), 9)
})

test('runJob executes dry-run by default without side effects', async () => {
  let ran = 0
  const s = store()
  addJob(s, { name: 't', schedule: 'daily', owner: 'acme', repo: 'app', action: 'health', dryRun: true })
  const job = listJobs(s)[0]
  const r = await runJob(job, async () => { ran += 1; return { ok: true, data: {} } })
  assert.equal(r.ok, true)
  assert.equal(r.data.dryRun, true)
  assert.equal(ran, 1)
})
