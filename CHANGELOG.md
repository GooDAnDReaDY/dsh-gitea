# Changelog

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
