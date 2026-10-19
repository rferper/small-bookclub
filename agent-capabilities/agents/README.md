# Subagents

Claude Code subagent definitions built from `docs/team/`: `bookclub-pm`, `bookclub-engineer`, `bookclub-qa`, plus the specialist [`spoiler-leak-reviewer`](../../custom-agent/spoiler-leak-reviewer.md). Each file is a thin wrapper: the role text stays in `docs/team/*.md` so there is one source of truth.

Install (project scope): copy the files into `.claude/agents/`, e.g.
`cp agent-capabilities/agents/*.md custom-agent/*.md .claude/agents/` (skip this README).

## Orchestrator wiring

The default flow is one implementer (`docs/process.md`). In the full-loop fallback the orchestrator runs, per issue:

1. `bookclub-pm` grooms the issue.
2. `bookclub-engineer` implements it on `issue-<n>-<slug>` and posts `## Implementation`.
3. `spoiler-leak-reviewer` runs when authentication, permissions or spoilers are touched.
4. `bookclub-qa` posts `## QA: PASS` or `## QA: FAIL`; a FAIL returns to step 2 (three FAILs go to the owner).
5. Only the orchestrator merges and closes.

Tool lists are least-privilege: PM and QA cannot edit files, the reviewer is read-only. Subagents share the host's credentials and shell, so these lists limit mistakes but are not a sandbox (see `security/agent-security.md`).
