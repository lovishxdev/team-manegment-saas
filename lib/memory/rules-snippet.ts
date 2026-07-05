/**
 * The coding-agent contract: a rules block users drop into their repos
 * (.cursor/rules or AGENTS.md) so every agent session consults project
 * memory before working and reflects work back — without depending on any
 * single prompt. Shown in the Memory tab and docs/decision-memory.md.
 */
export const CODING_AGENT_RULES_SNIPPET = `## Euclis project memory

This project uses Euclis (connected via MCP) as its source of truth for
tasks, decisions, and blockers.

- Before starting a task, call \`get_project_context\` with a short
  description of the work (and the task #N if known). It returns the
  relevant decisions and open blockers in a few hundred tokens.
- If a returned blocker affects your work, tell the user before proceeding.
- After completing meaningful work, post a short note via \`add_task_update\`
  (what changed, where).
- When a decision is made during the work (library choice, approach,
  trade-off), record it via \`record_decision\` with the reasoning.
- If your work clears an open blocker, confirm with the user, then call
  \`resolve_blocker\` with the blocker's event id.
`;
