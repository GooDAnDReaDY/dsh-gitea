import { test } from 'node:test'
import assert from 'node:assert/strict'
import { GiteaClient } from '../lib/gitea-client.js'

const URL = process.env.GITEA_TEST_URL || ''
const TOKEN = process.env.GITEA_TEST_TOKEN || ''
const OWNER = process.env.GITEA_TEST_OWNER || ''
const REPO = process.env.GITEA_TEST_REPO || ''
const NAME = process.env.GITEA_TEST_NAME || 'gitea'

const hasEnv = Boolean(URL && TOKEN && OWNER && REPO)

test(`e2e: smoke against real ${NAME} (skipped without env)`, { skip: !hasEnv && 'GITEA_TEST_URL/TOKEN/OWNER/REPO not set' }, async () => {
  const client = new GiteaClient({ baseUrl: URL, token: TOKEN, retries: 0 })

  // 1. whoami
  const who = await client.getUser()
  assert.equal(who.ok, true, `getUser failed: ${who.error}`)
  assert.ok(who.data.login)

  // 1b. repo search (works on Gitea and Forgejo)
  const search = await client.searchRepos({ q: REPO, limit: 5 })
  assert.equal(search.ok, true, `searchRepos failed: ${search.error}`)

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

  // 6. labels: list + create
  const labels = await client.listLabels(OWNER, REPO)
  assert.equal(labels.ok, true, `listLabels failed: ${labels.error}`)
  const labelName = `e2e-${Date.now()}`
  const createdLabel = await client.createLabel(OWNER, REPO, { name: labelName, color: '1d76db' })
  assert.equal(createdLabel.ok, true, `createLabel failed: ${createdLabel.error}`)

  // 7. milestones: list + create
  const milestones = await client.listMilestones(OWNER, REPO)
  assert.equal(milestones.ok, true, `listMilestones failed: ${milestones.error}`)
  const createdMilestone = await client.createMilestone(OWNER, REPO, { title: `e2e-m-${Date.now()}` })
  assert.equal(createdMilestone.ok, true, `createMilestone failed: ${createdMilestone.error}`)

  // 8. branches list
  const branches = await client.listBranches(OWNER, REPO)
  assert.equal(branches.ok, true, `listBranches failed: ${branches.error}`)

  // 9. releases list
  const releases = await client.listReleases(OWNER, REPO)
  assert.equal(releases.ok, true, `listReleases failed: ${releases.error}`)

  console.log(`e2e OK: ${NAME} user=${who.data.login} issue #${number} + labels/milestones/branches/releases`)
})
