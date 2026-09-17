/**
 * HTTP guard utilities for protecting write endpoints (POST/PUT/DELETE)
 * against drive-by CSRF, unauthorized cross-network access, and cross-origin tampering.
 */

export function isLoopbackAddress(ip) {
  if (!ip || typeof ip !== "string") return false
  return (
    ip === "127.0.0.1" ||
    ip === "::1" ||
    ip === "::ffff:127.0.0.1" ||
    ip.startsWith("127.")
  )
}

export function getClientIp(req) {
  return (
    req.socket?.remoteAddress ||
    req.connection?.remoteAddress ||
    req.info?.remoteAddress ||
    ""
  )
}

/**
 * Checks whether an incoming HTTP write request is safe for configuration or state mutation.
 *
 * Requirements:
 * 1. If Origin header is present:
 *    - must not be "null" or empty
 *    - parsed Origin host must match Host header
 * 2. If Referer header is present:
 *    - parsed Referer host must match Host header
 * 3. If Sec-Fetch-Site header is present:
 *    - must be "same-origin" or "none" (cross-site and same-site are rejected)
 * 4. If neither Origin nor Sec-Fetch-Site is present:
 *    - only local loopback clients (127.0.0.1, ::1) are permitted.
 *      Remote/network callers without origin verification are rejected.
 */
export function isTrustedWriteRequest(req) {
  const headers = req.headers || {}
  const host = headers.host || ""

  const origin = headers.origin
  if (origin !== undefined) {
    if (origin === "null" || !origin) return false
    try {
      const parsed = new URL(origin)
      if (parsed.host && host && parsed.host !== host) return false
    } catch {
      return false
    }
  }

  const referer = headers.referer
  if (referer !== undefined && referer) {
    try {
      const parsed = new URL(referer)
      if (parsed.host && host && parsed.host !== host) return false
    } catch {
      return false
    }
  }

  const site = headers["sec-fetch-site"]
  if (site !== undefined && site) {
    if (site !== "same-origin" && site !== "none") return false
  }

  // If both origin and sec-fetch-site are absent, allow only loopback callers
  if (origin === undefined && site === undefined) {
    const ip = getClientIp(req)
    if (!isLoopbackAddress(ip)) {
      return false
    }
  }

  return true
}

export function rejectUntrustedWrite(req, res) {
  if (!isTrustedWriteRequest(req)) {
    try {
      res.writeHead(403, {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      })
      res.end(
        JSON.stringify({
          ok: false,
          error: {
            code: "forbidden",
            message: "Forbidden: same-origin or local loopback only",
          },
        })
      )
    } catch {
      /* socket closed */
    }
    return true
  }
  return false
}

