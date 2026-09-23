/**
 * gitea_merge_readiness: checks PR readiness for merge.
 * Read-only report: pass/fail/unknown.
 */

const CHECK_NAMES = ['description', 'conflicts', 'approval', 'tests', 'migrations']

export async function checkMergeReadiness(args = {}, deps = {}) {
  const client = deps.client
  const owner = args.owner
  const repo = args.repo
  const number = Number(args.number)

  const [prRes, reviewsRes, filesRes] = await Promise.all([
    client.getPull(owner, repo, number).catch((e) => ({ ok: false, error: String(e) })),
    client.listPullReviews(owner, repo, number, {}).catch((e) => ({ ok: false, error: String(e) })),
    client.listPullFiles(owner, repo, number, {}).catch((e) => ({ ok: false, error: String(e) })),
  ])

  const pr = prRes?.ok ? prRes.data : null
  const checks = []
  const notes = []

  // description
  if (!pr) {
    checks.push({ name: 'description', status: 'unknown', detail: 'PR not accessible' })
  } else if (pr.body && String(pr.body).trim().length >= 10) {
    checks.push({ name: 'description', status: 'pass', detail: 'Description provided' })
  } else {
    checks.push({ name: 'description', status: 'fail', detail: 'Description empty or too short' })
  }

  // conflicts
  if (!pr) {
    checks.push({ name: 'conflicts', status: 'unknown', detail: 'n/a' })
  } else if (pr.mergeable === true) {
    checks.push({ name: 'conflicts', status: 'pass', detail: 'No merge conflicts' })
  } else if (pr.mergeable === false) {
    checks.push({ name: 'conflicts', status: 'fail', detail: 'Merge conflicts present' })
  } else {
    checks.push({ name: 'conflicts', status: 'unknown', detail: 'Mergeable status unknown' })
  }

  // approval
  const reviews = reviewsRes?.ok && Array.isArray(reviewsRes.data) ? reviewsRes.data : []
  const approved = reviews.some((r) => r.state === 'APPROVED')
  if (!reviewsRes?.ok) {
    checks.push({ name: 'approval', status: 'unknown', detail: 'Reviews not accessible' })
  } else if (approved) {
    checks.push({ name: 'approval', status: 'pass', detail: 'Approved review present' })
  } else {
    checks.push({ name: 'approval', status: 'fail', detail: 'No approved review' })
  }

  // tests & migrations from files
  const files = filesRes?.ok && Array.isArray(filesRes.data) ? filesRes.data : []
  if (!filesRes?.ok) {
    checks.push({ name: 'tests', status: 'unknown', detail: 'Changed files not accessible' })
    checks.push({ name: 'migrations', status: 'unknown', detail: 'Changed files not accessible' })
  } else {
    const hasTests = files.some((f) => /test|spec|\.test\./i.test(String(f.filename || '')))
    const isCode = files.some((f) => /\.(?:js|mjs|cjs|ts|tsx|jsx|py|go|rs|c|cpp|h|java|php|rb)$/i.test(String(f.filename || '')))
    const testStatus = hasTests || !isCode ? 'pass' : 'unknown'
    const testDetail = hasTests ? 'Tests updated' : (!isCode ? 'No executable code changed' : 'No test files modified')
    const hasMigrations = files.some((f) => /migration|schema|\.sql$/i.test(String(f.filename || '')))
    checks.push({ name: 'tests', status: testStatus, detail: testDetail })
    const rollbackApproved = args.allowMigrations === true || args.hasRollbackPlan === true || Boolean(pr?.body && /rollback plan/i.test(pr.body))
    const migrationStatus = !hasMigrations ? 'pass' : (rollbackApproved ? 'pass' : 'fail')
    const migrationDetail = !hasMigrations
      ? 'No database migrations'
      : (rollbackApproved ? 'Database migrations detected with rollback plan' : 'Database migrations detected — rollback plan required')
    checks.push({ name: 'migrations', status: migrationStatus, detail: migrationDetail })
  }

  const ready = checks.every((c) => c.status === 'pass')
  return { ok: true, data: { number, ready, checks, notes } }
}

/**
 * gitea_auto_merge: merges PR if merge-gate is green AND confirm: true.
 * Without confirm: returns ready/needConfirm report. Never merges silently.
 */
export async function autoMergeIfReady(args = {}, deps = {}) {
  const client = deps.client
  const owner = args.owner
  const repo = args.repo
  const number = Number(args.number)

  const gate = await checkMergeReadiness({ owner, repo, number }, deps)
  if (!gate.ok) return gate

  const checks = Array.isArray(gate.data.checks) ? gate.data.checks : []
  const allPass = checks.every((c) => c.status === 'pass')
  const confirm = args.confirm === true

  if (!allPass) {
    return { ok: true, data: { number, ready: false, merged: false, checks: gate.data.checks, notes: gate.data.notes } }
  }
  if (!confirm) {
    return { ok: true, data: { number, ready: true, merged: false, needConfirm: true, checks: gate.data.checks, notes: gate.data.notes } }
  }

  const merged = await client.mergePull(owner, repo, number, { Do: 'merge' }).catch((e) => ({ ok: false, error: String(e) }))
  if (!merged?.ok) return { ok: false, error: merged?.error || 'merge failed' }
  return { ok: true, data: { number, ready: true, merged: true, checks: gate.data.checks, notes: gate.data.notes } }
}
