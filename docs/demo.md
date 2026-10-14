# Fictional reviewer demo (#75)

Demo mode requires the explicit boolean `DEMO_MODE=true`; it defaults to false
even when `BOOKCLUB_ENV=demo`. Accepted boolean values are true/false
(case-insensitive); invalid values stop startup. The real club keeps it false.
The route registry is selected at process startup, so changing the flag requires
restarting the backend. Disabled `/api/auth/demo` returns 404 and is absent from
the generated schema and implemented-operation inventory.

Use a separate database/media location or Compose project/volume for the demo.
Never enable demo mode on an existing real-club volume or copy real data into a
demo. The marker is installation provenance, not an anonymizer. This issue does
not publish an instance; public deployment/TLS remains #76.

## Local Compose

From PowerShell at the repository root, select a dedicated project and free port:

```powershell
$env:DEMO_MODE = 'true'
$env:BOOKCLUB_PORT = '18875'
docker compose -p bookclub-demo up --build -d --wait
docker compose -p bookclub-demo exec backend python manage.py seed_demo
```

Visit http://localhost:18875. Once seeded, the existing Spanish sign-in screen
offers **Entrar en la demo**. No Discord credentials or external account are
needed. Compose defaults to demo mode off; exporting the flag is an explicit
opt-in. Use a different project name from the owner's retained instance.

For a standalone backend, set `DEMO_MODE=true`, `BOOKCLUB_ENV=demo`, a dedicated
absolute `DATABASE_PATH` and `MEDIA_ROOT`, then run `uv run python manage.py
migrate` and `uv run python manage.py seed_demo` in `backend/`. Frontend HTTP mode
must proxy to that backend, as described in the container documentation.

## Seed and session boundaries

`seed_demo` is explicit and transactional. Normal migrations/startup never seed
members or mark a database as a demo. The first seed refuses an unmarked
populated club database, including removed rows and customized quotes/rubric.
Only untouched migration seed values and transient request budgets are permitted
before the first fictional seed. A failure rolls back all new rows and the
singleton marker. Repeating a completed seed preserves all reviewer edits and
does not recreate revoked/missing members or reset completions/reviews/votes.

Fixtures include six fictional members, four invented books, two linked
weeks/meetings, another member's completions, an open two-candidate approval
vote and three historical reviews. There is no demo administrator. The fixed
ordinary member starts without personal completion/review flags so reviewers
can explore the same weekly and review spoiler gates as the real application.

Demo sign-in needs normal CSRF protection and shares the existing per-peer OAuth
request budget (30/minute). It accepts no identity/role selector, flushes the
prior session and all OAuth/export state, and establishes only the fixed approved
ordinary member. Missing seed/marker/member, revocation, promotion to admin or
current-curator assignment makes sign-in unavailable and returns 404. A demo
login never supplies Discord reauthentication or export authority. Permissions
and spoiler policies remain the existing backend helpers.

All visitors share that member's persisted edits. Keep any operator edits
fictional. There is no public reset or role-switching API. To start fresh, create
a new dedicated disposable project/database; do not erase the owner's volume.
`docker compose -p bookclub-demo down` stops the demo and retains its volume.

## Verification

See [testing.md](testing.md). Targeted checks are
`uv run pytest tests/integration/test_demo.py tests/unit/test_environment.py`.
The two startup-mode probes use subprocesses with fresh temporary SQLite/media
paths and bounded timeouts; they do not reload Django/Ninja's global routers.
They cover schema/registry visibility, contract responses, fixed identity, CSRF,
old-session invalidation, OAuth/export-state clearance, request limits and actual
meeting/review spoiler gates. Seed tests cover refusal and transactional rollback.
The central TypeScript HTTP adapter has separate transport regressions; existing
sign-in screen tests retain mock coverage of the demo button/session refresh.
