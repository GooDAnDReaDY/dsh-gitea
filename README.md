# dsh-gitea

Gitea and Forgejo issues, pull requests, repository search, git worktrees, and a git chip in the chat header for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness).

Forgejo exposes the same REST API as Gitea (`/api/v1`); this plugin works with both.

## What you get

- **Issues & PRs** — create, read, comment, close, update, search, labels, milestones, assignees, reviews, line comments, merge (with `confirm`).
- **Repo operations** — contents, branches, commits, compare, tags, releases, wiki, org repos/members/teams, webhooks.
- **CI** — Gitea Actions runs, jobs, rerun (with `confirm`), failure explainer.
- **Operations** — project health, daily triage digest, PR review inbox, merge-readiness gate, release notes, duplicate detection, batch ops, duty officer, label-driven automation, scheduled checks, digest delivery.
- **UX** — git chip in the chat header (branch, dirty state, open PR, failed CI) and a Gitea events panel fed by a webhook.

## Install

```bash
# From npm (when published):
dsh plugin --profile web add @goodandready-private/dsh-gitea

# From a local checkout:
dsh plugin --profile web add a temporary package artifact
```

Restart the Web UI, then hard-refresh the browser.

## Quick start

1. Open **Settings -> Plugins**, expand the **Gitea** card.
2. Set **Instance URL** (e.g. `https://gitea.example.com`).
3. Create a DSH credential named `GITEA_TOKEN` with your Gitea API token (repository + issues scopes), and type only the credential name.
4. Save — the plugin is ready. Tools infer `owner`/`repo` from the session's `git remote origin`, or take them explicitly.

## Safety model

- **Write operations require `confirm: true`**: merge, worktree/branch/tag/webhook/milestone/release delete, notifications mark-read, CI rerun.
- **Dry-run by default** for batch ops, bootstrap, scheduled checks, digest delivery.
- **Background scheduler** (`bgSchedulerEnabled`, default off; `bgSchedulerIntervalMin`,
  `bgSchedulerOwner/Repo`, `bgSchedulerWebhook`) — periodically runs the daily triage
  digest in the host process and optionally delivers it to a webhook. Never session-local.
- **`gitWrapper`** — worktree write operations go through the `git-<agent>` wrapper or are refused; read stays on bare git.
- **Secrets never leave the credentials store** — Settings keeps only the credential name.
- **Retry with backoff** on transient HTTP 429/5xx.

## Configure

Open **Settings -> Plugins** and expand the **Gitea** card.

- **Instances** (optional) — additional Gitea/Forgejo instances as a list of
  `{ name, baseUrl, tokenEnv }`. Tools accept an `instance` parameter to select
  one; when omitted they use the primary (baseUrl/tokenEnv).
- **Instance URL** -- e.g. `https://gitea.example.com` (no trailing slash required).
- **Credential name** -- name of a DSH credential that already holds the API token (default `GITEA_TOKEN`). Type the name, never the token. The token stays in the credentials store and is never returned by Settings GET.
- **DoD reminder** (`dodReminder`, default off) — after a tool run that changed git files, remind if no issue/PR reference was made. Never blocks.
- **Git wrapper** (`gitWrapper`) -- binary used for write operations (`gitea_worktree_add`, `gitea_worktree_remove`), e.g. `git-deepseek-harness`. Default empty: write operations are **disabled** and return a clear error. Read operations (status, worktree list, origin) always use bare `git`. This keeps the Gitea agent identity: write operations must go through the `git-<agent>` wrapper, never bare `git`.

Tools take `owner`/`repo` on each call. If omitted, they infer from `git remote origin` of the current session workspace. Settings does not pick a repository.

#Push notifications: set `notifyWebhook` to receive immediate delivery on
critical events (new PR opened, CI failed) — in addition to the events panel.

Webhook verification: if `webhookSecret` is set, the `/dsh-gitea/webhook`
endpoint requires a valid `X-Gitea-Signature` (HMAC-SHA256) header — set the
same secret in Gitea's webhook settings. Empty secret disables verification.

## Gitea events panel

`dsh-gitea` exposes a webhook endpoint (`POST /dsh-gitea/webhook`, expects
`X-Gitea-Event` header). In Gitea: Settings → Webhooks → Add Webhook with
type `gitea`, URL `<your-dsh-origin>/dsh-gitea/webhook`, and events such as
`pull_request` (opened) and `workflow_run` (conclusion). The last 50 events
are shown in the plugin Settings card (Gitea events), refreshed every 5s.

## API token

Create a personal access token on your instance with **repository** and **issues** scopes. Add it as a DSH credential using the ref name from Settings (default `GITEA_TOKEN`).

## Tools

| Tool | Purpose |
|------|---------|
| `gitea_issue_create` | Create an issue |
| `gitea_issue_list` | List issues |
| `gitea_issue_get` | Get an issue by number |
| `gitea_issue_comment` | Comment on an issue |
| `gitea_issue_close` | Close an issue |
| `gitea_issue_update` | Update an issue (title, body, state) |
| `gitea_issue_search` | Search issues across the instance |
| `gitea_issue_set_labels` | Replace labels on an issue |
| `gitea_issue_set_assignee` | Set the assignee of an issue |
| `gitea_issue_lint` | Check issue quality (non-blocking) before creation |
| `gitea_label_list` | List repository labels |
| `gitea_label_create` | Create a label |
| `gitea_label_delete` | Delete a label |
| `gitea_milestone_list` | List milestones |
| `gitea_milestone_create` | Create a milestone |
| `gitea_pr_create` | Create a pull request |
| `gitea_pr_list` | List pull requests |
| `gitea_pr_get` | Get a pull request by number |
| `gitea_pr_comment` | Comment on a pull request |
| `gitea_pr_merge` | Merge a pull request |
| `gitea_pr_files` | List files changed in a PR |
| `gitea_pr_reviews` | List PR reviews |
| `gitea_pr_submit_review` | Submit a review (APPROVED / REQUEST_CHANGES / COMMENT) |
| `gitea_pr_line_comment` | Add a line comment to a PR diff |
| `gitea_pr_merge_status` | Check whether a PR is mergeable |
| `gitea_repo_search` | Search repositories on the configured instance |
| `gitea_repo_contents` | Get file/directory contents |
| `gitea_repo_branches` | List branches |
| `gitea_repo_commits` | List commits |
| `gitea_repo_compare` | Compare two commits/branches |
| `gitea_repo_tags` | List tags |
| `gitea_release_list` | List releases |
| `gitea_release_create` | Create a release |
| `gitea_release_delete` | Delete a release (`confirm: true`) |
| `gitea_wiki_pages` | List wiki pages |
| `gitea_org_repos` | List org repositories |
| `gitea_notifications` | List notifications |
| `gitea_project_health` | Read-only project health report (PRs, stale issues, branches) |
| `gitea_review_inbox` | Classify PRs: awaiting my review / awaiting theirs / merge-ready |
| `gitea_ci_explain` | Extract first error from a failed CI job log (capped) |
| `gitea_auto_merge` | Auto-merge when gate green (`confirm: true`) |
| `gitea_pr_review` | Hybrid AI-style PR review (rules + verdict/questions) |
| `gitea_pr_summary` | Read-only PR change/risk summary |
| `gitea_issue_duplicates` | Find likely duplicate issues (ranked, non-destructive) |
| `gitea_batch_issue_ops` | Batch labels/assignee with dry-run preview (`apply: true` to commit) |
| `gitea_merge_readiness` | PR merge-readiness checks (never merges) |
| `gitea_release_notes` | Release notes from merged PRs + semver bump (preview only) |
| `gitea_triage_digest` | Daily triage: PRs without review, stale issues/branches, priority action |
| `gitea_dep_watch` | Dependency/security scan (read-only, no updates/issues) |
| `gitea_pr_policy` | Read/validate repo PR policy + evaluate changed files |
| `gitea_pr_impact` | PR impact map: files, areas, issue refs (sourced) |
| `gitea_scheduled_checks` | Recurring read-only checks (list/add/run, dry-run default) |
| `gitea_digest_delivery` | Deliver digest to webhook (dry-run default, audit log) |
| `gitea_label_bootstrap` | Sync canonical label set (dry-run default, apply: true) |
| `gitea_pr_template_check` | Check PR body vs template + risk checklist |
| `gitea_issue_flow` | Issue → branch/worktree/PR flow (plan + create) |
| `gitea_repo_bootstrap` | Create repo from template (dry-run default, apply: true) |
| `gitea_duty_report` | Duty officer: read-only repo snapshot + actions |
| `gitea_label_auto` | Label-driven workflow rules (preview actions) |
| `gitea_org_members` | List organization members |
| `gitea_notifications_mark_read` | Mark notifications read (`confirm: true`) |
| `gitea_ci_status` | List Gitea Actions runs (status/URL) |
| `gitea_ci_jobs` | List jobs of an Actions run |
| `gitea_repo_create_org` | Create repo in an org |
| `gitea_repo_branch_create` / `gitea_repo_branch_delete` | Create/delete branch (delete requires confirm) |
| `gitea_repo_tag_create` / `gitea_repo_tag_delete` | Create/delete tag (delete requires confirm) |
| `gitea_milestone_update` / `gitea_milestone_delete` | Update/close/delete milestone (delete requires confirm) |
| `gitea_wiki_page` | Get wiki page content |
| `gitea_release_update` | Update a release |
| `gitea_webhook_list` / `gitea_webhook_create` / `gitea_webhook_delete` | Manage repo webhooks (delete requires confirm) |
| `gitea_ci_rerun` | Rerun failed Actions job (`confirm: true`) |
| `gitea_user_search` / `gitea_org_list` / `gitea_org_teams` | User/org/teams discovery |
| `gitea_whoami` | Show the user for the configured token |
| `gitea_worktree_list` | List git worktrees |
| `gitea_worktree_add` | Create a git worktree |
| `gitea_worktree_use` | Make a worktree the current working copy |
| `gitea_worktree_remove` | Remove a worktree (`confirm: true`) |

**Merge safety:** `gitea_pr_merge` requires `confirm: true` (boolean). Calls without it are rejected.

**Worktree safety:** `gitea_worktree_remove` also requires `confirm: true`.

## Issue templates

The package ships a Gitea issue template pack under `.gitea/ISSUE_TEMPLATE/`:

| File | Purpose | Starter labels |
|------|---------|----------------|
| `bug.yaml` | Bug report | type/bug, status/ready |
| `feature.yaml` | Feature request | type/feature, status/ready |
| `security.yaml` | Security issue | type/security, priority/high, scope/security |
| `research.yaml` | Research / spike | type/research, status/ready |
| `tech-debt.yaml` | Tech debt | type/tech-debt, status/ready |
| `incident.yaml` | Incident | type/incident, priority/critical |
| `config-change.yaml` | Config change | type/refactor, scope/settings, status/ready |

Templates follow the Gitea YAML form format (name, about, labels, body). They
suggest starter labels (including `priority/*`, `type/*`, `status/*`) but never
write them automatically — the creator confirms. Validation helpers live in
`lib/issue-templates.js` with tests in `test/issue-templates.test.mjs`.

The chat header chip is a git status for this conversation: repository, branch, whether the tree is clean, recent commits, uncommitted diff, plus the open PR for the current branch and failed CI for the current SHA (when Gitea is configured). It follows the git folder this chat actually used. Click the chip to open the panel. There is no repository picker in Settings.

## Identity

Package: `@goodandready-private/dsh-gitea`

Repository: https://github.com/goodandready-private/dsh-gitea

The HTTP client retries transient failures (HTTP 429/5xx) with exponential
backoff (default 1 retry, 300ms base). Configurable per instance if needed.

## E2E against a real Gitea

Run the smoke e2e (whoami, create/get/comment/close issue) against a real
instance by setting env vars — skipped when unset:

```bash
GITEA_TEST_URL=https://gitea.example.com GITEA_TEST_TOKEN=<token> \
GITEA_TEST_OWNER=owner GITEA_TEST_REPO=repo npm test
```

Set `GITEA_TEST_NAME=forgejo` to label the run (the client uses the same
`/api/v1`; the smoke is compatible with both Gitea and Forgejo).

## Verification

```bash
npm test
```
