/**
 * HTTP guard utilities for protecting read and write endpoints
 * against drive-by CSRF, unauthorized cross-network access, DNS rebinding, and cross-origin tampering.
 */

export function isLoopbackAddress(ip) {
  if (!ip || typeof ip !== "string") return false
  const clean = ip.replace(/^::ffff:/, "")
  return (
    clean === "127.0.0.1" ||
    clean === "::1" ||
    clean.startsWith("127.")
  )
}

export function isLanAddress(ip) {
  if (!ip || typeof ip !== "string") return false
  const clean = ip.replace(/^::ffff:/, "")
  if (isLoopbackAddress(clean)) return true
  if (clean.startsWith("10.") || clean.startsWith("192.168.")) return true
  const match172 = clean.match(/^172\.(\d+)\./)
  if (match172) {
    const octet = parseInt(match172[1], 10)
    if (octet >= 16 && octet <= 31) return true
  }
  return false
}

export function isTrustedHost(host) {
  if (!host || typeof host !== "string") return false
  let hostname = host.trim()
  if (hostname.startsWith("[")) {
    const end = hostname.indexOf("]")
    if (end > 0) hostname = hostname.slice(1, end)
  } else {
    hostname = hostname.split(":")[0]
  }
  hostname = hostname.toLowerCase()
  if (!hostname) return false
  if (hostname === "localhost" || hostname.endsWith(".local")) return true
  if (isLoopbackAddress(hostname) || isLanAddress(hostname)) return true
  return false
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
 * Checks whether an incoming HTTP read request is trusted.
 *
 * Requirements:
 * 1. Host header is required and must be a trusted host (loopback, LAN, or .local).
 *    Rejects empty Host and DNS rebinding attacks (e.g. attacker.com resolving to 127.0.0.1).
 * 2. If Origin header is present:
 *    - must not be "null" or empty
 *    - parsed Origin hostname must be a trusted host or match Host
 * 3. If Referer header is present:
 *    - parsed Referer hostname must be a trusted host or match Host
 * 4. If Sec-Fetch-Site header is present:
 *    - "cross-site" is strictly rejected (prevent cross-origin data extraction).
 * 5. If client IP is remote (neither loopback nor LAN), origin verification is mandatory.
 */
export function isTrustedRequest(req) {
  const headers = req.headers || {}
  const host = headers.host || ""

  // 1. Host header must be present and trusted
  if (!host || !isTrustedHost(host)) {
    return false
  }

  const origin = headers.origin
  if (origin !== undefined) {
    if (origin === "null" || !origin) return false
    try {
      const parsed = new URL(origin)
      if (!isTrustedHost(parsed.hostname) && parsed.host !== host) return false
    } catch {
      return false
    }
  }

  const referer = headers.referer
  if (referer !== undefined && referer) {
    try {
      const parsed = new URL(referer)
      if (!isTrustedHost(parsed.hostname) && parsed.host !== host) return false
    } catch {
      return false
    }
  }

  const site = headers["sec-fetch-site"]
  if (site !== undefined && site === "cross-site") {
    return false
  }

  // Remote callers outside loopback/LAN must have verified origin
  const ip = getClientIp(req)
  if (ip && !isLoopbackAddress(ip) && !isLanAddress(ip)) {
    if (origin === undefined && referer === undefined) {
      return false
    }
  }

  return true
}

export function rejectUntrustedRequest(req, res) {
  if (!isTrustedRequest(req)) {
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
            message: "Forbidden: same-origin or local network only",
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

/**
 * Checks whether an incoming HTTP write request is safe for configuration or state mutation.
 *
 * Requirements:
 * 1. Must satisfy all isTrustedRequest requirements (Host, trusted host, origin, referer).
 * 2. If Origin header is present:
 *    - parsed Origin host must match Host header
 * 3. If Referer header is present:
 *    - parsed Referer host must match Host header
 * 4. If Sec-Fetch-Site header is present:
 *    - must be "same-origin" or "none" (cross-site and same-site are rejected)
 * 5. If neither Origin nor Sec-Fetch-Site is present:
 *    - only local loopback clients (127.0.0.1, ::1) are permitted.
 *      Remote/LAN callers without origin verification are rejected for writes.
 */
export function isTrustedWriteRequest(req) {
  const headers = req.headers || {}
  const host = headers.host || ""

  // Write requests require isTrustedRequest first
  if (!isTrustedRequest(req)) {
    return false
  }

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

  // If both origin and sec-fetch-site are absent, allow only loopback callers for write operations
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
