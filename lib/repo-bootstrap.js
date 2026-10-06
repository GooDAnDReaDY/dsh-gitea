/**
 * Repository bootstrap templates: plan creating repository structure from
 * templates (README, .gitignore, CI, issue/PR templates) with preview/dry-run.
 */

const TEMPLATE_FILES = [
  { path: 'README.md', content: (n) => `# ${n}\n\nProject description.` },
  { path: '.gitignore', content: () => 'node_modules/\n.env*\n*.key\n*.pem\n' },
  { path: '.gitea/workflows/ci.yml', content: () => 'name: CI\non: [push, pull_request]\njobs:\n  test:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n' },
  { path: '.gitea/ISSUE_TEMPLATE/bug.yaml', content: () => 'name: Bug\nbody:\n  - type: textarea\n    id: observed\n    attributes:\n      label: Observed\n    validations:\n      required: true\n' },
  { path: '.gitea/ISSUE_TEMPLATE/feature.yaml', content: () => 'name: Feature\nbody:\n  - type: textarea\n    id: problem\n    attributes:\n      label: Problem\n    validations:\n      required: true\n' },
  { path: '.gitea/PULL_REQUEST_TEMPLATE/default.md', content: () => '## Summary\n\n## Related Issue\n\nCloses #\n' },
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
      note: 'Repository creation and file commit require user approval.',
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

  const owner = repoRes.data?.owner?.login || repoRes.data?.owner?.username || args.owner
  const createdFiles = []

  if (client?.createFile && owner) {
    for (const f of files) {
      const contentB64 = Buffer.from(f.content, 'utf8').toString('base64')
      let res = await client.createFile(owner, name, f.path, {
        content: contentB64,
        message: `Bootstrap ${f.path}`,
      }).catch((e) => ({ ok: false, error: String(e) }))

      if (!res?.ok && (res?.status === 422 || res?.status === 409)) {
        const existing = await client.getContents(owner, name, f.path).catch(() => null)
        const sha = existing?.data?.sha
        if (sha && client.updateFile) {
          res = await client.updateFile(owner, name, f.path, {
            content: contentB64,
            message: `Update ${f.path}`,
            sha,
          }).catch((e) => ({ ok: false, error: String(e) }))
        }
      }

      if (res?.ok) {
        createdFiles.push(f.path)
      }
    }
  }

  return {
    ok: true,
    data: { name, created: true, files: createdFiles },
  }
}
