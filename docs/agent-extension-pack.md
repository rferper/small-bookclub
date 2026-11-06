# Agent extension pack

Everything in this repository that extends a coding agent, what each piece does, how
to install it and what it may do. Authority and limits are in
[`permissions.md`](permissions.md#agent-extension-pack-permissions); the audited
inventory is [`security/agent-inventory.json`](../security/agent-inventory.json).

| Piece | Where | Purpose | Install |
|---|---|---|---|
| Project rules | [`AGENTS.md`](../AGENTS.md) (imported by `CLAUDE.md`) | Stack, commands, rules and which doc to read when. | Loaded automatically. |
| Process and roles | [`docs/process.md`](process.md), [`docs/team/`](team/) | One implementer by default; PM → engineer → QA as fallback. | Read by agents. |
| Skills | [`agent-capabilities/skills/`](../agent-capabilities/skills/) | `issue-loop` (issue to handoff and PR), `spoiler-gating-check` (spoiler/permission review). | `cp -r agent-capabilities/skills/* .claude/skills/` |
| Subagents | [`agent-capabilities/agents/`](../agent-capabilities/agents/README.md), [`custom-agent/`](../custom-agent/spoiler-leak-reviewer.md) | `bookclub-pm`, `bookclub-engineer`, `bookclub-qa`, read-only `spoiler-leak-reviewer`. | `cp agent-capabilities/agents/*.md custom-agent/*.md .claude/agents/` (skip the README) |
| MCP server | [`mcp-server/`](../mcp-server/README.md) | Read-only tools: `list_api_operations`, `read_project_rules`, `demo_health`. | `claude mcp add --scope project small-bookclub -- node mcp-server/server.mjs` |
| Guardrail hooks | [`agent-hooks/`](../agent-hooks/README.md) | Refuse risky git commands, failing fast checks on commit, and real data in fixtures. | Merge [`settings.example.json`](../agent-hooks/settings.example.json) into `.claude/settings*.json`. |
| Permission rules | `.claude/settings.local.json` (per machine, not committed) | Allow routine read/git/test commands; deny force push, hard reset, clean, repo/issue deletion. | Copy the `permissions` block from your own settings. |
| Worktrees | [`agent-capabilities/README.md`](../agent-capabilities/README.md#parallel-work-with-git-worktrees) | Parallel issues in separate directories. | `git worktree add ../<dir> -b <branch> main` |

## Installing everything

From the repository root, with Node 24, `uv` and `npm` available:

```bash
mkdir -p .claude/skills .claude/agents
cp -r agent-capabilities/skills/* .claude/skills/
cp agent-capabilities/agents/pm.md agent-capabilities/agents/software-engineer.md \
   agent-capabilities/agents/qa-engineer.md custom-agent/spoiler-leak-reviewer.md .claude/agents/
claude mcp add --scope project small-bookclub -- node mcp-server/server.mjs
# then merge the hooks block from agent-hooks/settings.example.json into .claude/settings.json
```

Review each file before installing: skills and agents are instructions, MCP servers and
hooks are programs that run with your user's rights.

## How the pieces fit

1. `AGENTS.md` and the `issue-loop` skill tell an agent how to take one issue.
2. Hooks stop the mistakes that are cheap to detect (push to `main`, skipped checks,
   secrets or real data committed) before they happen.
3. Subagents split roles when the full loop is used; the reviewer is read-only.
4. The MCP server gives agents the API surface and rules without them parsing files.
5. CI re-checks everything on the pull request; hooks and permissions are a first line,
   never the only one.

## Verifying the pack

```bash
node --test agent-hooks/hooks.test.mjs mcp-server/server.test.mjs
```

## Limits

No piece is a sandbox: all of them run in the same shell with the same credentials.
They reduce mistakes; they do not contain a hostile or confused agent. Known gaps are
listed in [`security/agent-security.md`](../security/agent-security.md).
