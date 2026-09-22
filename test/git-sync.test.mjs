import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildGitSnapshot } from '../lib/git-local.js'

test('buildGitSnapshot returns ahead and behind counts when upstream is present', async () => {
  const mockExec = async (bin, args, opts) => {
    const cmd = args.join(' ')
    if (cmd === 'rev-parse --abbrev-ref HEAD') return { stdout: 'feat/test\n', stderr: '' }
    if (cmd === 'rev-parse HEAD') return { stdout: 'abcdef123456\n', stderr: '' }
    if (cmd === 'rev-parse --show-toplevel') return { stdout: '/workspace/my-repo\n', stderr: '' }
    if (cmd === 'status --porcelain') return { stdout: ' M lib/file.js\n?? new.txt\n', stderr: '' }
    if (cmd === 'log --oneline -8') return { stdout: 'abcdef initial\n', stderr: '' }
    if (cmd === 'remote get-url origin') return { stdout: 'git@gitea.local:org/my-repo.git\n', stderr: '' }
    if (cmd === 'rev-list --left-right --count HEAD...@{upstream}') {
      return { stdout: '3\t1\n', stderr: '' }
    }
    if (cmd.startsWith('diff')) return { stdout: 'diff contents', stderr: '' }
    return { stdout: '', stderr: '' }
  }

  const snap = await buildGitSnapshot({ repoDir: '/workspace/my-repo', execFile: mockExec })
  assert.equal(snap.ok, true)
  assert.equal(snap.branch, 'feat/test')
  assert.equal(snap.dirty, true)
  assert.equal(snap.dirtyFiles, 2)
  assert.equal(snap.ahead, 3)
  assert.equal(snap.behind, 1)
  assert.equal(snap.upstream, '@{upstream}')
  assert.equal(snap.repoName, 'my-repo')
})

test('buildGitSnapshot falls back to origin/<branch> if @{upstream} fails', async () => {
  const mockExec = async (bin, args, opts) => {
    const cmd = args.join(' ')
    if (cmd === 'rev-parse --abbrev-ref HEAD') return { stdout: 'main\n', stderr: '' }
    if (cmd === 'rev-parse HEAD') return { stdout: '123456\n', stderr: '' }
    if (cmd === 'rev-parse --show-toplevel') return { stdout: '/workspace/repo\n', stderr: '' }
    if (cmd === 'status --porcelain') return { stdout: '', stderr: '' }
    if (cmd === 'log --oneline -8') return { stdout: '123456 initial\n', stderr: '' }
    if (cmd === 'remote get-url origin') return { stdout: 'https://gitea.local/owner/repo.git\n', stderr: '' }
    if (cmd === 'rev-list --left-right --count HEAD...@{upstream}') {
      throw new Error('fatal: no upstream configured for branch')
    }
    if (cmd === 'rev-list --left-right --count HEAD...origin/main') {
      return { stdout: '0\t2\n', stderr: '' }
    }
    return { stdout: '', stderr: '' }
  }

  const snap = await buildGitSnapshot({ repoDir: '/workspace/repo', execFile: mockExec })
  assert.equal(snap.ok, true)
  assert.equal(snap.dirty, false)
  assert.equal(snap.ahead, 0)
  assert.equal(snap.behind, 2)
  assert.equal(snap.upstream, 'origin/main')
})
