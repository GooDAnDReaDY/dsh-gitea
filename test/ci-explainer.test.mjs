import { test } from 'node:test'
import assert from 'node:assert/strict'
import { extractFirstError, explainFailedJob } from '../lib/ci-explainer.js'

test('extractFirstError finds the first meaningful error line', () => {
  const log = [
    'Build started',
    'error: failed to compile lib/a.js',
    'Error: ENOENT: no such file',
    'npm ERR! code 1',
  ].join('\n')
  const err = extractFirstError(log)
  assert.ok(err)
  assert.match(err, /error: failed to compile/i)
})

test('extractFirstError returns null for clean log', () => {
  const err = extractFirstError('All checks passed\nBuild succeeded')
  assert.equal(err, null)
})

test('explainFailedJob extracts error and metadata from a failed job', () => {
  const job = {
    id: 9,
    name: 'test',
    status: 'failed',
    log: 'line1\nerror: cannot find module X\nline3',
    head_sha: 'abc123',
  }
  const r = explainFailedJob(job)
  assert.equal(r.ok, true)
  assert.equal(r.error, 'error: cannot find module X')
  assert.equal(r.jobId, 9)
})

test('explainFailedJob reports null error for failed job with clean log', () => {
  const job = { id: 1, name: 'x', status: 'failed', log: 'nothing here' }
  const r = explainFailedJob(job)
  assert.equal(r.ok, true)
  assert.equal(r.error, null)
})

test('explainFailedJob caps oversized log input', () => {
  const big = 'a'.repeat(500000)
  const job = { id: 1, name: 'x', status: 'failed', log: big + '\nerror: real failure' }
  const r = explainFailedJob(job)
  assert.equal(r.ok, true)
  assert.equal(r.capped, true)
  assert.ok(r.logLength > 200000)
  assert.match(r.error, /error: real failure/)
})
