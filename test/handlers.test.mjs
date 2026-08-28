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
