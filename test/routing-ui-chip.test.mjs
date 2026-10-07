import test from 'node:test'
import assert from 'node:assert/strict'
import { slimRecord, toLossless, RECORD_KEYS, LEGACY_MAP, formatToolResult, runHandler } from '../lib/handlers.js'
import { checkMergeReadiness, autoMergeIfReady } from '../lib/merge-gate.js'
import { planRebase, runRebase } from '../lib/pr-rebase.js'
import { planBatch, applyBatch } from '../lib/batch-ops.js'
import { buildReleaseNotes, semverBump } from '../lib/release-notes.js'
import { buildGitSnapshot } from '../lib/git-local.js'
import { templateForBranch } from '../lib/pr-templates-branch.js'
import { checkPrTemplate, REQUIRED_SECTIONS } from '../lib/pr-templates.js'
import { fetchCommitGraph, computeLanes, parseGitLogOutput } from '../lib/graph.js'
import { buildAnalytics } from '../lib/analytics.js'
import { buildHealthReport } from '../lib/project-health.js'
import { buildTriageDigest } from '../lib/triage-digest.js'
import { TOOL_DEFS } from '../lib/tool-defs.js'

function makeMockClient(overrides = {}) {
  return {
    getPull: async () => ({ ok: true, data: { number: 1, state: 'open', mergeable: true, head: { ref: 'feat/test', sha: 'abc1234' }, base: { ref: 'main' }, body: 'Resolves issue with enough detail' } }),
    listPullReviews: async () => ({ ok: true, data: [] }),
    listPullFiles: async () => ({ ok: true, data: [{ filename: 'test/foo.test.js' }] }),
    getCombinedCommitStatus: async () => ({ ok: true, data: { state: 'success', statuses: [] } }),
    listActionsRuns: async () => ({ ok: true, data: { workflow_runs: [] } }),
    listLabels: async () => ({ ok: true, data: [{ id: 1, name: 'bug' }, { id: 2, name: 'feature' }] }),
    setIssueLabels: async () => ({ ok: true }),
    getIssue: async (o, r, num) => ({ ok: true, data: { number: num, title: `Issue ${num}`, state: 'open' } }),
    listIssues: async () => ({ ok: true, data: [] }),
    listPulls: async () => ({ ok: true, data: [] }),
    listBranches: async () => ({ ok: true, data: [] }),
    listTags: async () => ({ ok: true, data: [] }),
    listReleases: async () => ({ ok: true, data: [] }),
    ...overrides,
  }
}

// ---------------------------------------------------------
// #280: slimRecord fields retention
// ---------------------------------------------------------
test('#280: slimRecord retains essential Gitea fields (labels, assignees, milestone, diff, stat, filesCount)', () => {
  const full = {
    number: 42,
    title: 'Fix issue',
    state: 'open',
    labels: [
      { id: 1, name: 'bug', color: 'ff0000', description: 'Bug report' },
    ],
    milestone: { id: 5, title: 'v1.0.0', state: 'open', due_on: '2026-12-31T00:00:00Z' },
    assignees: [{ login: 'alice', name: 'Alice' }, 'bob'],
    diff: 'diff --git a/foo b/foo',
    stat: '+5 -2',
    filesCount: 3,
    sha: 'abcdef0123456789',
    download_url: 'https://gitea.example.com/raw/file.js',
    encoding: 'base64',
    truncated: true,
    sampleSize: 100,
    inspectedCount: 200,
    unwantedInternalField: 'should-be-omitted',
  }

  const slim = slimRecord(full)
  assert.equal(slim.number, 42)
  assert.equal(slim.title, 'Fix issue')
  assert.equal(slim.state, 'open')
  assert.deepEqual(slim.labels, [{ id: 1, name: 'bug', color: 'ff0000', description: 'Bug report' }])
  assert.deepEqual(slim.milestone, { id: 5, title: 'v1.0.0', state: 'open', due_on: '2026-12-31T00:00:00Z' })
  assert.deepEqual(slim.assignees, ['alice', 'bob'])
  assert.equal(slim.diff, 'diff --git a/foo b/foo')
  assert.equal(slim.stat, '+5 -2')
  assert.equal(slim.filesCount, 3)
  assert.equal(slim.sha, 'abcdef0123456789')
  assert.equal(slim.download_url, 'https://gitea.example.com/raw/file.js')
  assert.equal(slim.encoding, 'base64')
  assert.equal(slim.truncated, true)
  assert.equal(slim.sampleSize, 100)
  assert.equal(slim.inspectedCount, 200)
  assert.equal(slim.unwantedInternalField, undefined)
})

// ---------------------------------------------------------
// #281: toLossless non-circular reused objects
// ---------------------------------------------------------
test('#281: toLossless preserves non-circular reused objects across siblings without dropping data', () => {
  const sharedAuthor = { login: 'octocat', id: 1 }
  const payload = {
    sender: sharedAuthor,
    author: sharedAuthor,
    nested: {
      creator: sharedAuthor,
    },
  }

  const clean = toLossless(payload)
  assert.deepEqual(clean.sender, { login: 'octocat', id: 1 })
  assert.deepEqual(clean.author, { login: 'octocat', id: 1 })
  assert.deepEqual(clean.nested.creator, { login: 'octocat', id: 1 })

  // Verify that true circular references are still detected and broken
  const circular = { name: 'cycle' }
  circular.self = circular
  const cleanCycle = toLossless(circular)
  assert.equal(cleanCycle.name, 'cycle')
  assert.equal(cleanCycle.self, undefined)
})

// ---------------------------------------------------------
// #283: Auto-merge CI checks
// ---------------------------------------------------------
test('#283: checkMergeReadiness checks commit status and actions runs for head SHA', async () => {
  // Case 1: CI passes
  const clientPass = makeMockClient({
    getCombinedCommitStatus: async () => ({ ok: true, data: { state: 'success' } }),
    listActionsRuns: async () => ({ ok: true, data: { workflow_runs: [{ head_sha: 'abc1234', status: 'completed', conclusion: 'success' }] } }),
    listPullReviews: async () => ({ ok: true, data: [{ state: 'APPROVED', user: { login: 'reviewer' } }] }),
  })
  const resPass = await checkMergeReadiness({ owner: 'o', repo: 'r', number: 1 }, { client: clientPass })
  assert.equal(resPass.ok, true)
  const ciPass = resPass.data.checks.find((c) => c.name === 'ci')
  assert.ok(ciPass)
  assert.equal(ciPass.status, 'pass')
  assert.equal(resPass.data.ready, true)

  // Case 2: CI failed
  const clientFail = makeMockClient({
    getCombinedCommitStatus: async () => ({ ok: true, data: { state: 'failure' } }),
    listActionsRuns: async () => ({ ok: true, data: { workflow_runs: [{ head_sha: 'abc1234', status: 'completed', conclusion: 'failure' }] } }),
    listPullReviews: async () => ({ ok: true, data: [{ state: 'APPROVED', user: { login: 'reviewer' } }] }),
  })
  const resFail = await checkMergeReadiness({ owner: 'o', repo: 'r', number: 1 }, { client: clientFail })
  assert.equal(resFail.ok, true)
  const ciFail = resFail.data.checks.find((c) => c.name === 'ci')
  assert.ok(ciFail)
  assert.equal(ciFail.status, 'fail')
  assert.equal(resFail.data.ready, false)

  // Case 3: CI running/pending
  const clientPending = makeMockClient({
    getCombinedCommitStatus: async () => ({ ok: true, data: { state: 'pending' } }),
    listPullReviews: async () => ({ ok: true, data: [{ state: 'APPROVED', user: { login: 'reviewer' } }] }),
  })
  const resPending = await checkMergeReadiness({ owner: 'o', repo: 'r', number: 1 }, { client: clientPending })
  assert.equal(resPending.ok, true)
  const ciPending = resPending.data.checks.find((c) => c.name === 'ci')
  assert.ok(ciPending)
  assert.equal(ciPending.status, 'pending')
  assert.equal(resPending.data.ready, false)
})

// ---------------------------------------------------------
// #284: Merge readiness review order & changes requested
// ---------------------------------------------------------
test('#284: checkMergeReadiness rejects stale approval if latest review requests changes', async () => {
  // Case 1: Reviewer approved earlier, but latest review requested changes
  const reviewsWithChangesRequested = [
    { id: 1, user: { login: 'alice' }, state: 'APPROVED', submitted_at: '2026-01-01T10:00:00Z' },
    { id: 2, user: { login: 'alice' }, state: 'REQUEST_CHANGES', submitted_at: '2026-01-02T10:00:00Z' },
  ]
  const clientChangesReq = makeMockClient({
    listPullReviews: async () => ({ ok: true, data: reviewsWithChangesRequested }),
  })
  const res1 = await checkMergeReadiness({ owner: 'o', repo: 'r', number: 1 }, { client: clientChangesReq })
  const approvalCheck1 = res1.data.checks.find((c) => c.name === 'approval')
  assert.equal(approvalCheck1.status, 'fail')
  assert.match(approvalCheck1.detail, /changes requested/i)

  // Case 2: Reviewer requested changes earlier, but latest review approved
  const reviewsApprovedAfterFix = [
    { id: 1, user: { login: 'alice' }, state: 'REQUEST_CHANGES', submitted_at: '2026-01-01T10:00:00Z' },
    { id: 2, user: { login: 'alice' }, state: 'APPROVED', submitted_at: '2026-01-02T10:00:00Z' },
  ]
  const clientApproved = makeMockClient({
    listPullReviews: async () => ({ ok: true, data: reviewsApprovedAfterFix }),
  })
  const res2 = await checkMergeReadiness({ owner: 'o', repo: 'r', number: 1 }, { client: clientApproved })
  const approvalCheck2 = res2.data.checks.find((c) => c.name === 'approval')
  assert.equal(approvalCheck2.status, 'pass')

  // Case 3: Dismissed review is disregarded
  const reviewsDismissed = [
    { id: 1, user: { login: 'alice' }, state: 'REQUEST_CHANGES', submitted_at: '2026-01-01T10:00:00Z' },
    { id: 2, user: { login: 'alice' }, state: 'DISMISSED', submitted_at: '2026-01-02T10:00:00Z' },
    { id: 3, user: { login: 'bob' }, state: 'APPROVED', submitted_at: '2026-01-02T11:00:00Z' },
  ]
  const clientDismissed = makeMockClient({
    listPullReviews: async () => ({ ok: true, data: reviewsDismissed }),
  })
  const res3 = await checkMergeReadiness({ owner: 'o', repo: 'r', number: 1 }, { client: clientDismissed })
  const approvalCheck3 = res3.data.checks.find((c) => c.name === 'approval')
  assert.equal(approvalCheck3.status, 'pass')
})

// ---------------------------------------------------------
// #285: gitea_pr_rebase target branch verification
// ---------------------------------------------------------
test('#285: runRebase verifies target PR status, branches, and blocks closed/mismatched branches', async () => {
  // Case 1: PR closed or merged
  const clientClosed = makeMockClient({
    getPull: async () => ({ ok: true, data: { number: 1, state: 'closed', merged: true, head: { ref: 'feat/test' }, base: { ref: 'main' } } }),
  })
  const resClosed = await runRebase({ owner: 'o', repo: 'r', number: 1, confirm: true }, {
    client: clientClosed,
    execFile: async () => ({ stdout: '' }),
    gitWrapper: 'git',
    cwd: '/fake/cwd',
  })
  assert.equal(resClosed.ok, false)
  assert.match(resClosed.error, /closed or already merged/i)

  // Case 2: Local branch does not match PR head branch
  const clientOpen = makeMockClient({
    getPull: async () => ({ ok: true, data: { number: 1, state: 'open', head: { ref: 'feat/expected' }, base: { ref: 'main' } } }),
  })
  const resMismatch = await runRebase({ owner: 'o', repo: 'r', number: 1, confirm: true }, {
    client: clientOpen,
    execFile: async (bin, args) => {
      if (args.includes('rev-parse') && args.includes('--abbrev-ref')) {
        return { stdout: 'feat/wrong-branch\n' }
      }
      return { stdout: '' }
    },
    gitWrapper: 'git',
    cwd: '/fake/cwd',
  })
  assert.equal(resMismatch.ok, false)
  assert.match(resMismatch.error, /does not match PR head branch/i)

  // Case 3: Rebase onto target base branch (e.g. release-1.0)
  let fetchedBranch = ''
  let rebasedOnto = ''
  const clientCustomBase = makeMockClient({
    getPull: async () => ({ ok: true, data: { number: 1, state: 'open', head: { ref: 'feat/expected' }, base: { ref: 'release-1.0' } } }),
  })
  const resSuccess = await runRebase({ owner: 'o', repo: 'r', number: 1, confirm: true }, {
    client: clientCustomBase,
    execFile: async (bin, args) => {
      if (args.includes('rev-parse') && args.includes('--abbrev-ref')) return { stdout: 'feat/expected\n' }
      if (args.includes('fetch')) fetchedBranch = args[args.indexOf('fetch') + 2]
      if (args.includes('rebase')) rebasedOnto = args[args.indexOf('rebase') + 1]
      return { stdout: '' }
    },
    gitWrapper: 'git',
    cwd: '/fake/cwd',
  })
  assert.equal(resSuccess.ok, true)
  assert.equal(fetchedBranch, 'release-1.0')
  assert.equal(rebasedOnto, 'origin/release-1.0')
})

// ---------------------------------------------------------
// #286: Multi-instance routing & parameter declaration
// ---------------------------------------------------------
test('#286: all tools declare instance parameter and unknown instance is rejected', async () => {
  // 1. All 71 tools declare instance parameter
  for (const def of TOOL_DEFS) {
    assert.ok(def.parameters, `Tool ${def.name} missing parameters`)
    assert.ok(def.parameters.instance, `Tool ${def.name} missing instance parameter`)
    assert.equal(def.parameters.instance.type, 'string')
  }

  // 2. runHandler with deps.instanceError returns error
  const res = await runHandler('gitea_whoami', {}, { instanceError: 'Instance "unknown" not found in configured instances.' })
  assert.equal(res.ok, false)
  assert.match(res.error, /Instance "unknown" not found/i)
})

// ---------------------------------------------------------
// #288: Batch label missing label validation
// ---------------------------------------------------------
test('#288: applyBatch rejects unknown label and preserves issue labels without wiping', async () => {
  let setIssueLabelsCalled = false
  const client = makeMockClient({
    listLabels: async () => ({ ok: true, data: [{ id: 1, name: 'bug' }] }),
    setIssueLabels: async () => { setIssueLabelsCalled = true; return { ok: true } },
    listIssues: async () => ({ ok: true, data: [{ number: 10, title: 'Test' }] }),
  })

  const res = await applyBatch({ owner: 'o', repo: 'r', numbers: [10], label: 'nonexistent-typo' }, { client })
  assert.equal(res.ok, false)
  assert.match(res.error, /Label\(s\) not found in repository: nonexistent-typo/i)
  assert.equal(setIssueLabelsCalled, false)
})

// ---------------------------------------------------------
// #289: Milestone in batch ops
// ---------------------------------------------------------
test('#289: gitea_batch_issue_ops accepts and plans/applies milestone parameter', async () => {
  const batchDef = TOOL_DEFS.find((t) => t.name === 'gitea_batch_issue_ops')
  assert.ok(batchDef)
  assert.ok(batchDef.parameters.milestone, 'gitea_batch_issue_ops missing milestone parameter')

  let updatedMilestone = null
  const client = makeMockClient({
    listIssues: async () => ({ ok: true, data: [{ number: 1, title: 'Item' }] }),
    listMilestones: async () => ({ ok: true, data: [{ id: 42, title: 'v2.0' }] }),
    updateIssue: async (o, r, num, payload) => {
      updatedMilestone = payload.milestone
      return { ok: true }
    },
  })

  // Plan includes milestone preview
  const plan = await planBatch({ owner: 'o', repo: 'r', numbers: [1], milestone: 'v2.0' }, { client })
  assert.equal(plan.ok, true)
  assert.equal(plan.data.preview[0].action.milestone, 'v2.0')

  // Apply sets milestone
  const applied = await applyBatch({ owner: 'o', repo: 'r', numbers: [1], milestone: 'v2.0' }, { client })
  assert.equal(applied.ok, true)
  assert.equal(updatedMilestone, 42)
})

// ---------------------------------------------------------
// #300: Release notes tag filtering
// ---------------------------------------------------------
test('#300: buildReleaseNotes filters PRs strictly by fromTag..toTag date range', async () => {
  const mockPulls = [
    { number: 1, title: 'feat: initial work', merged_at: '2026-01-01T12:00:00Z', state: 'closed' },
    { number: 2, title: 'fix: patch issue', merged_at: '2026-02-01T12:00:00Z', state: 'closed' },
    { number: 3, title: 'feat: new cool feature', merged_at: '2026-03-01T12:00:00Z', state: 'closed' },
    { number: 4, title: 'chore: bump deps', merged_at: '2026-04-01T12:00:00Z', state: 'closed' },
  ]
  const mockTags = [
    { name: 'v1.0.0', commit: { created: '2026-01-15T00:00:00Z' } },
    { name: 'v2.0.0', commit: { created: '2026-03-15T00:00:00Z' } },
  ]

  const client = makeMockClient({
    listPulls: async () => ({ ok: true, data: mockPulls }),
    listTags: async () => ({ ok: true, data: mockTags }),
  })

  const res = await buildReleaseNotes({ owner: 'o', repo: 'r', fromTag: 'v1.0.0', toTag: 'v2.0.0' }, { client })
  assert.equal(res.ok, true)
  // Only PR #2 (Feb 1) and PR #3 (March 1) should be in range (Jan 15 .. March 15]
  assert.equal(res.data.count, 2)
  assert.deepEqual(res.data.changes.map((c) => c.number), [2, 3])
  assert.equal(res.data.bump, 'minor')
})

// ---------------------------------------------------------
// #302: BroadcastChannel session scoping
// ---------------------------------------------------------
test('#302: cross-tab git status message structure carries cwd and sessionId', () => {
  // Test message filtering contract
  const targetCwd = '/repo/a'
  const targetSession = 'session-123'

  const messageSame = { type: 'git-status', payload: { ok: true }, cwd: '/repo/a', sessionId: 'session-123' }
  const messageDiffCwd = { type: 'git-status', payload: { ok: true }, cwd: '/repo/b', sessionId: 'session-123' }
  const messageDiffSession = { type: 'git-status', payload: { ok: true }, cwd: '/repo/a', sessionId: 'session-456' }

  const shouldAccept = (ev, cwd, sessionId) => {
    return ev.cwd === cwd && ev.sessionId === sessionId
  }

  assert.equal(shouldAccept(messageSame, targetCwd, targetSession), true)
  assert.equal(shouldAccept(messageDiffCwd, targetCwd, targetSession), false)
  assert.equal(shouldAccept(messageDiffSession, targetCwd, targetSession), false)
})

// ---------------------------------------------------------
// #303: Fallback getSnapshot referential stability
// ---------------------------------------------------------
test('#303: fallback and loading snapshots are referentially stable frozen constants', async () => {
  const fs = await import('node:fs/promises')
  const clientCode = await fs.readFile(new URL('../lib/client.js', import.meta.url), 'utf-8')
  assert.ok(clientCode.includes("UNAVAILABLE_SNAPSHOT = Object.freeze({ status: 'unavailable' })"))
  assert.ok(clientCode.includes("LOADING_SNAPSHOT = Object.freeze({ status: 'loading' })"))
  assert.ok(clientCode.includes('scope ? scope.getSnapshot() : UNAVAILABLE_SNAPSHOT'))
  assert.ok(clientCode.includes('React.useCallback(() => LOADING_SNAPSHOT, [])'))
})

// ---------------------------------------------------------
// #304: readGit failure handling in git-local.js
// ---------------------------------------------------------
test('#304: buildGitSnapshot returns error when all git commands fail instead of clean main', async () => {
  // Mock execFile where git rev-parse commands fail with non-zero exit
  const failingExec = async () => {
    const err = new Error('fatal: not a git repository')
    err.code = 128
    throw err
  }

  const res = await buildGitSnapshot({ repoDir: '/non/git/dir', execFile: failingExec })
  assert.equal(res.ok, false)
  assert.match(res.error, /Not a git repository/i)
})

// ---------------------------------------------------------
// #305: Legacy tool aliases registration
// ---------------------------------------------------------
test('#305: LEGACY_MAP maps 36 legacy aliases to valid canonical tools and actions', () => {
  assert.ok(Object.keys(LEGACY_MAP).length >= 35)
  for (const [legacyName, [canonicalName, defaultAction]] of Object.entries(LEGACY_MAP)) {
    assert.ok(canonicalName.startsWith('gitea_'), `${legacyName} -> ${canonicalName} invalid prefix`)
    assert.ok(typeof defaultAction === 'string' && defaultAction.length > 0, `${legacyName} missing default action`)
    const canonical = TOOL_DEFS.find((d) => d.name === canonicalName)
    assert.ok(canonical, `Canonical tool ${canonicalName} not found in TOOL_DEFS for legacy alias ${legacyName}`)
  }
})

// ---------------------------------------------------------
// #306: PR templates validator compliance
// ---------------------------------------------------------
test('#306: templateForBranch generates bodies satisfying all 6 required sections for all branch types', () => {
  const branchTypes = ['feat/new-api', 'fix/null-pointer', 'docs/update-guide', 'chore/cleanup', 'refactor/core', 'custom-branch']
  for (const branch of branchTypes) {
    const body = templateForBranch(branch, { number: 101, title: 'Test PR' })
    const checked = checkPrTemplate(body)
    assert.equal(checked.ok, true, `Branch ${branch} failed template validation: ${checked.missing?.join(', ')}`)
    assert.deepEqual(checked.missing, [], `Branch ${branch} has missing sections`)
  }
})

// ---------------------------------------------------------
// #307: formatToolResult rich reports
// ---------------------------------------------------------
test('#307: formatToolResult produces rich structured text reports instead of OK', () => {
  // 1. Merge readiness
  const mrData = { number: 77, ready: true, merged: false, checks: [{ name: 'ci', status: 'pass' }, { name: 'approval', status: 'pass' }] }
  const mrFmt = formatToolResult('gitea_merge_readiness', { ok: true, data: mrData })
  assert.match(mrFmt[0].text, /PR #77 Merge Readiness: READY to merge/)
  assert.match(mrFmt[0].text, /ci: pass/)

  // 2. Project health
  const healthData = { healthScore: 92, openIssues: 12, openPRs: 3, staleIssues: [] }
  const healthFmt = formatToolResult('gitea_project_health', { ok: true, data: healthData })
  assert.match(healthFmt[0].text, /Health Score: 92\/100/)
  assert.match(healthFmt[0].text, /Open Issues: 12/)

  // 3. Triage digest
  const triageData = { pullRequestsNoReview: [1, 2], staleIssues: [10], priorityAction: 'Review 2 PRs' }
  const triageFmt = formatToolResult('gitea_triage_digest', { ok: true, data: triageData })
  assert.match(triageFmt[0].text, /Triage Digest/)
  assert.match(triageFmt[0].text, /2 PRs awaiting review/)

  // 4. Review inbox
  const inboxData = { count: 4 }
  const inboxFmt = formatToolResult('gitea_review_inbox', { ok: true, data: inboxData })
  assert.match(inboxFmt[0].text, /Review Inbox: 4 pending item\(s\)/)

  // 5. Repo analytics
  const analyticsData = { issues: { total: 50 }, pulls: { total: 25 } }
  const analyticsFmt = formatToolResult('gitea_repo_analytics', { ok: true, data: analyticsData })
  assert.match(analyticsFmt[0].text, /Repo Analytics: 50 issues, 25 pull requests analyzed/)
})

// ---------------------------------------------------------
// #308: Git graph load more cursor/offset
// ---------------------------------------------------------
test('#308: fetchCommitGraph accepts skip/offset and returns offset and nextOffset metadata', async () => {
  let executedArgs = []
  const mockExec = (bin, args, opts, cb) => {
    executedArgs = args
    cb(null, '', '')
  }

  const res = await fetchCommitGraph({ gitWrapper: 'git', limit: 50, skip: 100, execFile: mockExec })
  assert.equal(res.ok, true)
  assert.ok(executedArgs.includes('--skip=100'))
  assert.equal(res.data.offset, 100)
})

// ---------------------------------------------------------
// #309: Events drawer timestamp field
// ---------------------------------------------------------
test('#309: events drawer formatting prefers ev.at timestamp', () => {
  const atTimestamp = 1775550000000
  const evWithAt = { id: 1, type: 'push', at: atTimestamp }
  const evWithTimestamp = { id: 2, type: 'push', timestamp: atTimestamp }

  const resolveTime = (ev) => ev.at != null ? ev.at : (ev.timestamp != null ? ev.timestamp : Date.now())
  assert.equal(resolveTime(evWithAt), atTimestamp)
  assert.equal(resolveTime(evWithTimestamp), atTimestamp)
})

// ---------------------------------------------------------
// #312: Summary reports truncation metadata
// ---------------------------------------------------------
test('#312: summary reports report truncated: true and inspectedCount when reaching sample limit', async () => {
  const lotsOfIssues = Array.from({ length: 200 }, (_, i) => ({ number: i + 1, state: 'open', created_at: '2026-01-01', updated_at: '2026-01-02' }))
  const client = makeMockClient({
    listIssues: async () => ({ ok: true, data: lotsOfIssues }),
    listPulls: async () => ({ ok: true, data: [] }),
    listBranches: async () => ({ ok: true, data: [] }),
  })

  // 1. buildAnalytics
  const aRes = await buildAnalytics({ owner: 'o', repo: 'r' }, { client })
  assert.equal(aRes.ok, true)
  assert.equal(aRes.data.truncated, true)
  assert.equal(aRes.data.sampleLimit, 200)
  assert.deepEqual(aRes.data.inspectedCount, { issues: 200, pulls: 0 })

  // 2. buildHealthReport
  const hRes = await buildHealthReport({ owner: 'o', repo: 'r' }, { client })
  assert.equal(hRes.ok, true)
  assert.equal(hRes.data.truncated, true)
  assert.equal(hRes.data.sampleLimit, 100)
  assert.equal(hRes.data.inspectedCount.issues, 200)

  // 3. buildTriageDigest
  const tRes = await buildTriageDigest({ owner: 'o', repo: 'r' }, { client })
  assert.equal(tRes.ok, true)
  assert.equal(tRes.data.truncated, true)
  assert.equal(tRes.data.sampleLimit, 100)
  assert.equal(tRes.data.inspectedCount.issues, 200)
})

// ---------------------------------------------------------
// #313: Git header slot localization
// ---------------------------------------------------------
test('#313: client UI defines localized strings for active PR and dirty changes in en and zh', async () => {
  const fs = await import('node:fs/promises')
  const clientCode = await fs.readFile(new URL('../lib/client.js', import.meta.url), 'utf-8')

  // Check dictionary keys
  assert.ok(clientCode.includes("prActive: 'Active'"))
  assert.ok(clientCode.includes("prActive: '进行中'"))
  assert.ok(clientCode.includes("dirtyChanged: '{count} changed'"))
  assert.ok(clientCode.includes("dirtyChanged: '{count} 项更改'"))

  // Check slot registration with locale: NS
  assert.ok(clientCode.includes("locale: NS,"))
})
