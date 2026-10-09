# Testing guidelines

Living document: update it when we learn something about how tests should be written here.

## Tools

- Backend: pytest with pytest-django, run inside `backend/` with `uv run pytest`.
- Frontend: Vitest with Testing Library, run inside `frontend/` with `npm test`. Render pages with `src/test/renderApp.tsx` and inject a mock client (`createMockClient`) with the state each test needs; use its `failures` option for failing calls instead of spies. Choose who is signed in with its `session` option (`'anonymous'`, `'member'`, `'admin'` or `'denied'`; signed in as the fixture admin when omitted), and where «Entrar con Discord» leads with `signInResult`. To check which client methods were called or to hold a call in flight, wrap the mock with `trackCalls` or `holdCalls` from `src/test/clients.ts`.
- Browser end-to-end tests (later, #54): Playwright against the Docker Compose stack.
- CI runs all of them on every push and pull request.

## Unit vs integration tests

The course grades integration tests separately, so keep the two kinds apart:

- **Unit tests** (`backend/tests/unit/`, `frontend/src/**/*.test.ts(x)`): pure functions and single components, no database or network. Rating maths, statistics, gating decisions given plain inputs, API client helpers.
- **Integration tests** (`backend/tests/integration/`, marked `@pytest.mark.integration`): go through the real HTTP API with the test database, as a signed-in user of a given role, and check status codes, JSON bodies and the OpenAPI contract. One test per key workflow step (sign in, complete a week, vote, rate, see unlocked content).
- Run them separately: `uv run pytest -m "not integration"` and `uv run pytest -m integration`.

## What must always be tested

These are the critical rules from `product-spec.md` §10. Write their tests first.

- **Permissions:** every endpoint is checked as anonymous, member, current curator and admin, following the matrix in §3.
- **Spoiler gating:** check the actual JSON response body for hidden content, not only the HTTP status. Hidden ratings, aggregates, summaries and highlights must not appear anywhere in the response, including list, feed and statistics endpoints.
- **Ownership:** a member changing another user's ID in a request can never act as that user.
- **Ratings maths:** use exact values (e.g. scores 5, 4.5, 3, 4, 2.5 give 3.8) and reject invalid steps and ranges.
- **Vote lifecycle, independent completion flags, soft delete and restore.**
- **Contract:** integration tests validate responses against `openapi.yaml`.
- **Demo mode:** the demo sign-in is unreachable when `DEMO_MODE` is off.

## Conventions

- Backend tests live in `backend/tests/unit/` and `backend/tests/integration/`; frontend tests sit next to the code they test.
- Use fictional fixtures (factory functions or pytest fixtures) for members and books; never real club data.
- Name tests after behaviour: `test_member_cannot_see_reviews_before_submitting_own`.
- Freeze time for anything date-dependent (purge, "this week", next meeting); use the club timezone setting, never the machine's.
- Mock external HTTP (Open Library, Discord). Tests must pass offline.
- In frontend tests, mock the API client module, not `fetch`.
- Keep calculations in pure functions and unit-test them without the database.
