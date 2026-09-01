/**
 * Repository bootstrap templates: план создания нового репозитория из
 * шаблона (README, .gitignore, CI, issue/PR templates) с preview/dry-run.
 * Фактическое создание репо и запись файлов требуют approval.
 */

const TEMPLATE_FILES = [
  { path: 'README.md', content: (n) => `# ${n}\n\nОписание проекта.` },
  { path: '.gitignore', content: () => 'node_modules/\n.env*\n*.key\n*.pem\n' },
  { path: '.gitea/workflows/ci.yml', content: () => 'name: CI\non: [push, pull_request]\njobs:\n  test:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n' },
  { path: '.gitea/ISSUE_TEMPLATE/bug.yaml', content: () => 'name: Bug\nbody:\n  - type: textarea\n    id: observed\n    attributes:\n      label: Observed\n    validations:\n      required: true\n' },
  { path: '.gitea/ISSUE_TEMPLATE/feature.yaml', content: () => 'name: Feature\nbody:\n  - type: textarea\n    id: problem\n    attributes:\n      label: Problem\n    validations:\n      required: true\n' },
  { path: '.gitea/PULL_REQUEST_TEMPLATE/default.md', content: () => '## Что изменено\n\n## Связанная задача\n\nCloses #\n' },
]

export function buildTemplateFiles({ name, description = '' }) {
  const repoName = String(name || '').trim()
  if (!repoName) return []
  return TEMPLATE_FILES.map((t) => ({
    path: t.path,
    content: t.content(repoName),
  }))
}

export function planBootstrap(args = {}) {
  const name = String(args.name || '').trim()
  if (!name) return { ok: false, error: 'name is required' }
  const files = buildTemplateFiles(args)
  return {
    ok: true,
    data: {
      name,
      description: args.description || '',
      private: args.private !== false,
      files,
      dryRun: true,
      note: 'Создание репозитория и запись файлов — после approval.',
    },
  }
}

export async function applyBootstrap(args = {}, deps = {}) {
  const client = deps.client
  const name = String(args.name || '').trim()
  if (!name) return { ok: false, error: 'name is required' }
  const files = buildTemplateFiles(args)

  const repoRes = await client.createRepo({
    name,
    description: args.description || '',
    private: args.private !== false,
    auto_init: true,
  }).catch((e) => ({ ok: false, error: String(e) }))
  if (!repoRes?.ok) return { ok: false, error: repoRes?.error || 'createRepo failed' }

  return {
    ok: true,
    data: { name, created: true, files: files.map((f) => f.path) },
  }
}
