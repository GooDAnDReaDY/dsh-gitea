# Changelog

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
