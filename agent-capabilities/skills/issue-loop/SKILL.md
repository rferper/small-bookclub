---
name: issue-loop
description: Implement one small-bookclub GitHub issue end to end on its own branch (groom, contract first, implement, test, handoff). Use when asked to work on, finish or "do" an issue number in this repository.
---

# Issue loop

Source of truth: `AGENTS.md` and `docs/process.md`. This skill is a checklist, not a replacement.

1. **Read.** `gh issue view <n>`, then only the spec sections, docs and code the issue touches. Do not load every document.
2. **Groom.** If criteria are stale, restate them as checkable items in your handoff. Contradictory criteria or decisions outside the issue go back to the user; never silently change them.
3. **Branch.** `git checkout -b issue-<n>-<slug>` from `main` (or from the branch it depends on, and say so). One issue per branch.
4. **Contract first.** If an endpoint or its frontend caller changes, edit `openapi.yaml` before code. The frontend uses only its central API client.
5. **Implement and test.** Use fictional data only, Spanish UI text, English code and docs. Run targeted tests while developing: `uv run pytest -m "not integration"` / `-m integration`, `uv run ruff check .` in `backend/`; `npm test`, `npm run lint`, `npm run build` in `frontend/`. Run the full suites once before handoff. Never claim something works without running it.
6. **Security review when warranted.** For authentication, permissions or spoilers, also apply the `spoiler-gating-check` skill and request a brief independent review.
7. **Commit** after each meaningful step; end messages with the attribution line the session specifies.
8. **Hand off.** Post a short `## Implementation` issue comment (about 10 lines): criteria covered, checks run with results, assumptions, branch, commit. Open a PR with `Closes #<n>`.
9. **Stop.** Other needed work becomes a new issue or comment, not an unplanned change. Only the orchestrator merges and closes. Stop when the issue's own acceptance criteria hold and CI is green, or when a decision belongs to the user.
