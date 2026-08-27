# dsh-gitea v1 — Design (A only)

Date: 2026-08-23
Status: approved
Package: `@goodandready-private/dsh-gitea`
Catalog category: `git`

## Goal

A publishable DeepSeek Harness plugin that lets the agent work with a
self-hosted Gitea or Forgejo instance: issues, pull requests, repo search.
One instance URL + a token via DSH credentials. No MiniAI workflow, no
Definition-of-Done hook, no git UI in the chat chrome.

## Publication stance

Shaped for later GitHub + npm (`@goodandready-private/dsh-gitea`). This iteration
does not create a GitHub repo, does not npm publish, and does not copy to
RELEASE. Install the temporary package artifact on the isolated test server.

No MiniAI hosts, paths, org names, or tokens in code, README, or examples.

## In scope (A)

Issues: gitea_issue_create, list, get, comment, close.
PRs: gitea_pr_create, list, get, comment, merge (confirm: true required).
Repos: gitea_repo_search.
Settings: instance URL, credential ref, optional default owner/repo.
Repo resolution: tool args, then settings, then git origin.
Forgejo uses the same /api/v1 client.

## Out of scope

DoD hook, worktrees-as-product, Kanban, deploy, Device Flow, branch graph,
diff viewer, Actions mirror, git clone/push, multi-instance, PR review-line
comments.
