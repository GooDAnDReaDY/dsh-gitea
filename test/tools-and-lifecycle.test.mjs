import test from 'node:test'
import assert from 'node:assert/strict'
import { GiteaClient } from '../lib/gitea-client.js'
import { applyBootstrap } from '../lib/repo-bootstrap.js'
import { TOOL_DEFS } from '../lib/tool-defs.js'
import { runRebase, planRebase } from '../lib/pr-rebase.js'
import { runHandler, formatToolResult } from '../lib/handlers.js'
import { runWorktreeAction, buildGitSnapshot, clearSnapshotCache, MAX_SNAPSHOT_ENTRIES, getSnapshotCacheSize } from '../lib/git-local.js'
import { buildImpactMap } from '../lib/impact-map.js'
import { detectFlavor } from '../lib/forgejo-detect.js'
import { buildReviewInbox } from '../lib/review-inbox.js'
import { isForbiddenPath } from '../lib/session-git.js'
import { listIssueTemplates, validateAllTemplates } from '../lib/issue-templates.js'

function makeTestDeps(client, extra = {}) {
  return {
    client,
    configured: { baseUrl: 'http://localhost:3000', token: 'tok' },
    settings: { baseUrl: 'http://localhost:3000', tokenEnv: 'GITEA_TOKEN' },
    ...extra,
  }
}

test('#263: annotateCommentsWithMine uses logger.warn when logger is provided', async () => {
  const warnings = []
  const mockLogger = {
    warn: (...args) => warnings.push(args.join(' ')),
  }
  const comments = [{ id: 1, user: { login: 'alice' }, body: 'hello' }]
  const client = {
    listIssueComments: async () => ({ ok: true, data: comments }),
    getUser: () => Promise.reject(new Error('simulated network failure')),
  }
  const deps = makeTestDeps(client, { logger: mockLogger })
  const res = await runHandler('gitea_issue_comments', { number: 1, owner: 'o', repo: 'r' }, deps)
  assert.equal(res.ok, true)
  assert.ok(warnings.some((w) => w.includes('[dsh-gitea] getUser failed')))
})

test('#264: gitea_issue_timeline parameters include pagination and time filters', () => {
  const def = TOOL_DEFS.find((t) => t.name === 'gitea_issue_timeline')
  assert.ok(def, 'gitea_issue_timeline def found')
  assert.ok(def.parameters.since, 'since parameter present')
  assert.ok(def.parameters.before, 'before parameter present')
  assert.ok(def.parameters.limit, 'limit parameter present')
  assert.ok(def.parameters.page, 'page parameter present')
})

test('#267 & #268: runRebase gates on gitWrapper and validates branch', async () => {
  // Missing gitWrapper
  const noWrapper = await runRebase({ confirm: true, owner: 'o', repo: 'r' }, { cwd: '/repo', execFile: async () => {} })
  assert.equal(noWrapper.ok, false)
  assert.match(noWrapper.error, /git wrapper not configured/)

  // Invalid branch name (injection)
  const badBranch = await runRebase({ confirm: true, owner: 'o', repo: 'r', branch: 'feat;rm -rf /' }, {
    cwd: '/repo',
    gitWrapper: 'git',
    execFile: async () => {},
  })
  assert.equal(badBranch.ok, false)
  assert.match(badBranch.error, /Invalid branch name/)

  // Path traversal in branch
  const traversalBranch = await runRebase({ confirm: true, owner: 'o', repo: 'r', branch: 'feat/../main' }, {
    cwd: '/repo',
    gitWrapper: 'git',
    execFile: async () => {},
  })
  assert.equal(traversalBranch.ok, false)
  assert.match(traversalBranch.error, /Invalid branch name/)
})

test('#267: runRebase reports failures on fetch, push, and non-conflict rebase', async () => {
  // Fetch failure
  const fetchFail = await runRebase({ confirm: true, owner: 'o', repo: 'r' }, {
    cwd: '/repo',
    gitWrapper: 'git',
    execFile: async (bin, args) => {
      if (args.includes('fetch')) {
        const err = new Error('network down')
        err.code = 128
        err.stderr = 'fatal: unable to access remote'
        throw err
      }
      return { stdout: '', stderr: '' }
    },
  })
  assert.equal(fetchFail.ok, false)
  assert.match(fetchFail.error, /git fetch origin main failed/)

  // Push failure
  const pushFail = await runRebase({ confirm: true, owner: 'o', repo: 'r' }, {
    cwd: '/repo',
    gitWrapper: 'git',
    execFile: async (bin, args) => {
      if (args.includes('push')) {
        const err = new Error('rejected')
        err.code = 1
        err.stderr = 'error: failed to push some refs'
        throw err
      }
      return { stdout: '', stderr: '' }
    },
  })
  assert.equal(pushFail.ok, false)
  assert.match(pushFail.error, /git push origin failed/)

  // Rebase conflict returns conflict files
  const conflict = await runRebase({ confirm: true, owner: 'o', repo: 'r' }, {
    cwd: '/repo',
    gitWrapper: 'git',
    execFile: async (bin, args) => {
      if (args.includes('rebase')) {
        const err = new Error('conflict')
        err.code = 1
        err.stderr = 'CONFLICT (content): Merge conflict in file.txt'
        throw err
      }
      if (args.includes('diff')) {
        return { stdout: 'file.txt\n' }
      }
      return { stdout: '', stderr: '' }
    },
  })
  assert.equal(conflict.ok, true)
  assert.equal(conflict.data.rebased, false)
  assert.deepEqual(conflict.data.conflicts, ['file.txt'])
})

test('#268 & #278: planRebase enriches head and base branches when client is present', async () => {
  const client = {
    getPull: async (o, r, num) => ({
      ok: true,
      data: { head: { ref: 'feature-branch' }, base: { ref: 'main' } },
    }),
  }
  const plan = await planRebase({ owner: 'o', repo: 'r', number: 42 }, { client })
  assert.equal(plan.ok, true)
  assert.equal(plan.data.headBranch, 'feature-branch')
  assert.equal(plan.data.baseBranch, 'main')
})

test('#269: GiteaClient createFile and updateFile endpoints', async () => {
  const requests = []
  const client = new GiteaClient({
    baseUrl: 'http://localhost:3000',
    token: 'tok',
    fetchImpl: async (url, opts) => {
      requests.push({ url, method: opts.method, body: opts.body ? JSON.parse(opts.body) : null })
      return {
        ok: true,
        status: 201,
        headers: new Headers(),
        text: async () => JSON.stringify({ content: { name: 'test.md' } }),
      }
    },
  })

  const cRes = await client.createFile('acme', 'proj', 'docs/readme.md', { content: 'YQ==', message: 'Add readme' })
  assert.equal(cRes.ok, true)
  assert.equal(requests[0].method, 'POST')
  assert.match(requests[0].url, /\/repos\/acme\/proj\/contents\/docs\/readme\.md/)

  const uRes = await client.updateFile('acme', 'proj', 'docs/readme.md', { content: 'Yg==', message: 'Update readme', sha: '123' })
  assert.equal(uRes.ok, true)
  assert.equal(requests[1].method, 'PUT')
  assert.match(requests[1].url, /\/repos\/acme\/proj\/contents\/docs\/readme\.md/)
})

test('#269: applyBootstrap creates all template files and handles existing files', async () => {
  const created = []
  const client = {
    createRepo: async () => ({ ok: true, data: { owner: { login: 'acme' } } }),
    createFile: async (owner, repo, filePath, body) => {
      if (filePath === 'README.md') {
        // simulate README already existing from auto_init
        return { ok: false, status: 422, error: 'file already exists' }
      }
      created.push(filePath)
      return { ok: true, data: { content: { path: filePath } } }
    },
    getContents: async () => ({ ok: true, data: { sha: 'abc123' } }),
    updateFile: async (owner, repo, filePath, body) => {
      created.push(filePath)
      return { ok: true, data: { content: { path: filePath } } }
    },
  }

  const res = await applyBootstrap({ name: 'my-repo' }, { client })
  assert.equal(res.ok, true)
  assert.equal(res.data.created, true)
  assert.ok(res.data.files.includes('README.md'))
  assert.ok(res.data.files.includes('.gitignore'))
  assert.ok(res.data.files.includes('.gitea/workflows/ci.yml'))
  assert.equal(created.length, res.data.files.length)
})

test('#272: confirm gates on mutating tools (batch_issue_ops and label_bootstrap)', async () => {
  let batchApplied = false
  let labelApplied = false

  const client = {
    setIssueLabels: async () => { batchApplied = true; return { ok: true } },
    createLabel: async () => { labelApplied = true; return { ok: true } },
    listLabels: async () => ({ ok: true, data: [{ id: 10, name: 'bug' }] }),
    listIssues: async () => ({ ok: true, data: [{ number: 1, labels: [] }] }),
  }
  const deps = makeTestDeps(client)

  // batch_issue_ops dry-run without confirm
  const bPlan = await runHandler('gitea_batch_issue_ops', { numbers: [1], label: 'bug', owner: 'o', repo: 'r' }, deps)
  assert.equal(bPlan.ok, true)
  assert.equal(bPlan.data.dryRun, true)
  assert.equal(batchApplied, false)

  // batch_issue_ops with confirm: true
  const bExec = await runHandler('gitea_batch_issue_ops', { numbers: [1], label: 'bug', owner: 'o', repo: 'r', confirm: true }, deps)
  assert.equal(bExec.ok, true)
  assert.equal(batchApplied, true)

  // label_bootstrap dry-run without confirm
  const lPlan = await runHandler('gitea_label_bootstrap', { owner: 'o', repo: 'r' }, deps)
  assert.equal(lPlan.ok, true)
  assert.equal(lPlan.data.dryRun, true)
  assert.equal(labelApplied, false)

  // label_bootstrap with confirm: true
  const lExec = await runHandler('gitea_label_bootstrap', { owner: 'o', repo: 'r', confirm: true }, deps)
  assert.equal(lExec.ok, true)
  assert.equal(labelApplied, true)
})

test('#273 & #278: formatToolResult formats gitea_issue_comment and gitea_pr_merge with numbers', () => {
  const commentFmt = formatToolResult('gitea_issue_comment', {
    ok: true,
    data: {
      issue_number: 99,
      id: 555,
      user: { login: 'vadim' },
    },
  })
  assert.match(commentFmt[0].text, /Comment posted on #99 \(comment #555\) by @vadim\./)

  const mergeFmt = formatToolResult('gitea_pr_merge', {
    ok: true,
    data: {
      number: 77,
      merged: true,
    },
  })
  assert.match(mergeFmt[0].text, /Pull request #77 merged\./)
})

test('#275: snapshotCache respects MAX_SNAPSHOT_ENTRIES = 50 and LRU eviction', async () => {
  clearSnapshotCache()
  const fakeExecFile = async () => ({ stdout: 'main\n', stderr: '' })

  for (let i = 0; i < 60; i += 1) {
    await buildGitSnapshot({ repoDir: `/mock/repo/${i}`, execFile: fakeExecFile, maxAgeMs: 60_000 })
  }

  assert.equal(getSnapshotCacheSize(), MAX_SNAPSHOT_ENTRIES)
  clearSnapshotCache()
})

test('#276: runWorktreeAction "use" validates isGitDir and pins path', async () => {
  let pinned = null
  const deps = {
    execFile: async (bin, args, opts) => {
      if (opts?.cwd === '/valid/git') return { stdout: '/valid/git\n', stderr: '' }
      throw new Error('not a git repo')
    },
    pinGitFromExec: async (exec, res) => {
      pinned = res.repoDir
    },
  }

  // Invalid dir
  const invalid = await runWorktreeAction('use', { path: '/invalid/path' }, deps)
  assert.equal(invalid.ok, false)
  assert.match(invalid.error, /not a valid git repository/)
  assert.equal(pinned, null)

  // Valid dir
  const valid = await runWorktreeAction('use', { path: '/valid/git' }, deps)
  assert.equal(valid.ok, true)
  assert.equal(valid.data.repoDir, '/valid/git')
  assert.equal(pinned, '/valid/git')
})

test('#277: buildImpactMap truncates file list at 50', async () => {
  const files = []
  for (let i = 1; i <= 65; i += 1) {
    files.push({ filename: `src/mod${i}/file${i}.js` })
  }
  const client = {
    getPull: async () => ({ ok: true, data: { title: 'Big PR', user: { login: 'dev' } } }),
    listPullFiles: async () => ({ ok: true, data: files }),
  }

  const res = await buildImpactMap({ owner: 'o', repo: 'r', number: 10 }, { client })
  assert.equal(res.ok, true)
  assert.equal(res.data.truncated, true)
  assert.equal(res.data.files.length, 50)
})

test('#278: detectFlavor handles direct client argument', async () => {
  const client = {
    getVersion: async () => ({ ok: true, data: { version: '1.22.0+gitea-1.22.0' } }),
  }
  const res = await detectFlavor({ client })
  assert.equal(res.ok, true)
  assert.equal(res.data.flavor, 'gitea')
})

test('#278: buildReviewInbox captures review API errors in errors array', async () => {
  const client = {
    listPulls: async () => ({ ok: true, data: [{ number: 101, user: { login: 'alice' } }] }),
    listPullReviews: async () => ({ ok: false, error: 'Review fetch timeout' }),
  }

  const res = await buildReviewInbox({ owner: 'o', repo: 'r' }, { client })
  assert.equal(res.ok, true)
  assert.ok(res.data.errors.some((e) => e.includes('reviews #101: Review fetch timeout')))
})

test('#278: isForbiddenPath correctly blocks root, system prefixes, and traversal', () => {
  assert.equal(isForbiddenPath('/etc'), true)
  assert.equal(isForbiddenPath('/etc/passwd'), true)
  assert.equal(isForbiddenPath('/root'), true)
  assert.equal(isForbiddenPath('/sys/kernel'), true)
  assert.equal(isForbiddenPath('/home/vadim/project/repo'), false)
  assert.equal(isForbiddenPath('C:\\Windows\\System32'), true)
  assert.equal(isForbiddenPath('C:\\Projects\\repo'), false)
})

test('#278: issue template containment rejects directory escape', () => {
  const templates = listIssueTemplates()
  assert.ok(Array.isArray(templates))
  // All templates should have clean base names
  for (const t of templates) {
    assert.equal(t.file.includes('..'), false)
    assert.equal(t.file.includes('/'), false)
  }
})

test('#274: apply registers tools/execute middleware within ctx.effect', async () => {
  const effects = []
  const listeners = []
  const mockCtx = {
    inject(deps, cb) {
      if (typeof cb === 'function') cb({ settings: {} })
    },
    logger: { info: () => {}, warn: () => {}, error: () => {} },
    credentials: { resolve: async () => ({ value: 'tok' }) },
    settings: {
      register: () => {},
      watch: () => () => {},
    },
    tools: {
      register: () => {},
    },
    webServer: {
      register: () => {},
      route: () => {},
    },
    on: (evt, handler) => {
      listeners.push(evt)
      return () => {}
    },
    effect: (fn) => {
      effects.push(fn)
      return fn()
    },
    provide() {},
  }

  const { apply } = await import('../lib/index.js')
  apply(mockCtx)
  assert.ok(listeners.includes('tools/execute'), 'tools/execute middleware registered')
  assert.ok(effects.length > 0, 'ctx.effect called')
})
