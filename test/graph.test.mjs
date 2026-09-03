import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  computeLanes,
  parseDecorations,
  parseGitLogOutput,
  fetchCommitGraph,
  GIT_LOG_FORMAT,
} from '../lib/graph.js'

test('computeLanes empty input returns empty array', () => {
  assert.deepEqual(computeLanes([]), [])
  assert.deepEqual(computeLanes(null), [])
})

test('computeLanes single linear commit chain assigns single column', () => {
  const rows = [
    { oid: 'c3', parents: ['c2'] },
    { oid: 'c2', parents: ['c1'] },
    { oid: 'c1', parents: [] },
  ]
  const lanes = computeLanes(rows)
  assert.equal(lanes.length, 3)
  assert.deepEqual(lanes[0].columns, ['node'])
  assert.equal(lanes[0].nodeColumn, 0)
  assert.equal(lanes[0].merge, false)

  assert.deepEqual(lanes[1].columns, ['node'])
  assert.equal(lanes[1].nodeColumn, 0)
  assert.equal(lanes[1].merge, false)

  assert.deepEqual(lanes[2].columns, ['node'])
  assert.equal(lanes[2].nodeColumn, 0)
  assert.equal(lanes[2].merge, false)
})

test('computeLanes branch and merge assignment produces distinct columns', () => {
  // m: merge commit of b1 and main
  // b1: commit on feature branch (parent: root)
  // m1: commit on main branch (parent: root)
  // root: initial commit
  const rows = [
    { oid: 'm', parents: ['m1', 'b1'] },
    { oid: 'b1', parents: ['root'] },
    { oid: 'm1', parents: ['root'] },
    { oid: 'root', parents: [] },
  ]
  const lanes = computeLanes(rows)
  assert.equal(lanes.length, 4)

  // Merge commit row has 'merge' in column 0
  assert.equal(lanes[0].merge, true)
  assert.equal(lanes[0].columns[0], 'merge')

  // While b1 is being visited, m1 is still pending in another column
  assert.equal(lanes[1].merge, false)
  assert.ok(lanes[1].columns.includes('node'))
  assert.ok(lanes[1].columns.includes('pass'))
})

test('parseDecorations extracts branch and tag names cleanly', () => {
  assert.deepEqual(parseDecorations(''), [])
  assert.deepEqual(parseDecorations('HEAD -> main, tag: v0.4.3, origin/main'), [
    'main',
    'v0.4.3',
    'origin/main',
  ])
  assert.deepEqual(parseDecorations('tag: v1.0.0'), ['v1.0.0'])
})

test('parseGitLogOutput correctly splits records and fields', () => {
  const stdout =
    `abc1234\x1fdef5678\x1fVadim\x1f1700000000\x1ffeat: add graph\x1fHEAD -> main, tag: v0.4.3\x1e` +
    `def5678\x1f\x1fVadim\x1f1699990000\x1finitial commit\x1f\x1e`

  const commits = parseGitLogOutput(stdout)
  assert.equal(commits.length, 2)

  assert.equal(commits[0].oid, 'abc1234')
  assert.deepEqual(commits[0].parents, ['def5678'])
  assert.equal(commits[0].author, 'Vadim')
  assert.equal(commits[0].authorTime, 1700000000)
  assert.equal(commits[0].subject, 'feat: add graph')
  assert.deepEqual(commits[0].refs, ['main', 'v0.4.3'])

  assert.equal(commits[1].oid, 'def5678')
  assert.deepEqual(commits[1].parents, [])
  assert.equal(commits[1].author, 'Vadim')
  assert.equal(commits[1].subject, 'initial commit')
  assert.deepEqual(commits[1].refs, [])
})

test('fetchCommitGraph calls git with expected topo-order arguments and parses output', async () => {
  const sampleLog = `a1\x1fb1\x1fAuthor\x1f1700000000\x1fcommit a\x1fHEAD -> main\x1e`
  const calls = []
  const mockExecFile = (bin, args, opts, cb) => {
    calls.push({ bin, args, opts })
    cb(null, sampleLog, '')
  }

  const res = await fetchCommitGraph({
    gitWrapper: 'git-antigravity',
    cwd: '/test/repo',
    limit: 50,
    execFile: mockExecFile,
  })

  assert.equal(res.ok, true)
  assert.equal(calls.length, 1)
  assert.equal(calls[0].bin, 'git-antigravity')
  assert.ok(calls[0].args.includes('--topo-order'))
  assert.ok(calls[0].args.includes('--max-count=51'))
  assert.equal(res.data.commits.length, 1)
  assert.equal(res.data.commits[0].oid, 'a1')
  assert.equal(res.data.hasMore, false)
  assert.equal(res.data.lanes.length, 1)
})
