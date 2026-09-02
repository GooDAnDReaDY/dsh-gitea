/**
 * gitea_pr_rebase: авто-rebase PR-ветки на свежий main через gitWrapper.
 * План (read-only) и выполнение (confirm). При конфликтах возвращает
 * список файлов — агент решает их вручную.
 */

export async function planRebase(args = {}, deps = {}) {
  const { number } = args
  return {
    ok: true,
    data: {
      dryRun: true,
      number,
      steps: [
        '1. определить PR-ветку (head) и main',
        '2. fetch origin main',
        '3. rebase ветки на origin/main (или merge)',
        '4. при конфликтах — вернуть список файлов, иначе push + rerun CI',
      ],
      note: 'План. Фактический rebase требует confirm: true.',
    },
  }
}

export async function runRebase(args = {}, deps = {}) {
  const confirm = args.confirm === true
  const execFile = deps.execFile
  const gitWrapper = deps.gitWrapper || 'git'
  const cwd = deps.cwd
  const owner = args.owner
  const repo = args.repo

  if (!confirm) return { ok: false, error: 'Auto-rebase requires confirm: true (boolean).' }
  if (!cwd || !execFile) return { ok: false, error: 'No workspace cwd or execFile provided. Run from a gitea worktree.' }
  if (!repo) return { ok: false, error: 'Cannot rebase: repo not resolved.' }

  const run = async (bin, gitArgs) => {
    const res = await execFile(bin, gitArgs).catch((e) => ({ stdout: '', stderr: String(e?.stderr || e?.message || e) }))
    return res
  }

  try {
    // fetch свежий main
    await run(gitWrapper, ['-C', cwd, 'fetch', 'origin', 'main'])
    // rebase на origin/main
    const rebaseRes = await run(gitWrapper, ['-C', cwd, 'rebase', 'origin/main'])
    const stderr = String(rebaseRes.stderr || '')
    if (/conflict|CONFLICT|fatal/i.test(stderr) || /rebase in progress/i.test(stderr)) {
      // собрать конфликтные файлы
      const lsRes = await run(gitWrapper, ['-C', cwd, 'diff', '--name-only', '--diff-filter=U'])
      const files = String(lsRes.stdout || '').split('\n').filter(Boolean)
      return {
        ok: true,
        data: { rebased: false, conflicts: files.length ? files : ['(см. git status)'], note: 'Конфликты — решите вручную и завершите rebase (git rebase --continue).' },
      }
    }
    // push
    await run(gitWrapper, ['-C', cwd, 'push', 'origin', `HEAD:${args.branch || 'HEAD'}`])
    return { ok: true, data: { rebased: true, pushed: true, note: 'Rebase выполнен, изменения запушены.' } }
  } catch (e) {
    return { ok: false, error: String(e?.message || e) }
  }
}
