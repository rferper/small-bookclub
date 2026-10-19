# Agent capabilities

Reusable workflows for coding agents working on this repository, as `SKILL.md` files
(a name and description in YAML front matter, then instructions).

| Skill | Use |
|---|---|
| [`issue-loop`](skills/issue-loop/SKILL.md) | Take one GitHub issue from reading to handoff and PR. |
| [`spoiler-gating-check`](skills/spoiler-gating-check/SKILL.md) | Verify spoiler and permission enforcement for any change that exposes review, rating, statistics, meeting or feed data. |

## Global vs project scope

- **Project scope (used here):** skills live in this repository, are reviewed like
  code, and apply to everyone who clones it. To activate them in Claude Code, copy
  or link each skill directory into `.claude/skills/` (for example
  `cp -r agent-capabilities/skills/* .claude/skills/`). They are kept in
  `agent-capabilities/` so the course deliverable is visible and versioned.
- **Global scope:** a skill in `~/.claude/skills/` follows the person across all
  projects. Only generic habits belong there. These two skills name this project's
  files, rules and commands, so they must **not** be installed globally.
- Skills carry instructions only. They add no permissions: tool authority still
  comes from the session's permission mode (see `docs/permissions.md`). Review a
  skill's text before installing it, and never let one request secrets or paid services.

## Parallel work with git worktrees

Several issues can progress at once without sharing a working directory. Each
worktree has its own branch and files but shares one repository history.

```bash
git worktree add ../small-bookclub-issue-85 -b issue-85-agent-skills main
git worktree add ../small-bookclub-issue-86 -b issue-86-subagents main
git worktree list
# work, test and commit inside each directory, one agent per directory
git worktree remove ../small-bookclub-issue-85   # after the PR merges
```

Rules:

- One issue, one branch, one worktree, one agent. Never run two agents in one directory.
- Branch from `main`, or from the branch an issue depends on and say so in the PR.
- Dependencies (`uv sync`, `npm ci`) and the SQLite database are per directory; do
  not point two worktrees at the same database or preview port.
- Worktrees isolate files, not credentials or the host: all agents share the same
  logins and terminal authority (see `security/agent-security.md`).
- Merge conflicts in shared files (`docs/decisions.md`, `openapi.yaml`) are resolved
  by whoever merges second. Keep edits to shared files small and append-only.
- Claude Code can create one for a session with `claude --worktree <name>`; the
  manual commands above work with any agent.
