import { test } from 'node:test'
import assert from 'node:assert/strict'
import { runHandler } from '../lib/handlers.js'

test('runHandler gitea_git_graph invokes fetchCommitGraph and enriches CI status', async () => {
  const sampleLog = `a1\x1fb1\x1fVadim\x1f1700000000\x1ffeat: test\x1fHEAD -> main\x1e`
  const mockExec = (bin, args, opts, cb) => {
    cb(null, sampleLog, '')
  }

  const mockClient = {
    getCombinedCommitStatus: async (owner, repo, sha) => {
      assert.equal(owner, 'goodandready')
      assert.equal(repo, 'dsh-gitea')
      assert.equal(sha, 'a1')
      return { ok: true, data: { state: 'success' } }
    },
  }

  const res = await runHandler('gitea_git_graph', {
    owner: 'goodandready',
    repo: 'dsh-gitea',
    limit: 10,
  }, {
    cwd: '/test/cwd',
    gitWrapper: 'git',
    execFile: mockExec,
    client: mockClient,
    settings: { baseUrl: 'http://gitea.local', tokenEnv: 'GITEA_TOKEN' },
    configured: { baseUrl: 'http://gitea.local', token: 'dummy' },
  })

  assert.equal(res.ok, true)
  assert.equal(res.data.commits.length, 1)
  assert.equal(res.data.commits[0].oid, 'a1')
  assert.equal(res.data.commits[0].ciStatus, 'success')
  assert.equal(res.data.lanes.length, 1)
})
