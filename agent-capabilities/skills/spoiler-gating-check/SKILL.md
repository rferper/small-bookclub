---
name: spoiler-gating-check
description: Review a small-bookclub change that reads or returns reviews, ratings, statistics, meeting summaries/highlights, activity feed items or exports, and verify spoiler and permission rules are enforced in the backend. Use before finishing any such change.
---

# Spoiler-gating check

Rules come from `product-spec.md` §5.5 and §5 (meetings) and `docs/permissions.md`. The backend is the only enforcement point; hiding data in the frontend never counts.

For the diff, answer each question with evidence (file and line, or test name):

1. **Central helpers.** Does every read go through the helpers in `backend/users/access.py` (`can_view_reviews`, `permission_refusal`, `@require_permission`) rather than an ad-hoc role check?
2. **Both conditions.** Is review visibility for a book gated on the viewer's personal completion *and* their own submitted complete rating? Admin must not bypass it implicitly.
3. **Every surface.** Check endpoints, aggregates and statistics, chart data (radar and numeric table), the home activity feed, book-card previews, exports, and meeting summaries/highlights (gated on the linked week's reading; hidden for non-admins when no assignment is linked).
4. **Projection.** Are the denied fields absent from the JSON (not null, not masked client-side)? Do counts, ordering or error messages leak what was withheld?
5. **Server-derived identity.** Are ownership and curator facts taken from the session and stored state, never from request data?
6. **Tests.** Are there tests for an anonymous user, a member who has not completed the book, a member who completed it but has no rating, a satisfied member, and admin? Run them: `uv run pytest -m "not integration"` and `-m integration` in `backend/` (see `backend/tests/integration/test_meeting_spoilers.py` for the pattern). A new surface without a denying test is a failure.
7. **Contract.** Does `openapi.yaml` document the new response, including denial statuses?

Report PASS or FAIL per question. Any FAIL blocks the change. Use fictional data only.
