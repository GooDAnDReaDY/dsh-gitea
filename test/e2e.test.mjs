import { test } from 'node:test'
import assert from 'node:assert/strict'
import { GiteaClient } from '../lib/gitea-client.js'

const URL = process.env.GITEA_TEST_URL || ''
const TOKEN = process.env.GITEA_TEST_TOKEN || ''
const OWNER = process.env.GITEA_TEST_OWNER || ''
const REPO = process.env.GITEA_TEST_REPO || ''

const hasEnv = Boolean(URL && TOKEN && OWNER && REPO)

test('e2e: smoke against real Gitea (skipped without env)', { skip: !hasEnv && 'GITEA_TEST_URL/TOKEN/OWNER/REPO not set' }, async () => {
  const client = new GiteaClient({ baseUrl: URL, token: TOKEN, retries: 0 })

  // 1. whoami
  const who = await client.getUser()
  assert.equal(who.ok, true, `getUser failed: ${who.error}`)
  assert.ok(who.data.login)

  // 2. create issue
  const created = await client.createIssue(OWNER, REPO, { title: `e2e-${Date.now()}`, body: 'smoke' })
  assert.equal(created.ok, true, `createIssue failed: ${created.error}`)
  const number = created.data.number
  assert.ok(number > 0)

  // 3. get issue
  const got = await client.getIssue(OWNER, REPO, number)
  assert.equal(got.ok, true)
  assert.equal(got.data.number, number)

  // 4. comment
  const commented = await client.commentIssue(OWNER, REPO, number, 'e2e comment')
  assert.equal(commented.ok, true)

  // 5. close
  const closed = await client.closeIssue(OWNER, REPO, number)
  assert.equal(closed.ok, true)

  console.log(`e2e OK: user=${who.data.login} issue #${number} created/read/commented/closed`)
})
