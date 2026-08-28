# dsh-gitea

Gitea and Forgejo issues, pull requests, repository search, git worktrees, and a git chip in the chat header for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness).

Forgejo exposes the same REST API as Gitea (`/api/v1`); this plugin works with both.

## Install

```bash
# From npm (when published):
dsh plugin --profile web add @@goodandready/dsh-gitea

# From a local checkout:
dsh plugin --profile web add a temporary package artifact
```

Restart the Web UI, then hard-refresh the browser.

## Configure

Open **Settings -> Plugins** and expand the **Gitea** card.

- **Instance URL** -- e.g. `https://gitea.example.com` (no trailing slash required).
- **Credential name** -- name of a DSH credential that already holds the API token (default `GITEA_TOKEN`). Type the name, never the token. The token stays in the credentials store and is never returned by Settings GET.
- **Git wrapper** (`gitWrapper`) -- binary used for write operations (`gitea_worktree_add`, `gitea_worktree_remove`), e.g. `git-deepseek-harness`. Default empty: write operations are **disabled** and return a clear error. Read operations (status, worktree list, origin) always use bare `git`. This keeps the Gitea agent identity: write operations must go through the `git-<agent>` wrapper, never bare `git`.

Tools take `owner`/`repo` on each call. If omitted, they infer from `git remote origin` of the current session workspace. Settings does not pick a repository.

### API token

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
| `gitea_repo_search` | Search repositories on the configured instance |
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

The chat header chip is a git status for this conversation: repository, branch, whether the tree is clean, recent commits, and uncommitted diff. It follows the git folder this chat actually used. Click the chip to open the panel. There is no repository picker in Settings.

## Identity

Package: `@@goodandready/dsh-gitea`

Repository: https://github.com/@goodandready/dsh-gitea

## Verification

```bash
npm test
```
