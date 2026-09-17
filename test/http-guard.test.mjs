import { test } from "node:test"
import assert from "node:assert/strict"
import { isTrustedWriteRequest, rejectUntrustedWrite, isLoopbackAddress, getClientIp } from "../lib/http-guard.js"

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

test("http-guard: getClientIp extracts remote address from socket or connection", () => {
  assert.equal(getClientIp({ socket: { remoteAddress: "127.0.0.1" } }), "127.0.0.1")
  assert.equal(getClientIp({ connection: { remoteAddress: "10.0.0.1" } }), "10.0.0.1")
  assert.equal(getClientIp({ info: { remoteAddress: "::1" } }), "::1")
  assert.equal(getClientIp({}), "")
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
