# dsh-gitea A — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a publishable-but-unpublished DSH plugin `@goodandready-private/dsh-gitea` that gives the agent Gitea/Forgejo issue, PR, and repo-search tools, with Settings for instance URL plus credential ref.

**Architecture:** One Cordis package plugin. Thin `/api/v1` HTTP client, repo resolution (args then settings then git origin), exported handlers testable without Cordis, `apply()` that registers tools and settings, Settings-only browser bundle. No DoD hook, no MiniAI hosts, no GitHub/npm release.

**Tech Stack:** Node ESM, `node:test`, schemastery, `defineTool`, `credentialRef`, Cordis settings and webServer. Gitea API v1 with `Authorization: token`. Git on MiniAI: `git-cursor`.

## Global Constraints

- Package name, cordis `name:`, and client loader id are `@goodandready-private/dsh-gitea`. Short patch `id:` is `dsh-gitea`.
- Catalog category: `git`. Gitea and Forgejo share one `/api/v1` client.
- Token via `ctx.credentials.resolve(credentialRef(tokenEnv))`. Settings store the credential name (`GITEA_TOKEN` default), never the secret.
- Empty config must not crash boot. Missing URL/token is a tool-result error.
- Every tool has `output.schema` and `output.render` returning `[{ type: 'text', text }]`. Object schemas set `additionalProperties: false`.
- `gitea_pr_merge` does not call the API unless `confirm === true` (strict boolean).
- No MiniAI IPs, `/opt`, `/mnt`, or tokens in `lib/`, `test/`, README, or examples. Placeholders only.
- No GitHub repo, no npm publish, no RELEASE. Install with `package-artifact:` on staging DSH only.
- Develop on MiniAI at `DEV/dsh-gitea`. Git only through `git-cursor`.
- Do not implement B (DoD hook), C (chat git UI), Device Flow, clone/push, multi-instance, or review-line comments.
- `inject` only `tools`, `credentials`, `settings`, `webServer`.
- After each package change: bump version, `plugin remove` then `add`, grep the installed copy.
- Commits: conventional, footer `Refs: #<issue>`. Docs in the same commit when they change.

---

## File map

Worktree after Task 1: `DEV/dsh-gitea/.worktrees/feat-1-gitea-a/`

| File | Responsibility |
|---|---|
| `package.json` | Scoped name, exports, dsh.bundle/client, peers, files, test script |
| `cordis.patch.yml` | id `dsh-gitea`, name `@goodandready-private/dsh-gitea` |
| `lib/repo.js` | `parseGitRemote`, `resolveRepo` |
| `lib/gitea-client.js` | `normalizeBaseUrl`, `GiteaClient` |
| `lib/secrets.js` | `stripSecretsFromConfig`, `assertCredentialRef` |
| `lib/handlers.js` | `guardMerge`, `runHandler`, `formatToolResult` |
| `lib/index.js` | Cordis apply: settings, credentials, 11 tools, config HTTP |
| `lib/client.js` | Settings section only |
| `test/*.test.mjs` | node:test, mocked fetch |
| `README.md` LICENSE `.gitignore` `AGENTS.md` `index.md` | Publishable docs |
| `docs/superpowers/specs/2026-08-23-dsh-gitea-design.md` | Approved spec |
| `docs/superpowers/plans/2026-08-23-dsh-gitea-a.md` | Copy of this plan |


### Task 1: Gitea repo, issue, worktree, scaffold

**Files:**
- Create: `package.json`, `cordis.patch.yml`, `.gitignore`, `LICENSE`, `AGENTS.md`, `index.md`, spec and plan copies under `docs/superpowers/`
- Test: repo exists; `package.json` name is `@goodandready-private/dsh-gitea`

**Interfaces:**
- Consumes: user approval to create `goodandready/dsh-gitea` (spec ok).
- Produces: private org repo, issue #1, branch `feat/1-gitea-a`, worktree, identity files.

- [ ] **Step 1: Create org repo as cursor (private)**

`POST /api/v1/orgs/goodandready/repos` with `name=dsh-gitea`, `private=true`, `auto_init=true`, description: DSH plugin for Gitea/Forgejo issues, PRs, repo search.

Use cursor token from `the configured credential store`. Never print the token. If the repo exists, reuse it. Do not create a personal-namespace repo.

- [ ] **Step 2: One canonical clone**

```bash
export PATH=<user-bin>:/usr/bin:/bin
cd DEV/plugins
test ! -e dsh-gitea
# SSH host: the one that already works for git-cursor in sibling plugins; path must be goodandready/dsh-gitea.git
git-cursor clone ssh://git@HOST:2222/goodandready/dsh-gitea.git dsh-gitea
```

- [ ] **Step 3: Issue #1** titled `feat: Gitea/Forgejo agent tools (A)` with in-scope tools, out-of-scope B/C/deploy, success criteria, test plan. Start comment: executor cursor, branch `feat/1-gitea-a`, worktree path.

- [ ] **Step 4: Worktree**

```bash
cd DEV/dsh-gitea
git-cursor fetch --no-tags origin main
git-cursor worktree add -b feat/1-gitea-a .worktrees/feat-1-gitea-a origin/main
```

All later writes only in that worktree.

- [ ] **Step 5: Scaffold**

`.gitignore`: `node_modules/`, `.env`, `.env.*`, `*.pem`, `*.key`, `*.crt`, `credentials.yaml`, `.planning/`, `*.log`

`package.json` version `0.1.0`, name `@goodandready-private/dsh-gitea`, type module, exports `.` `./client` `./cordis.patch.yml` `./package.json`, files `lib/` `cordis.patch.yml` `README.md` `LICENSE`, keywords dsh/dsh-plugin/gitea/forgejo/git, repository/homepage/bugs pointing at intended `https://github.com/goodandready-private/dsh-gitea` (do not create GitHub), script `"test": "node --test test/*.test.mjs"`, dsh.bundle.patch `./cordis.patch.yml`, dsh.client platform web inject `@deepseek-ai/dsh-client-runtime` and `@deepseek-ai/dsh-client-ui-slots`, peerDependencies cordis ^4.0.1, dsh-tools / dsh-credentials / dsh-host-webserver / dsh-settings ^0.1.0-rc.6, schemastery ^3.18.1, publishConfig access public.

`cordis.patch.yml`:

```yaml
- insert:
    - id: dsh-gitea
      name: '@goodandready-private/dsh-gitea'
      config: {}
```

MIT LICENSE copyright 2026 dsh-gitea contributors. AGENTS.md: three identity sites, git-cursor, no secrets, npm test, package reinstall is remove+add. Copy spec+plan into docs/superpowers. Short index.md with test command and staging-only note.

- [ ] **Step 6: Commit and push** `chore(dsh-gitea): scaffold publishable plugin package` footer `Refs: #1`

---

### Task 2: Repo resolution

**Files:**
- Create: `lib/repo.js`
- Test: `test/repo.test.mjs`

**Interfaces:**
- Produces: `parseGitRemote(url) => {owner, repo}|null`; `resolveRepo({args, settings, remoteUrl}) => {ok, owner, repo}|{ok:false, error}`

- [ ] **Step 1: Write failing test** covering ssh scp (`git@example.com:acme/app.git`), ssh url with port, https, http with port, junk → null; resolve order args > settings > remote; miss → error matching /owner/i

- [ ] **Step 2: Run `node --test test/repo.test.mjs` — expect MODULE_NOT_FOUND**

- [ ] **Step 3: Implement `lib/repo.js`**

```js
export function parseGitRemote(url) {
  const s = String(url || '').trim()
  if (!s) return null
  let m = s.match(/^git@[^:]+:([^/]+)\/(.+?)(?:\.git)?$/)
  if (m) return { owner: m[1], repo: m[2] }
  m = s.match(/^ssh:\/\/[^/]+\/([^/]+)\/(.+?)(?:\.git)?$/)
  if (m) return { owner: m[1], repo: m[2] }
  m = s.match(/^https?:\/\/[^/]+\/([^/]+)\/(.+?)(?:\.git)?$/)
  if (m) return { owner: m[1], repo: m[2] }
  return null
}

export function resolveRepo({ args = {}, settings = {}, remoteUrl = '' } = {}) {
  const a = { owner: String(args.owner || '').trim(), repo: String(args.repo || '').trim() }
  if (a.owner && a.repo) return { ok: true, ...a }
  const s = { owner: String(settings.defaultOwner || '').trim(), repo: String(settings.defaultRepo || '').trim() }
  if (s.owner && s.repo) return { ok: true, ...s }
  const parsed = parseGitRemote(remoteUrl)
  if (parsed?.owner && parsed?.repo) return { ok: true, ...parsed }
  return { ok: false, error: 'Set owner and repo on the tool, in Settings (default owner/repo), or run inside a git checkout with origin.' }
}
```

- [ ] **Step 4: Tests PASS**

- [ ] **Step 5: Commit** `feat(dsh-gitea): resolve owner/repo from args, settings, or origin` `Refs: #1`


### Task 3: Gitea HTTP client

**Files:**
- Create: `lib/gitea-client.js`
- Test: `test/gitea-client.test.mjs`

**Interfaces:**
- Produces: `normalizeBaseUrl(url) => string`; `class GiteaClient({ baseUrl, token, fetchImpl, timeoutMs })`; `request(method, path, { query, body }) => { ok, status, data, error }`; methods `createIssue`, `listIssues`, `getIssue`, `commentIssue`, `closeIssue`, `createPull`, `listPulls`, `getPull`, `mergePull`, `searchRepos`.

- [ ] **Step 1: Failing tests** — trailing slash strip; `createIssue` POSTs `https://gitea.example.com/api/v1/repos/acme/app/issues` with `Authorization: token t-test`; 404 → `{ok:false}` no throw; `mergePull` POSTs `.../pulls/3/merge` with `{Do:"squash"}`. Mock `fetchImpl`, never use a real host.

- [ ] **Step 2: Run — FAIL missing module**

- [ ] **Step 3: Implement client**

Default `fetchImpl` is global `fetch`. API root = `normalizeBaseUrl(baseUrl) + '/api/v1'`. Headers: `Accept: application/json`, `Authorization: token ${token}`, `Content-Type` when body present. Use `AbortSignal.timeout(timeoutMs)` when available. Network errors → `{ ok:false, status:0, error }`. Never log the token.

Paths:
- POST `/repos/{o}/{r}/issues`
- GET `/repos/{o}/{r}/issues` query state,limit,page
- GET `/repos/{o}/{r}/issues/{n}`
- POST `/repos/{o}/{r}/issues/{n}/comments` `{body}`
- PATCH `/repos/{o}/{r}/issues/{n}` `{state:"closed"}`
- POST `/repos/{o}/{r}/pulls` `{title,head,base,body}`
- GET `/repos/{o}/{r}/pulls`
- GET `/repos/{o}/{r}/pulls/{n}`
- POST `/repos/{o}/{r}/pulls/{n}/merge` `{Do}`
- GET `/repos/search` query q,limit

- [ ] **Step 4: Tests PASS**

- [ ] **Step 5: Commit** `feat(dsh-gitea): add Gitea/Forgejo API v1 client` `Refs: #1`

---

### Task 4: Handlers, merge guard, eleven tools

**Files:**
- Create: `lib/handlers.js`, `lib/secrets.js`, `lib/index.js`
- Test: `test/handlers.test.mjs`, `test/secrets.test.mjs`

**Interfaces:**
- Consumes: `GiteaClient`, `resolveRepo`, `guardMerge`
- Produces: `runHandler(name, args, deps)`; `deps = { client, settings, remoteUrl, configured: { baseUrl, token } }`; tool names `gitea_issue_create|list|get|comment|close`, `gitea_pr_create|list|get|comment|merge`, `gitea_repo_search`.

- [ ] **Step 1: Failing tests**
  - `guardMerge({confirm:true}).ok === true`; false/missing → not ok
  - `gitea_pr_merge` without confirm does not call `client.mergePull`
  - empty `configured.baseUrl` → ok false, no HTTP, error matches /url|instance|configure/i
  - `formatToolResult` returns `[{type:'text', text}]` containing `#3`
  - `stripSecretsFromConfig` keeps `tokenEnv`, drops `token`, `apiKey`, `keys`

- [ ] **Step 2: Run — FAIL**

- [ ] **Step 3: Implement**

`guardMerge`: only `args.confirm === true` (string `"true"` is refused).

`runHandler`: missing URL → configure instance URL in Settings; missing token → set credential named in `tokenEnv`. Issue/PR tools call `resolveRepo` first (search does not). Merge runs `guardMerge` before `mergePull`. Default `Do` is `merge`; allow `rebase` and `squash`.

`lib/index.js`:
- `export const name = 'dsh-gitea'`
- `export const inject = ['tools', 'credentials', 'settings', 'webServer']`
- `Config`: `baseUrl` default `''`, `tokenEnv` default `GITEA_TOKEN`, `defaultOwner`, `defaultRepo`, `timeoutMs` default 30000
- each tool `defineTool` execute → `runHandler`; `output.render` → `formatToolResult`; object schema `additionalProperties: false`
- `apply()` registers tools even when URL is empty
- runtime origin: `readGitOrigin(cwd)` via `execFile` of `git` `remote get-url origin`; tests pass `remoteUrl` and do not spawn git

- [ ] **Step 4: `node --test test/*.test.mjs` PASS; `node --check` all lib js except client**

- [ ] **Step 5: Commit** `feat(dsh-gitea): register issue, PR, and repo-search tools` `Refs: #1`


### Task 5: Settings, credentials, client bundle

**Files:**
- Modify: `lib/index.js`
- Create: `lib/client.js`
- Test: `test/client-factory.test.mjs`

**Interfaces:**
- Produces: settings namespace `dsh-gitea`; GET/POST `/dsh-gitea/config` never returns token values; client `apply(ctx)` with `inject: ['slots']`.

- [ ] **Step 1: Failing vm test** (pattern from `plugins/dsh-tts/test/client-factory.test.mjs`): source has `id: '@goodandready-private/dsh-gitea'`, `var module = { exports: {} }`, `return module.exports`, `inject: ['slots']`, `apply` is a function, no `127.0.0.1` `INSTALLED_PATH/` `DEV_SOURCE/`.

- [ ] **Step 2: Run — FAIL no client.js**

- [ ] **Step 3: Implement**

Host: `settings.register('dsh-gitea', Config, { base: config })`. Resolve token with `ctx.credentials.resolve(credentialRef(tokenEnv))`. GET `/dsh-gitea/config` returns public config plus `tokenConfigured` boolean (`credentials.describe` if present). POST strips secrets then `scope.update`. Dispose via `ctx.effect`.

Client: Settings label `Gitea`. Fields: instance URL, credential ref name, default owner, default repo, Save. Do not store the token in plugin settings; user creates DSH credential `GITEA_TOKEN` and the plugin stores only the ref name. CSS uses `var(--dsw-alias-*)`.

- [ ] **Step 4: Tests PASS. `grep -c 'return module.exports' lib/client.js` is 1.**

- [ ] **Step 5: Commit** `feat(dsh-gitea): add Settings for instance URL and token ref` `Refs: #1`

---

### Task 6: README and leak check

**Files:**
- Create: `README.md`

**Interfaces:**
- Produces: install docs for future npm and temporary package artifact; URL + `GITEA_TOKEN`; token scopes repo+issues; Forgejo note; merge requires confirm; placeholders only.

- [ ] **Step 1: Write README** with `https://gitea.example.com`, `GITEA_TOKEN`, `owner/repo` only.

- [ ] **Step 2: Leak grep** on `lib/`, `test/`, `README.md`, `AGENTS.md` for `127.0.0.1`, `INSTALLED_PATH/`, `DEV_SOURCE`, tokens. `goodandready` allowed only in package name and intended GitHub URLs.

```bash
rg -n -i '192\.168|INSTALLED_PATH/|DEV_SOURCE' lib test README.md AGENTS.md
```

- [ ] **Step 3: `npm test` PASS**

- [ ] **Step 4: Commit** `docs(dsh-gitea): add placeholder README for self-hosted setup` `Refs: #1`

---

### Task 7: Isolated package-artifact install

**Files:** bump `package.json` version only if pnpm reuses a stale copy.

**Interfaces:**
- Produces: plugin loaded on staging; tools present; Settings Gitea visible; production DSH untouched; WIP PR; not published.

- [ ] **Step 1: Identify staging vs production.** Install only on staging. If profile `package.json` is missing, stop (dsh-web-profile-repair). Do not recreate the profile.

- [ ] **Step 2: `node --check` host files. Backup profile dependency counts. `dsh plugin --profile web add temporary package artifact` (guard-add if present).

- [ ] **Step 3: Installed copy must contain `gitea_pr_merge`. If grep count is 0: remove + add, bump version.

- [ ] **Step 4: Restart staging dsh-web only. Require active, NRestarts not climbing, HTTP 200, no `failed to apply loader entry @goodandready-private/dsh-gitea`.

- [ ] **Step 5: Client**

```bash
curl -sS ORIGIN/ | grep -F '"id":"@goodandready-private/dsh-gitea"'
curl -sS -o /dev/null -w '%{http_code}\n' ORIGIN/plugins/@goodandready-private/dsh-gitea/client.js
```

Expect 200. Hard-refresh Settings → Gitea.

- [ ] **Step 6: Open WIP PR `feat/1-gitea-a` → `main` with test evidence. Do not merge until the user asks. Do not npm publish. Do not create GitHub repo. Do not copy RELEASE.**

- [ ] **Step 7: Issue comment with SHA, `npm test`, staging HTTP codes, “not published”.

---

## Spec coverage

| Spec item | Task |
|---|---|
| Issue create/list/get/comment/close | 4 |
| PR create/list/get/comment/merge+confirm | 3, 4 |
| Repo search | 3, 4 |
| Settings URL + credential + default owner/repo | 5 |
| Repo resolution order | 2 |
| Forgejo = same client | 3 |
| No B/C/MiniAI ops | Global + 6 |
| Token not in chat/settings JSON | 4, 5 |
| Boot with empty config | 4, 7 |
| Three identity sites | 1, 5 |
| package artifact only | 7 |
| output.render / additionalProperties | 4 |

## Out of this plan

B DoD hook, GitHub/npm release, production DSH, OPT deploy of other services, Hermes Kanban/worktree/deploy-approval.
