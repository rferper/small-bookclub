# Groomed issue template

The PM rewrites each issue body into this format before implementation starts. Keep the issue title as `<number>. <title>`.

```markdown
## Goal
<One or two sentences: what the user can do or what is true after this issue, and why.>

## Acceptance criteria
- [ ] <A checkable statement about behaviour, e.g. "An anonymous GET /api/books returns 401 with no book data.">
- [ ] <Each criterion can be verified by running the code or a test, with a clear pass/fail.>
- [ ] <Include permission, spoiler and empty-state cases where they apply.>
- [ ] `openapi.yaml` describes every endpoint added or changed, and responses match it.
- [ ] Unit and integration tests cover the criteria above; backend `uv run pytest` and frontend `npm test` pass in CI.

## Out of scope
- <Things a reader might expect but that belong elsewhere. Link the issue that covers them, e.g. "Restore from recycle bin (#46)".>

## Constraints
- <Spec sections that apply, e.g. "product-spec.md §5.5 (independent rating rule)".>
- <Models, files or helpers to use or not touch, e.g. "Use the permission helpers from #11".>
- <Dependencies on other issues that must be closed first.>
- <Technical limits: no new dependencies without asking, Spanish UI copy, etc.>
```

## Guidance

- An acceptance criterion describes observable behaviour, not implementation steps.
- Avoid vague words like "nice", "fast", "properly" or "handles errors". Say what happens.
- If an issue is too big for one session, the PM splits it and creates follow-up issues.
