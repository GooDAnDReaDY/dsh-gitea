/**
 * Topological commit graph engine and lane assignment for dsh-gitea.
 * Computes branch/merge lanes for monospace visualization (●, ◆, │, gap).
 * @module dsh-gitea/graph
 */

/**
 * Lane glyphs for monospace terminal/web rendering:
 * - 'node': commit node (●)
 * - 'merge': merge commit with 2+ parents (◆)
 * - 'pass': vertical continuation line through this row (│)
 * - 'gap': empty column space (' ')
 */

/**
 * Minimal lane assignment over topo-ordered commits.
 * Each lane tracks one expected commit.
 * @param {Array<{ oid: string, parents: string[] }>} rows - topo-ordered commits.
 * @returns {Array<{ columns: ('node'|'merge'|'pass'|'gap')[], nodeColumn: number, merge: boolean }>}
 */
export function computeLanes(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return []

  const later = new Set()
  for (const row of rows) {
    if (Array.isArray(row.parents)) {
      for (const parent of row.parents) {
        if (parent) later.add(parent)
      }
    }
  }

  const lanes = []
  const result = []

  for (const row of rows) {
    const oid = row.oid || ''
    const parents = Array.isArray(row.parents) ? row.parents.filter(p => later.has(p)) : []
    const isMerge = (row.parents && row.parents.length > 1) || false

    let nodeColumn = lanes.findIndex(pending => pending === oid)
    if (nodeColumn === -1) {
      lanes.push(oid)
      nodeColumn = lanes.length - 1
    }

    const columns = []
    for (let i = 0; i < lanes.length; i += 1) {
      const pending = lanes[i]
      if (pending === null || pending === undefined) {
        columns.push('gap')
      } else if (i === nodeColumn) {
        columns.push(isMerge ? 'merge' : 'node')
      } else if (pending === oid) {
        // A second lane waiting for this commit is a merge join: its line ends into the node
        columns.push('gap')
      } else if (typeof pending === 'string' && later.has(pending)) {
        columns.push('pass')
      } else {
        columns.push('gap')
      }
    }

    const [first, ...rest] = parents
    // Join lanes are consumed by this row; node lane continues with the first parent
    for (let i = 0; i < lanes.length; i += 1) {
      if (lanes[i] === oid && i !== nodeColumn) {
        lanes[i] = null
      }
    }
    lanes[nodeColumn] = first || null
    for (const parent of rest) {
      if (!lanes.includes(parent)) {
        lanes.push(parent)
      }
    }

    while (lanes.length > 0 && lanes[lanes.length - 1] === null) {
      lanes.pop()
    }

    result.push({ columns, nodeColumn, merge: isMerge })
  }

  return result
}

/**
 * Format string used for git log queries.
 * Delimiter: \x1f (Unit Separator), Record Delimiter: \x1e (Record Separator)
 */
export const GIT_LOG_FORMAT = '%H%x1f%P%x1f%an%x1f%at%x1f%s%x1f%D%x1e'

/**
 * Parse raw refs decoration (from %D) into clean array of branch and tag names.
 * @param {string} raw - e.g. "HEAD -> main, tag: v0.4.3, origin/main"
 * @returns {string[]}
 */
export function parseDecorations(raw) {
  if (!raw || typeof raw !== 'string') return []
  return raw
    .split(',')
    .map(s => s.trim())
    .map(part => {
      if (part === 'HEAD') return ''
      return part.replace(/^HEAD -> /, '').replace(/^tag: /, '').trim()
    })
    .filter(Boolean)
}

/**
 * Parse stdout of git log formatted with GIT_LOG_FORMAT.
 * @param {string} stdout
 * @returns {Array<{ oid: string, parents: string[], author: string, authorTime: number, subject: string, refs: string[] }>}
 */
export function parseGitLogOutput(stdout) {
  if (!stdout || typeof stdout !== 'string') return []
  const records = stdout.split('\x1e')
  const commits = []

  for (const record of records) {
    const trimmed = record.trim()
    if (!trimmed) continue
    const parts = trimmed.split('\x1f')
    if (parts.length < 5) continue

    const [oid, rawParents, author, rawTime, subject, rawRefs] = parts
    const parents = rawParents ? rawParents.trim().split(/\s+/).filter(Boolean) : []
    const authorTime = parseInt(rawTime, 10) || 0
    const refs = parseDecorations(rawRefs || '')

    commits.push({
      oid: oid.trim(),
      parents,
      author: (author || '').trim(),
      authorTime,
      subject: (subject || '').trim(),
      refs,
    })
  }

  return commits
}

/**
 * Fetch and build graph commits using git wrapper.
 * @param {object} deps
 * @param {string} [deps.gitWrapper]
 * @param {string} [deps.cwd]
 * @param {number} [deps.limit=100]
 * @param {Function} [deps.execFile]
 * @returns {Promise<{ ok: boolean, data?: { commits: any[], lanes: any[], hasMore: boolean }, error?: string }>}
 */
export async function fetchCommitGraph(deps = {}) {
  const { gitWrapper = 'git', cwd = process.cwd(), limit = 100, execFile } = deps
  const run = execFile || (await import('node:child_process')).execFile

  // Fetch limit + 1 to check hasMore
  const fetchLimit = Math.max(1, Math.min(500, Number(limit) || 100)) + 1
  const args = [
    'log',
    `--max-count=${fetchLimit}`,
    '--branches',
    '--tags',
    '--remotes',
    '--topo-order',
    `--format=${GIT_LOG_FORMAT}`,
  ]

  try {
    const stdout = await new Promise((resolve, reject) => {
      run(gitWrapper, args, { cwd, maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
        if (err) {
          // Empty repo without commits
          if (stderr && (stderr.includes('does not have any commits') || stderr.includes('unknown revision'))) {
            resolve('')
            return
          }
          reject(new Error(stderr || err.message))
          return
        }
        resolve(stdout)
      })
    })

    const parsed = parseGitLogOutput(stdout)
    const hasMore = parsed.length > fetchLimit - 1
    const commits = hasMore ? parsed.slice(0, fetchLimit - 1) : parsed
    const lanes = computeLanes(commits)

    return {
      ok: true,
      data: {
        commits,
        lanes,
        hasMore,
      },
    }
  } catch (err) {
    return { ok: false, error: err.message }
  }
}
