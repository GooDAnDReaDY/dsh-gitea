import test from 'node:test'
import assert from 'node:assert/strict'
import { runHandler, formatToolResult } from '../lib/handlers.js'

function createMockClient({ currentUser = 'alice', comments = [] } = {}) {
  const calls = []
  return {
    calls,
    getUser: () => {
      calls.push({ method: 'getUser' })
      return Promise.resolve({ ok: true, data: { login: currentUser, id: 10 } })
    },
    getIssueComment: (owner, repo, id) => {
      calls.push({ method: 'getIssueComment', owner, repo, id })
      const comment = comments.find(c => c.id === Number(id))
      if (!comment) {
        return Promise.resolve({ ok: false, status: 404, error: 'comment not found' })
      }
      return Promise.resolve({ ok: true, data: comment })
    },
    deleteIssueComment: (owner, repo, id) => {
      calls.push({ method: 'deleteIssueComment', owner, repo, id })
      return Promise.resolve({ ok: true, status: 204, data: null })
    },
    listIssueComments: (owner, repo, number) => {
      calls.push({ method: 'listIssueComments', owner, repo, number })
      return Promise.resolve({ ok: true, data: comments })
    },
    getIssue: (owner, repo, number) => {
      calls.push({ method: 'getIssue', owner, repo, number })
      return Promise.resolve({ ok: true, data: { number, title: 'Test Issue' } })
    },
  }
}

function createDeps(client) {
  return {
    client,
    configured: { baseUrl: 'http://gitea.local', token: 'secret' },
    settings: { tokenEnv: 'GITEA_TOKEN' },
  }
}

test('gitea_issue_comment_delete requires numeric comment_id', async () => {
  const client = createMockClient()
  const deps = createDeps(client)
  const res = await runHandler('gitea_issue_comment_delete', { owner: 'acme', repo: 'app' }, deps)
  assert.equal(res.ok, false)
  assert.match(res.error, /comment_id is required/)
})

test('gitea_issue_comment_delete returns dry-run preview when confirm is not true', async () => {
  const comment = {
    id: 501,
    user: { login: 'alice' },
    body: 'This is my first duplicate comment that should be cleaned up.',
    created_at: '2026-09-17T19:01:05Z',
  }
  const client = createMockClient({ currentUser: 'alice', comments: [comment] })
  const deps = createDeps(client)

  const res = await runHandler('gitea_issue_comment_delete', {
    comment_id: 501,
    confirm: false,
    owner: 'acme',
    repo: 'app',
  }, deps)

  assert.equal(res.ok, true)
  assert.equal(res.data.dryRun, true)
  assert.equal(res.data.commentId, 501)
  assert.equal(res.data.author, 'alice')
  assert.equal(res.data.createdAt, '2026-09-17T19:01:05Z')
  assert.equal(res.data.preview, 'This is my first duplicate comment that should be cleaned up.')
  assert.match(res.data.message, /Dry-run: pass confirm: true/)

  // Verify deleteIssueComment was NOT called
  assert.equal(client.calls.some(c => c.method === 'deleteIssueComment'), false)
})

test('gitea_issue_comment_delete refuses to delete comment by another author', async () => {
  const comment = {
    id: 502,
    user: { login: 'bob' },
    body: 'Important verdict by bob.',
    created_at: '2026-09-17T19:00:00Z',
  }
  const client = createMockClient({ currentUser: 'alice', comments: [comment] })
  const deps = createDeps(client)

  const res = await runHandler('gitea_issue_comment_delete', {
    comment_id: 502,
    confirm: true,
    owner: 'acme',
    repo: 'app',
  }, deps)

  assert.equal(res.ok, false)
  assert.match(res.error, /Refusing to delete comment #502 by 'bob'/)
  assert.match(res.error, /only comments authored by the authenticated user \('alice'\) can be deleted/)

  // Verify deleteIssueComment was NOT called
  assert.equal(client.calls.some(c => c.method === 'deleteIssueComment'), false)
})

test('gitea_issue_comment_delete permanently deletes comment when confirmed and author matches', async () => {
  const comment = {
    id: 503,
    user: { login: 'alice' },
    body: 'Duplicate verdict comment to delete.',
    created_at: '2026-09-17T19:01:09Z',
  }
  const client = createMockClient({ currentUser: 'alice', comments: [comment] })
  const deps = createDeps(client)

  const res = await runHandler('gitea_issue_comment_delete', {
    comment_id: 503,
    confirm: true,
    owner: 'acme',
    repo: 'app',
  }, deps)

  assert.equal(res.ok, true)
  assert.equal(res.data.deleted, true)
  assert.equal(res.data.commentId, 503)
  assert.equal(res.data.author, 'alice')

  // Verify deleteIssueComment was called with correct arguments
  const delCall = client.calls.find(c => c.method === 'deleteIssueComment')
  assert.ok(delCall)
  assert.equal(delCall.id, 503)
})

test('gitea_issue_comment_delete reports 404 when comment does not exist', async () => {
  const client = createMockClient({ currentUser: 'alice', comments: [] })
  const deps = createDeps(client)

  const res = await runHandler('gitea_issue_comment_delete', {
    comment_id: 999,
    confirm: true,
    owner: 'acme',
    repo: 'app',
  }, deps)

  assert.equal(res.ok, false)
  assert.match(res.error, /404|comment not found/)
})

test('gitea_issue_comments marks mine: true for current user and false for others', async () => {
  const comments = [
    { id: 1, user: { login: 'alice' }, body: 'My comment', created_at: '2026-09-17T18:00:00Z' },
    { id: 2, user: { login: 'bob' }, body: 'Bob comment', created_at: '2026-09-17T18:05:00Z' },
  ]
  const client = createMockClient({ currentUser: 'alice', comments })
  const deps = createDeps(client)

  const res = await runHandler('gitea_issue_comments', {
    number: 10,
    owner: 'acme',
    repo: 'app',
  }, deps)

  assert.equal(res.ok, true)
  assert.equal(res.data.length, 2)
  assert.equal(res.data[0].id, 1)
  assert.equal(res.data[0].mine, true)
  assert.equal(res.data[1].id, 2)
  assert.equal(res.data[1].mine, false)
})

test('gitea_issue_get annotates comments with mine: true/false when include_comments is true', async () => {
  const comments = [
    { id: 10, user: { login: 'alice' }, body: 'Alice comment' },
    { id: 11, user: { login: 'charlie' }, body: 'Charlie comment' },
  ]
  const client = createMockClient({ currentUser: 'alice', comments })
  const deps = createDeps(client)

  const res = await runHandler('gitea_issue_get', {
    number: 25,
    include_comments: true,
    owner: 'acme',
    repo: 'app',
  }, deps)

  assert.equal(res.ok, true)
  assert.equal(res.data.comments.length, 2)
  assert.equal(res.data.comments[0].mine, true)
  assert.equal(res.data.comments[1].mine, false)
})

test('formatToolResult formats dry-run and deleted results properly', () => {
  const dryRes = formatToolResult('gitea_issue_comment_delete', {
    ok: true,
    data: {
      dryRun: true,
      commentId: 501,
      owner: 'acme',
      repo: 'app',
      author: 'alice',
      createdAt: '2026-09-17T19:01:05Z',
      preview: 'A preview snippet',
    },
  })
  assert.equal(dryRes.length, 1)
  assert.match(dryRes[0].text, /\[DRY-RUN\] Comment #501 in acme\/app by @alice/)
  assert.match(dryRes[0].text, /Pass confirm: true to permanently delete\./)

  const delRes = formatToolResult('gitea_issue_comment_delete', {
    ok: true,
    data: {
      deleted: true,
      commentId: 501,
      author: 'alice',
      createdAt: '2026-09-17T19:01:05Z',
      preview: 'A preview snippet',
    },
  })
  assert.equal(delRes.length, 1)
  assert.match(delRes[0].text, /Deleted comment #501 by @alice/)

  const commentsRes = formatToolResult('gitea_issue_comments', {
    ok: true,
    data: [
      { user: 'alice', mine: true, body: 'Own comment', created_at: '2026-09-17' },
      { user: 'bob', mine: false, body: 'Other comment', created_at: '2026-09-17' },
    ],
  })
  assert.equal(commentsRes.length, 1)
  assert.match(commentsRes[0].text, /\*\*alice\*\* \(you\) \(2026-09-17\):\nOwn comment/)
  assert.match(commentsRes[0].text, /\*\*bob\*\* \(2026-09-17\):\nOther comment/)
})

