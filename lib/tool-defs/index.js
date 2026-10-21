import { ISSUES_TOOL_DEFS } from './issues.js'
import { PRS_TOOL_DEFS } from './prs.js'
import { REVIEWS_TOOL_DEFS } from './reviews.js'
import { REPOS_TOOL_DEFS } from './repos.js'
import { WORKTREES_TOOL_DEFS } from './worktrees.js'
import { RELEASES_TOOL_DEFS } from './releases.js'

export const TOOL_DEFS = [
  ...ISSUES_TOOL_DEFS,
  ...PRS_TOOL_DEFS,
  ...REVIEWS_TOOL_DEFS,
  ...REPOS_TOOL_DEFS,
  ...WORKTREES_TOOL_DEFS,
  ...RELEASES_TOOL_DEFS,
]

// #286: Ensure multi-instance parameter is declared across all tools
for (const def of TOOL_DEFS) {
  if (def.parameters && !def.parameters.instance) {
    def.parameters.instance = {
      type: 'string',
      description: 'Gitea instance identifier (for multi-instance setups).',
    }
  }
}
