import { test } from "node:test"
import assert from "node:assert/strict"
import {
  isTrustedWriteRequest,
  rejectUntrustedWrite,
  isTrustedRequest,
  rejectUntrustedRequest,
  isLoopbackAddress,
  isLanAddress,
  isTrustedHost,
  getClientIp,
} from "../lib/http-guard.js"

test("http-guard: isLoopbackAddress identifies IPv4 and IPv6 loopback", () => {
  assert.equal(isLoopbackAddress("127.0.0.1"), true)
  assert.equal(isLoopbackAddress("127.0.0.2"), true)
  assert.equal(isLoopbackAddress("::1"), true)
  assert.equal(isLoopbackAddress("::ffff:127.0.0.1"), true)
  assert.equal(isLoopbackAddress("192.168.1.111"), false)
  assert.equal(isLoopbackAddress("10.0.0.5"), false)
  assert.equal(isLoopbackAddress(null), false)
  assert.equal(isLoopbackAddress(""), false)
})

test("http-guard: isLanAddress identifies private network IP ranges", () => {
  assert.equal(isLanAddress("127.0.0.1"), true)
  assert.equal(isLanAddress("10.0.0.1"), true)
  assert.equal(isLanAddress("192.168.0.50"), true)
  assert.equal(isLanAddress("172.16.0.1"), true)
  assert.equal(isLanAddress("172.31.255.255"), true)
  assert.equal(isLanAddress("172.32.0.1"), false)
  assert.equal(isLanAddress("8.8.8.8"), false)
  assert.equal(isLanAddress("1.1.1.1"), false)
})

test("http-guard: isTrustedHost validates hostnames and blocks DNS rebinding", () => {
  assert.equal(isTrustedHost("localhost"), true)
  assert.equal(isTrustedHost("localhost:3000"), true)
  assert.equal(isTrustedHost("127.0.0.1:3080"), true)
  assert.equal(isTrustedHost("[::1]:3080"), true)
  assert.equal(isTrustedHost("192.168.1.111:3005"), true)
  assert.equal(isTrustedHost("10.0.1.5"), true)
  assert.equal(isTrustedHost("myhost.local"), true)
  assert.equal(isTrustedHost("myhost.local:8080"), true)
  assert.equal(isTrustedHost("attacker.com"), false)
  assert.equal(isTrustedHost("evil.domain.org:3080"), false)
  assert.equal(isTrustedHost(""), false)
  assert.equal(isTrustedHost(null), false)
})

test("http-guard: getClientIp extracts remote address from socket or connection", () => {
  assert.equal(getClientIp({ socket: { remoteAddress: "127.0.0.1" } }), "127.0.0.1")
  assert.equal(getClientIp({ connection: { remoteAddress: "10.0.0.1" } }), "10.0.0.1")
  assert.equal(getClientIp({ info: { remoteAddress: "::1" } }), "::1")
  assert.equal(getClientIp({}), "")
})

test("http-guard: isTrustedRequest rejects missing or untrusted Host header", () => {
  const noHost = { headers: {} }
  assert.equal(isTrustedRequest(noHost), false)

  const untrustedHost = { headers: { host: "attacker-rebind.com" } }
  assert.equal(isTrustedRequest(untrustedHost), false)

  const trustedHost = { headers: { host: "localhost:3080" } }
  assert.equal(isTrustedRequest(trustedHost), true)
})

test("http-guard: isTrustedRequest rejects cross-site sec-fetch-site", () => {
  const req = {
    headers: {
      host: "localhost:3080",
      "sec-fetch-site": "cross-site",
    },
  }
  assert.equal(isTrustedRequest(req), false)
})

test("http-guard: isTrustedRequest rejects remote caller without origin", () => {
  const req = {
    headers: {
      host: "localhost:3080",
    },
    socket: { remoteAddress: "203.0.113.195" },
  }
  assert.equal(isTrustedRequest(req), false)
})

test("http-guard: rejectUntrustedRequest returns 403 on untrusted request", () => {
  let statusCode = 0
  let payload = ""
  const res = {
    writeHead(code) { statusCode = code },
    end(data) { payload = data },
  }
  const req = { headers: { host: "evil.com" } }
  const blocked = rejectUntrustedRequest(req, res)
  assert.equal(blocked, true)
  assert.equal(statusCode, 403)
  const parsed = JSON.parse(payload)
  assert.equal(parsed.ok, false)
  assert.equal(parsed.error.code, "forbidden")
})

test("http-guard: rejects request with origin null", () => {
  const req = {
    headers: {
      host: "localhost:3080",
      origin: "null",
    },
    socket: { remoteAddress: "127.0.0.1" },
  }
  assert.equal(isTrustedWriteRequest(req), false)
})

test("http-guard: rejects request with mismatched origin host", () => {
  const req = {
    headers: {
      host: "localhost:3080",
      origin: "http://attacker.com",
    },
    socket: { remoteAddress: "127.0.0.1" },
  }
  assert.equal(isTrustedWriteRequest(req), false)
})

test("http-guard: accepts request with matching origin host", () => {
  const req = {
    headers: {
      host: "localhost:3080",
      origin: "http://localhost:3080",
      "sec-fetch-site": "same-origin",
    },
    socket: { remoteAddress: "127.0.0.1" },
  }
  assert.equal(isTrustedWriteRequest(req), true)
})

test("http-guard: rejects request with cross-site sec-fetch-site", () => {
  const req = {
    headers: {
      host: "localhost:3080",
      origin: "http://localhost:3080",
      "sec-fetch-site": "cross-site",
    },
    socket: { remoteAddress: "127.0.0.1" },
  }
  assert.equal(isTrustedWriteRequest(req), false)
})

test("http-guard: rejects non-browser request from external IP without origin", () => {
  const req = {
    headers: {
      host: "192.168.1.111:3080",
    },
    socket: { remoteAddress: "192.168.1.55" },
  }
  assert.equal(isTrustedWriteRequest(req), false)
})

test("http-guard: allows non-browser local loopback request without origin", () => {
  const req = {
    headers: {
      host: "localhost:3080",
    },
    socket: { remoteAddress: "127.0.0.1" },
  }
  assert.equal(isTrustedWriteRequest(req), true)
})

test("http-guard: rejects mismatched referer", () => {
  const req = {
    headers: {
      host: "localhost:3080",
      referer: "http://evil-site.com/index.html",
    },
    socket: { remoteAddress: "127.0.0.1" },
  }
  assert.equal(isTrustedWriteRequest(req), false)
})

test("http-guard: rejectUntrustedWrite sends 403 response with policy message", () => {
  let statusCode = 0
  let headersSent = {}
  let payload = ""

  const res = {
    writeHead(code, headers) {
      statusCode = code
      headersSent = headers
    },
    end(data) {
      payload = data
    },
  }

  const req = {
    headers: {
      host: "localhost:3080",
      origin: "http://evil.com",
    },
    socket: { remoteAddress: "127.0.0.1" },
  }

  const rejected = rejectUntrustedWrite(req, res)
  assert.equal(rejected, true)
  assert.equal(statusCode, 403)
  assert.equal(headersSent["Content-Type"], "application/json")
  const parsed = JSON.parse(payload)
  assert.equal(parsed.ok, false)
  assert.equal(parsed.error.code, "forbidden")
  assert.match(parsed.error.message, /same-origin or local loopback only/i)
})
