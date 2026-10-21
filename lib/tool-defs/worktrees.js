export const WORKTREES_TOOL_DEFS = [
  {
    name: "gitea_worktree_list",
    description: "List git worktrees for the working copy.",
    parameters: {
      path: { type: "string", description: "Git working copy. Falls back to the session workspace." },
    },
  },
  {
    name: "gitea_worktree_add",
    description: "Create a git worktree at worktreePath.",
    parameters: {
      worktreePath: { type: "string", required: true, description: "Path for the new worktree." },
      branch: { type: "string", description: "Existing branch to check out." },
      createBranch: { type: "string", description: "Create this branch in the new worktree." },
      path: { type: "string", description: "Main working copy. Falls back to the session workspace." },
    },
  },
  {
    name: "gitea_worktree_use",
    description: "Pin this session git header to worktreePath. Does not change Settings.",
    parameters: {
      worktreePath: { type: "string", required: true, description: "Worktree path to make current." },
    },
  },
  {
    name: "gitea_worktree_remove",
    description: "Remove a git worktree. Requires confirm: true (boolean).",
    parameters: {
      worktreePath: { type: "string", required: true, description: "Worktree path to remove." },
      confirm: { type: "boolean", description: "Must be true to remove." },
      path: { type: "string", description: "Main working copy. Falls back to the session workspace." },
    },
  },
  {
    name: "gitea_git_graph",
    description: "Fetch visual topological Git commit graph with lanes, branch/tag refs, and optional Gitea Actions CI statuses.",
    parameters: {
      limit: { type: "number", description: "Maximum commits to return (default 100)." },
      cwd: { type: "string", description: "Working directory (defaults to session cwd)." },
      withCiStatus: { type: "boolean", description: "Fetch CI status for latest commits from Gitea (default true)." },
      owner: { type: "string", description: "Repository owner." },
      repo: { type: "string", description: "Repository name." },
    },
  },
  {
    name: "gitea_worktree_gc",
    description: "Inspect and garbage collect merged or abandoned worktrees safely.",
    parameters: {
      dry_run: { type: "boolean", description: "Simulate GC and return candidates without pruning (default true)." },
      prune: { type: "boolean", description: "Remove verified merged worktrees (requires confirm)." },
      base: { type: "string", description: "Base branch to compare against (default main)." },
      path: { type: "string", description: "Working copy path." },
    },
  },
  {
    name: "gitea_action_card",
    description: "Render an interactive Gitea action card in chat for an issue, pull request, or git branch with quick actions (Open Worktree, Assign, Merge, Commit, Push).",
    parameters: {
      type: { type: "string", enum: ["issue","pr","branch"], required: true, description: "Entity type: issue, pr, or branch." },
      number: { type: "number", description: "Issue or PR number (required for type: issue or pr)." },
      branch: { type: "string", description: "Branch name (for type: branch; defaults to current branch)." },
      owner: { type: "string", description: "Repository owner (defaults to configured defaultOwner)." },
      repo: { type: "string", description: "Repository name (defaults to configured defaultRepo)." },
      cwd: { type: "string", description: "Local repository directory." },
    },
  },
]
