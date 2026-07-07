## Euclis project memory

This project uses Euclis (connected via MCP) as its source of truth for
tasks, decisions, and blockers.

- Before starting a task, call `get_project_context` with a short
  description of the work (and the task #N if known). It returns the
  relevant decisions and open blockers in a few hundred tokens.
- If a returned blocker affects your work, tell the user before proceeding.
- After completing meaningful work, post a short note via `add_task_update`
  (what changed, where).
- When a decision is made during the work (library choice, approach,
  trade-off), record it via `record_decision` with the reasoning.
- If your work clears an open blocker, confirm with the user, then call
 `resolve_blocker` with the blocker's event id.
- When committing work that belongs to a Euclis task, reference it in the
 commit message (e.g. "(#12)" in the subject) so git history links back
 to the task and its decisions.
