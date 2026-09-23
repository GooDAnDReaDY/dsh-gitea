# Changelog

## [0.7.15] - 2026-09-23

### Fixed
- **Client hook lifecycle and BroadcastChannel cleanup (#239)**: `useCrossTabGitStatus` in `lib/client.js` previously instantiated, posted to, and closed a new `BroadcastChannel` every 4 seconds. It now persists and reuses the open instance via `channelRef`. Additionally, `AbortError` thrown by `navigator.locks.request` when `abortController.abort()` runs on component unmount is now caught and ignored, preventing parasitic background fetch requests and state updates on unmounted React components (`aliveRef.current`).
- **Standardized logging in comment annotation (#240)**: `annotateCommentsWithMine` in `lib/handlers.js` previously used direct `console.warn` calls when `client.getUser` returned non-ok or threw. It now routes warnings through `logger?.warn` (receiving `deps.logger` from `runHandler`), eliminating direct unmanaged console output from the server handlers while preserving a fallback when no logger is injected.

## [0.7.14] - 2026-09-23

### Performance
- **Debounced disk persistence and memory capacity cap for session-git (#236)**: `rememberSessionGitDir` previously executed a blocking `fs.writeFileSync` on every invocation of any tool, and unbounded Map growth allowed `session-git.json` to grow indefinitely. It now includes dirty checking (`dirs.get(id) === dir`), an asynchronous debounced writer (`fs.promises.writeFile`), and a strict memory cap (`MAX_SESSION_DIRS = 300`) with FIFO eviction.
- **Parallelized review lookups and elimination of redundant getPull calls (#237)**: Added `mapConcurrent` helper in `lib/retry.js` with bounded concurrency. `buildReviewInbox` and `buildTriageDigest` now query PR reviews concurrently with a pool limit of 8 instead of sequential loops. In `review-escalation.js`, existing `pr.labels` from `listPulls` are reused to eliminate redundant `client.getPull` HTTP calls per PR.
- **Client response cache capacity cap, LRU eviction, and structuredClone (#238)**: `GiteaClient` now enforces `maxCacheEntries = 150` with LRU eviction to prevent unbounded memory growth during continuous read operations. Expired entries without ETags are purged immediately on access, and object cloning for cache hits and HTTP 304 revalidations has been updated from `JSON.parse(JSON.stringify(...))` to native `structuredClone`.

## [0.7.13] - 2026-09-23

### Fixed
- **Merge readiness gate strictly blocks database migrations (#241)**: `checkMergeReadiness` in `lib/merge-gate.js` previously evaluated migration detection to `status: 'pass'` regardless of whether migrations were present. It now evaluates to `status: 'fail'` and `ready: false` unless a rollback plan is verified (via `args.allowMigrations`, `args.hasRollbackPlan`, or a rollback plan description in the PR body).
- **Batch issue operations milestone reporting (#242)**: `applyBatch` in `lib/batch-ops.js` now updates milestones via `client.updateIssue` and only records `milestone` in `applied` upon actual success. Unapplied or failed milestone updates are excluded from `applied`, mark `perIssue.ok = false`, and report diagnostic details in `perIssue.errors`.
- **Direct fetch for explicit issue numbers in batch ops (#243)**: `planBatch` and `applyBatch` in `lib/batch-ops.js` now fetch explicit issue numbers directly via `client.getIssue`, removing the 200 open-issue page limit and properly including closed issues. Missing issue numbers return an explicit error instead of an empty success.

## 0.7.12

### Fixed
- Settings no longer wait on the removed settingsScope service. The client uses configForms (#244).

## [0.7.11] - 2026-09-19

### Fixed
- **Settings reachable again on the plugin's own page**: the current DSH core
  (0.1.6-alpha.2) renders a plugin's configuration page only for entries registered
  in the plugin-list seat `plugins.item` — that is how `dsh-agentrouter` and
  `dsh-agent-orchestrator` show their settings, while the row seat and the legacy
  card alone leave the page without the form. The view-aware `GiteaPluginCard` is now
  registered there too (`id: 'dsh-gitea'`, order 60, static label); the row seat and
  `settings.plugin.item` stay as fallbacks.
- Both client-settings tests now expect the three seats in order.

## [0.7.10] - 2026-09-19

### Fixed
- **`gitea_pr_merge` no longer reports a false failure (#231)**: Gitea answers the
  merge endpoint with an empty body, so `wrap()` returned `{ ok: true, data: undefined }`.
  JSON drops an `undefined` key, and the harness rejects a tool result that does not
  survive serialization — the call was reported as `invalid output: value is not
  lossless JSON` **although the merge had succeeded**. `wrap()` now omits the field
  when there is no payload, and `lib/gitea-client.js` handles empty bodies and
  `204` explicitly instead of relying on a swallowed JSON parse error.
- **Tool results are serializable by construction**: new `toLossless()` in
  `lib/handlers.js` is applied to every tool result in `lib/index.js`; it drops
  `undefined` keys, replaces non-finite numbers with `null`, converts `Date` to ISO
  strings and `BigInt` to strings, and cuts cycles. Any endpoint that answers with
  no payload can no longer produce a rejected tool result.

### Added
- **Settings open on the plugin's own page**: the client registers the settings
  surface into the Plugins page row seat `plugins.row.config`, keyed
  `@goodandready/dsh-gitea#dsh-gitea` (`rowConfigKey(package, rowId)`), rendering a
  one-line description for `view: 'summary'` and the settings form without card
  chrome for `view: 'page'`. The legacy `settings.plugin.item` seat is kept as a
  fallback, newest first.
- Guards: `test/lossless-output.test.mjs` (JSON round-trip for `undefined` keys,
  `NaN`, dates, bigints, cycles; row-seat key and seat order) and updated client
  tests that assert the row seat is registered first.

## [0.7.9] - 2026-09-18

### Fixed
- **Robust Comment Ownership Annotation (`annotateCommentsWithMine`)**:
  - Replaced empty `catch {}` block with diagnostic warning logging (`console.warn`) and explicit intent annotation (`/* bestEffort: mine is not critical for reading comments */`).
  - Added non-ok response handling when `getUser()` returns an error payload.
  - Guarded ownership annotation: when `getUser()` fails or is unreachable, comments retain `mine: undefined` rather than falsely marking own comments as foreign (`mine: false`).

## [0.7.8] - 2026-09-17

### Added
- **Safe Issue Comment Deletion (`gitea_issue_comment_delete`)**:
  - Implemented safe comment deletion tool requiring explicit `confirm: true` (`lib/handlers.js`, `lib/tool-defs.js`).
  - Without `confirm: true`, returns a safe dry-run preview with comment ID, owner/repo, author, creation timestamp, and first 80 characters of body.
  - Strict author protection: enforces that only comments authored by the current token user (`getUser()`) can be deleted; foreign comments are rejected with an explicit error.
- **Comment Ownership Annotation (`mine: true/false`)**:
  - Annotated comments in `gitea_issue_comments` and `gitea_issue_get` with `mine: true` or `false` based on authenticated user comparison.
  - Updated result formatter to render `**<author>** (you)` for rapid distinction by LLM agents.
- **Dedicated Comment Deletion Test Suite**:
  - Added `test/comment-delete.test.mjs` with 8 comprehensive test cases covering dry-run previews, cross-author deletion rejection, confirmed deletion, 404s, and `mine` flags.
- **Documentation**:
  - Updated `README.md`, `README.ru.md`, `README.zh.md`, and added Section 13 to `docs/design/DESIGN.md`.

## [0.7.7] - 2026-09-17

### Changed
- **Server Entrypoint Decomposition**:
  - Extracted all HTTP route handlers (`/dsh-gitea/config`, `/webhook`, `/events`, `/git-status`, `/git-graph`) and transport helpers (`writeJson`, `readBody`) into a dedicated `lib/routes.js` module.
  - Reduced `lib/index.js` from 611 lines to 380 lines (comfortably below the 600-line guideline).
  - Decoupled `lib/routes.js` from DSH harness peer dependencies via dependency injection (`tokenConfigured`, `resolveToken`, `execFile`), allowing independent unit testing in pure Node.js.

### Added
- **Client Bundle Architecture Documentation**:
  - Added Section 12 to `docs/design/DESIGN.md` establishing the architectural rationale for retaining `lib/client.js` as a unified runtime bundle without external bundlers per Ponytail / YAGNI and DSH `window.__ModuleLoader__.load` contracts (following the precedent of `dsh-context-lens` #69).
  - Documented line count justifications for specialized modules `lib/handlers.js`, `lib/tool-defs.js`, and `lib/gitea-client.js`.
- **Route Unit Test Suite**:
  - Added `test/routes.test.mjs` covering route registration, streaming body parser limits, and status responses.

## [0.7.6] - 2026-09-17

### Added
- **One-Click Plugin Auto-Updater**:
  - Implemented `/api/dsh-gitea/update` endpoint (`lib/plugin-updater.js`) with background CLI updater and loopback origin validation.
  - Added native auto-updater section to settings card (`lib/client.js`) using DSH theme CSS variables.
  - Safe dependencies: respects pnpm release quarantine rules and handles prerelease progression.
- **Public Composition Services**:
  - `dshGitea` task provisioning service supporting idempotent issue creation (`lib/task-service.js`, contract `dsh-drives.task-provision.v1`).
  - `giteaEvents` producer-owned telemetry composition service for `@goodandready/dsh-pulse` with complete redaction and subscriber error isolation (`lib/gitea-events.js`).
- **Sanitized Release Export Pipeline**:
  - Added `.gitattributes` (`export-ignore`) and sanitized release export script (`publish.sh`) to exclude internal metadata from GitHub mirrors.

### Changed
- **Entrypoint Modularization**:
  - Extracted 70 tool schema definitions into `lib/tool-defs.js`, reducing `lib/index.js` to 587 lines while keeping client bundle single-file per DSH runtime.

### Fixed
- **Git Mutation Invalidation & Dead Code Pruning**:
  - Connected `clearSnapshotCache()` to local git write operations and PR rebases, with `refresh=1` cache-busting on `/dsh-gitea/git-snapshot`.
  - Pruned unused internal exports and dead functions.
- **Security & Origin Validation**:
  - Hardened POST `/dsh-gitea/config` using `lib/http-guard.js` loopback verification and strict origin/host validation.
- **UI & Settings Robustness**:
  - Fallback status to `unavailable` and `writable = false` when `settingsScope` is missing.
  - Replaced all hardcoded colors with DSH theme CSS tokens in Git panel and commit graph.
  - Resolved `IconChevronDownOutline14` from `@deepseek-ai/dsh-client-ui-primitives` with fallback.
  - Declared missing client inject dependencies `@deepseek-ai/dsh-client-locale` and `@deepseek-ai/dsh-client-ui-settings` in `package.json`.
- **Repository Hygiene**:
  - Added `.worktrees/` to `.gitignore`.

## [0.7.4] - 2026-09-13

### Fixed
- **Localization Compliance with DSH Plugin Standard**:
  - Embedded first-class Chinese (`zh`) dictionary in client bundle covering all settings, drawer, git inspector, and commit graph strings.
  - Removed embedded Russian (`ru`) dictionary from plugin codebase to strictly follow standard (Russian strings are provided exclusively via `dsh-russian-lang`).
  - Registered both English and Chinese locales: `ctx.locale.register(NS, { en, zh })`.
  - Added unit test to verify zero hardcoded Russian Cyrillic characters in client bundle and full `zh` dictionary coverage.

## [0.7.3] - 2026-09-13

### Added
- **Inbound Webhook Gateway & Event Ingestion (Phase 4)**:
  - Enhanced webhook event parser in `EventStore.fromWebhook` supporting `push` (branch, commits count, message), `issue_comment` (PR comments, issue discussions), and `release` events.
  - Comprehensive unit test suite `test/webhook-route.test.mjs` verifying HMAC-SHA256 signature verification, event mapping, and event store ingestion (total: 403 tests).

## [0.7.2] - 2026-09-13

### Added
- **HTTP 304 Conditional Request Caching (Phase 3)**:
  - `GiteaClient` now captures upstream `ETag` headers on successful GET responses.
  - Subsequent requests to the same endpoint send `If-None-Match: <etag>`.
  - On receiving `304 Not Modified`, `GiteaClient` refreshes cache TTL and serves cached data directly, saving bandwidth and serialization time.
- Unit tests verifying ETag header transmission and 304 response recovery (total: 399 tests).

## [0.7.1] - 2026-09-13

### Added
- **New Agent Tools (Phase 2)**:
  - `gitea_pr_diff`: Fetch raw pull request unified diff or parsed file-level change statistics (`stat: true`, additions, deletions, changed files list).
  - `gitea_reactions`: Manage emoji reactions on issues and comments (`list`, `add`, `delete` for `+1`, `-1`, `laugh`, `confused`, `heart`, `hooray`, `rocket`, `eyes`).
  - `gitea_issue_timeline`: Chronological timeline of events, state transitions, and comments on issues.
- **Client Methods**: `getPullDiff`, `listIssueReactions`, `addIssueReaction`, `deleteIssueReaction`, `listCommentReactions`, `addCommentReaction`, `deleteCommentReaction`, `getIssueTimeline`.
- Rich CLI and chat formatting for PR diff stats, reaction counts, and event timelines.
- Unit tests covering all Phase 2 agent tools and output formatters.

## [0.7.0] - 2026-09-13

### Added
- **Native DSH Sidebar Drawer (Phase 1)**: Replaced popup panel and modal commit graph with a smooth, collapsible `GitSidebarDrawer` docked to the right edge.
- **3 Tabbed Inspector Sections**:
  - **Status**: Live branch info, upstream sync indicators (ahead/behind), active PR badge, formatted working tree changes, clean/dirty indicator, and one-click manual refresh button.
  - **Graph & CI**: Topological commit graph with lane characters, commit author, relative timestamp, direct OID links to Gitea, and live Actions CI status badges (`CI ✓`, `CI ✗`, `CI ●`).
  - **Events & PRs**: Real-time webhook events stream and PR tracking.
- **Enhanced Keyboard & Accessibility**: Full `Esc` key navigation, `aria-modal`, `role="dialog"`, smooth cubic-bezier drawer transition, and backdrop blur.
- Tests covering `GitSidebarDrawer` tabs and accessibility attributes.

## [0.6.4] - 2026-09-13

### Added
- Issue comments inspection: `listIssueComments`, `getIssueComment`, `updateIssueComment`, and `deleteIssueComment` in `GiteaClient` with in-memory TTL cache support and automatic invalidation.
- New tool `gitea_issue_comments` for retrieving issue discussions with pagination (`limit`, `page`).
- Support for `include_comments` parameter in `gitea_issue_get` to retrieve issue details and comments in a single query.
- Slim comment projection in `RECORD_KEYS` / `slimRecord` (`id`, `user`, `body`, `created_at`, `updated_at`).
- Rich text formatting in `formatToolResult` for `gitea_issue_get` (rendering title, state, description, and comments) and `gitea_issue_comments`.
- Handlers for `gitea_issue_comment_update` and `gitea_issue_comment_delete`.
- 7 new unit tests covering comment methods, TTL cache invalidation, and tool result formatting (total: 394 tests).
- Acknowledged community contribution and proposal from GitHub PR #1 by @madalee-com.

## [0.6.3] - 2026-09-12

### Added
- In-memory TTL cache (`cacheTtlMs: 15_000`) in `GiteaClient` with automatic cache invalidation on mutating requests (POST/PATCH/DELETE/PUT).
- Parallelized independent git inspection commands (`status`, `rev-parse`, `log`, `remote`) via `Promise.allSettled` in `buildGitSnapshot`.
- Visibility-aware polling via Page Visibility API in `useCrossTabGitStatus` and `EventsPanel`: pauses redundant background polling when tab is hidden, immediate sync on tab focus.
- Canonical style tag isolation using `data-dsh-plugin="dsh-gitea"` compliant with `dsh-plugin-authoring` standard.
- Tests covering TTL cache behavior, style tag attribute, and visibility-aware polling.

## [0.6.2] - 2026-09-10

### Added
- React `ErrorBoundary` wrapping `GiteaPluginCard` and `GiteaSettingsForm` inspired by `dsh-clinebot`.
- Native SVG `Chevron` icon in `GiteaPluginCard` with smooth 180-degree rotation on toggle.
- Host status badge (`badgeOnline` / `badgeOffline`) and token status badge in settings header.
- Connected `gitea_ci` with `action: 'run'` (`client.getActionsRun`) and `action: 'logs'` (`client.getJobLogs`).
- Connected `gitea_labels` with `action: 'add_to_issue'` (`client.addIssueLabels`).
- Tests covering `ErrorBoundary`, `Chevron`, and the new `gitea_ci` / `gitea_labels` actions.

### Fixed
- Replaced hardcoded Russian strings in `EventsPanel` with localized keys (`eventsTitle`, `eventsEmptyHint`).
- Aligned UI design tokens and badge styles (`.dgt-badgeOk`, `.dgt-badgeWarn`, `.dgt-badgeBad`, `.dgt-badgesRow`) with DSH styling standards.

## 0.6.1 — 2026-09-10

- Client Stability, Safe Locale & Full Settings Card Suite (#192):
  - **Safe Locale Registration (`lib/client.js`)**: Wrapped `locale.register` in an isolated `try/catch` with `console.warn` logging, ensuring duplicate locale registration attempts ("already has locale") never crash client UI slots.
  - **Context Service Access (`lib/client.js`, `lib/index.js`)**: Standardized service resolution via `ctx.get('service')` helper (`locale`, `settingsScope`, `slots`, `credentials`, `settings`), preventing `undefined` lookups on Cordis proxies.
  - **Comprehensive Settings Card (`lib/client.js`)**: Extended `GiteaSettingsForm` to cover all 17 schema configuration fields grouped into Core and Advanced sections (`defaultOwner`, `defaultRepo`, `gitWrapper`, `dodReminder`, `forceHttpsUrls`, `timeoutMs`, `webhookSecretEnv`, `notifyWebhook`, `bgScheduler*`, `instances`).
  - **Deprecation & Security**: Explicitly documented `webhookSecret` as deprecated in favor of `webhookSecretEnv` credential references, keeping sensitive values out of browser DOM.
  - **Documentation**: Updated Settings Reference Tables in English, Russian, and Chinese documentation.

## 0.6.0 — 2026-09-07

- Tool Consolidation, Architecture Decoupling & Stability Release:
  - **Tool Consolidation & Facades**: Consolidated repetitive CRUD micro-tools into 9 facade tools (`gitea_labels`, `gitea_milestones`, `gitea_releases`, `gitea_ci`, `gitea_branches`, `gitea_tags`, `gitea_webhooks`, `gitea_org`, `gitea_wiki`), reducing schema registry definitions from 95 to ~30 while keeping clean semantic actions.
  - **100% Backward Compatibility**: Added automatic legacy tool mapping in `runHandler` (`lib/handlers.js`) so that all legacy tool calls (e.g. `gitea_label_list`, `gitea_release_now`, `gitea_ci_explain`, etc.) map transparently to the corresponding facade actions without breaking existing workflows or agents.
  - **Architectural Decoupling & Feature Creep Removal**:
    - Removed `lib/sprint-plan.js` (delegated to `@goodandready/dsh-kanban`).
    - Removed `lib/digest-delivery.js` (delegated to `@goodandready/dsh-plugin-notify`).
    - Removed `lib/auto-actions.js` & `lib/dep-watch.js`.
  - **Performance & Concurrency Hardening**:
    - `lib/git-local.js`: Implemented a 3-second TTL cache for `buildGitSnapshot` to prevent repetitive subshell `git` executions on chat/session polling.
    - `lib/duty-officer.js`: Optimized PR review lookups with `Promise.all` batching and capped queries.
    - `lib/pr-templates.js`: Added bilingual (EN/RU) template detection for PR checklist verification.
    - `lib/bg-scheduler.js`: Added in-flight concurrency guard to prevent overlapping ticks when external requests lag.


- Authoring, Quality & Security Bugfix Suite (#181, #182, #183, #184, #185, #186, #187):
  - **#181 (`lib/index.js`)**: Updated server entry `export const name = '@goodandready/dsh-gitea'` to match `package.json` and client bundle registration.
  - **#182 (`lib/index.js`)**: Merged incoming payload with existing configuration in `/dsh-gitea/config` POST handler, preventing partial updates from wiping other `Config` fields.
  - **#183 (`lib/client.js`)**: Bound `settingsScope` in `GiteaSettingsForm`, gating on snapshot status (`loading`, `unavailable`, `ready`) and respecting `writable` status.
  - **#184 (`lib/index.js`, `lib/secrets.js`)**: Replaced plaintext `webhookSecret` in `Config` with `webhookSecretEnv` credential ref with `.role('credential-ref')`. Stripped `webhookSecret` from `/dsh-gitea/config` GET responses.
  - **#185 (`lib/webhook-signature.js`)**: Fixed `verifySignature` to return `false` when secret or signature is empty.
  - **#186 (`lib/issue-templates.js`, `lib/handlers.js`, `lib/index.js`)**: Wired `lib/issue-templates.js` into `gitea_issue_templates` tool in `TOOL_DEFS` and `runHandler`.
  - **#187 (`lib/client.js`)**: Removed `settings.section` sidebar fallback to adhere to DSH plugin slot standards (`settings.plugin.item` only).

## 0.5.0 — 2026-09-03

- Topological Commit Graph & Remote Sync in Chat Chip (#176):
  - Added topological commit graph engine (`lib/graph.js`) with `computeLanes` algorithm for monospace lane visualization (`●`, `◆`, `│`).
  - Added `gitea_git_graph` agent tool and `/dsh-gitea/git-graph` HTTP route with Gitea Actions CI statuses.
  - Enhanced Git status chat chip with live ahead/behind badges (`↑ahead`, `↓behind`) and dirty files count.
  - Interactive Commit Graph Modal with monospace branch/merge lanes, commit links to Gitea Web UI, branch/tag badges, and CI badges.
  - Cross-tab coordination via `navigator.locks` leader election and `BroadcastChannel`, eliminating duplicate network polling.
  - Created `docs/design/DESIGN.md` design contract.

## 0.4.3 — 2026-09-02

- Bugfix suite & stability improvements (#173):
  - `GiteaClient`: added `addIssueLabels` method for adding issue labels via POST `/issues/{number}/labels`
  - Webhooks & push notifications: fixed `deliverDigest` and `push-notify` default `fetch` handler to send JSON payloads via HTTP POST
  - Repository analytics: fixed `pullsMerged` metric to recognize Gitea REST API `merged: true` / `merged_at` closed PR states
  - Policy parser: fixed `parseSimpleYaml` section tracking so `requiredChecks` list items are correctly parsed
  - DoD reminder: removed stateful `/g` flag from module-level regex to ensure reliable, deterministic reminder triggering
  - Tool routing: added `gitea_repo_create_org`, `gitea_repo_bootstrap`, and `gitea_digest_delivery` to `NO_REPO` so they can execute outside a repository context
  - Cross-platform path handling: unified Windows and POSIX path resolution in `session-git` and `gitea-client`
  - Tool output schema: relaxed `OUTPUT_SCHEMA` to allow rich data structures from all 57 tools
  - Local git snapshot: resilient inspection on brand new repositories without commits
  - HTTP retry handler: retry on transient status 0 (network interruptions / timeouts)

## 0.4.2 — 2026-09-02

- Per-branch PR templates (#159)
- Review escalations for stale high-priority PRs (#160)
- Issue sprint planning (#161)
- Forgejo-aware mode (#162)

## 0.4.1 — 2026-09-02

- Auto-rebase PR branch on fresh main (#155)
- Server-side code search across a repo (#156)
- One-command release plan (#157)
- Performance metrics in health report (#158)

All notable changes to dsh-gitea.

## 0.4.0 — 2026-09-01

- Hybrid AI-style PR review (#141)
- Auto-merge gate (#142)
- Push notifications on critical events (#143)
- Public GitHub mirror plan (#144)
- Auto-actions rules (#145)
- Repository analytics (#146)

## 0.3.1 — 2026-08-31

- Repair npm packument (empty from 0.3.0)
- Public scope `@goodandready/dsh-gitea`

## 0.3.0 — 2026-08-31

- First public release
- 3-language README (EN/RU/ZH)
