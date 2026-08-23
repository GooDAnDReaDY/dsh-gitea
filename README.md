# dsh-gitea

Gitea and Forgejo issues, pull requests, and repository search for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness).

Forgejo exposes the same REST API as Gitea (`/api/v1`); this plugin works with both.

## Install

```bash
# From npm (when published):
dsh plugin --profile web add @goodandready/dsh-gitea

# From a local checkout:
dsh plugin --profile web add file:/path/to/dsh-gitea
```

Restart the Web UI, then hard-refresh the browser.

## Configure

Open **Settings -> Gitea**.

- **Instance URL** -- e.g. `https://gitea.example.com` (no trailing slash required).
- **Credential ref name** -- DSH credential that holds the API token (default `GITEA_TOKEN`). The token is stored in the credentials store, not in plugin settings, and is never returned by Settings GET.
- **Default owner** / **Default repo** -- optional fallback when a tool omits `owner`/`repo` (e.g. `owner` / `repo`). Tools can also infer `owner`/`repo` from `git remote origin` in the session working directory.

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
| `gitea_pr_create` | Create a pull request |
| `gitea_pr_list` | List pull requests |
| `gitea_pr_get` | Get a pull request by number |
| `gitea_pr_comment` | Comment on a pull request |
| `gitea_pr_merge` | Merge a pull request |
| `gitea_repo_search` | Search repositories on the configured instance |

**Merge safety:** `gitea_pr_merge` requires `confirm: true` (boolean). Calls without it are rejected.

## Identity

Package: `@goodandready/dsh-gitea`

Repository: https://github.com/GooDAnDReaDY/dsh-gitea

## Verification

```bash
npm test
```
