# Permissions

Two kinds: [backend permissions](#backend-permissions) (what site users may see and do) and [agent extension pack permissions](#agent-extension-pack-permissions) (what coding-agent tooling may do).

## Backend permissions

`backend/users/access.py` owns pure permission decisions for the section 3 matrix.
Use `is_admin`, `is_current_curator`, `can_edit_profile`, `can_edit_review`,
`can_manage_vote`, `can_view_reviews`, or `permission_refusal` instead of ad-hoc
role checks. Effective membership means a current, persisted, authenticated,
approved user with no revocation time. Curator is a current assignment, not a role.

IDs and completion facts passed to these helpers must come from server state.
Convert route resource IDs at the service boundary, look up the resource, then use
its stored owner ID; never accept an ownership or curator claim from request data.
Own-action APIs derive their owner solely from the session and reject submitted
ownership keys, even when they match the current user. Admin cannot implicitly edit
another profile/review or bypass rating spoilers. Review visibility for every book
requires both personal completion and the viewer's own submitted complete rating.
Tie-winner writes are admin-only under the current API contract.

`@require_permission(action, context=...)` guards tuple-returning Django Ninja
services. It refreshes the identity before executing the optional context callback
or handler. Membership denial is 401; insufficient authority is 403. Admin-only
denial occurs before the context callback. A context callback supplies only trusted
authority facts such as the current curator assignment or persisted ownership;
resource/lifecycle lookups follow the API's operation-specific denial precedence.

For mutations, place the guard inside the transaction and recheck current
authority after acquiring domain locks. SQLite does not provide row locks through
`select_for_update`; atomic transactions and database constraints are still
required. Permission helpers do not replace CSRF, ownership-injection rejection,
input validation, lifecycle checks or spoiler-safe response projections. Services
return their tuples through the existing safe API response wrapper.

`backend/tests/unit/test_permissions.py` covers every matrix action for anonymous,
member, assigned curator and admin, foreign ownership, revoked/pending identities,
spoiler prerequisites and guard execution order. Mounted integration tests verify
that actual session and persistence boundaries retain these decisions.

## Agent extension pack permissions

What each piece of the [agent extension pack](agent-extension-pack.md) may do. None of
them adds authority: tool access comes from the session's permission mode, and all of
them run with the user's rights in the same shell and with the same logins.

| Piece | May | May not |
|---|---|---|
| Skills (`agent-capabilities/skills/`) | Add instructions to the agent's context. | Grant tools, run code, or override `AGENTS.md`. Never request secrets or paid services. |
| Subagents | Use only the tools listed in their front matter. PM and QA cannot edit files; the spoiler reviewer is read-only. | Merge or close issues (orchestrator only); isolate credentials. |
| MCP server (`mcp-server/`) | Read `openapi.yaml` and the Rules section of `AGENTS.md`; one fixed `GET /api/health` to the fictional staging or demo origin. | Write files, run shell commands, touch the database or secrets, follow redirects, contact other hosts. |
| Hooks (`agent-hooks/`) | Read the tool-call event and refuse it (exit 2); run `ruff check` or `npm run lint` before a commit. | Make network calls, modify files, read databases or credentials, or approve what the session's permissions deny. They fail open on malformed input. |
| `.claude/settings*.json` allow/deny | Pre-approve routine commands (`gh issue/pr` reads, `git` add/commit/branch, `npm`/`uv` runs). Deny force push, `git reset --hard`, `git clean`, repo and issue deletion. | Replace the owner's judgement for deleting data, paid services or new accounts. |
| Worktrees | Give each issue its own files and branch. | Isolate credentials, the host, or a shared database. |

Rules that apply to all of them:

- Fictional data only; real club records and secrets never enter prompts, fixtures or git.
- Spoiler and permission rules are enforced by the backend. An agent tool, hook or skill
  never replaces that enforcement (see [Backend permissions](#backend-permissions)).
- Review the text of any skill, agent, hook or MCP server before installing it; changes
  to them are reviewed as code.
- Hooks inspect command text and submitted file content only. A reshaped command or a
  shell redirect can bypass them, so permissions, review and CI remain the real gates.
