export const TOOL_DEFS = [
  // ---- Consolidated Facade Tools ----
  {
    name: 'gitea_labels',
    description: 'Manage labels in a repository or issue (list, create, delete, set, add_to_issue).',
    parameters: {
      action: { type: 'string', required: true, description: 'Action: list, create, delete, set, or add_to_issue.' },
      name: { type: 'string', description: 'Label name (create).' },
      color: { type: 'string', description: 'Hex color without # (create).' },
      description: { type: 'string', description: 'Label description (create).' },
      label_id: { type: 'number', description: 'Label id (delete).' },
      number: { type: 'number', description: 'Issue number (set).' },
      labels: { type: 'array', items: { type: 'number' }, description: 'Numeric label ids to assign (set).' },
      limit: { type: 'number', description: 'Maximum items to return (list).' },
      page: { type: 'number', description: 'Page number (list).' },
      owner: { type: 'string', description: 'Repository owner.' },
      repo: { type: 'string', description: 'Repository name.' },
    },
  },
  {
    name: 'gitea_milestones',
    description: 'Manage milestones in a repository (list, create, update, delete).',
    parameters: {
      action: { type: 'string', required: true, description: 'Action: list, create, update, or delete.' },
      title: { type: 'string', description: 'Milestone title (create/update).' },
      description: { type: 'string', description: 'Milestone description (create/update).' },
      due_on: { type: 'string', description: 'Due date in RFC3339 format (create/update).' },
      state: { type: 'string', description: 'Milestone state: open or closed (update).' },
      milestone_id: { type: 'number', description: 'Milestone id (update/delete).' },
      confirm: { type: 'boolean', description: 'Must be true to delete a milestone.' },
      limit: { type: 'number', description: 'Maximum items to return (list).' },
      page: { type: 'number', description: 'Page number (list).' },
      owner: { type: 'string', description: 'Repository owner.' },
      repo: { type: 'string', description: 'Repository name.' },
    },
  },
  {
    name: 'gitea_releases',
    description: 'Manage releases in a repository (list, create, update, delete, plan, notes).',
    parameters: {
      action: { type: 'string', required: true, description: 'Action: list, create, update, delete, plan, or notes.' },
      tag_name: { type: 'string', description: 'Git tag name (create).' },
      name: { type: 'string', description: 'Release name/title (create/update).' },
      body: { type: 'string', description: 'Release body/changelog (create/update).' },
      release_id: { type: 'number', description: 'Release id (update/delete).' },
      confirm: { type: 'boolean', description: 'Must be true to delete a release.' },
      fromTag: { type: 'string', description: 'Base tag for notes preview (notes).' },
      toTag: { type: 'string', description: 'Target tag for notes preview (notes).' },
      limit: { type: 'number', description: 'Maximum items to return (list).' },
      page: { type: 'number', description: 'Page number (list).' },
      owner: { type: 'string', description: 'Repository owner.' },
      repo: { type: 'string', description: 'Repository name.' },
    },
  },
  {
    name: 'gitea_ci',
    description: 'Inspect and manage CI Actions runs and jobs (status, run, jobs, logs, rerun, explain).',
    parameters: {
      action: { type: 'string', required: true, description: 'Action: status, run, jobs, logs, rerun, or explain.' },
      branch: { type: 'string', description: 'Filter runs by branch (status).' },
      sha: { type: 'string', description: 'Filter runs by commit SHA (status).' },
      run_id: { type: 'number', description: 'Actions run id (jobs).' },
      job_id: { type: 'number', description: 'Actions job id (rerun).' },
      confirm: { type: 'boolean', description: 'Must be true to rerun a job.' },
      job: { type: 'object', additionalProperties: true, description: 'Failed job object { id, name, status, log, head_sha } (explain).' },
      limit: { type: 'number', description: 'Maximum items to return (status).' },
      page: { type: 'number', description: 'Page number (status).' },
      owner: { type: 'string', description: 'Repository owner.' },
      repo: { type: 'string', description: 'Repository name.' },
    },
  },
  {
    name: 'gitea_branches',
    description: 'Manage branches in a repository (list, create, delete).',
    parameters: {
      action: { type: 'string', required: true, description: 'Action: list, create, or delete.' },
      branch_name: { type: 'string', description: 'New branch name (create).' },
      branch: { type: 'string', description: 'Branch name to delete (delete).' },
      ref: { type: 'string', description: 'Source ref/commit (create, default main).' },
      confirm: { type: 'boolean', description: 'Must be true to delete a branch.' },
      limit: { type: 'number', description: 'Maximum items to return (list).' },
      page: { type: 'number', description: 'Page number (list).' },
      owner: { type: 'string', description: 'Repository owner.' },
      repo: { type: 'string', description: 'Repository name.' },
    },
  },
  {
    name: 'gitea_tags',
    description: 'Manage tags in a repository (list, create, delete).',
    parameters: {
      action: { type: 'string', required: true, description: 'Action: list, create, or delete.' },
      tag_name: { type: 'string', description: 'New tag name (create).' },
      tag: { type: 'string', description: 'Tag name to delete (delete).' },
      target: { type: 'string', description: 'Target ref or commit SHA (create, default main).' },
      confirm: { type: 'boolean', description: 'Must be true to delete a tag.' },
      limit: { type: 'number', description: 'Maximum items to return (list).' },
      page: { type: 'number', description: 'Page number (list).' },
      owner: { type: 'string', description: 'Repository owner.' },
      repo: { type: 'string', description: 'Repository name.' },
    },
  },
  {
    name: 'gitea_webhooks',
    description: 'Manage webhooks in a repository (list, create, delete).',
    parameters: {
      action: { type: 'string', required: true, description: 'Action: list, create, or delete.' },
      url: { type: 'string', description: 'Webhook target URL (create).' },
      type: { type: 'string', description: 'Webhook type (create, default gitea).' },
      events: { type: 'array', items: { type: 'string' }, description: 'Events to trigger webhook (create).' },
      hook_id: { type: 'number', description: 'Webhook id to delete (delete).' },
      confirm: { type: 'boolean', description: 'Must be true to delete a webhook.' },
      owner: { type: 'string', description: 'Repository owner.' },
      repo: { type: 'string', description: 'Repository name.' },
    },
  },
  {
    name: 'gitea_org',
    description: 'Manage organizations and team repositories (list, repos, members, teams, create_repo).',
    parameters: {
      action: { type: 'string', required: true, description: 'Action: list, repos, members, teams, or create_repo.' },
      org: { type: 'string', description: 'Organization name (required for repos, members, teams, create_repo).' },
      name: { type: 'string', description: 'Repository name (create_repo).' },
      description: { type: 'string', description: 'Repository description (create_repo).' },
      private: { type: 'boolean', description: 'Private repository (create_repo, default true).' },
      limit: { type: 'number', description: 'Maximum items to return.' },
      page: { type: 'number', description: 'Page number.' },
    },
  },
  {
    name: 'gitea_wiki',
    description: 'Manage repository wiki pages (list, get).',
    parameters: {
      action: { type: 'string', required: true, description: 'Action: list or get.' },
      pageName: { type: 'string', description: 'Wiki page title or slug (get).' },
      limit: { type: 'number', description: 'Maximum items to return (list).' },
      page: { type: 'number', description: 'Page number (list).' },
      owner: { type: 'string', description: 'Repository owner.' },
      repo: { type: 'string', description: 'Repository name.' },
    },
  },

  // ---- Issues & Pull Requests ----
  {
    name: 'gitea_issue_create',
    description: 'Create a Gitea/Forgejo issue in a repository.',
    parameters: {
      title: { type: 'string', required: true, description: 'Issue title.' },
      body: { type: 'string', description: 'Issue body.' },
      owner: { type: 'string', description: 'Repository owner.' },
      repo: { type: 'string', description: 'Repository name.' },
    },
  },
  {
    name: 'gitea_issue_list',
    description: 'List Gitea/Forgejo issues in a repository.',
    parameters: {
      state: { type: 'string', description: 'Filter: open, closed, or all.' },
      limit: { type: 'number', description: 'Maximum items to return.' },
      page: { type: 'number', description: 'Page number.' },
      owner: { type: 'string', description: 'Repository owner.' },
      repo: { type: 'string', description: 'Repository name.' },
    },
  },
  {
    name: 'gitea_issue_get',
    description: 'Get a Gitea/Forgejo issue by number, optionally including comments.',
    parameters: {
      number: { type: 'number', required: true, description: 'Issue number.' },
      include_comments: { type: 'boolean', description: 'Whether to fetch issue comments along with the issue details.' },
      owner: { type: 'string', description: 'Repository owner.' },
      repo: { type: 'string', description: 'Repository name.' },
    },
  },
  {
    name: 'gitea_issue_comments',
    description: 'List comments for a Gitea/Forgejo issue.',
    parameters: {
      number: { type: 'number', required: true, description: 'Issue number.' },
      limit: { type: 'number', description: 'Maximum comments to return.' },
      page: { type: 'number', description: 'Page number.' },
      owner: { type: 'string', description: 'Repository owner.' },
      repo: { type: 'string', description: 'Repository name.' },
    },
  },
  {
    name: 'gitea_issue_comment',
    description: 'Add a comment to a Gitea/Forgejo issue.',
    parameters: {
      number: { type: 'number', required: true, description: 'Issue number.' },
      body: { type: 'string', required: true, description: 'Comment text.' },
      owner: { type: 'string', description: 'Repository owner.' },
      repo: { type: 'string', description: 'Repository name.' },
    },
  },
  {
    name: 'gitea_issue_close',
    description: 'Close a Gitea/Forgejo issue.',
    parameters: {
      number: { type: 'number', required: true, description: 'Issue number.' },
      owner: { type: 'string', description: 'Repository owner.' },
      repo: { type: 'string', description: 'Repository name.' },
    },
  },
  {
    name: 'gitea_issue_update',
    description: 'Update a Gitea/Forgejo issue (title, body, state).',
    parameters: {
      number: { type: 'number', required: true, description: 'Issue number.' },
      title: { type: 'string', description: 'New title.' },
      body: { type: 'string', description: 'New body.' },
      state: { type: 'string', description: 'New state: open or closed.' },
      owner: { type: 'string', description: 'Repository owner.' },
      repo: { type: 'string', description: 'Repository name.' },
    },
  },
  {
    name: 'gitea_issue_search',
    description: 'Search issues across the Gitea/Forgejo instance.',
    parameters: {
      q: { type: 'string', required: true, description: 'Search query.' },
      repo: { type: 'string', description: 'Restrict to owner/repo.' },
      state: { type: 'string', description: 'open, closed, or all.' },
      limit: { type: 'number', description: 'Maximum items to return.' },
      page: { type: 'number', description: 'Page number.' },
      type: { type: 'string', description: 'issues or pulls.' },
      labels: { type: 'string', description: 'Comma-separated labels filter.' },
    },
  },
  {
    name: 'gitea_issue_set_assignee',
    description: 'Set the assignee of an issue.',
    parameters: {
      number: { type: 'number', required: true, description: 'Issue number.' },
      assignee: { type: 'string', required: true, description: 'User login to assign.' },
      owner: { type: 'string', description: 'Repository owner.' },
      repo: { type: 'string', description: 'Repository name.' },
    },
  },
  {
    name: 'gitea_issue_lint',
    description: 'Check issue quality before creation: coverage of required sections (problem, impact, priority, DoD, boundaries, dependencies, verification plan). Non-blocking.',
    parameters: {
      title: { type: 'string', required: true, description: 'Issue title (used to detect preset).' },
      body: { type: 'string', required: true, description: 'Issue body text.' },
      preset: { type: 'string', description: 'Preset: bug, feature, or chore. Auto-detected from title when omitted.' },
    },
  },
  {
    name: 'gitea_issue_duplicates',
    description: 'Find likely duplicate issues by title/body similarity (ranked, non-destructive).',
    parameters: {
      title: { type: 'string', required: true, description: 'Proposed issue title.' },
      body: { type: 'string', description: 'Proposed issue body.' },
      threshold: { type: 'number', description: 'Similarity threshold (default 0.3).' },
      owner: { type: 'string', description: 'Repository owner.' },
      repo: { type: 'string', description: 'Repository name.' },
    },
  },
  {
    name: 'gitea_batch_issue_ops',
    description: 'Batch-apply labels/assignee to selected issues. Dry-run by default; set apply: true to commit.',
    parameters: {
      numbers: { type: 'array', items: { type: 'number' }, description: 'Issue numbers to target.' },
      label: { type: 'string', description: 'Label name to set.' },
      assignee: { type: 'string', description: 'Assignee login to set.' },
      apply: { type: 'boolean', description: 'Set true to apply (dry-run otherwise).' },
      owner: { type: 'string', description: 'Repository owner.' },
      repo: { type: 'string', description: 'Repository name.' },
    },
  },
  {
    name: 'gitea_issue_flow',
    description: 'Issue-to-branch-worktree-PR flow: plan a branch name and worktree path for an issue, or create the PR from a head branch.',
    parameters: {
      action: { type: 'string', required: true, description: 'plan or create.' },
      issue: { type: 'number', required: true, description: 'Issue number.' },
      title: { type: 'string', description: 'Issue title (for branch slug).' },
      type: { type: 'string', description: 'Branch type prefix: feat, fix, chore, docs (default feat).' },
      head: { type: 'string', description: 'Head branch (required for create).' },
      base: { type: 'string', description: 'Base branch (default main).' },
      owner: { type: 'string', description: 'Repository owner.' },
      repo: { type: 'string', description: 'Repository name.' },
    },
  },
  {
    name: 'gitea_issue_templates',
    description: 'List and validate standardized Gitea YAML issue templates from .gitea/ISSUE_TEMPLATE/.',
    parameters: {
      dir: { type: 'string', description: 'Optional custom template directory path.' },
    },
  },
  {
    name: 'gitea_pr_create',
    description: 'Create a Gitea/Forgejo pull request.',
    parameters: {
      title: { type: 'string', required: true, description: 'Pull request title.' },
      head: { type: 'string', required: true, description: 'Head branch.' },
      base: { type: 'string', required: true, description: 'Base branch.' },
      body: { type: 'string', description: 'Pull request body.' },
      owner: { type: 'string', description: 'Repository owner.' },
      repo: { type: 'string', description: 'Repository name.' },
    },
  },
  {
    name: 'gitea_pr_list',
    description: 'List Gitea/Forgejo pull requests.',
    parameters: {
      state: { type: 'string', description: 'Filter: open, closed, or all.' },
      limit: { type: 'number', description: 'Maximum items to return.' },
      page: { type: 'number', description: 'Page number.' },
      owner: { type: 'string', description: 'Repository owner.' },
      repo: { type: 'string', description: 'Repository name.' },
    },
  },
  {
    name: 'gitea_pr_get',
    description: 'Get a Gitea/Forgejo pull request by number.',
    parameters: {
      number: { type: 'number', required: true, description: 'Pull request number.' },
      owner: { type: 'string', description: 'Repository owner.' },
      repo: { type: 'string', description: 'Repository name.' },
    },
  },
  {
    name: 'gitea_pr_diff',
    description: 'Get unified diff or summary change statistics of a pull request.',
    parameters: {
      number: { type: 'number', required: true, description: 'Pull request number.' },
      stat: { type: 'boolean', description: 'If true, returns parsed file-level stats (+additions, -deletions, file list) instead of raw text.' },
      owner: { type: 'string', description: 'Repository owner.' },
      repo: { type: 'string', description: 'Repository name.' },
    },
  },
  {
    name: 'gitea_reactions',
    description: 'Manage emoji reactions on issues or comments (list, add, delete).',
    parameters: {
      action: { type: 'string', required: true, description: 'Action: list, add, or delete.' },
      target: { type: 'string', description: 'Target type: issue (default) or comment.' },
      number: { type: 'number', description: 'Issue or PR number (when target=issue).' },
      comment_id: { type: 'number', description: 'Comment ID (when target=comment).' },
      content: { type: 'string', description: 'Reaction emoji name (e.g. +1, -1, laugh, confused, heart, hooray, rocket, eyes).' },
      limit: { type: 'number', description: 'Maximum items to return (list).' },
      page: { type: 'number', description: 'Page number (list).' },
      owner: { type: 'string', description: 'Repository owner.' },
      repo: { type: 'string', description: 'Repository name.' },
    },
  },
  {
    name: 'gitea_issue_timeline',
    description: 'List chronological events, comments, and status transitions on an issue.',
    parameters: {
      number: { type: 'number', required: true, description: 'Issue or PR number.' },
      since: { type: 'string', description: 'Only events updated since this ISO date-time.' },
      before: { type: 'string', description: 'Only events updated before this ISO date-time.' },
      limit: { type: 'number', description: 'Maximum events to return.' },
      page: { type: 'number', description: 'Page number.' },
      owner: { type: 'string', description: 'Repository owner.' },
      repo: { type: 'string', description: 'Repository name.' },
    },
    parameters: {
      number: { type: 'number', required: true, description: 'Pull request number.' },
      owner: { type: 'string', description: 'Repository owner.' },
      repo: { type: 'string', description: 'Repository name.' },
    },
  },
  {
    name: 'gitea_pr_comment',
    description: 'Add a comment to a Gitea/Forgejo pull request.',
    parameters: {
      number: { type: 'number', required: true, description: 'Pull request number.' },
      body: { type: 'string', required: true, description: 'Comment text.' },
      owner: { type: 'string', description: 'Repository owner.' },
      repo: { type: 'string', description: 'Repository name.' },
    },
  },
  {
    name: 'gitea_pr_merge',
    description: 'Merge a Gitea/Forgejo pull request. Requires confirm: true (boolean).',
    parameters: {
      number: { type: 'number', required: true, description: 'Pull request number.' },
      confirm: { type: 'boolean', description: 'Must be true to merge.' },
      Do: { type: 'string', description: 'Merge style: merge, rebase, or squash.' },
      owner: { type: 'string', description: 'Repository owner.' },
      repo: { type: 'string', description: 'Repository name.' },
    },
  },
  {
    name: 'gitea_pr_files',
    description: 'List files changed in a pull request.',
    parameters: {
      number: { type: 'number', required: true, description: 'Pull request number.' },
      limit: { type: 'number', description: 'Maximum items to return.' },
      page: { type: 'number', description: 'Page number.' },
      owner: { type: 'string', description: 'Repository owner.' },
      repo: { type: 'string', description: 'Repository name.' },
    },
  },
  {
    name: 'gitea_pr_reviews',
    description: 'List reviews on a pull request.',
    parameters: {
      number: { type: 'number', required: true, description: 'Pull request number.' },
      limit: { type: 'number', description: 'Maximum items to return.' },
      page: { type: 'number', description: 'Page number.' },
      owner: { type: 'string', description: 'Repository owner.' },
      repo: { type: 'string', description: 'Repository name.' },
    },
  },
  {
    name: 'gitea_pr_submit_review',
    description: 'Submit a review on a pull request (event: APPROVED, REQUEST_CHANGES, COMMENT, PENDING).',
    parameters: {
      number: { type: 'number', required: true, description: 'Pull request number.' },
      event: { type: 'string', required: true, description: 'Review event: APPROVED, REQUEST_CHANGES, COMMENT.' },
      body: { type: 'string', description: 'Review comment.' },
      owner: { type: 'string', description: 'Repository owner.' },
      repo: { type: 'string', description: 'Repository name.' },
    },
  },
  {
    name: 'gitea_pr_line_comment',
    description: 'Add a line comment to a pull request diff.',
    parameters: {
      number: { type: 'number', required: true, description: 'Pull request number.' },
      body: { type: 'string', required: true, description: 'Comment text.' },
      path: { type: 'string', required: true, description: 'File path in the diff.' },
      line: { type: 'number', description: 'Line number in the diff.' },
      owner: { type: 'string', description: 'Repository owner.' },
      repo: { type: 'string', description: 'Repository name.' },
    },
  },
  {
    name: 'gitea_pr_merge_status',
    description: 'Check whether a pull request is mergeable.',
    parameters: {
      number: { type: 'number', required: true, description: 'Pull request number.' },
      owner: { type: 'string', description: 'Repository owner.' },
      repo: { type: 'string', description: 'Repository name.' },
    },
  },
  {
    name: 'gitea_pr_summary',
    description: 'Build a read-only PR change/risk summary: files, areas, tests, migration/security risks, review state, mergeability.',
    parameters: {
      number: { type: 'number', required: true, description: 'Pull request number.' },
      owner: { type: 'string', description: 'Repository owner.' },
      repo: { type: 'string', description: 'Repository name.' },
    },
  },
  {
    name: 'gitea_pr_review',
    description: 'Hybrid AI-style PR review: rule-based diff analysis (risks, areas, tests, migrations, merge status) with verdict and questions. Read-only.',
    parameters: {
      number: { type: 'number', required: true, description: 'Pull request number.' },
      owner: { type: 'string', description: 'Repository owner.' },
      repo: { type: 'string', description: 'Repository name.' },
    },
  },
  {
    name: 'gitea_pr_impact',
    description: 'Build a PR impact map: files, areas, issue references (sourced), author, state. No invented dependencies.',
    parameters: {
      number: { type: 'number', required: true, description: 'Pull request number.' },
      owner: { type: 'string', description: 'Repository owner.' },
      repo: { type: 'string', description: 'Repository name.' },
    },
  },
  {
    name: 'gitea_pr_template_check',
    description: 'Check a PR body against the PR template sections and whether the risk checklist applies.',
    parameters: {
      body: { type: 'string', required: true, description: 'PR body text.' },
      labels: { type: 'array', items: { type: 'string' }, description: 'PR labels for risk detection.' },
    },
  },
  {
    name: 'gitea_pr_policy',
    description: 'Read and validate the repository PR policy (.gitea/pr-policy.yml), optionally evaluate against changed files.',
    parameters: {
      files: { type: 'array', items: { type: 'string' }, description: 'Changed file paths to evaluate.' },
      owner: { type: 'string', description: 'Repository owner.' },
      repo: { type: 'string', description: 'Repository name.' },
    },
  },
  {
    name: 'gitea_auto_merge',
    description: 'Merge a PR automatically when the merge gate is green (description, no conflicts, APPROVED, tests, migrations). Requires confirm: true (boolean).',
    parameters: {
      number: { type: 'number', required: true, description: 'Pull request number.' },
      confirm: { type: 'boolean', description: 'Must be true to actually merge.' },
      owner: { type: 'string', description: 'Repository owner.' },
      repo: { type: 'string', description: 'Repository name.' },
    },
  },
  {
    name: 'gitea_pr_rebase',
    description: 'Auto-rebase a PR branch onto fresh main via git wrapper. Dry-run by default; confirm: true rebases and pushes (conflicts are reported for manual resolution).',
    parameters: {
      number: { type: 'number', required: true, description: 'Pull request number.' },
      confirm: { type: 'boolean', description: 'Set true to actually rebase and push.' },
      branch: { type: 'string', description: 'Local branch name (default: PR head).' },
      owner: { type: 'string', description: 'Repository owner.' },
      repo: { type: 'string', description: 'Repository name.' },
    },
  },
  {
    name: 'gitea_merge_readiness',
    description: 'Check PR merge readiness: description, conflicts, approval, tests, migrations. Never merges.',
    parameters: {
      number: { type: 'number', required: true, description: 'Pull request number.' },
      owner: { type: 'string', description: 'Repository owner.' },
      repo: { type: 'string', description: 'Repository name.' },
    },
  },

  // ---- Workflow, Reviews & Maintenance ----
  {
    name: 'gitea_review_inbox',
    description: 'Classify open PRs: awaiting my review, my PRs awaiting review, and merge-ready PRs.',
    parameters: {
      user: { type: 'string', required: true, description: 'User login to classify against.' },
      owner: { type: 'string', description: 'Repository owner.' },
      repo: { type: 'string', description: 'Repository name.' },
    },
  },
  {
    name: 'gitea_review_escalate',
    description: 'Find high-priority PRs waiting >N days without review; optionally ping reviewers (comment). Dry-run by default; confirm: true writes.',
    parameters: {
      staleDays: { type: 'number', description: 'Days without review before escalation (default 7).' },
      confirm: { type: 'boolean', description: 'Set true to post escalation comments.' },
      owner: { type: 'string', description: 'Repository owner.' },
      repo: { type: 'string', description: 'Repository name.' },
    },
  },
  {
    name: 'gitea_project_health',
    description: 'Build a read-only project health report: open PRs, open/stale issues, stale branches, and API errors.',
    parameters: {
      owner: { type: 'string', description: 'Repository owner.' },
      repo: { type: 'string', description: 'Repository name.' },
      staleDays: { type: 'number', description: 'Stale threshold in days (default 14).' },
    },
  },
  {
    name: 'gitea_triage_digest',
    description: 'Build a daily triage digest: PRs without review, stale issues, stale branches, and a priority action. Read-only.',
    parameters: {
      owner: { type: 'string', description: 'Repository owner.' },
      repo: { type: 'string', description: 'Repository name.' },
      staleDays: { type: 'number', description: 'Stale threshold in days (default 14).' },
    },
  },
  {
    name: 'gitea_duty_report',
    description: 'Repository duty officer: read-only snapshot of new PRs, PRs without review, and stale issues with actions. No writes.',
    parameters: {
      owner: { type: 'string', description: 'Repository owner.' },
      repo: { type: 'string', description: 'Repository name.' },
      lastCheckAt: { type: 'string', description: 'ISO timestamp of the last check (for new-PR detection).' },
      staleDays: { type: 'number', description: 'Stale threshold in days (default 14).' },
    },
  },
  {
    name: 'gitea_label_bootstrap',
    description: 'Idempotently sync the canonical label set into a repository. Dry-run by default; apply: true creates missing labels, never deletes foreign ones.',
    parameters: {
      apply: { type: 'boolean', description: 'Set true to create missing labels (dry-run otherwise).' },
      owner: { type: 'string', description: 'Repository owner.' },
      repo: { type: 'string', description: 'Repository name.' },
    },
  },
  {
    name: 'gitea_label_auto',
    description: 'Label-driven workflow automation: apply rules to an issue by its labels (type/risk/signal) and return preview actions. No writes.',
    parameters: {
      number: { type: 'number', required: true, description: 'Issue number.' },
      owner: { type: 'string', description: 'Repository owner.' },
      repo: { type: 'string', description: 'Repository name.' },
    },
  },
  {
    name: 'gitea_scheduled_checks',
    description: 'Scheduled project checks: list/add/run recurring read-only checks with history. Dry-run by default; no writes without approval.',
    parameters: {
      action: { type: 'string', required: true, description: 'list, add, or run.' },
      name: { type: 'string', description: 'Job name (required for add/run).' },
      schedule: { type: 'string', description: 'hourly, daily, or weekly (default daily).' },
      checkType: { type: 'string', description: 'health, triage, or inbox.' },
      dryRun: { type: 'boolean', description: 'Run without side effects (default true).' },
      owner: { type: 'string', description: 'Repository owner.' },
      repo: { type: 'string', description: 'Repository name.' },
    },
  },
  {
    name: 'gitea_repo_bootstrap',
    description: 'Create a repository from a safe template (README, gitignore, CI, issue/PR templates). Dry-run by default; apply: true creates it.',
    parameters: {
      name: { type: 'string', required: true, description: 'Repository name.' },
      description: { type: 'string', description: 'Repository description.' },
      private: { type: 'boolean', description: 'Private repo (default true).' },
      apply: { type: 'boolean', description: 'Set true to create (dry-run otherwise).' },
    },
  },
  {
    name: 'gitea_repo_analytics',
    description: 'Read-only repository analytics: open/closed issues, PR metrics, average cycle time.',
    parameters: {
      owner: { type: 'string', description: 'Repository owner.' },
      repo: { type: 'string', description: 'Repository name.' },
    },
  },
  {
    name: 'gitea_mirror_public',
    description: 'Prepare a public GitHub mirror plan (sanitize history, push steps). Read-only plan; actual push is a separate step.',
    parameters: {
      source: { type: 'string', description: 'Source (default gitea).' },
      target: { type: 'string', description: 'Target (default github).' },
    },
  },

  // ---- Repository Search & Content ----
  {
    name: 'gitea_repo_search',
    description: 'Search repositories on the configured Gitea/Forgejo instance.',
    parameters: {
      q: { type: 'string', required: true, description: 'Search query.' },
      limit: { type: 'number', description: 'Maximum items to return.' },
    },
  },
  {
    name: 'gitea_code_search',
    description: 'Search code across a Gitea repository (contents) via the Gitea API. Prefer local codegraph/fff MCP when the repo is cloned on this host; use this when the repo lives only in Gitea or you need server-side search.',
    parameters: {
      q: { type: 'string', required: true, description: 'Search query (code content).' },
      branch: { type: 'string', description: 'Branch/ref to search in.' },
      limit: { type: 'number', description: 'Maximum results (default 20).' },
      owner: { type: 'string', description: 'Repository owner.' },
      repo: { type: 'string', description: 'Repository name.' },
    },
  },
  {
    name: 'gitea_repo_contents',
    description: 'Get file or directory contents in a repository.',
    parameters: {
      path: { type: 'string', required: true, description: 'File or directory path.' },
      ref: { type: 'string', description: 'Branch, tag, or commit SHA.' },
      owner: { type: 'string', description: 'Repository owner.' },
      repo: { type: 'string', description: 'Repository name.' },
    },
  },
  {
    name: 'gitea_repo_commits',
    description: 'List commits in a repository.',
    parameters: {
      sha: { type: 'string', description: 'Branch or commit SHA.' },
      limit: { type: 'number', description: 'Maximum items to return.' },
      page: { type: 'number', description: 'Page number.' },
      owner: { type: 'string', description: 'Repository owner.' },
      repo: { type: 'string', description: 'Repository name.' },
    },
  },
  {
    name: 'gitea_repo_compare',
    description: 'Compare two commits/branches in a repository.',
    parameters: {
      range: { type: 'string', required: true, description: 'Range like base...head.' },
      owner: { type: 'string', description: 'Repository owner.' },
      repo: { type: 'string', description: 'Repository name.' },
    },
  },

  // ---- Notifications & Users ----
  {
    name: 'gitea_notifications',
    description: 'List notifications for the authenticated user.',
    parameters: {
      status: { type: 'string', description: 'Filter: unread, read, or all.' },
      limit: { type: 'number', description: 'Maximum items to return.' },
      page: { type: 'number', description: 'Page number.' },
    },
  },
  {
    name: 'gitea_notifications_mark_read',
    description: 'Mark notifications as read. Requires confirm: true (boolean).',
    parameters: {
      confirm: { type: 'boolean', description: 'Must be true to mark read.' },
    },
  },
  {
    name: 'gitea_user_search',
    description: 'Search users on the instance.',
    parameters: {
      q: { type: 'string', required: true, description: 'Search query.' },
      limit: { type: 'number', description: 'Maximum items to return.' },
    },
  },
  {
    name: 'gitea_whoami',
    description: 'Show the Gitea/Forgejo user for the configured API token.',
    parameters: {},
  },
  {
    name: 'gitea_flavor',
    description: 'Detect the instance flavor (gitea/forgejo) via /version and report feature differences.',
    parameters: {},
  },

  // ---- Local Git Tools ----
  {
    name: 'gitea_worktree_list',
    description: 'List git worktrees for the working copy.',
    parameters: {
      path: { type: 'string', description: 'Git working copy. Falls back to the session workspace.' },
    },
  },
  {
    name: 'gitea_worktree_add',
    description: 'Create a git worktree at worktreePath.',
    parameters: {
      worktreePath: { type: 'string', required: true, description: 'Path for the new worktree.' },
      branch: { type: 'string', description: 'Existing branch to check out.' },
      createBranch: { type: 'string', description: 'Create this branch in the new worktree.' },
      path: { type: 'string', description: 'Main working copy. Falls back to the session workspace.' },
    },
  },
  {
    name: 'gitea_worktree_use',
    description: 'Pin this session git header to worktreePath. Does not change Settings.',
    parameters: {
      worktreePath: { type: 'string', required: true, description: 'Worktree path to make current.' },
    },
  },
  {
    name: 'gitea_worktree_remove',
    description: 'Remove a git worktree. Requires confirm: true (boolean).',
    parameters: {
      worktreePath: { type: 'string', required: true, description: 'Worktree path to remove.' },
      confirm: { type: 'boolean', description: 'Must be true to remove.' },
      path: { type: 'string', description: 'Main working copy. Falls back to the session workspace.' },
    },
  },
  {
    name: 'gitea_git_graph',
    description: 'Fetch visual topological Git commit graph with lanes, branch/tag refs, and optional Gitea Actions CI statuses.',
    parameters: {
      limit: { type: 'number', description: 'Maximum commits to return (default 100).' },
      cwd: { type: 'string', description: 'Working directory (defaults to session cwd).' },
      withCiStatus: { type: 'boolean', description: 'Fetch CI status for latest commits from Gitea (default true).' },
      owner: { type: 'string', description: 'Repository owner.' },
      repo: { type: 'string', description: 'Repository name.' },
    },
  },
]

