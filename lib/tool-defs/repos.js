export const REPOS_TOOL_DEFS = [
  {
    name: "gitea_branches",
    description: "Manage branches in a repository (list, create, delete).",
    parameters: {
      action: { type: "string", required: true, description: "Action: list, create, or delete." },
      branch_name: { type: "string", description: "New branch name (create)." },
      new_branch_name: { type: "string", description: "Alias for branch_name (create)." },
      branch: { type: "string", description: "Branch name to delete (delete)." },
      ref: { type: "string", description: "Source ref/commit (create, default main)." },
      old_ref_name: { type: "string", description: "Alias for ref (create)." },
      confirm: { type: "boolean", description: "Must be true to delete a branch." },
      limit: { type: "number", description: "Maximum items to return (list)." },
      page: { type: "number", description: "Page number (list)." },
      owner: { type: "string", description: "Repository owner." },
      repo: { type: "string", description: "Repository name." },
    },
  },
  {
    name: "gitea_tags",
    description: "Manage tags in a repository (list, create, delete).",
    parameters: {
      action: { type: "string", required: true, description: "Action: list, create, or delete." },
      tag_name: { type: "string", description: "New tag name (create)." },
      tag: { type: "string", description: "Tag name to delete (delete)." },
      target: { type: "string", description: "Target ref or commit SHA (create, default main)." },
      confirm: { type: "boolean", description: "Must be true to delete a tag." },
      limit: { type: "number", description: "Maximum items to return (list)." },
      page: { type: "number", description: "Page number (list)." },
      owner: { type: "string", description: "Repository owner." },
      repo: { type: "string", description: "Repository name." },
    },
  },
  {
    name: "gitea_webhooks",
    description: "Manage webhooks in a repository (list, create, delete).",
    parameters: {
      action: { type: "string", required: true, description: "Action: list, create, or delete." },
      url: { type: "string", description: "Webhook target URL (create)." },
      type: { type: "string", description: "Webhook type (create, default gitea)." },
      events: { type: "array", items: {"type":"string"}, description: "Events to trigger webhook (create)." },
      hook_id: { type: "number", description: "Webhook id to delete (delete)." },
      confirm: { type: "boolean", description: "Must be true to delete a webhook." },
      owner: { type: "string", description: "Repository owner." },
      repo: { type: "string", description: "Repository name." },
    },
  },
  {
    name: "gitea_org",
    description: "Manage organizations and team repositories (list, repos, members, teams, create_repo).",
    parameters: {
      action: { type: "string", required: true, description: "Action: list, repos, members, teams, or create_repo." },
      org: { type: "string", description: "Organization name (required for repos, members, teams, create_repo)." },
      name: { type: "string", description: "Repository name (create_repo)." },
      description: { type: "string", description: "Repository description (create_repo)." },
      private: { type: "boolean", description: "Private repository (create_repo, default true)." },
      confirm: { type: "boolean", description: "Confirm creation of repository when action=create_repo (dry-run preview otherwise)." },
      limit: { type: "number", description: "Maximum items to return." },
      page: { type: "number", description: "Page number." },
    },
  },
  {
    name: "gitea_wiki",
    description: "Manage repository wiki pages (list, get).",
    parameters: {
      action: { type: "string", required: true, description: "Action: list or get." },
      pageName: { type: "string", description: "Wiki page title or slug (get)." },
      limit: { type: "number", description: "Maximum items to return (list)." },
      page: { type: "number", description: "Page number (list)." },
      owner: { type: "string", description: "Repository owner." },
      repo: { type: "string", description: "Repository name." },
    },
  },
  {
    name: "gitea_project_health",
    description: "Build a read-only project health report: open PRs, open/stale issues, stale branches, and API errors.",
    parameters: {
      owner: { type: "string", description: "Repository owner." },
      repo: { type: "string", description: "Repository name." },
      staleDays: { type: "number", description: "Stale threshold in days (default 14)." },
    },
  },
  {
    name: "gitea_triage_digest",
    description: "Build a daily triage digest: PRs without review, stale issues, stale branches, and a priority action. Read-only.",
    parameters: {
      owner: { type: "string", description: "Repository owner." },
      repo: { type: "string", description: "Repository name." },
      staleDays: { type: "number", description: "Stale threshold in days (default 14)." },
    },
  },
  {
    name: "gitea_duty_report",
    description: "Repository duty officer: read-only snapshot of new PRs, PRs without review, and stale issues with actions. No writes.",
    parameters: {
      owner: { type: "string", description: "Repository owner." },
      repo: { type: "string", description: "Repository name." },
      lastCheckAt: { type: "string", description: "ISO timestamp of the last check (for new-PR detection)." },
      staleDays: { type: "number", description: "Stale threshold in days (default 14)." },
    },
  },
  {
    name: "gitea_scheduled_checks",
    description: "Scheduled project checks: list/add/run recurring read-only checks with history. Dry-run by default; no writes without approval.",
    parameters: {
      action: { type: "string", required: true, description: "list, add, or run." },
      name: { type: "string", description: "Job name (required for add/run)." },
      schedule: { type: "string", description: "hourly, daily, or weekly (default daily)." },
      checkType: { type: "string", description: "health, triage, or inbox." },
      dryRun: { type: "boolean", description: "Run without side effects (default true)." },
      owner: { type: "string", description: "Repository owner." },
      repo: { type: "string", description: "Repository name." },
    },
  },
  {
    name: "gitea_repo_bootstrap",
    description: "Create a repository from a safe template (README, gitignore, CI, issue/PR templates). Dry-run by default; apply: true creates it.",
    parameters: {
      name: { type: "string", required: true, description: "Repository name." },
      description: { type: "string", description: "Repository description." },
      private: { type: "boolean", description: "Private repo (default true)." },
      apply: { type: "boolean", description: "Set true to create (dry-run otherwise)." },
    },
  },
  {
    name: "gitea_repo_analytics",
    description: "Read-only repository analytics: open/closed issues, PR metrics, average cycle time.",
    parameters: {
      owner: { type: "string", description: "Repository owner." },
      repo: { type: "string", description: "Repository name." },
    },
  },
  {
    name: "gitea_mirror_public",
    description: "Prepare a public GitHub mirror plan (sanitize history, push steps). Read-only plan; actual push is a separate step.",
    parameters: {
      source: { type: "string", description: "Source (default gitea)." },
      target: { type: "string", description: "Target (default github)." },
    },
  },
  {
    name: "gitea_repo_search",
    description: "Search repositories on the configured Gitea/Forgejo instance.",
    parameters: {
      q: { type: "string", required: true, description: "Search query." },
      limit: { type: "number", description: "Maximum items to return." },
    },
  },
  {
    name: "gitea_code_search",
    description: "Search code locally via git grep when in a repository workspace. Note: Gitea REST API does not provide a remote code search endpoint; server-side search is not supported by Gitea Swagger v1.",
    parameters: {
      q: { type: "string", required: true, description: "Search query (code content)." },
      branch: { type: "string", description: "Branch/ref to search in." },
      limit: { type: "number", description: "Maximum results (default 20)." },
      cwd: { type: "string", description: "Working directory of git repository to search in." },
      owner: { type: "string", description: "Repository owner." },
      repo: { type: "string", description: "Repository name." },
    },
  },
  {
    name: "gitea_repo_contents",
    description: "Get file or directory contents in a repository.",
    parameters: {
      path: { type: "string", required: true, description: "File or directory path." },
      ref: { type: "string", description: "Branch, tag, or commit SHA." },
      owner: { type: "string", description: "Repository owner." },
      repo: { type: "string", description: "Repository name." },
    },
  },
  {
    name: "gitea_repo_commits",
    description: "List commits in a repository.",
    parameters: {
      sha: { type: "string", description: "Branch or commit SHA." },
      limit: { type: "number", description: "Maximum items to return." },
      page: { type: "number", description: "Page number." },
      owner: { type: "string", description: "Repository owner." },
      repo: { type: "string", description: "Repository name." },
    },
  },
  {
    name: "gitea_repo_compare",
    description: "Compare two commits/branches in a repository.",
    parameters: {
      range: { type: "string", required: true, description: "Range like base...head." },
      owner: { type: "string", description: "Repository owner." },
      repo: { type: "string", description: "Repository name." },
    },
  },
  {
    name: "gitea_notifications",
    description: "List notifications for the authenticated user.",
    parameters: {
      status: { type: "string", description: "Filter: unread, read, or all." },
      limit: { type: "number", description: "Maximum items to return." },
      page: { type: "number", description: "Page number." },
    },
  },
  {
    name: "gitea_notifications_mark_read",
    description: "Mark notifications as read. Requires confirm: true (boolean).",
    parameters: {
      confirm: { type: "boolean", description: "Must be true to mark read." },
    },
  },
  {
    name: "gitea_user_search",
    description: "Search users on the instance.",
    parameters: {
      q: { type: "string", required: true, description: "Search query." },
      limit: { type: "number", description: "Maximum items to return." },
    },
  },
  {
    name: "gitea_whoami",
    description: "Show the Gitea/Forgejo user for the configured API token.",
    parameters: {
    },
  },
  {
    name: "gitea_flavor",
    description: "Detect the instance flavor (gitea/forgejo) via /version and report feature differences.",
    parameters: {
    },
  },
]
