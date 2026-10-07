import { execFile as execFileCb } from 'node:child_process'
import { promisify } from 'node:util'

const defaultExecFile = promisify(execFileCb)

export function parseSemver(v) {
  const m = String(v || '').trim().replace(/^v/, '').match(/^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/)
  if (!m) return null
  return {
    major: parseInt(m[1], 10),
    minor: parseInt(m[2], 10),
    patch: parseInt(m[3], 10),
    prerelease: m[4] || null,
  }
}

export function compareSemver(a, b) {
  const pa = parseSemver(a)
  const pb = parseSemver(b)
  if (!pa || !pb) return 0
  if (pa.major !== pb.major) return pa.major - pb.major
  if (pa.minor !== pb.minor) return pa.minor - pb.minor
  if (pa.patch !== pb.patch) return pa.patch - pb.patch
  if (pa.prerelease && !pb.prerelease) return -1
  if (!pa.prerelease && pb.prerelease) return 1
  return 0
}

export function validateSemverBump(currentVersion, nextVersion) {
  const cur = parseSemver(currentVersion)
  const nxt = parseSemver(nextVersion)
  if (!cur) return { ok: false, error: `Invalid current version format: "${currentVersion}"` }
  if (!nxt) return { ok: false, error: `Invalid target version format: "${nextVersion}"` }

  const cmp = compareSemver(nextVersion, currentVersion)
  if (cmp <= 0) {
    return { ok: false, error: `Target version "${nextVersion}" must be strictly greater than current "${currentVersion}"` }
  }

  let bumpType = 'unknown'
  if (nxt.major > cur.major && nxt.minor === 0 && nxt.patch === 0) bumpType = 'major'
  else if (nxt.major === cur.major && nxt.minor > cur.minor && nxt.patch === 0) bumpType = 'minor'
  else if (nxt.major === cur.major && nxt.minor === cur.minor && nxt.patch > cur.patch) bumpType = 'patch'
  else if (nxt.prerelease) bumpType = 'prerelease'

  return { ok: true, current: currentVersion, next: nextVersion, bumpType }
}

export function generateMultilingualReleaseNotes({ version, commits = [], summary = '' }) {
  const v = String(version || '').replace(/^v/, '')
  const commitList = Array.isArray(commits) && commits.length > 0
    ? commits.map((c) => `- ${c.hash ? c.hash.slice(0, 7) + ' ' : ''}${c.subject || c.message || c}`).join('\n')
    : '- Performance improvements and maintenance updates'

  const notesEn = [
    `# Release v${v}`,
    '',
    summary ? `### Overview\n${summary}\n` : '',
    '### Changes',
    commitList,
  ].filter(Boolean).join('\n')

  const notesRu = [
    `# Release v${v} (RU)`,
    '',
    summary ? `### Overview\n${summary}\n` : '',
    '### Changes',
    commitList,
  ].filter(Boolean).join('\n')

  const notesZh = [
    `# 版本发布 v${v}`,
    '',
    summary ? `### 概述\n${summary}\n` : '',
    '### 变更日志',
    commitList,
  ].filter(Boolean).join('\n')

  return { en: notesEn, ru: notesRu, zh: notesZh }
}

export async function runReleasePreflight({ cwd, execFile, targetVersion, currentVersion } = {}) {
  const exec = execFile || defaultExecFile
  const checks = []

  // 1. Semver validation
  const semverVal = validateSemverBump(currentVersion, targetVersion)
  checks.push({
    name: 'semver-validation',
    ok: semverVal.ok,
    message: semverVal.ok ? `Valid ${semverVal.bumpType} bump from ${currentVersion} to ${targetVersion}` : semverVal.error,
  })

  // 2. Git working tree clean
  let gitClean = false
  try {
    const { stdout } = await exec('git', ['status', '--porcelain'], { cwd: cwd || process.cwd() })
    gitClean = stdout.trim().length === 0
    checks.push({
      name: 'git-clean-tree',
      ok: gitClean,
      message: gitClean ? 'Working directory is clean' : 'Working directory has uncommitted modifications',
    })
  } catch (err) {
    checks.push({ name: 'git-clean-tree', ok: false, message: `Git status failed: ${err.message}` })
  }

  // 3. Current branch is main
  let isMain = false
  try {
    const { stdout } = await exec('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: cwd || process.cwd() })
    const branch = stdout.trim()
    isMain = branch === 'main' || branch === 'master'
    checks.push({
      name: 'branch-check',
      ok: isMain,
      message: isMain ? `On release branch: ${branch}` : `Not on main branch (current: ${branch})`,
    })
  } catch (err) {
    checks.push({ name: 'branch-check', ok: false, message: `Branch check failed: ${err.message}` })
  }

  const allPassed = checks.every((c) => c.ok)
  return { ok: allPassed, checks }
}

export async function runReleaseAssistant(args = {}, deps = {}) {
  const action = args.action || 'preflight'
  const currentVersion = String(args.currentVersion || args.current || deps.pkgVersion || '0.7.25')
  const targetVersion = String(args.targetVersion || args.next || args.version || '')

  if (action === 'validate_semver') {
    return { ok: true, data: validateSemverBump(currentVersion, targetVersion) }
  }

  if (action === 'preview_notes') {
    const notes = generateMultilingualReleaseNotes({
      version: targetVersion || currentVersion,
      commits: args.commits || [],
      summary: args.summary || '',
    })
    return { ok: true, data: notes }
  }

  if (action === 'preflight') {
    if (!targetVersion) {
      return { ok: false, error: 'Pass targetVersion (e.g. 0.7.26) for release preflight.' }
    }
    const preflight = await runReleasePreflight({
      cwd: deps.cwd,
      execFile: deps.execFile,
      targetVersion,
      currentVersion,
    })
    return { ok: true, data: preflight }
  }

  return { ok: false, error: `Unknown release assistant action: ${action}` }
}
