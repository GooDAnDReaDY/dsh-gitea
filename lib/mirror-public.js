/**
 * mirror-public: preparation for mirroring to public GitHub repository.
 * Sanitizes private paths/names/IP/tokens.
 */

const PRIVATE_SCOPE = '@goodandready-private/dsh-gitea'
const PUBLIC_SCOPE = '@goodandready/dsh-gitea'

export function sanitizeForPublic(text = '') {
  return String(text)
    .split(PRIVATE_SCOPE).join(PUBLIC_SCOPE)
    .replace(/\/home\/vadim/g, '/home/user')
    .replace(/\/mnt\/external/g, '/path/to')
    .replace(/192\.168\.\d{1,3}\.\d{1,3}/g, '127.0.0.1')
    .replace(/36c9614607417f02736f35565a8340ccdf20437c/g, '0000000000000000000000000000000000000000')
    .replace(/\bvadim\b/g, 'user')
}

export async function prepareMirror(args = {}, deps = {}) {
  const source = args.source || 'gitea'
  const target = args.target || 'github'
  return {
    ok: true,
    data: {
      dryRun: true,
      source,
      target,
      steps: [
        '1. fetch clean gitea main',
        '2. sanitize history (paths/names/token/scope) via sanitizeForPublic',
        `3. push to ${target} as main`,
        '4. verify: clone audit (no personal data)',
      ],
      note: 'Dry-run plan. Actual push is executed as an external step (outside plugin).',
    },
  }
}
