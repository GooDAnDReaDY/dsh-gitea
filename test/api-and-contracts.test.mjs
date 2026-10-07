import { test } from 'node:test'
import assert from 'node:assert/strict'
import { GiteaClient } from '../lib/gitea-client.js'
import { runHandler, formatToolResult } from '../lib/handlers.js'

function baseDeps(client, overrides = {}) {
  return {
    client,
    settings: { defaultOwner: 'acme', defaultRepo: 'core', ...overrides.settings },
    configured: { baseUrl: 'https://gitea.local', token: 'tok', ...overrides.configured },
    ...overrides,
  }
}

// ============================================================================
// #290: searchIssues routes to /repos/issues/search and filters by repo
// ============================================================================

test('#290: GiteaClient.searchIssues requests /repos/issues/search and filters client-side by repo', async () => {
  let capturedUrl
  let capturedInit
  const mockFetch = async (url, init) => {
    capturedUrl = url
    capturedInit = init
    return {
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      text: async () => JSON.stringify([
        { id: 101, title: 'Bug in target repo', repository: { name: 'my-repo', full_name: 'org/my-repo' } },
        { id: 102, title: 'Bug in another repo', repository: { name: 'other-repo', full_name: 'org/other-repo' } },
        { id: 103, title: 'Another issue in target repo', repository: { name: 'my-repo', full_name: 'org/my-repo' } },
      ]),
    }
  }

  const client = new GiteaClient({ baseUrl: 'https://gitea.local', token: 'tok', fetchImpl: mockFetch })
  const res = await client.searchIssues({ q: 'memory', repo: 'my-repo', state: 'open' })

  assert.equal(res.ok, true)
  assert.ok(capturedUrl.includes('/api/v1/repos/issues/search'))
  assert.ok(capturedUrl.includes('q=memory'))
  assert.ok(capturedUrl.includes('state=open'))
  assert.ok(!capturedUrl.includes('repo='), 'repo should be stripped from remote search query')
  assert.equal(res.data.length, 2)
  assert.equal(res.data[0].id, 101)
  assert.equal(res.data[1].id, 103)
})

test('#290: GiteaClient.searchIssues without repo returns all items unfiltered', async () => {
  const mockFetch = async () => ({
    ok: true,
    status: 200,
    headers: { get: () => 'application/json' },
    text: async () => JSON.stringify([
      { id: 1, title: 'Issue 1' },
      { id: 2, title: 'Issue 2' },
    ]),
  })

  const client = new GiteaClient({ baseUrl: 'https://gitea.local', token: 'tok', fetchImpl: mockFetch })
  const res = await client.searchIssues({ q: 'leak' })

  assert.equal(res.ok, true)
  assert.equal(res.data.length, 2)
})

// ============================================================================
// #291: createPullComment routes to /pulls/{n}/reviews with event: COMMENT
// ============================================================================

test('#291: GiteaClient.createPullComment posts review comment to /pulls/{n}/reviews', async () => {
  let capturedUrl
  let capturedInit
  const mockFetch = async (url, init) => {
    capturedUrl = url
    capturedInit = init
    return {
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      text: async () => JSON.stringify({ id: 50, state: 'COMMENT' }),
    }
  }

  const client = new GiteaClient({ baseUrl: 'https://gitea.local', token: 'tok', fetchImpl: mockFetch })
  const res = await client.createPullComment('acme', 'core', 12, {
    path: 'lib/parser.js',
    line: 85,
    body: 'Possible null dereference here.',
    commit_id: 'abc1234',
  })

  assert.equal(res.ok, true)
  assert.equal(capturedUrl, 'https://gitea.local/api/v1/repos/acme/core/pulls/12/reviews')
  assert.equal(capturedInit.method, 'POST')

  const payload = JSON.parse(capturedInit.body)
  assert.equal(payload.event, 'COMMENT')
  assert.equal(payload.commit_id, 'abc1234')
  assert.equal(payload.comments.length, 1)
  assert.equal(payload.comments[0].path, 'lib/parser.js')
  assert.equal(payload.comments[0].new_position, 85)
  assert.equal(payload.comments[0].old_position, 0)
  assert.equal(payload.comments[0].body, 'Possible null dereference here.')
})

// ============================================================================
// #292: gitea_code_search capability gate and local git grep
// ============================================================================

test('#292: gitea_code_search executes local git grep when cwd and execFile are provided', async () => {
  let executedCmd
  let executedArgs
  let executedOpts
  const fakeExecFile = (file, args, opts, cb) => {
    executedCmd = file
    executedArgs = args
    executedOpts = opts
    const sampleOutput = ['lib/parser.js:42:const regex = /test/;', 'lib/utils.js:10:return regex.test(s);'].join('\n')
    cb(null, sampleOutput, '')
  }

  const deps = baseDeps({}, { cwd: '/workspace/project', execFile: fakeExecFile })
  const res = await runHandler('gitea_code_search', { q: 'regex', limit: 10 }, deps)

  assert.equal(res.ok, true)
  assert.equal(executedCmd, 'git')
  assert.ok(executedArgs.includes('grep'))
  assert.ok(executedArgs.includes('-n'))
  assert.ok(executedArgs.includes('-I'))
  assert.ok(executedArgs.includes('-e'))
  assert.ok(executedArgs.includes('regex'))
  assert.equal(executedOpts.cwd, '/workspace/project')
  assert.equal(res.data.length, 2)
  assert.equal(res.data[0].path, 'lib/parser.js')
  assert.equal(res.data[0].line, 42)
  assert.equal(res.data[0].text, 'const regex = /test/;')
})

test('#292: gitea_code_search returns empty array when git grep finds no matches (exit code 1)', async () => {
  const fakeExecFile = (file, args, opts, cb) => {
    const err = new Error('Command failed: git grep')
    err.code = 1
    cb(err, '', '')
  }

  const deps = baseDeps({}, { cwd: '/workspace/project', execFile: fakeExecFile })
  const res = await runHandler('gitea_code_search', { q: 'nonexistent' }, deps)

  assert.equal(res.ok, true)
  assert.deepEqual(res.data, [])
})

test('#292: gitea_code_search returns capability error when remote search returns 404', async () => {
  const client = {
    searchCode: async () => ({ ok: false, status: 404, error: 'Not Found' }),
  }
  const deps = baseDeps(client)
  const res = await runHandler('gitea_code_search', { q: 'something', owner: 'acme', repo: 'app' }, deps)

  assert.equal(res.ok, false)
  assert.match(res.error, /Gitea REST API does not provide a remote code search endpoint/)
})

// ============================================================================
// #293: markNotificationsRead routes to PUT /notifications
// ============================================================================

test('#293: GiteaClient.markNotificationsRead routes to PUT /notifications and handles 205', async () => {
  let capturedUrl
  let capturedInit
  const mockFetch = async (url, init) => {
    capturedUrl = url
    capturedInit = init
    return {
      ok: true,
      status: 205,
      headers: { get: () => '0' },
      text: async () => '',
    }
  }

  const client = new GiteaClient({ baseUrl: 'https://gitea.local', token: 'tok', fetchImpl: mockFetch })
  const res = await client.markNotificationsRead({ all: true })

  assert.equal(res.ok, true)
  assert.equal(capturedUrl, 'https://gitea.local/api/v1/notifications?all=true')
  assert.equal(capturedInit.method, 'PUT')
})

// ============================================================================
// #294: Actions rerun routes with run_id and job_id
// ============================================================================

test('#294: GiteaClient.rerunActionsJob calls /actions/runs/{run}/jobs/{job}/rerun', async () => {
  let capturedUrl
  let capturedInit
  const mockFetch = async (url, init) => {
    capturedUrl = url
    capturedInit = init
    return {
      ok: true,
      status: 201,
      headers: { get: () => 'application/json' },
      text: async () => JSON.stringify({ id: 99 }),
    }
  }

  const client = new GiteaClient({ baseUrl: 'https://gitea.local', token: 'tok', fetchImpl: mockFetch })
  const res = await client.rerunActionsJob('acme', 'core', 42, 7)

  assert.equal(res.ok, true)
  assert.equal(capturedUrl, 'https://gitea.local/api/v1/repos/acme/core/actions/runs/42/jobs/7/rerun')
  assert.equal(capturedInit.method, 'POST')
})

test('#294: GiteaClient.rerunActionsRun calls /actions/runs/{run}/rerun', async () => {
  let capturedUrl
  let capturedInit
  const mockFetch = async (url, init) => {
    capturedUrl = url
    capturedInit = init
    return {
      ok: true,
      status: 201,
      headers: { get: () => 'application/json' },
      text: async () => JSON.stringify({ id: 42 }),
    }
  }

  const client = new GiteaClient({ baseUrl: 'https://gitea.local', token: 'tok', fetchImpl: mockFetch })
  const res = await client.rerunActionsRun('acme', 'core', 42)

  assert.equal(res.ok, true)
  assert.equal(capturedUrl, 'https://gitea.local/api/v1/repos/acme/core/actions/runs/42/rerun')
  assert.equal(capturedInit.method, 'POST')
})

test('#294: GiteaClient.rerunActionsJob resolves run_id when only job_id is provided', async () => {
  const urls = []
  const mockFetch = async (url) => {
    urls.push(url)
    if (url.includes('/actions/jobs/7')) {
      return {
        ok: true,
        status: 200,
        headers: { get: () => 'application/json' },
        text: async () => JSON.stringify({ id: 7, run_id: 42 }),
      }
    }
    return {
      ok: true,
      status: 201,
      headers: { get: () => 'application/json' },
      text: async () => JSON.stringify({ id: 7 }),
    }
  }

  const client = new GiteaClient({ baseUrl: 'https://gitea.local', token: 'tok', fetchImpl: mockFetch })
  const res = await client.rerunActionsJob('acme', 'core', 7)

  assert.equal(res.ok, true)
  assert.equal(urls[0], 'https://gitea.local/api/v1/repos/acme/core/actions/jobs/7')
  assert.equal(urls[1], 'https://gitea.local/api/v1/repos/acme/core/actions/runs/42/jobs/7/rerun')
})

test('#294: gitea_ci action rerun passes run_id and job_id to client', async () => {
  let calledRunId
  let calledJobId
  const client = {
    rerunActionsJob: async (owner, repo, runId, jobId) => {
      calledRunId = runId
      calledJobId = jobId
      return { ok: true, data: { status: 'queued' } }
    },
  }
  const deps = baseDeps(client)
  const res = await runHandler('gitea_ci', {
    action: 'rerun',
    run_id: 10,
    job_id: 25,
    confirm: true,
    owner: 'acme',
    repo: 'core',
  }, deps)

  assert.equal(res.ok, true)
  assert.equal(calledRunId, 10)
  assert.equal(calledJobId, 25)
})

// ============================================================================
// #295: createBranch maps { new_branch_name, old_ref_name }
// ============================================================================

test('#295: GiteaClient.createBranch sends new_branch_name and old_ref_name', async () => {
  let capturedInit
  const mockFetch = async (url, init) => {
    capturedInit = init
    return {
      ok: true,
      status: 201,
      headers: { get: () => 'application/json' },
      text: async () => JSON.stringify({ name: 'feature/new' }),
    }
  }

  const client = new GiteaClient({ baseUrl: 'https://gitea.local', token: 'tok', fetchImpl: mockFetch })
  const res = await client.createBranch('acme', 'core', { branch_name: 'feature/new', ref: 'v1.0.0' })

  assert.equal(res.ok, true)
  const body = JSON.parse(capturedInit.body)
  assert.equal(body.new_branch_name, 'feature/new')
  assert.equal(body.old_ref_name, 'v1.0.0')
})

test('#295: gitea_branches action create passes new_branch_name to client', async () => {
  let passedPayload
  const client = {
    createBranch: async (owner, repo, payload) => {
      passedPayload = payload
      return { ok: true, data: { name: payload.new_branch_name } }
    },
  }
  const deps = baseDeps(client)
  const res = await runHandler('gitea_branches', {
    action: 'create',
    branch_name: 'hotfix/patch-1',
    ref: 'main',
    owner: 'acme',
    repo: 'core',
  }, deps)

  assert.equal(res.ok, true)
  assert.equal(passedPayload.new_branch_name, 'hotfix/patch-1')
  assert.equal(passedPayload.old_ref_name, 'main')
})

// ============================================================================
// #296: getPullMergeStatus and gitea_pr_merge_status distinction
// ============================================================================

test('#296: GiteaClient.getPullMergeStatus normalizes 204 to merged: true and 404 to merged: false', async () => {
  const client204 = new GiteaClient({
    baseUrl: 'https://gitea.local',
    token: 'tok',
    fetchImpl: async () => ({
      ok: true,
      status: 204,
      headers: { get: () => '0' },
      text: async () => '',
    }),
  })
  const res204 = await client204.getPullMergeStatus('acme', 'core', 15)
  assert.equal(res204.ok, true)
  assert.equal(res204.data.merged, true)

  const client404 = new GiteaClient({
    baseUrl: 'https://gitea.local',
    token: 'tok',
    fetchImpl: async () => ({
      ok: false,
      status: 404,
      headers: { get: () => 'application/json' },
      text: async () => JSON.stringify({ message: 'Pull request not merged' }),
    }),
  })
  const res404 = await client404.getPullMergeStatus('acme', 'core', 15)
  assert.equal(res404.ok, true)
  assert.equal(res404.data.merged, false)
})

test('#296: gitea_pr_merge_status and formatToolResult format merged vs mergeable vs conflict', async () => {
  // Scenario A: Already merged
  const clientA = {
    getPullMergeStatus: async () => ({ ok: true, data: { merged: true } }),
    getPull: async () => ({ ok: true, data: { number: 12, state: 'closed', merged: true, mergeable: false } }),
  }
  const resA = await runHandler('gitea_pr_merge_status', { number: 12, owner: 'acme', repo: 'core' }, baseDeps(clientA))
  assert.equal(resA.ok, true)
  assert.equal(resA.data.merged, true)
  assert.equal(resA.data.mergeable, false)
  const fmtA = formatToolResult('gitea_pr_merge_status', resA)
  assert.match(fmtA[0].text, /PR #12 is already merged/)

  // Scenario B: Open and mergeable
  const clientB = {
    getPullMergeStatus: async () => ({ ok: true, data: { merged: false } }),
    getPull: async () => ({ ok: true, data: { number: 14, state: 'open', merged: false, mergeable: true } }),
  }
  const resB = await runHandler('gitea_pr_merge_status', { number: 14, owner: 'acme', repo: 'core' }, baseDeps(clientB))
  assert.equal(resB.ok, true)
  assert.equal(resB.data.merged, false)
  assert.equal(resB.data.mergeable, true)
  const fmtB = formatToolResult('gitea_pr_merge_status', resB)
  assert.match(fmtB[0].text, /ready to merge \(no conflicts detected\)/)

  // Scenario C: Open with conflicts
  const clientC = {
    getPullMergeStatus: async () => ({ ok: true, data: { merged: false } }),
    getPull: async () => ({ ok: true, data: { number: 16, state: 'open', merged: false, mergeable: false } }),
  }
  const resC = await runHandler('gitea_pr_merge_status', { number: 16, owner: 'acme', repo: 'core' }, baseDeps(clientC))
  assert.equal(resC.ok, true)
  assert.equal(resC.data.merged, false)
  assert.equal(resC.data.mergeable, false)
  assert.equal(resC.data.has_issues, true)
  const fmtC = formatToolResult('gitea_pr_merge_status', resC)
  assert.match(fmtC[0].text, /cannot be merged automatically/)
})

// ============================================================================
// #297: HTTP parser plaintext job logs and malformed JSON detection
// ============================================================================

test('#297: GiteaClient.getJobLogs returns plaintext without parsing error', async () => {
  const rawLogs = ['2026-10-07T10:00:00Z Step 1: Starting container', '2026-10-07T10:00:05Z Step 2: Running npm test', 'PASSED'].join('\n') + '\n'
  const mockFetch = async (url, init) => {
    assert.equal(init.headers.Accept, 'text/plain')
    return {
      ok: true,
      status: 200,
      headers: { get: (h) => (h === 'content-type' ? 'text/plain; charset=utf-8' : null) },
      text: async () => rawLogs,
    }
  }

  const client = new GiteaClient({ baseUrl: 'https://gitea.local', token: 'tok', fetchImpl: mockFetch })
  const res = await client.getJobLogs('acme', 'core', 99)

  assert.equal(res.ok, true)
  assert.equal(res.data, rawLogs)
})

test('#297: GiteaClient.request returns informative error when 200 response has malformed JSON', async () => {
  const mockFetch = async () => ({
    ok: true,
    status: 200,
    headers: { get: (h) => (h === 'content-type' ? 'application/json; charset=utf-8' : null) },
    text: async () => '<html><body>502 Bad Gateway from reverse proxy</body></html>',
  })

  const client = new GiteaClient({ baseUrl: 'https://gitea.local', token: 'tok', fetchImpl: mockFetch })
  const res = await client.listIssues('acme', 'core')

  assert.equal(res.ok, false)
  assert.equal(res.status, 200)
  assert.match(res.error, /Failed to parse JSON response/)
})

test('#297: GiteaClient.request safely preserves non-JSON error bodies on HTTP 500', async () => {
  const mockFetch = async () => ({
    ok: false,
    status: 500,
    headers: { get: (h) => (h === 'content-type' ? 'text/html' : null) },
    text: async () => 'Internal Server Error: database connection timeout',
  })

  const client = new GiteaClient({ baseUrl: 'https://gitea.local', token: 'tok', fetchImpl: mockFetch })
  const res = await client.listIssues('acme', 'core')

  assert.equal(res.ok, false)
  assert.equal(res.status, 500)
  assert.match(res.error, /Internal Server Error/)
})
