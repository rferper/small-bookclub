# Running automated checks

Use Python 3.13, uv, Node.js 24 and npm. From `backend/`, install the locked
Python environment with `uv sync --locked`; from `frontend/`, run `npm ci`.
Backend integration tests also need frontend dependencies because they execute
the production TypeScript adapter with Vite's existing SSR loader. No extra
test dependency, Discord account, browser or Docker daemon is needed.

Set `BOOKCLUB_ENV=test` and `DATABASE_PATH=:memory:` in the backend test shell.
In PowerShell:

```powershell
$env:BOOKCLUB_ENV = 'test'
$env:DATABASE_PATH = ':memory:'
```

From `backend/`, run:

```text
uv run pytest -m "not integration"
uv run pytest -m integration
uv run ruff check .
uv run ruff format --check .
```

Database-backed migration, persistence, session/OAuth, permission, ownership,
meeting and review spoiler tests live in `backend/tests/integration/` and carry
the `integration` marker. Unit selection excludes them. Migration and backup
subprocess tests use fresh temporary destinations, never the development DB.
External Discord and Open Library calls use fictional mocked responses in their
respective suites, so no external account/network is needed.

From `frontend/`, run:

```text
npm test
npm run lint
npm run build
```

Frontend component tests use the fictional mock API; transport unit tests may
inject fake fetch. These complement the real HTTP integration below.

## Production HTTP adapter journey

Run this check alone from `backend/` with the same test environment:

```text
uv run pytest tests/integration/test_frontend_bridge.py -q --durations=3
```

pytest-django creates a disposable SQLite test database and an HTTP server on
an allocated local port. Fictional users, session, reading assignment, meeting,
vote and reviews are seeded in that database. The test-only static URL is set
before the live server starts. No owner's database or preview port is used.

`frontend/scripts/integration-client.mjs` loads `src/api/httpClient.ts` through
Vite and uses Node's real fetch plus a cookie jar to call Django. The jar supplies
browser session/CSRF mechanics, without fake responses. Assertions exercise
anonymous/member denial, own-profile changes, weekly completion, approval voting,
personal book completion, review submission, meeting/review spoiler gates,
CSRF rejection and invalidation of a replayed logged-out session. Raw response
sentinels prove hidden content is absent before eligibility, including after
finishing a book without submitting a review.

Python validates every recorded response against its OpenAPI operation/status,
including empty 204 bodies, and verifies persisted mutations. A Node assertion
failure exits nonzero; Python asserts that exit code, so pytest and CI fail.
The subprocess has a **90-second timeout**; `subprocess.run` kills and reaps it
on timeout. Vite closes in `finally` on normal/assertion exits; pytest owns
live-server/database cleanup on success or failure.

Backend GitHub Actions installs Node 24 and frontend dependencies, then runs
unit and integration checks separately on every push/pull request. Frontend CI
runs unit, contract, build and mock-screen accessibility checks separately.
This journey checks HTTP/data integration; browser rendering and full-stack
browser journeys remain #54, and Compose is #73.

## Timing and contract parsing

On Windows with Node 24.19.0, the targeted bridge passed in **5.38 seconds**
(3.40 seconds call, 1.49 seconds setup). A subsequent run alongside contract
tests took 1.24 seconds for the bridge call. These are local measurements, not
CI performance guarantees; the 90-second subprocess cap allows slower runners.

Contract YAML parsing is cached by file content, with a deep copy returned for
each caller. Unit regressions check nested mutation isolation and same-length
file-content replacement. Every recorded response still receives full schema
validation.
