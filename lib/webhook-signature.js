/**
 * Webhook signature verification (X-Gitea-Signature, HMAC-SHA256 hex).
 * Пустой секрет = проверка отключена.
 */

import crypto from 'node:crypto'

export function computeSignature(secret, body) {
  return crypto.createHmac('sha256', String(secret)).update(String(body)).digest('hex')
}

export function verifySignature(secret, body, signature) {
  if (!secret) return true // проверка отключена
  const expected = computeSignature(secret, body)
  const received = String(signature || '')
  if (received.length !== expected.length) return false
  // constant-time сравнение
  let diff = 0
  for (let i = 0; i < expected.length; i += 1) {
    diff |= expected.charCodeAt(i) ^ received.charCodeAt(i)
  }
  return diff === 0
}
