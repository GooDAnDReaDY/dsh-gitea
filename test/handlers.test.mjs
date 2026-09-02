import { test } from 'node:test'
import assert from 'node:assert/strict'
import { guardMerge, runHandler, formatToolResult } from '../lib/handlers.js'

function mockClient() {
  const calls = []
  const client = {
    calls,
    createIssue: (...args) => {
      calls.push({ method: 'createIssue', args })
      return Promise.resolve({ ok: true, data: { number: 1, title: 'Bug', body: 'secret-body' } })
    },
    listIssues: (...args) => {
      calls.push({ method: 'listIssues', args })
      return Promise.resolve({ ok: true, data: [{ number: 2, title: 'Listed', body: 'x' }] })
    },
    getIssue: (...args) => {
      calls.push({ method: 'getIssue', args })
      return Promise.resolve({
        ok: true,
        data: {
          number: 3,
          title: 'Test',
          body: 'issue body',
          html_url: 'https://gitea.example.com/acme/app/issues/3',
        },
      })
    },
    commentIssue: (...args) => {
      calls.push({ method: 'commentIssue', args })
      return Promise.resolve({ ok: true, data: { id: 1 } })
    },
    closeIssue: (...args) => {
      calls.push({ method: 'closeIssue', args })
      return Promise.resolve({ ok: true, data: { number: 2, state: 'closed' } })
    },
    createPull: (...args) => {
      calls.push({ method: 'createPull', args })
      return Promise.resolve({ ok: true, data: { number: 5, title: 'PR' } })
    },
    listPulls: (...args) => {
      calls.push({ method: 'listPulls', args })
      return Promise.resolve({ ok: true, data: [{ number: 6, title: 'Open PR' }] })
    },
    getPull: (...args) => {
      calls.push({ method: 'getPull', args })
      return Promise.resolve({ ok: true, data: { number: 4, title: 'Feature' } })
    },
    mergePull: (...args) => {
      calls.push({ method: 'mergePull', args })
      return Promise.resolve({ ok: true, data: { merged: true } })
    },
    listPullFiles: (...args) => {
      calls.push({ method: 'listPullFiles', args })
      return Promise.resolve({ ok: true, data: [{ filename: 'lib/a.js' }] })
    },
    listPullReviews: (...args) => {
      calls.push({ method: 'listPullReviews', args })
      return Promise.resolve({ ok: true, data: [{ id: 1, state: 'APPROVED' }] })
    },
    submitPullReview: (...args) => {
      calls.push({ method: 'submitPullReview', args })
      return Promise.resolve({ ok: true, data: { id: 1, state: 'APPROVED' } })
    },
    createPullComment: (...args) => {
      calls.push({ method: 'createPullComment', args })
      return Promise.resolve({ ok: true, data: { id: 2 } })
    },
    getPullMergeStatus: (...args) => {
      calls.push({ method: 'getPullMergeStatus', args })
      return Promise.resolve({ ok: true, data: {} })
    },
    getContents: (...args) => {
      calls.push({ method: 'getContents', args })
      return Promise.resolve({ ok: true, data: { name: 'README.md' } })
    },
    listBranches: (...args) => {
      calls.push({ method: 'listBranches', args })
      return Promise.resolve({ ok: true, data: [{ name: 'main' }] })
    },
    listCommits: (...args) => {
      calls.push({ method: 'listCommits', args })
      return Promise.resolve({ ok: true, data: [{ sha: 'abc' }] })
    },
    compareCommits: (...args) => {
      calls.push({ method: 'compareCommits', args })
      return Promise.resolve({ ok: true, data: { commits: [] } })
    },
    listTags: (...args) => {
      calls.push({ method: 'listTags', args })
      return Promise.resolve({ ok: true, data: [{ name: 'v0.2.12' }] })
    },
    listReleases: (...args) => {
      calls.push({ method: 'listReleases', args })
      return Promise.resolve({ ok: true, data: [{ id: 1, tag_name: 'v0.2.12' }] })
    },
    createRelease: (...args) => {
      calls.push({ method: 'createRelease', args })
      return Promise.resolve({ ok: true, data: { id: 2, tag_name: 'v0.3.0' } })
    },
    deleteRelease: (...args) => {
      calls.push({ method: 'deleteRelease', args })
      return Promise.resolve({ ok: true, data: {} })
    },
    listWikiPages: (...args) => {
      calls.push({ method: 'listWikiPages', args })
      return Promise.resolve({ ok: true, data: [{ pageName: 'Home' }] })
    },
    listOrgRepos: (...args) => {
      calls.push({ method: 'listOrgRepos', args })
      return Promise.resolve({ ok: true, data: [{ name: 'dsh-gitea' }] })
    },
    listNotifications: (...args) => {
      calls.push({ method: 'listNotifications', args })
      return Promise.resolve({ ok: true, data: [{ id: 1 }] })
    },
    listOrgMembers: (...args) => {
      calls.push({ method: 'listOrgMembers', args })
      return Promise.resolve({ ok: true, data: [{ id: 1, login: 'alice' }] })
    },
    markNotificationsRead: (...args) => {
      calls.push({ method: 'markNotificationsRead', args })
      return Promise.resolve({ ok: true, data: {} })
    },
    listActionsRuns: (...args) => {
      calls.push({ method: 'listActionsRuns', args })
      return Promise.resolve({ ok: true, data: { workflow_runs: [] } })
    },
    listRunJobs: (...args) => {
      calls.push({ method: 'listRunJobs', args })
      return Promise.resolve({ ok: true, data: { jobs: [] } })
    },
    createOrgRepo: (...args) => {
      calls.push({ method: 'createOrgRepo', args })
      return Promise.resolve({ ok: true, data: { name: 'app' } })
    },
    createBranch: (...args) => {
      calls.push({ method: 'createBranch', args })
      return Promise.resolve({ ok: true, data: { name: 'feat/x' } })
    },
    deleteBranch: (...args) => {
      calls.push({ method: 'deleteBranch', args })
      return Promise.resolve({ ok: true, data: {} })
    },
    createTag: (...args) => {
      calls.push({ method: 'createTag', args })
      return Promise.resolve({ ok: true, data: { name: 'v0.3.0' } })
    },
    deleteTag: (...args) => {
      calls.push({ method: 'deleteTag', args })
      return Promise.resolve({ ok: true, data: {} })
    },
    updateMilestone: (...args) => {
      calls.push({ method: 'updateMilestone', args })
      return Promise.resolve({ ok: true, data: { id: 5, state: 'closed' } })
    },
    deleteMilestone: (...args) => {
      calls.push({ method: 'deleteMilestone', args })
      return Promise.resolve({ ok: true, data: {} })
    },
    getWikiPage: (...args) => {
      calls.push({ method: 'getWikiPage', args })
      return Promise.resolve({ ok: true, data: { pageName: 'Home' } })
    },
    updateRelease: (...args) => {
      calls.push({ method: 'updateRelease', args })
      return Promise.resolve({ ok: true, data: { id: 7 } })
    },
    listWebhooks: (...args) => {
      calls.push({ method: 'listWebhooks', args })
      return Promise.resolve({ ok: true, data: [] })
    },
    createWebhook: (...args) => {
      calls.push({ method: 'createWebhook', args })
      return Promise.resolve({ ok: true, data: { id: 3 } })
    },
    deleteWebhook: (...args) => {
      calls.push({ method: 'deleteWebhook', args })
      return Promise.resolve({ ok: true, data: {} })
    },
    rerunActionsJob: (...args) => {
      calls.push({ method: 'rerunActionsJob', args })
      return Promise.resolve({ ok: true, data: {} })
    },
    searchUsers: (...args) => {
      calls.push({ method: 'searchUsers', args })
      return Promise.resolve({ ok: true, data: { data: [] } })
    },
    listUserOrgs: (...args) => {
      calls.push({ method: 'listUserOrgs', args })
      return Promise.resolve({ ok: true, data: [] })
    },
    listOrgTeams: (...args) => {
      calls.push({ method: 'listOrgTeams', args })
      return Promise.resolve({ ok: true, data: [] })
    },
    getVersion: (...args) => {
      calls.push({ method: 'getVersion', args })
      return Promise.resolve({ ok: true, data: { version: '1.22.0' } })
    },
    getUser: (...args) => {
      calls.push({ method: 'getUser', args })
      return Promise.resolve({ ok: true, data: { login: 'alice', id: 1, html_url: 'https://gitea.example.com/alice' } })
    },
    searchRepos: (...args) => {
      calls.push({ method: 'searchRepos', args })
      return Promise.resolve({
        ok: true,
        data: {
          data: [{ name: 'app', full_name: 'acme/app', html_url: 'https://gitea.example.com/acme/app' }],
        },
      })
    },
    searchCode: (...args) => {
      calls.push({ method: 'searchCode', args })
      return Promise.resolve({ ok: true, data: { data: [] } })
    },
    updateIssue: (...args) => {
      calls.push({ method: 'updateIssue', args })
      return Promise.resolve({ ok: true, data: { number: 3, title: 'Updated' } })
    },
    searchIssues: (...args) => {
      calls.push({ method: 'searchIssues', args })
      return Promise.resolve({ ok: true, data: { data: [{ number: 7, title: 'Found' }] } })
    },
    listLabels: (...args) => {
      calls.push({ method: 'listLabels', args })
      return Promise.resolve({ ok: true, data: [{ id: 1, name: 'type/bug' }] })
    },
    createLabel: (...args) => {
      calls.push({ method: 'createLabel', args })
      return Promise.resolve({ ok: true, data: { id: 9, name: 'priority/H' } })
    },
    deleteLabel: (...args) => {
      calls.push({ method: 'deleteLabel', args })
      return Promise.resolve({ ok: true, data: {} })
    },
    setIssueLabels: (...args) => {
      calls.push({ method: 'setIssueLabels', args })
      return Promise.resolve({ ok: true, data: [{ id: 1, name: 'type/bug' }] })
    },
    listMilestones: (...args) => {
      calls.push({ method: 'listMilestones', args })
      return Promise.resolve({ ok: true, data: [{ id: 5, title: 'v0.3' }] })
    },
    createMilestone: (...args) => {
      calls.push({ method: 'createMilestone', args })
      return Promise.resolve({ ok: true, data: { id: 5, title: 'v0.3' } })
    },
    setIssueAssignee: (...args) => {
      calls.push({ method: 'setIssueAssignee', args })
      return Promise.resolve({ ok: true, data: { number: 3, assignee: { login: 'claude' } } })
    },
  }
  return client
}

function baseDeps(client, overrides = {}) {
  return {
    client,
    settings: { tokenEnv: 'GITEA_TOKEN', defaultOwner: 'acme', defaultRepo: 'app', ...overrides.settings },
    remoteUrl: overrides.remoteUrl || '',
    configured: { baseUrl: 'https://gitea.example.com', token: 't-test', ...overrides.configured },
  }
}

test('guardMerge: confirm true is ok', () => {
  assert.equal(guardMerge({ confirm: true }).ok, true)
})

test('guardMerge: false, missing, and string true are not ok', () => {
  assert.notEqual(guardMerge({ confirm: false }).ok, true)
  assert.notEqual(guardMerge({}).ok, true)
  assert.notEqual(guardMerge({ confirm: 'true' }).ok, true)
})

test('gitea_pr_merge without confirm does not call mergePull', async () => {
  const client = mockClient()
  const deps = baseDeps(client)
  const result = await runHandler('gitea_pr_merge', { number: 3, owner: 'acme', repo: 'app' }, deps)
  assert.equal(result.ok, false)
  assert.equal(client.calls.filter((c) => c.method === 'mergePull').length, 0)
})

test('gitea_pr_merge with confirm calls mergePull', async () => {
  const client = mockClient()
  const deps = baseDeps(client)
  const result = await runHandler('gitea_pr_merge', { number: 3, confirm: true, owner: 'acme', repo: 'app' }, deps)
  assert.equal(result.ok, true)
  assert.equal(client.calls.filter((c) => c.method === 'mergePull').length, 1)
})

test('empty configured.baseUrl returns error and no HTTP', async () => {
  const client = mockClient()
  const deps = baseDeps(client, { configured: { baseUrl: '', token: 't-test' } })
  const result = await runHandler('gitea_issue_list', { owner: 'acme', repo: 'app' }, deps)
  assert.equal(result.ok, false)
  assert.match(result.error, /url|instance|configure/i)
  assert.equal(client.calls.length, 0)
})

test('formatToolResult returns text block containing #3', () => {
  const rendered = formatToolResult('gitea_issue_get', { ok: true, data: { number: 3, title: 'Test' } })
  assert.equal(rendered.length, 1)
  assert.equal(rendered[0].type, 'text')
  assert.match(rendered[0].text, /#3/)
})

test('gitea_repo_search unwraps Gitea wrapped data array', async () => {
  const client = mockClient()
  const deps = baseDeps(client)
  const result = await runHandler('gitea_repo_search', { q: 'app' }, deps)
  assert.equal(result.ok, true)
  assert.equal(client.calls[0].method, 'searchRepos')
  assert.ok(Array.isArray(result.data))
  assert.equal(result.data.length, 1)
  assert.equal(result.data[0].name, 'app')
  assert.equal(result.data[0].full_name, 'acme/app')
  assert.equal(result.data[0].html_url, 'https://gitea.example.com/acme/app')
})

test('gitea_issue_get keeps body and html_url in slim record', async () => {
  const client = mockClient()
  const deps = baseDeps(client)
  const result = await runHandler('gitea_issue_get', { number: 3, owner: 'acme', repo: 'app' }, deps)
  assert.equal(result.ok, true)
  assert.equal(result.data.body, 'issue body')
  assert.equal(result.data.html_url, 'https://gitea.example.com/acme/app/issues/3')
})

test('gitea_issue_list keeps body in slim array items', async () => {
  const client = mockClient()
  const deps = baseDeps(client)
  const result = await runHandler('gitea_issue_list', { owner: 'acme', repo: 'app' }, deps)
  assert.equal(result.ok, true)
  assert.ok(Array.isArray(result.data))
  assert.equal(result.data[0].number, 2)
  assert.equal(result.data[0].body, 'x')
})


test('gitea_whoami returns login without resolving a repo', async () => {
  const client = mockClient()
  const deps = baseDeps(client)
  const result = await runHandler('gitea_whoami', {}, deps)
  assert.equal(result.ok, true)
  assert.equal(result.data.login, 'alice')
  assert.equal(client.calls[0].method, 'getUser')
})

test('token-looking tokenEnv is rejected before HTTP', async () => {
  const client = mockClient()
  const deps = baseDeps(client, { settings: { tokenEnv: '0000000000000000000000000000000000000000' } })
  const result = await runHandler('gitea_issue_list', { owner: 'acme', repo: 'app' }, deps)
  assert.equal(result.ok, false)
  assert.match(result.error, /token/i)
  assert.equal(client.calls.length, 0)
})

test('formatToolResult whoami prints login', () => {
  const rendered = formatToolResult('gitea_whoami', { ok: true, data: { login: 'alice' } })
  assert.match(rendered[0].text, /alice/)
})

test('gitea_worktree_list uses injected execFile', async () => {
  const client = mockClient()
  const calls = []
  const deps = baseDeps(client)
  deps.execFile = async (bin, args, opts) => {
    calls.push({ bin, args, cwd: opts.cwd })
    return { stdout: 'worktree /tmp/example/app\nHEAD abc\nbranch refs/heads/main\n', stderr: '' }
  }
  const result = await runHandler('gitea_worktree_list', { path: '/tmp/example/app' }, deps)
  assert.equal(result.ok, true)
  assert.equal(result.data[0].path, '/tmp/example/app')
  assert.equal(calls[0].cwd, '/tmp/example/app')
  assert.equal(client.calls.length, 0)
})

// ---- #16 issue governance: update, search, labels, milestones, assignees ----

test('gitea_issue_update calls client.updateIssue with title/body/state', async () => {
  const client = mockClient()
  const deps = baseDeps(client)
  const result = await runHandler('gitea_issue_update', { number: 3, title: 'New', body: 'B', state: 'closed', owner: 'acme', repo: 'app' }, deps)
  assert.equal(result.ok, true)
  assert.equal(client.calls[0].method, 'updateIssue')
  assert.equal(client.calls[0].args[2], 3)
  assert.deepEqual(client.calls[0].args[3], { title: 'New', body: 'B', state: 'closed' })
})

test('gitea_issue_search does not require repo resolution', async () => {
  const client = mockClient()
  const deps = baseDeps(client)
  deps.settings = { tokenEnv: 'GITEA_TOKEN', defaultOwner: '', defaultRepo: '' }
  const result = await runHandler('gitea_issue_search', { q: 'bug', repo: 'acme/app' }, deps)
  assert.equal(result.ok, true)
  assert.equal(client.calls[0].method, 'searchIssues')
  assert.deepEqual(client.calls[0].args[0], { q: 'bug', repo: 'acme/app' })
})

test('gitea_label_list calls client.listLabels', async () => {
  const client = mockClient()
  const deps = baseDeps(client)
  const result = await runHandler('gitea_label_list', { owner: 'acme', repo: 'app' }, deps)
  assert.equal(result.ok, true)
  assert.equal(client.calls[0].method, 'listLabels')
  assert.deepEqual(client.calls[0].args, ['acme', 'app', {}])
})

test('gitea_label_create calls client.createLabel with name/color/description', async () => {
  const client = mockClient()
  const deps = baseDeps(client)
  const result = await runHandler('gitea_label_create', { name: 'priority/H', color: 'd93f0b', description: 'High', owner: 'acme', repo: 'app' }, deps)
  assert.equal(result.ok, true)
  assert.equal(client.calls[0].method, 'createLabel')
  assert.deepEqual(client.calls[0].args[2], { name: 'priority/H', color: 'd93f0b', description: 'High' })
})

test('gitea_label_delete calls client.deleteLabel', async () => {
  const client = mockClient()
  const deps = baseDeps(client)
  const result = await runHandler('gitea_label_delete', { label_id: 9, owner: 'acme', repo: 'app' }, deps)
  assert.equal(result.ok, true)
  assert.equal(client.calls[0].method, 'deleteLabel')
  assert.equal(client.calls[0].args[2], 9)
})

test('gitea_issue_set_labels calls client.setIssueLabels with numeric ids', async () => {
  const client = mockClient()
  const deps = baseDeps(client)
  const result = await runHandler('gitea_issue_set_labels', { number: 3, labels: ['1', '2'], owner: 'acme', repo: 'app' }, deps)
  assert.equal(result.ok, true)
  assert.equal(client.calls[0].method, 'setIssueLabels')
  assert.deepEqual(client.calls[0].args[3], [1, 2])
})

test('gitea_milestone_list calls client.listMilestones', async () => {
  const client = mockClient()
  const deps = baseDeps(client)
  const result = await runHandler('gitea_milestone_list', { state: 'open', owner: 'acme', repo: 'app' }, deps)
  assert.equal(result.ok, true)
  assert.equal(client.calls[0].method, 'listMilestones')
})

test('gitea_milestone_create calls client.createMilestone', async () => {
  const client = mockClient()
  const deps = baseDeps(client)
  const result = await runHandler('gitea_milestone_create', { title: 'v0.3', owner: 'acme', repo: 'app' }, deps)
  assert.equal(result.ok, true)
  assert.equal(client.calls[0].method, 'createMilestone')
  assert.deepEqual(client.calls[0].args[2], { title: 'v0.3', description: undefined, due_on: undefined })
})

test('gitea_issue_set_assignee calls client.setIssueAssignee', async () => {
  const client = mockClient()
  const deps = baseDeps(client)
  const result = await runHandler('gitea_issue_set_assignee', { number: 3, assignee: 'claude', owner: 'acme', repo: 'app' }, deps)
  assert.equal(result.ok, true)
  assert.equal(client.calls[0].method, 'setIssueAssignee')
  assert.equal(client.calls[0].args[3], 'claude')
})

// ---- #54 issue quality lint ----

test('gitea_issue_lint returns missing sections for empty body without network', async () => {
  const client = mockClient()
  const deps = baseDeps(client)
  const result = await runHandler('gitea_issue_lint', { title: 'Bug: x', body: '' }, deps)
  assert.equal(result.ok, true)
  assert.equal(result.data.ok, false)
  assert.ok(result.data.missing.length > 0)
  assert.equal(client.calls.length, 0)
})

test('gitea_issue_lint passes for well-formed feature body', async () => {
  const client = mockClient()
  const deps = baseDeps(client)
  const body = `## Проблема
Что-то

## Влияние
Да

## DoD
- [ ] done

## Границы
Только X

## Зависимости
#16

## План проверки
Тест
`
  const result = await runHandler('gitea_issue_lint', { title: 'feat: x', body }, deps)
  assert.equal(result.ok, true)
  assert.equal(result.data.ok, true, JSON.stringify(result.data.missing))
})

// ---- #17 PR files, reviews, line comments, merge status ----

test('gitea_pr_files calls client.listPullFiles', async () => {
  const client = mockClient()
  const deps = baseDeps(client)
  const result = await runHandler('gitea_pr_files', { number: 5, owner: 'acme', repo: 'app' }, deps)
  assert.equal(result.ok, true)
  assert.equal(client.calls[0].method, 'listPullFiles')
  assert.equal(client.calls[0].args[2], 5)
})

test('gitea_pr_reviews calls client.listPullReviews', async () => {
  const client = mockClient()
  const deps = baseDeps(client)
  const result = await runHandler('gitea_pr_reviews', { number: 5, owner: 'acme', repo: 'app' }, deps)
  assert.equal(result.ok, true)
  assert.equal(client.calls[0].method, 'listPullReviews')
})

test('gitea_pr_submit_review calls client.submitPullReview with event/body', async () => {
  const client = mockClient()
  const deps = baseDeps(client)
  const result = await runHandler('gitea_pr_submit_review', { number: 5, event: 'APPROVED', body: 'ok', owner: 'acme', repo: 'app' }, deps)
  assert.equal(result.ok, true)
  assert.equal(client.calls[0].method, 'submitPullReview')
  assert.deepEqual(client.calls[0].args[3], { event: 'APPROVED', body: 'ok' })
})

test('gitea_pr_line_comment calls client.createPullComment with path/line', async () => {
  const client = mockClient()
  const deps = baseDeps(client)
  const result = await runHandler('gitea_pr_line_comment', { number: 5, body: 'nit', path: 'lib/a.js', line: 3, owner: 'acme', repo: 'app' }, deps)
  assert.equal(result.ok, true)
  assert.equal(client.calls[0].method, 'createPullComment')
  assert.deepEqual(client.calls[0].args[3], { body: 'nit', path: 'lib/a.js', line: 3 })
})

test('gitea_pr_merge_status calls client.getPullMergeStatus', async () => {
  const client = mockClient()
  const deps = baseDeps(client)
  const result = await runHandler('gitea_pr_merge_status', { number: 5, owner: 'acme', repo: 'app' }, deps)
  assert.equal(result.ok, true)
  assert.equal(client.calls[0].method, 'getPullMergeStatus')
})

// ---- #18 git metadata tools ----

test('gitea_repo_contents calls client.getContents with path and ref', async () => {
  const client = mockClient()
  const deps = baseDeps(client)
  const result = await runHandler('gitea_repo_contents', { path: 'README.md', ref: 'main', owner: 'acme', repo: 'app' }, deps)
  assert.equal(result.ok, true)
  assert.equal(client.calls[0].method, 'getContents')
  assert.deepEqual(client.calls[0].args[3], { ref: 'main' })
})

test('gitea_repo_branches calls client.listBranches', async () => {
  const client = mockClient()
  const deps = baseDeps(client)
  const result = await runHandler('gitea_repo_branches', { owner: 'acme', repo: 'app' }, deps)
  assert.equal(result.ok, true)
  assert.equal(client.calls[0].method, 'listBranches')
})

test('gitea_repo_commits calls client.listCommits', async () => {
  const client = mockClient()
  const deps = baseDeps(client)
  const result = await runHandler('gitea_repo_commits', { sha: 'main', owner: 'acme', repo: 'app' }, deps)
  assert.equal(result.ok, true)
  assert.equal(client.calls[0].method, 'listCommits')
})

test('gitea_repo_compare calls client.compareCommits with range', async () => {
  const client = mockClient()
  const deps = baseDeps(client)
  const result = await runHandler('gitea_repo_compare', { range: 'main...feat/x', owner: 'acme', repo: 'app' }, deps)
  assert.equal(result.ok, true)
  assert.equal(client.calls[0].method, 'compareCommits')
  assert.equal(client.calls[0].args[2], 'main...feat/x')
})

test('gitea_repo_tags calls client.listTags', async () => {
  const client = mockClient()
  const deps = baseDeps(client)
  const result = await runHandler('gitea_repo_tags', { owner: 'acme', repo: 'app' }, deps)
  assert.equal(result.ok, true)
  assert.equal(client.calls[0].method, 'listTags')
})

// ---- #19 releases, wiki, org repos, notifications ----

test('gitea_release_list calls client.listReleases', async () => {
  const client = mockClient()
  const deps = baseDeps(client)
  const result = await runHandler('gitea_release_list', { owner: 'acme', repo: 'app' }, deps)
  assert.equal(result.ok, true)
  assert.equal(client.calls[0].method, 'listReleases')
})

test('gitea_release_create calls client.createRelease with tag/name/body', async () => {
  const client = mockClient()
  const deps = baseDeps(client)
  const result = await runHandler('gitea_release_create', { tag_name: 'v0.3.0', name: 'v0.3.0', body: 'notes', owner: 'acme', repo: 'app' }, deps)
  assert.equal(result.ok, true)
  assert.equal(client.calls[0].method, 'createRelease')
  assert.deepEqual(client.calls[0].args[2], { tag_name: 'v0.3.0', name: 'v0.3.0', body: 'notes' })
})

test('gitea_release_delete without confirm is rejected', async () => {
  const client = mockClient()
  const deps = baseDeps(client)
  const result = await runHandler('gitea_release_delete', { release_id: 7, owner: 'acme', repo: 'app' }, deps)
  assert.equal(result.ok, false)
  assert.match(result.error, /confirm/i)
  assert.equal(client.calls.length, 0)
})

test('gitea_release_delete with confirm calls client.deleteRelease', async () => {
  const client = mockClient()
  const deps = baseDeps(client)
  const result = await runHandler('gitea_release_delete', { release_id: 7, confirm: true, owner: 'acme', repo: 'app' }, deps)
  assert.equal(result.ok, true)
  assert.equal(client.calls[0].method, 'deleteRelease')
  assert.equal(client.calls[0].args[2], 7)
})

test('gitea_wiki_pages calls client.listWikiPages', async () => {
  const client = mockClient()
  const deps = baseDeps(client)
  const result = await runHandler('gitea_wiki_pages', { owner: 'acme', repo: 'app' }, deps)
  assert.equal(result.ok, true)
  assert.equal(client.calls[0].method, 'listWikiPages')
})

test('gitea_org_repos calls client.listOrgRepos without repo resolution', async () => {
  const client = mockClient()
  const deps = baseDeps(client)
  deps.settings = { tokenEnv: 'GITEA_TOKEN', defaultOwner: '', defaultRepo: '' }
  const result = await runHandler('gitea_org_repos', { org: 'goodandready' }, deps)
  assert.equal(result.ok, true)
  assert.equal(client.calls[0].method, 'listOrgRepos')
  assert.equal(client.calls[0].args[0], 'goodandready')
})

test('gitea_notifications calls client.listNotifications', async () => {
  const client = mockClient()
  const deps = baseDeps(client)
  const result = await runHandler('gitea_notifications', { status: 'unread' }, deps)
  assert.equal(result.ok, true)
  assert.equal(client.calls[0].method, 'listNotifications')
})

// ---- #42 project health ----

test('gitea_project_health builds report from client data', async () => {
  const client = mockClient()
  client.listIssues = async () => ({ ok: true, data: [{ number: 1, title: 'stale', updated_at: '2026-07-01T00:00:00Z', state: 'open' }] })
  client.listPulls = async () => ({ ok: true, data: [{ number: 2, title: 'PR', updated_at: '2026-08-01T00:00:00Z', state: 'open' }] })
  client.listBranches = async () => ({ ok: true, data: [{ name: 'main', commit: { created: '2026-01-01T00:00:00Z' } }] })
  const deps = baseDeps(client)
  const result = await runHandler('gitea_project_health', { owner: 'acme', repo: 'app', staleDays: 14 }, deps)
  assert.equal(result.ok, true)
  assert.ok(result.data.openPRs >= 0)
  assert.ok(Array.isArray(result.data.staleIssues))
})

// ---- #44 review inbox ----

test('gitea_review_inbox classifies PRs', async () => {
  const client = mockClient()
  client.listPulls = async () => ({ ok: true, data: [{ number: 1, title: 'PR1', user: { login: 'bob' }, mergeable: true }] })
  client.listPullReviews = async () => ({ ok: true, data: [{ state: 'APPROVED', user: { login: 'alice' } }] })
  const deps = baseDeps(client)
  const result = await runHandler('gitea_review_inbox', { user: 'alice', owner: 'acme', repo: 'app' }, deps)
  assert.equal(result.ok, true)
  assert.ok(Array.isArray(result.data.awaitingMine))
  assert.ok(Array.isArray(result.data.mergeReady))
})

// ---- #46 CI explainer ----

test('gitea_ci_explain extracts error from failed job log', async () => {
  const client = mockClient()
  const deps = baseDeps(client)
  const job = { id: 9, name: 'test', status: 'failed', log: 'ok\nerror: cannot find module X' }
  const result = await runHandler('gitea_ci_explain', { job }, deps)
  assert.equal(result.ok, true)
  assert.equal(result.data.jobId, 9)
  assert.match(result.data.error, /cannot find module X/)
  assert.equal(client.calls.length, 0)
})

// ---- #45 PR summary ----

test('gitea_pr_summary builds summary from client data', async () => {
  const client = mockClient()
  client.getPull = async () => ({ ok: true, data: { number: 5, title: 'feat: x', body: 'b', state: 'open', user: { login: 'alice' } } })
  client.listPullFiles = async () => ({ ok: true, data: [{ filename: 'lib/index.js', additions: 2, deletions: 1 }] })
  client.listPullReviews = async () => ({ ok: true, data: [] })
  client.getPullMergeStatus = async () => ({ ok: true, data: { mergeable: true } })
  const deps = baseDeps(client)
  const result = await runHandler('gitea_pr_summary', { number: 5, owner: 'acme', repo: 'app' }, deps)
  assert.equal(result.ok, true)
  assert.equal(result.data.number, 5)
  assert.ok(result.data.files.length >= 1)
})

// ---- #49 duplicate detection ----

test('gitea_issue_duplicates returns candidates', async () => {
  const client = mockClient()
  client.searchIssues = async () => ({ ok: true, data: [{ number: 1, title: 'login crash', body: 'login crashes on start' }] })
  const deps = baseDeps(client)
  const result = await runHandler('gitea_issue_duplicates', { title: 'login crashes', owner: 'acme', repo: 'app' }, deps)
  assert.equal(result.ok, true)
  assert.ok(Array.isArray(result.data.candidates))
})

// ---- #50 batch issue ops ----

test('gitea_batch_issue_ops dry-run returns preview without applying', async () => {
  const client = mockClient()
  client.listIssues = async () => ({ ok: true, data: [{ number: 1, title: 'a' }] })
  const deps = baseDeps(client)
  const result = await runHandler('gitea_batch_issue_ops', { numbers: [1], label: 'type/bug', owner: 'acme', repo: 'app' }, deps)
  assert.equal(result.ok, true)
  assert.ok(Array.isArray(result.data.preview))
  assert.equal(result.data.dryRun, true)
  assert.equal(client.calls.length, 0)
})

// ---- #51 merge readiness ----

test('gitea_merge_readiness returns checks', async () => {
  const client = mockClient()
  client.getPull = async () => ({ ok: true, data: { number: 5, title: 'x', body: 'full description', mergeable: true } })
  client.listPullReviews = async () => ({ ok: true, data: [{ state: 'APPROVED' }] })
  client.listPullFiles = async () => ({ ok: true, data: [{ filename: 'test/a.test.mjs' }] })
  const deps = baseDeps(client)
  const result = await runHandler('gitea_merge_readiness', { number: 5, owner: 'acme', repo: 'app' }, deps)
  assert.equal(result.ok, true)
  assert.ok(Array.isArray(result.data.checks))
  assert.ok(result.data.checks.length >= 4)
})

// ---- #53 release notes ----

test('gitea_release_notes returns preview notes', async () => {
  const client = mockClient()
  client.listPulls = async () => ({ ok: true, data: [{ number: 1, title: 'fix: a', merged_at: '2026-08-01T00:00:00Z', state: 'closed' }] })
  const deps = baseDeps(client)
  const result = await runHandler('gitea_release_notes', { owner: 'acme', repo: 'app' }, deps)
  assert.equal(result.ok, true)
  assert.ok(result.data.count >= 1)
  assert.equal(result.data.preview, true)
})

// ---- #43 triage digest ----

test('gitea_triage_digest returns digest', async () => {
  const client = mockClient()
  client.listIssues = async () => ({ ok: true, data: [] })
  client.listPulls = async () => ({ ok: true, data: [{ number: 2, title: 'PR', user: { login: 'bob' } }] })
  client.listPullReviews = async () => ({ ok: true, data: [] })
  client.listBranches = async () => ({ ok: true, data: [] })
  const deps = baseDeps(client)
  const result = await runHandler('gitea_triage_digest', { owner: 'acme', repo: 'app' }, deps)
  assert.equal(result.ok, true)
  assert.ok(Array.isArray(result.data.pullRequestsNoReview))
  assert.ok(result.data.priorityAction)
})

// ---- #52 dependency watch ----

test('gitea_dep_watch scans package.json via contents', async () => {
  const client = mockClient()
  client.getContents = async () => ({ ok: true, data: { content: Buffer.from(JSON.stringify({ dependencies: { lodash: '^4.17.21' } })).toString('base64') } })
  const deps = baseDeps(client)
  const result = await runHandler('gitea_dep_watch', { owner: 'acme', repo: 'app' }, deps)
  assert.equal(result.ok, true)
  assert.ok(result.data.deps.length >= 1)
  assert.equal(result.data.readOnly, true)
})

// ---- #55 PR policy as code ----

test('gitea_pr_policy returns absent when no policy file', async () => {
  const client = mockClient()
  client.getContents = async () => ({ ok: false, error: 'not found' })
  const deps = baseDeps(client)
  const result = await runHandler('gitea_pr_policy', { owner: 'acme', repo: 'app' }, deps)
  assert.equal(result.ok, true)
  assert.equal(result.data.present, false)
})

// ---- #56 PR impact map ----

test('gitea_pr_impact returns impact map', async () => {
  const client = mockClient()
  client.getPull = async () => ({ ok: true, data: { number: 5, title: 'feat: x (#16)', body: 'Closes #16', user: { login: 'alice' } } })
  client.listPullFiles = async () => ({ ok: true, data: [{ filename: 'lib/a.js' }] })
  const deps = baseDeps(client)
  const result = await runHandler('gitea_pr_impact', { number: 5, owner: 'acme', repo: 'app' }, deps)
  assert.equal(result.ok, true)
  assert.ok(result.data.issueRefs.length >= 1)
  assert.ok(result.data.files.length >= 1)
})

// ---- #57 scheduled checks ----

test('gitea_scheduled_checks add then run', async () => {
  const client = mockClient()
  client.listIssues = async () => ({ ok: true, data: [] })
  client.listPulls = async () => ({ ok: true, data: [] })
  client.listBranches = async () => ({ ok: true, data: [] })
  const deps = baseDeps(client)
  const add = await runHandler('gitea_scheduled_checks', { action: 'add', name: 't', schedule: 'daily', checkType: 'health', owner: 'acme', repo: 'app' }, deps)
  assert.equal(add.ok, true)
  const run = await runHandler('gitea_scheduled_checks', { action: 'run', name: 't', owner: 'acme', repo: 'app' }, deps)
  assert.equal(run.ok, true)
  assert.equal(run.data.dryRun, true)
})

// ---- #58 digest delivery ----

test('gitea_digest_delivery dry-run previews without sending', async () => {
  const client = mockClient()
  const deps = baseDeps(client)
  const result = await runHandler('gitea_digest_delivery', { target: 'https://hooks.example.com/x', text: 'hi', owner: 'acme', repo: 'app' }, deps)
  assert.equal(result.ok, true)
  assert.equal(result.data.dryRun, true)
})

// ---- #61 label bootstrap ----

test('gitea_label_bootstrap dry-run lists missing', async () => {
  const client = mockClient()
  client.listLabels = async () => ({ ok: true, data: [] })
  const deps = baseDeps(client)
  const result = await runHandler('gitea_label_bootstrap', { owner: 'acme', repo: 'app' }, deps)
  assert.equal(result.ok, true)
  assert.equal(result.data.dryRun, true)
  assert.ok(result.data.missing.length >= 30)
})

// ---- #63 PR template check ----

test('gitea_pr_template_check checks body and risk labels', async () => {
  const client = mockClient()
  const deps = baseDeps(client)
  const result = await runHandler('gitea_pr_template_check', { body: '## Что изменено\nx', labels: ['risk/breaking'] }, deps)
  assert.equal(result.ok, true)
  assert.ok(result.data.template.missing.length > 0)
  assert.equal(result.data.riskChecklistNeeded, true)
})

// ---- #47 issue flow ----

test('gitea_issue_flow plan returns branch', async () => {
  const client = mockClient()
  const deps = baseDeps(client)
  const result = await runHandler('gitea_issue_flow', { action: 'plan', issue: 47, title: 'issue flow', type: 'feat', owner: 'acme', repo: 'app' }, deps)
  assert.equal(result.ok, true)
  assert.match(result.data.branch, /^feat\/47-/)
})

test('gitea_issue_flow create makes PR', async () => {
  const client = mockClient()
  const deps = baseDeps(client)
  const result = await runHandler('gitea_issue_flow', { action: 'create', issue: 47, head: 'feat/47-x', title: 'x', owner: 'acme', repo: 'app' }, deps)
  assert.equal(result.ok, true)
  assert.ok(client.calls.some((c) => c.method === 'createPull'))
})

// ---- #48 repo bootstrap ----

test('gitea_repo_bootstrap dry-run returns plan', async () => {
  const client = mockClient()
  const deps = baseDeps(client)
  const result = await runHandler('gitea_repo_bootstrap', { name: 'my-proj', owner: 'acme', repo: 'app' }, deps)
  assert.equal(result.ok, true)
  assert.equal(result.data.dryRun, true)
  assert.ok(result.data.files.length >= 3)
})

// ---- #59 duty officer ----

test('gitea_duty_report returns read-only report', async () => {
  const client = mockClient()
  client.listIssues = async () => ({ ok: true, data: [] })
  client.listPulls = async () => ({ ok: true, data: [{ number: 2, title: 'PR', user: { login: 'bob' }, created_at: '2026-08-10T00:00:00Z' }] })
  client.listPullReviews = async () => ({ ok: true, data: [] })
  client.listBranches = async () => ({ ok: true, data: [] })
  const deps = baseDeps(client)
  const result = await runHandler('gitea_duty_report', { owner: 'acme', repo: 'app', lastCheckAt: '2026-08-01T00:00:00Z' }, deps)
  assert.equal(result.ok, true)
  assert.equal(result.data.readOnly, true)
  assert.ok(Array.isArray(result.data.events))
})

// ---- #64 label automation ----

test('gitea_label_auto returns preview actions', async () => {
  const client = mockClient()
  client.getIssue = async () => ({ ok: true, data: { number: 1, title: 'bug: x', labels: [{ name: 'type/bug' }] } })
  const deps = baseDeps(client)
  const result = await runHandler('gitea_label_auto', { number: 1, owner: 'acme', repo: 'app' }, deps)
  assert.equal(result.ok, true)
  assert.ok(result.data.actions.length >= 1)
  assert.equal(result.data.dryRun, true)
})

// ---- #99 org members ----

test('gitea_org_members lists org members', async () => {
  const client = mockClient()
  const deps = baseDeps(client)
  const result = await runHandler('gitea_org_members', { org: 'goodandready' }, deps)
  assert.equal(result.ok, true)
  assert.equal(client.calls[0].method, 'listOrgMembers')
  assert.equal(client.calls[0].args[0], 'goodandready')
})

// ---- #100 notifications mark read ----

test('gitea_notifications_mark_read without confirm is rejected', async () => {
  const client = mockClient()
  const deps = baseDeps(client)
  const result = await runHandler('gitea_notifications_mark_read', {}, deps)
  assert.equal(result.ok, false)
  assert.match(result.error, /confirm/i)
})

test('gitea_notifications_mark_read with confirm calls client', async () => {
  const client = mockClient()
  const deps = baseDeps(client)
  const result = await runHandler('gitea_notifications_mark_read', { confirm: true }, deps)
  assert.equal(result.ok, true)
  assert.equal(client.calls[0].method, 'markNotificationsRead')
})

// ---- #107 Actions ----

test('gitea_ci_status lists runs', async () => {
  const client = mockClient()
  const deps = baseDeps(client)
  const result = await runHandler('gitea_ci_status', { owner: 'acme', repo: 'app', branch: 'main' }, deps)
  assert.equal(result.ok, true)
  assert.equal(client.calls[0].method, 'listActionsRuns')
})

test('gitea_ci_jobs lists jobs for run', async () => {
  const client = mockClient()
  const deps = baseDeps(client)
  const result = await runHandler('gitea_ci_jobs', { run_id: 5, owner: 'acme', repo: 'app' }, deps)
  assert.equal(result.ok, true)
  assert.equal(client.calls[0].method, 'listRunJobs')
  assert.equal(client.calls[0].args[2], 5)
})

// ---- #109 org repo + branch/tag write ----

test('gitea_repo_create_org creates repo in org', async () => {
  const client = mockClient()
  const deps = baseDeps(client)
  const result = await runHandler('gitea_repo_create_org', { org: 'goodandready', name: 'app', private: true }, deps)
  assert.equal(result.ok, true)
  assert.equal(client.calls[0].method, 'createOrgRepo')
  assert.equal(client.calls[0].args[0], 'goodandready')
})

test('gitea_repo_branch_create calls createBranch', async () => {
  const client = mockClient()
  const deps = baseDeps(client)
  const result = await runHandler('gitea_repo_branch_create', { branch_name: 'feat/x', ref: 'main', owner: 'acme', repo: 'app' }, deps)
  assert.equal(result.ok, true)
  assert.equal(client.calls[0].method, 'createBranch')
})

test('gitea_repo_branch_delete requires confirm', async () => {
  const client = mockClient()
  const deps = baseDeps(client)
  const denied = await runHandler('gitea_repo_branch_delete', { branch: 'feat/x', owner: 'acme', repo: 'app' }, deps)
  assert.equal(denied.ok, false)
  const ok = await runHandler('gitea_repo_branch_delete', { branch: 'feat/x', confirm: true, owner: 'acme', repo: 'app' }, deps)
  assert.equal(ok.ok, true)
  assert.equal(client.calls[0].method, 'deleteBranch')
})

test('gitea_repo_tag_create calls createTag', async () => {
  const client = mockClient()
  const deps = baseDeps(client)
  const result = await runHandler('gitea_repo_tag_create', { tag_name: 'v0.3.0', owner: 'acme', repo: 'app' }, deps)
  assert.equal(result.ok, true)
  assert.equal(client.calls[0].method, 'createTag')
})

test('gitea_repo_tag_delete requires confirm', async () => {
  const client = mockClient()
  const deps = baseDeps(client)
  const denied = await runHandler('gitea_repo_tag_delete', { tag: 'v0.3.0', owner: 'acme', repo: 'app' }, deps)
  assert.equal(denied.ok, false)
  const ok = await runHandler('gitea_repo_tag_delete', { tag: 'v0.3.0', confirm: true, owner: 'acme', repo: 'app' }, deps)
  assert.equal(ok.ok, true)
  assert.equal(client.calls[0].method, 'deleteTag')
})

// ---- #110 milestone write + wiki page ----

test('gitea_milestone_update closes milestone', async () => {
  const client = mockClient()
  const deps = baseDeps(client)
  const result = await runHandler('gitea_milestone_update', { milestone_id: 5, state: 'closed', owner: 'acme', repo: 'app' }, deps)
  assert.equal(result.ok, true)
  assert.equal(client.calls[0].method, 'updateMilestone')
})

test('gitea_milestone_delete requires confirm', async () => {
  const client = mockClient()
  const deps = baseDeps(client)
  const denied = await runHandler('gitea_milestone_delete', { milestone_id: 5, owner: 'acme', repo: 'app' }, deps)
  assert.equal(denied.ok, false)
  const ok = await runHandler('gitea_milestone_delete', { milestone_id: 5, confirm: true, owner: 'acme', repo: 'app' }, deps)
  assert.equal(ok.ok, true)
  assert.equal(client.calls[0].method, 'deleteMilestone')
})

test('gitea_wiki_page gets page content', async () => {
  const client = mockClient()
  const deps = baseDeps(client)
  const result = await runHandler('gitea_wiki_page', { pageName: 'Home', owner: 'acme', repo: 'app' }, deps)
  assert.equal(result.ok, true)
  assert.equal(client.calls[0].method, 'getWikiPage')
})

// ---- #111 release update + webhooks ----

test('gitea_release_update calls updateRelease', async () => {
  const client = mockClient()
  const deps = baseDeps(client)
  const result = await runHandler('gitea_release_update', { release_id: 7, name: 'v0.3.0', owner: 'acme', repo: 'app' }, deps)
  assert.equal(result.ok, true)
  assert.equal(client.calls[0].method, 'updateRelease')
})

test('gitea_webhook_list calls listWebhooks', async () => {
  const client = mockClient()
  const deps = baseDeps(client)
  const result = await runHandler('gitea_webhook_list', { owner: 'acme', repo: 'app' }, deps)
  assert.equal(result.ok, true)
  assert.equal(client.calls[0].method, 'listWebhooks')
})

test('gitea_webhook_create calls createWebhook', async () => {
  const client = mockClient()
  const deps = baseDeps(client)
  const result = await runHandler('gitea_webhook_create', { url: 'https://x/hook', owner: 'acme', repo: 'app' }, deps)
  assert.equal(result.ok, true)
  assert.equal(client.calls[0].method, 'createWebhook')
})

test('gitea_webhook_delete requires confirm', async () => {
  const client = mockClient()
  const deps = baseDeps(client)
  const denied = await runHandler('gitea_webhook_delete', { hook_id: 3, owner: 'acme', repo: 'app' }, deps)
  assert.equal(denied.ok, false)
  const ok = await runHandler('gitea_webhook_delete', { hook_id: 3, confirm: true, owner: 'acme', repo: 'app' }, deps)
  assert.equal(ok.ok, true)
  assert.equal(client.calls[0].method, 'deleteWebhook')
})

// ---- #112 rerun, user search, org/teams ----

test('gitea_ci_rerun requires confirm', async () => {
  const client = mockClient()
  const deps = baseDeps(client)
  const denied = await runHandler('gitea_ci_rerun', { job_id: 9, owner: 'acme', repo: 'app' }, deps)
  assert.equal(denied.ok, false)
  const ok = await runHandler('gitea_ci_rerun', { job_id: 9, confirm: true, owner: 'acme', repo: 'app' }, deps)
  assert.equal(ok.ok, true)
  assert.equal(client.calls[0].method, 'rerunActionsJob')
})

test('gitea_user_search calls searchUsers', async () => {
  const client = mockClient()
  const deps = baseDeps(client)
  const result = await runHandler('gitea_user_search', { q: 'ali' }, deps)
  assert.equal(result.ok, true)
  assert.equal(client.calls[0].method, 'searchUsers')
})

test('gitea_org_list calls listUserOrgs', async () => {
  const client = mockClient()
  const deps = baseDeps(client)
  const result = await runHandler('gitea_org_list', {}, deps)
  assert.equal(result.ok, true)
  assert.equal(client.calls[0].method, 'listUserOrgs')
})

test('gitea_org_teams calls listOrgTeams', async () => {
  const client = mockClient()
  const deps = baseDeps(client)
  const result = await runHandler('gitea_org_teams', { org: 'goodandready' }, deps)
  assert.equal(result.ok, true)
  assert.equal(client.calls[0].method, 'listOrgTeams')
})

// ---- #141 AI PR review ----

test('gitea_pr_review builds review', async () => {
  const client = mockClient()
  if (!client.listPullFiles) client.listPullFiles = async () => ({ ok: true, data: [{ filename: 'src/a.ts', status: 'modified', additions: 5, deletions: 1 }] })
  if (!client.getPullMergeStatus) client.getPullMergeStatus = async () => ({ ok: true, data: { mergeable: true, has_conflicts: false } })
  const deps = baseDeps(client)
  const result = await runHandler('gitea_pr_review', { number: 1, owner: 'acme', repo: 'app' }, deps)
  assert.equal(result.ok, true)
  assert.equal(result.data.readOnly, true)
  assert.ok(Array.isArray(result.data.files))
})

// ---- #142 auto merge ----

test('gitea_auto_merge requires confirm', async () => {
  const client = mockClient()
  client.getPull = async () => ({ ok: true, data: { number: 5, title: 't', body: 'описание достаточно длинное для прохождения', mergeable: true, merged: false } })
  client.listPullReviews = async () => ({ ok: true, data: [{ state: 'APPROVED' }] })
  client.listPullFiles = async () => ({ ok: true, data: [{ filename: 'test/app.test.ts', status: 'modified', additions: 5, deletions: 0 }] })
  const deps = baseDeps(client)
  const denied = await runHandler('gitea_auto_merge', { number: 5, owner: 'acme', repo: 'app' }, deps)
  assert.equal(denied.ok, true)
  assert.equal(denied.data.merged, false)
  assert.equal(denied.data.needConfirm, true)
})

// ---- #144 mirror public ----

test('gitea_mirror_public returns plan', async () => {
  const client = mockClient()
  const deps = baseDeps(client)
  const result = await runHandler('gitea_mirror_public', { source: 'gitea', target: 'github' }, deps)
  assert.equal(result.ok, true)
  assert.equal(result.data.dryRun, true)
  assert.ok(result.data.steps.length >= 3)
})

// ---- #145 auto actions ----

test('gitea_auto_actions dry-runs without confirm', async () => {
  const client = mockClient()
  client.getIssue = async () => ({ ok: true, data: { number: 1, title: 'x', labels: [{ name: 'type/security' }], assignees: [] } })
  const deps = baseDeps(client)
  const result = await runHandler('gitea_auto_actions', { number: 1, owner: 'acme', repo: 'app' }, deps)
  assert.equal(result.ok, true)
  assert.equal(result.data.applied, false)
  assert.ok(result.data.actions.length >= 1)
})

// ---- #146 repo analytics ----

test('gitea_repo_analytics returns metrics', async () => {
  const client = mockClient()
  client.listIssues = async () => ({ ok: true, data: [{ number: 1, state: 'open' }, { number: 2, state: 'closed' }] })
  client.listPulls = async () => ({ ok: true, data: [{ number: 1, state: 'open' }] })
  const deps = baseDeps(client)
  const result = await runHandler('gitea_repo_analytics', { owner: 'acme', repo: 'app' }, deps)
  assert.equal(result.ok, true)
  assert.equal(result.data.issues.open, 1)
  assert.equal(result.data.pulls.open, 1)
})

// ---- #155 auto-rebase ----

test('gitea_pr_rebase dry-runs without confirm', async () => {
  const client = mockClient()
  const deps = baseDeps(client)
  const result = await runHandler('gitea_pr_rebase', { number: 3, owner: 'acme', repo: 'app' }, deps)
  assert.equal(result.ok, true)
  assert.equal(result.data.dryRun, true)
})

// ---- #156 code search ----

test('gitea_code_search calls searchCode', async () => {
  const client = mockClient()
  const deps = baseDeps(client)
  const result = await runHandler('gitea_code_search', { q: 'buildAnalytics', owner: 'acme', repo: 'app' }, deps)
  assert.equal(result.ok, true)
  assert.equal(client.calls[0].method, 'searchCode')
})

// ---- #157 release now ----

test('gitea_release_now returns release plan', async () => {
  const client = mockClient()
  client.listPulls = async () => ({ ok: true, data: [{ number: 1, title: 'feat: x', state: 'closed', merged_at: '2026-09-01T00:00:00Z' }] })
  const deps = baseDeps(client)
  const result = await runHandler('gitea_release_now', { owner: 'acme', repo: 'app' }, deps)
  assert.equal(result.ok, true)
  assert.equal(result.data.dryRun, true)
})

// ---- #160 review escalation ----

test('gitea_review_escalate dry-runs without confirm', async () => {
  const client = mockClient()
  client.listPulls = async () => ({ ok: true, data: [] })
  const deps = baseDeps(client)
  const result = await runHandler('gitea_review_escalate', { owner: 'acme', repo: 'app' }, deps)
  assert.equal(result.ok, true)
  assert.equal(result.data.applied, false)
})

// ---- #161 sprint plan ----

test('gitea_sprint_plan returns plan', async () => {
  const client = mockClient()
  client.listIssues = async () => ({ ok: true, data: [{ number: 1, title: 'x', state: 'open', labels: [{ name: 'status/ready' }] }] })
  client.listMilestones = async () => ({ ok: true, data: [] })
  const deps = baseDeps(client)
  const result = await runHandler('gitea_sprint_plan', { owner: 'acme', repo: 'app' }, deps)
  assert.equal(result.ok, true)
  assert.equal(result.data.dryRun, true)
})

// ---- #162 flavor ----

test('gitea_flavor detects gitea', async () => {
  const client = mockClient()
  const deps = baseDeps(client)
  const result = await runHandler('gitea_flavor', {}, deps)
  assert.equal(result.ok, true)
  assert.equal(result.data.flavor, 'gitea')
})
