export const REVIEWS_TOOL_DEFS = [
  {
    name: "gitea_pr_reviews",
    description: "List reviews on a pull request.",
    parameters: {
      number: { type: "number", required: true, description: "Pull request number." },
      limit: { type: "number", description: "Maximum items to return." },
      page: { type: "number", description: "Page number." },
      owner: { type: "string", description: "Repository owner." },
      repo: { type: "string", description: "Repository name." },
    },
  },
  {
    name: "gitea_pr_submit_review",
    description: "Submit a review on a pull request (event: APPROVED, REQUEST_CHANGES, COMMENT, PENDING).",
    parameters: {
      number: { type: "number", required: true, description: "Pull request number." },
      event: { type: "string", required: true, description: "Review event: APPROVED, REQUEST_CHANGES, COMMENT." },
      body: { type: "string", description: "Review comment." },
      owner: { type: "string", description: "Repository owner." },
      repo: { type: "string", description: "Repository name." },
    },
  },
  {
    name: "gitea_pr_review",
    description: "Hybrid AI-style PR review: rule-based diff analysis (risks, areas, tests, migrations, merge status) with verdict and questions. Read-only.",
    parameters: {
      number: { type: "number", required: true, description: "Pull request number." },
      owner: { type: "string", description: "Repository owner." },
      repo: { type: "string", description: "Repository name." },
    },
  },
  {
    name: "gitea_ai_review",
    description: "Automated AI code review for Pull Request: static checks on diff (secrets, path traversal, conventional commits) and structured findings.",
    parameters: {
      pr_number: { type: "integer", required: true, description: "Pull request number." },
      post_comments: { type: "boolean", description: "Publish review as a comment to PR." },
      owner: { type: "string", description: "Repository owner." },
      repo: { type: "string", description: "Repository name." },
    },
  },
  {
    name: "gitea_review_inbox",
    description: "Classify open PRs: awaiting my review, my PRs awaiting review, and merge-ready PRs.",
    parameters: {
      user: { type: "string", required: true, description: "User login to classify against." },
      owner: { type: "string", description: "Repository owner." },
      repo: { type: "string", description: "Repository name." },
    },
  },
  {
    name: "gitea_review_escalate",
    description: "Find high-priority PRs waiting >N days without review; optionally ping reviewers (comment). Dry-run by default; confirm: true writes.",
    parameters: {
      staleDays: { type: "number", description: "Days without review before escalation (default 7)." },
      confirm: { type: "boolean", description: "Set true to post escalation comments." },
      owner: { type: "string", description: "Repository owner." },
      repo: { type: "string", description: "Repository name." },
    },
  },
]
