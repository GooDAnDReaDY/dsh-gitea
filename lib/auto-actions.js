/**
 * auto-actions: правила автодействий поверх label-auto.
 * По умолчанию: issue с type/security → комментарий-чек-лист.
 * Dry-run + confirm. Правила расширяемы.
 */

const CHECKLIST = [
  'Проверить, что секреты не в коде/.env',
  'Добавить репродукцию уязвимости',
  'Согласовать с владельцем безопасности',
  'Прогнать сканер зависимостей',
]

function actionsForIssue(issue = {}) {
  const actions = []
  const names = (Array.isArray(issue.labels) ? issue.labels : []).map((l) => l.name || l)
  if (names.includes('type/security')) {
    actions.push({
      type: 'comment',
      payload: { body: `**Auto-action (type/security):** чек-лист:\n${CHECKLIST.map((c) => `- [ ] ${c}`).join('\n')}` },
    })
    actions.push({ type: 'label', payload: { labels: ['priority/high'] } })
  }
  return actions
}

export async function buildAutoActions(args = {}, deps = {}) {
  const client = deps.client
  const owner = args.owner
  const repo = args.repo
  const number = Number(args.number)

  const res = await client.getIssue(owner, repo, number).catch((e) => ({ ok: false, error: String(e) }))
  if (!res?.ok) return { ok: false, error: res?.error || 'getIssue failed' }
  const actions = actionsForIssue(res.data)
  return { ok: true, data: { number, actions, dryRun: true, note: 'Только рекомендации. Применение требует confirm.' } }
}

export async function applyAutoActions(args = {}, deps = {}) {
  const client = deps.client
  const owner = args.owner
  const repo = args.repo
  const number = Number(args.number)

  const res = await buildAutoActions({ owner, repo, number }, deps)
  if (!res.ok) return res
  const actions = res.data.actions

  if (args.dryRun === true || args.confirm !== true) {
    return { ok: true, data: { number, actions, applied: false, needConfirm: args.dryRun !== true } }
  }

  const results = []
  for (const action of actions) {
    if (action.type === 'comment') {
      const r = await client.commentIssue(owner, repo, number, action.payload.body).catch((e) => ({ ok: false, error: String(e) }))
      results.push({ type: action.type, ok: r.ok, error: r.error })
    } else if (action.type === 'label') {
      const r = await client.addIssueLabels(owner, repo, number, action.payload.labels).catch((e) => ({ ok: false, error: String(e) }))
      results.push({ type: action.type, ok: r.ok, error: r.error })
    }
  }
  return { ok: true, data: { number, actions, applied: true, results } }
}
