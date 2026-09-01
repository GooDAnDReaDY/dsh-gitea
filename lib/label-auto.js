/**
 * Label-driven workflow automation: применяет правила к issue по его
 * labels (type/risk/signal) и возвращает preview действий. Ничего не
 * записывает — только рекомендации; применение требует approval.
 */

export const RULES = {
  type: {
    'type/bug': { actions: ['template:bug', 'lint:reproduction'] },
    'type/feature': { actions: ['template:feature', 'lint:DoD'] },
    'type/security': { actions: ['template:security', 'review:security'] },
    'type/tech-debt': { actions: ['template:tech-debt'] },
    'type/research': { actions: ['template:research'] },
  },
  risk: {
    'risk/breaking': { actions: ['checklist:risk', 'review:breaking'] },
    'risk/data-loss': { actions: ['checklist:risk', 'approval:data-loss'] },
    'risk/migration': { actions: ['checklist:migration', 'plan:rollback'] },
  },
  signal: {
    'signal/stale': { actions: ['suggest:close-or-update'] },
    'signal/ci-failed': { actions: ['suggest:retry-ci'] },
    'signal/duplicate': { actions: ['suggest:check-duplicates'] },
    'signal/needs-reproduction': { actions: ['suggest:ask-reproduction'] },
  },
}

export async function applyLabelRules(args = {}, deps = {}) {
  const client = deps.client
  const owner = args.owner
  const repo = args.repo
  const number = Number(args.number)

  const res = await client.getIssue(owner, repo, number).catch((e) => ({ ok: false, error: String(e) }))
  if (!res?.ok) return { ok: false, error: res?.error || 'getIssue failed' }
  const issue = res.data || {}
  const names = (Array.isArray(issue.labels) ? issue.labels : []).map((l) => l.name || l)

  const actions = []
  for (const group of Object.values(RULES)) {
    for (const [label, rule] of Object.entries(group)) {
      if (names.includes(label)) {
        for (const a of rule.actions) {
          if (!actions.includes(a)) actions.push(a)
        }
      }
    }
  }

  return {
    ok: true,
    data: {
      number,
      title: issue.title || '',
      labels: names,
      actions,
      dryRun: true,
      note: 'Только рекомендации. Применение требует approval.',
    },
  }
}
