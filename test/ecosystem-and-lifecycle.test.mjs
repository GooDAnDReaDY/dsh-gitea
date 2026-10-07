import test from 'node:test'
import assert from 'node:assert/strict'
import { createGiteaTaskService } from '../lib/task-service.js'
import { runWorktreeGc } from '../lib/worktree-gc.js'
import { runIssueToPr } from '../lib/issue-to-pr.js'
import { analyzeDiffContent, formatReviewMarkdown, runAiReview } from '../lib/ai-review.js'
import { issueToTaskCard, taskCardToGitea, runTaskTrackerSync, STATUS_MAPPING } from '../lib/task-tracker-sync.js'
import { formatReleaseMemory, formatPullRequestMemory, runMemoryBrainSync } from '../lib/memory-brain-sync.js'
import { sanitizeIncidentLogs, buildIncidentBody, runIncidentReport } from '../lib/incident-report.js'
import { validateSemverBump, generateMultilingualReleaseNotes, runReleaseAssistant } from '../lib/release-assistant.js'
import { formatToolResult } from '../lib/handlers.js'

// ==========================================
// 1. #298 & #299: task-service.js resolution & isolation
// ==========================================
test('#298: task service resolves string label names to numeric IDs and de-duplicates', async () => {
  let createdPayload = null
  const service = createGiteaTaskService({
    getConfig: () => ({ baseUrl: 'https://gitea.example.com', tokenEnv: 'GITEA_TOKEN', defaultOwner: 'org', defaultRepo: 'repo' }),
    resolveToken: async () => 'secret',
    clientFactory: () => ({
      listLabels: async (owner, repo) => ({
        ok: true,
        data: [
          { id: 10, name: 'type/bug' },
          { id: 20, name: 'priority/high' },
        ],
      }),
      createIssue: async (owner, repo, body) => {
        createdPayload = body
        return { ok: true, data: { number: 42 } }
      },
    }),
  })

  const res = await service.createIssue({
    title: 'Bug report',
    labels: ['type/bug', 20, '20'],
  })

  assert.equal(res.ok, true)
  assert.deepEqual(createdPayload.labels.sort(), [10, 20])
})

test('#298: task service fails closed with labels-not-found when unknown labels are specified', async () => {
  let created = false
  const service = createGiteaTaskService({
    getConfig: () => ({ baseUrl: 'https://gitea.example.com', tokenEnv: 'GITEA_TOKEN', defaultOwner: 'org', defaultRepo: 'repo' }),
    resolveToken: async () => 'secret',
    clientFactory: () => ({
      listLabels: async () => ({
        ok: true,
        data: [{ id: 10, name: 'type/bug' }],
      }),
      createIssue: async () => { created = true; return { ok: true } },
    }),
  })

  const res = await service.createIssue({
    title: 'Unknown label',
    labels: ['nonexistent-label'],
  })

  assert.equal(res.ok, false)
  assert.equal(res.code, 'labels-not-found')
  assert.equal(created, false)
})

test('#299: task service ignores foreign repository issues with matching externalRef markers', async () => {
  let createdCalled = false
  const service = createGiteaTaskService({
    getConfig: () => ({ baseUrl: 'https://gitea.example.com', tokenEnv: 'GITEA_TOKEN', defaultOwner: 'my-org', defaultRepo: 'my-repo' }),
    resolveToken: async () => 'secret',
    clientFactory: () => ({
      searchIssues: async () => ({
        ok: true,
        data: [
          {
            number: 999,
            body: 'foreign issue\n<!-- dsh-external-ref: task-xyz -->',
            repository: { name: 'other-repo', owner: { login: 'my-org' } },
          },
        ],
      }),
      createIssue: async () => { createdCalled = true; return { ok: true, data: { number: 100 } } },
    }),
  })

  const res = await service.createIssue({ title: 'Isolated issue', externalRef: 'task-xyz' })
  assert.equal(createdCalled, true)
  assert.equal(res.ok, true)
  assert.equal(res.number, 100)
  assert.equal(res.alreadyExists, false)
})

// ==========================================
// 2. #253: Worktree GC, Issue-to-PR, AI Review
// ==========================================
test('#253: runWorktreeGc protects main, current, and dirty worktrees in dry-run mode', async () => {
  const fakePorcelain = [
    'worktree /repo',
    'HEAD abc1234',
    'branch refs/heads/main',
    '',
    'worktree /repo/.worktrees/merged-branch',
    'HEAD bcd2345',
    'branch refs/heads/feat/merged',
    '',
    'worktree /repo/.worktrees/dirty-branch',
    'HEAD cde3456',
    'branch refs/heads/feat/dirty',
    '',
  ].join('\n')

  const fakeExecFile = async (bin, args, opts) => {
    if (args.includes('worktree') && args.includes('list')) {
      return { stdout: fakePorcelain }
    }
    if (opts?.cwd === '/repo/.worktrees/dirty-branch' && args.includes('status')) {
      return { stdout: ' M dirty-file.js\n' }
    }
    if (args.includes('status')) {
      return { stdout: '' }
    }
    if (args.includes('merge-base') && args.includes('--is-ancestor')) {
      if (args.includes('feat/merged')) return { stdout: '' }
      throw new Error('not ancestor')
    }
    return { stdout: '' }
  }

  const res = await runWorktreeGc({ dry_run: true }, {
    execFile: fakeExecFile,
    cwd: '/repo',
    settings: { repoDir: '/repo' },
  })

  assert.equal(res.ok, true)
  assert.equal(res.data.checked, 3)
  assert.equal(res.data.dryRun, true)
  assert.equal(res.data.candidates.length, 1)
  assert.equal(res.data.candidates[0].branch, 'feat/merged')
  assert.equal(res.data.pruned.length, 0)
  assert.equal(res.data.skipped.some((s) => s.reason.includes('dirty')), true)
})

test('#253: runIssueToPr creates branch and PR draft with conventional commit prefix', async () => {
  const mockClient = {
    getIssue: async (owner, repo, num) => ({
      ok: true,
      data: {
        number: num,
        title: 'Crash in router handler',
        state: 'open',
        labels: [{ name: 'type/bug' }],
      },
    }),
  }

  const res = await runIssueToPr({ issue_number: 123, owner: 'org', repo: 'app' }, {
    client: mockClient,
    settings: { defaultOwner: 'org', defaultRepo: 'app' },
  })

  assert.equal(res.ok, true)
  assert.equal(res.data.branch, 'fix/issue-123-crash-in-router-handler')
  assert.equal(res.data.prDraft.title, 'fix: resolve #123 - Crash in router handler')
  assert.match(res.data.prDraft.body, /Resolves #123/)
})

test('#253: analyzeDiffContent detects secrets and path traversal in PR diff', () => {
  const diffWithLeak = [
    'diff --git a/config.js b/config.js',
    '--- a/config.js',
    '+++ b/config.js',
    '+const apiKey = "bearer secret_token_1234567890abcdef";',
    '+const escape = "../../../etc/passwd";',
  ].join('\n')

  const analysis = analyzeDiffContent(diffWithLeak, 'chore: update config', '- [ ] item 1')
  assert.equal(analysis.status, 'changes_requested')
  assert.equal(analysis.findings.some((f) => f.rule === 'secret-leak'), true)
  assert.equal(analysis.findings.some((f) => f.rule === 'path-traversal'), true)
  assert.equal(analysis.findings.some((f) => f.rule === 'checklist-incomplete'), true)

  const md = formatReviewMarkdown(analysis, 55)
  assert.match(md, /CHANGES_REQUESTED/)
  assert.match(md, /Findings & Suggestions/)
})

// ==========================================
// 3. #254: Ecosystem Task Tracker, Memory Brain, Incident Report
// ==========================================
test('#254: task-tracker sync maps statuses between Gitea and kanban cards', () => {
  const issueReady = { number: 10, title: 'Card 1', body: 'Desc', state: 'open', labels: ['status/ready'] }
  const cardReady = issueToTaskCard(issueReady)
  assert.equal(cardReady.status, 'todo')
  assert.equal(cardReady.id, 'gitea-10')

  const issueProgress = { number: 11, title: 'Card 2', state: 'open', labels: ['status/in-progress'] }
  assert.equal(issueToTaskCard(issueProgress).status, 'in_progress')

  const issueDone = { number: 12, title: 'Card 3', state: 'closed', labels: [] }
  assert.equal(issueToTaskCard(issueDone).status, 'done')

  const converted = taskCardToGitea({ id: 'gitea-10', number: 10, status: 'in_progress', title: 'T' })
  assert.equal(converted.targetLabel, 'status/in-progress')
  assert.equal(converted.state, 'open')
})

test('#254: memory-brain sync formats release facts and merged PR facts', () => {
  const releaseFact = formatReleaseMemory({
    repo: 'dsh-gitea',
    tag: 'v0.7.26',
    releaseNotes: 'Fixed issues and improved UI',
  })
  assert.equal(releaseFact.category, 'release')
  assert.equal(releaseFact.action_type, 'commit')
  assert.equal(releaseFact.permanent, true)
  assert.match(releaseFact.content, /Release v0.7.26 for dsh-gitea completed/)

  const prFact = formatPullRequestMemory({
    repo: 'dsh-gitea',
    pr: { number: 330, title: 'Add ecosystem bridge' },
    summary: 'Bridged Task Tracker and Memory Brain',
  })
  assert.equal(prFact.category, 'feature')
  assert.equal(prFact.importance, 0.8)
})

test('#254: incident-report sanitizes error logs and builds issue body', () => {
  const rawLogs = 'Error occurred with bearer secret_api_token_123456789 and password="MyPassword123!"'
  const sanitized = sanitizeIncidentLogs(rawLogs)
  assert.equal(sanitized.includes('secret_api_token'), false)
  assert.equal(sanitized.includes('MyPassword123!'), false)
  assert.match(sanitized, /REDACTED/)

  const body = buildIncidentBody({
    service: 'dsh-web.service',
    alert: 'Outage detected',
    errorLogs: rawLogs,
    mitigation: 'Restarted systemd unit',
  })
  assert.match(body, /### Incident Description/)
  assert.match(body, /### Mitigation & Resolution/)
})

// ==========================================
// 4. #255: Release Assistant and SemVer Validation
// ==========================================
test('#255: validateSemverBump validates patch, minor, and major bumps strictly', () => {
  assert.equal(validateSemverBump('0.7.25', '0.7.26').ok, true)
  assert.equal(validateSemverBump('0.7.25', '0.7.26').bumpType, 'patch')
  assert.equal(validateSemverBump('0.7.25', '0.8.0').bumpType, 'minor')
  assert.equal(validateSemverBump('0.7.25', '1.0.0').bumpType, 'major')

  // Rejects downgrade or same version
  assert.equal(validateSemverBump('0.7.25', '0.7.24').ok, false)
  assert.equal(validateSemverBump('0.7.25', '0.7.25').ok, false)
  assert.equal(validateSemverBump('0.7.25', 'invalid').ok, false)
})

test('#255: generateMultilingualReleaseNotes produces changelog across EN, RU, and ZH', () => {
  const notes = generateMultilingualReleaseNotes({
    version: '0.7.26',
    commits: ['feat: worktree gc', 'fix: task service labels'],
    summary: 'Package 6 ecosystem release',
  })
  assert.match(notes.en, /# Release v0.7.26/)
  assert.match(notes.zh, /# 版本发布 v0.7.26/)
  assert.match(notes.ru, /# Release v0.7.26/)
})

// ==========================================
// 5. #252: formatToolResult rich output formatting
// ==========================================
test('#252: formatToolResult formats Worktree GC, Issue-to-PR, and AI Review results cleanly', () => {
  const gcRes = formatToolResult('gitea_worktree_gc', {
    ok: true,
    data: { dryRun: true, checked: 4, candidates: [{ branch: 'feat/b1' }], pruned: [] },
  })
  assert.match(gcRes[0].text, /Worktree GC \(Dry-run inspection\): 4 trees checked, 1 candidate\(s\)/)

  const issueRes = formatToolResult('gitea_issue_to_pr', {
    ok: true,
    data: { branch: 'feat/issue-252-hub', issue: { number: 252, title: 'UI Hub' } },
  })
  assert.match(issueRes[0].text, /Issue-to-PR: Branch "feat\/issue-252-hub" prepared/)
})
