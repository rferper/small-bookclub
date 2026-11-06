# Agent guardrail hooks

Claude Code [hooks](https://docs.claude.com/en/docs/claude-code/hooks) that run
**before** an agent's tool call and can refuse it. Plain Node 24 scripts: no dependency,
account or key. They read the event JSON on stdin; exit code `2` blocks the call and
prints the reason to the agent, `0` allows it. Malformed input is allowed (fail open),
because a broken hook must not stop all work.

| Hook | Runs on | Blocks |
|---|---|---|
| [`guard-git.mjs`](guard-git.mjs) | `Bash` | `git push` straight to `main`/`master`, force or delete pushes, `git commit --no-verify`/`-n`, `git reset --hard`, `git clean`, and commits that stage `.env`, SQLite databases, keys/certificates or `media/` uploads. |
| [`guard-commit-checks.mjs`](guard-commit-checks.mjs) | `Bash` | `git commit` when the fast check for the staged area fails: `ruff check` for backend Python, `npm run lint` for frontend TypeScript/CSS. |
| [`guard-fixtures.mjs`](guard-fixtures.mjs) | `Write`, `Edit`, `MultiEdit` | Writing real-looking data into test, fixture, seed, demo or mock files: emails on non-reserved domains (use `example.com`), API/GitHub/Slack tokens, private keys, Discord webhook URLs and bot tokens. |

Why the commit hook runs lint and not the whole test suite: the backend suite takes
about two minutes and the frontend suite about one and a half, too slow for every
commit. The full suites still run once before merge (`AGENTS.md`) and in CI.

## Install (project scope)

1. Copy the `hooks` block from [`settings.example.json`](settings.example.json) into
   `.claude/settings.json` (shared) or `.claude/settings.local.json` (just you). Merge
   it with any existing `hooks` key; do not replace the file. Review it first: a hook
   runs shell commands with your user's rights.
2. Run Claude Code from the repository root (the commands use relative paths) with
   Node 24 and the `uv`/`npm` dependencies installed.
3. Check it: ask the agent to run `git push origin main`. It should be refused with
   `BLOCKED by agent-hooks: push to main goes through a pull request`.

## Test

```bash
node --test agent-hooks/hooks.test.mjs
```

Covers every rule with allowed and blocked examples, the exit-code protocol through
real subprocesses, and that the existing repository fixtures contain nothing the
fixture guard would flag. CI runs it in the backend job.

## What the hooks are not

- Not a sandbox. They inspect the command text and the file contents the agent
  submits. A command can be reshaped (a script that calls `git`, a variable holding
  `main`) and a file can be written through a shell redirect, which bypasses the
  fixture guard. The deny list in `.claude/settings.json` and the host's permission
  mode remain the primary authority; hooks add a second, independent check.
- They do not read the owner's database, credentials or private data, and make no
  network calls. See [`docs/permissions.md`](../docs/permissions.md) and
  [`security/agent-security.md`](../security/agent-security.md).
