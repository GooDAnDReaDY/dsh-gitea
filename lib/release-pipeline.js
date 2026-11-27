import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

/**
 * release-pipeline (issue #395): codified release cycle for the plugin's own
 * repository - gates, version bump, changelog, commit, npm publish, mirror
 * publish. plan mode only prints the step list; execute requires
 * confirm: true and refuses to run outside this package's repository.
 */

const PACKAGE_NAME = '@goodandready/dsh-gitea'

function readPackage(cwd) {
  const file = join(cwd, 'package.json')
  if (!existsSync(file)) throw new Error(`no package.json in ${cwd}`)
  return JSON.parse(readFileSync(file, 'utf8'))
}

function bumpVersion(version, bump = 'patch') {
  const parts = String(version).split('.')
  if (parts.length !== 3 || parts.some((p) => !/^\d+$/.test(p))) {
    throw new Error(`cannot bump non-semver version ${version}`)
  }
  const [major, minor, patch] = parts.map(Number)
  if (bump === 'major') return `${major + 1}.0.0`
  if (bump === 'minor') return `${major}.${minor + 1}.0`
  return `${major}.${minor}.${patch + 1}`
}

function buildChangelogEntry(version, notes, date = new Date().toISOString().slice(0, 10)) {
  const body = String(notes || '').trim() || '- Maintenance release.'
  return `## [${version}] - ${date}\n\n${body}\n`
}

function insertChangelogEntry(changelogText, entry) {
  const anchor = '# Changelog\n'
  if (!changelogText.startsWith(anchor)) throw new Error('CHANGELOG.md must start with "# Changelog"')
  return anchor + '\n' + entry + '\n' + changelogText.slice(anchor.length)
}

export function buildPipelineSteps({ version, changelogFile, gitWrapper = 'git', runTests = true, skipMirror = false }) {
  const steps = []
  steps.push({ name: 'gate-size-budget', cmd: ['node', ['scripts/size-budget.mjs']], mutates: false })
  steps.push({ name: 'gate-leak-scan', cmd: ['node', ['scripts/leak-scan.mjs']], mutates: false })
  if (runTests) steps.push({ name: 'gate-tests', cmd: ['npm', ['test']], mutates: false })
  steps.push({ name: 'version-bump', cmd: ['npm', ['version', version, '--no-git-tag-version', '--allow-same-root']], mutates: true })
  steps.push({ name: 'changelog', cmd: ['node:changelog-insert', [version]], mutates: true })
  steps.push({ name: 'git-add', cmd: [gitWrapper, ['add', 'package.json', 'package-lock.json', 'CHANGELOG.md']], mutates: true })
  steps.push({ name: 'git-commit', cmd: [gitWrapper, ['commit', '-m', `chore(release): bump version to ${version}`]], mutates: true })
  steps.push({ name: 'npm-publish', cmd: ['npm', ['publish']], mutates: true })
  if (!skipMirror) {
    steps.push({ name: 'mirror-publish', cmd: ['bash', ['scripts/publish-github.sh', '--push', 'HEAD', '--tag', `v${version}`]], mutates: true })
  }
  void changelogFile
  return steps
}

export async function runReleasePipeline(args = {}, deps = {}) {
  const cwd = deps.cwd || process.cwd()
  let pkg
  try {
    pkg = readPackage(cwd)
  } catch (err) {
    return { ok: false, error: `${err.message}. Run the pipeline from this package's repository checkout.` }
  }
  if (pkg.name !== PACKAGE_NAME) {
    return { ok: false, error: `refusing to run: ${cwd} is the repository of ${pkg.name}, not ${PACKAGE_NAME}` }
  }

  const mode = args.action === 'execute' ? 'execute' : 'plan'
  const bump = ['patch', 'minor', 'major'].includes(args.bump) ? args.bump : 'patch'
  const version = /^\d+\.\d+\.\d+$/.test(String(args.version || '')) ? String(args.version) : bumpVersion(pkg.version, bump)
  const runTests = args.run_tests !== false
  const skipMirror = args.skip_mirror === true
  const gitWrapper = deps.gitWrapper || 'git'

  const steps = buildPipelineSteps({ version, runTests, skipMirror, gitWrapper })
  const changelogFile = join(cwd, 'CHANGELOG.md')

  if (mode === 'plan' || args.confirm !== true) {
    return {
      ok: true,
      data: {
        mode: mode === 'plan' ? 'plan' : 'execute-blocked',
        currentVersion: pkg.version,
        version,
        confirmRequired: mode !== 'plan',
        steps: steps.map((s) => ({ name: s.name, cmd: s.cmd.join(' '), mutates: s.mutates })),
      },
    }
  }

  const completed = []
  const outputs = []
  for (const step of steps) {
    try {
      if (step.name === 'changelog') {
        const entry = buildChangelogEntry(version, args.notes)
        const text = readFileSync(changelogFile, 'utf8')
        writeFileSync(changelogFile, insertChangelogEntry(text, entry), 'utf8')
        outputs.push({ name: step.name, ok: true, output: 'CHANGELOG.md updated' })
        completed.push(step.name)
        continue
      }
      const [file, cmdArgs] = step.cmd
      const res = await deps.execFile(file, cmdArgs, { cwd, maxBuffer: 16 * 1024 * 1024, windowsHide: true })
      const stdout = res && typeof res === 'object' && 'stdout' in res ? String(res.stdout || '') : String(res || '')
      outputs.push({ name: step.name, ok: true, output: stdout.slice(-400) })
      completed.push(step.name)
    } catch (err) {
      const message = err?.message || String(err)
      outputs.push({ name: step.name, ok: false, output: message.slice(-400) })
      return {
        ok: false,
        error: `pipeline stage "${step.name}" failed: ${message}`,
        data: { version, completed, steps: outputs },
      }
    }
  }

  return {
    ok: true,
    data: { mode: 'execute', version, completed, steps: outputs },
  }
}


export { buildChangelogEntry, insertChangelogEntry, bumpVersion }
