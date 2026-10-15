# small-bookclub

A private website for a book club of 6–10 friends: a calm, cottage-style digital library in Spanish.

> Status: specification done, implementation starting. Sections marked *(to do)* are filled in as the project is built.

## The problem

The club reads one book about every two months, meets weekly on Discord, and splits each book into weekly portions. Today that lives in chat messages and memory: who is reading what, which pages are due this week, what was said at each meeting, which book is next and what everyone thought of past books.

The site gives the club one private place to:

- See the current book, this week's reading (percentage and page range) and the next meeting.
- Mark weekly reading as done, visible to the other members, with no pressure or reminders.
- Browse every club book as a bookshelf or a timeline.
- Vote on the next book: the curator proposes a shortlist and members approve as many as they like.
- Rate books on five criteria (Disfrute, Estilo, Personajes, Trama, Huella) and see others' ratings only after submitting their own.
- Read meeting summaries and highlights, unlocked only after reading that week's portion.
- Explore simple statistics and taste similarities between members.

Only approved members can sign in (Discord login plus an admin-managed allowlist). The full specification is in [`product-spec.md`](product-spec.md).

## Architecture

| Part | Technology | Role |
|---|---|---|
| Frontend | React, Vite, TypeScript, Tailwind (`frontend/`) | Screens; calls the backend only through one API client module. |
| Backend | Django + Django Ninja (`backend/`) | JSON API, permissions and spoiler gating, admin. |
| API contract | `openapi.yaml` | Agreed endpoints; the backend follows it, the frontend is built against it. |
| Database | SQLite | Club data; settings per environment (dev, test, demo, production). |
| Containers | Docker, `docker-compose.yml` | Runs the full system with one command. |
| CI/CD | GitHub Actions (`.github/workflows/`) | Runs tests on every push; deploys the demo when they pass. |

## Running it

### Full system with Docker Compose

With Docker Desktop running, from the repository root:

```sh
docker compose up --build
```

Open http://localhost:8080. The built React app uses the real Django API through
one origin; no Discord credentials are needed to view the Spanish sign-in page
or check `/api/health` and `/api/session`. Discord sign-in needs the owner's
credentials and a bootstrapped approved identity; demo sign-in is issue #75.

SQLite and private media live in the Compose named volume, separate from the
host development database. Migrations run before Gunicorn starts, and the proxy
waits for backend health. Both runtime processes run without root. Stop with
`docker compose down`; it preserves data. **Do not use `down --volumes` for an
instance whose data you want to keep.**

Optional shell variables: `BOOKCLUB_PORT` (default 8080), `CLUB_TIMEZONE`
(default Europe/Madrid), `SECRET_KEY`, `DISCORD_CLIENT_ID`,
`DISCORD_CLIENT_SECRET` and `DISCORD_REDIRECT_URI`. If changing the port, set
the redirect URI to `http://localhost:<port>/api/auth/discord/callback` too.
The club timezone is used at backend runtime and frontend build time; rebuild
after changing it. The fallback secret and loopback HTTP are for local use only.
Public HTTPS, isolated trusted proxy configuration and secret management are #76.

Use `docker compose exec backend python manage.py bootstrap_admin` only after
providing the intended `INITIAL_ADMIN_DISCORD_ID` explicitly (see the bootstrap
section below). No member is created or elevated automatically. See
[container operation and verification](docs/containers.md) for commands,
persistence checks and backup guidance.

### Separate development servers

The frontend runs with fictional mock data by default. The backend implements public health and finite Discord sign-in, session lookup and logout:

```sh
cd frontend
npm ci
npm run dev   # http://localhost:5173
```

The backend uses Python 3.13 and Django 5.2 LTS. Install [uv](https://docs.astral.sh/uv/getting-started/installation/), then:

```sh
cd backend
uv sync --locked
uv run python manage.py check
uv run python manage.py runserver 127.0.0.1:8000
# In another terminal:
curl http://localhost:8000/api/health
# {"status":"ok"}
```

Health is public process liveness, without database readiness probes, session or provider access. Explicit HTTP mode enables session, Discord navigation and logout only; other client methods reject with 503. Default mock mode stays fictional. Discord credentials are optional for startup; absent credentials make OAuth start return safe Spanish 503. See [authentication configuration and isolated HTTP checking](docs/api.md#finite-discord-authentication-5). Compose is available as described above.

`backend/.env.example` documents shell variables; it is a reference, not automatically loaded. Defaults are `BOOKCLUB_ENV=development`, `DEBUG=true`, local allowed hosts, `DATABASE_PATH=development.sqlite3` and `CLUB_TIMEZONE=UTC`. Relative database paths resolve inside backend; `:memory:` is supported for tests. Timezone never follows the machine. `LANGUAGE_CODE=es` and `USE_TZ=True` always apply.

| Selector | Debug default | Secret/hosts | Secure session/CSRF cookies |
|---|---|---|---|
| development | true | Public development fallback/local hosts | false |
| test | false | Public development fallback/local hosts | false |
| demo | false | Set private key and actual hosts before deployment | false (local bootstrap only) |
| production | false (true is refused) | Explicit `SECRET_KEY` and comma-separated `ALLOWED_HOSTS` required | true |

Invalid selector, boolean (`true`/`false` only), IANA timezone or blank database path fails clearly. These settings are a bootstrap, not deployed authentication/TLS security. Production configuration requires a private generated secret and actual deployment host; never commit either. Demo configuration alone does not create demo users or sign-in (#75).

PowerShell test example (POSIX: prefix commands with `BOOKCLUB_ENV=test DATABASE_PATH=:memory:`):

```powershell
$env:BOOKCLUB_ENV = 'test'
$env:DATABASE_PATH = ':memory:'
uv run python manage.py check
uv run pytest -m "not integration"
uv run pytest -m integration
uv run ruff check .
uv run ruff format --check .
uv run python -m config.contract
```

Optional club timezone override: `$env:CLUB_TIMEZONE = 'Europe/Madrid'`. Production example: set `BOOKCLUB_ENV=production`, `DEBUG=false`, a generated private `SECRET_KEY`, `ALLOWED_HOSTS` to the deployed hostname and `DATABASE_PATH` to an intended absolute SQLite location. Settings consume environment variables directly; keep local databases and credentials out of Git.

The custom `users.User` is configured before auth/contenttypes migrations, with an independent website key, exact Discord string identity, native profile and deny-by-default membership. Its initial migration never creates `auth_user`. Django database sessions and authentication now precede a default backend membership guard: private requests require current persisted approval without revocation, and ineligible sessions are invalidated. Membership refusal precedes CSRF and private work; eligible unsafe requests require CSRF even on Ninja views. The only implemented HTTP operation remains health; no sign-in/session endpoint workflow is available yet. Exact public exceptions and implementation boundaries are documented in [docs/api.md](docs/api.md). The frontend still uses fictional mock data on localhost.

Verify migrations against a disposable database, never by resetting or migrating the owner's existing development database. From `backend/` in PowerShell:

```powershell
$previousDatabase = $env:DATABASE_PATH
$migrationDirectory = Join-Path $env:TEMP ('bookclub-migration-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $migrationDirectory | Out-Null
try {
  $env:DATABASE_PATH = Join-Path $migrationDirectory 'empty.sqlite3'
  uv run python manage.py migrate --noinput
  uv run python manage.py migrate --noinput # No migrations to apply.
  uv run python manage.py makemigrations --check --dry-run
} finally {
  $env:DATABASE_PATH = $previousDatabase
}
```

The integration suite reproduces this verification in pytest's temporary directory and checks the actual table, initial migration, uniqueness and SQL checks. Its test database is separate from development storage. On Unix, set `DATABASE_PATH` to a new temporary absolute path before running the same commands. The temporary verification database can be removed afterwards.

### Explicit initial owner bootstrap (#6)

`bootstrap_admin` reads only `INITIAL_ADMIN_DISCORD_ID`: an exact string of 17–20
ASCII digits, without trimming or numeric conversion. It creates an approved native
admin with placeholder display name `Administrador`, empty avatar and null bio/quote,
and an unusable password. No OAuth credentials/provider requests, email, Django
staff/superuser, SocialAccount or SocialToken are needed. Website profiles remain
independent of Discord and can be edited through the later profile feature (#9).

Example from `backend/`, using a fictional ID and a new disposable database:

```powershell
$bootstrapDirectory = Join-Path $env:TEMP ('bookclub-bootstrap-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $bootstrapDirectory | Out-Null
$previousDatabase = $env:DATABASE_PATH
$previousAdminIdentity = $env:INITIAL_ADMIN_DISCORD_ID
$previousEnvironment = $env:BOOKCLUB_ENV
try {
  $env:BOOKCLUB_ENV = 'test'
  $env:DATABASE_PATH = Join-Path $bootstrapDirectory 'disposable.sqlite3'
  uv run python manage.py migrate --noinput
  $env:INITIAL_ADMIN_DISCORD_ID = '100000000000000001'
  uv run python manage.py bootstrap_admin
  uv run python manage.py bootstrap_admin # Already configured; no persisted changes.
} finally {
  $env:DATABASE_PATH = $previousDatabase
  $env:INITIAL_ADMIN_DISCORD_ID = $previousAdminIdentity
  $env:BOOKCLUB_ENV = $previousEnvironment
}
```

POSIX equivalent, again on a disposable database:

```sh
bootstrap_directory=$(mktemp -d)
BOOKCLUB_ENV=test DATABASE_PATH="$bootstrap_directory/disposable.sqlite3" uv run python manage.py migrate --noinput
BOOKCLUB_ENV=test DATABASE_PATH="$bootstrap_directory/disposable.sqlite3" INITIAL_ADMIN_DISCORD_ID=100000000000000001 uv run python manage.py bootstrap_admin
```

Existing pending/approved/revoked members and the same-identity admin are reused;
explicit execution promotes/reapproves and clears revocation while retaining the
native key, identity, profile, creation time, last login and password. Any different
admin-role row blocks the operation, including pending/revoked admins: changing the
variable cannot transfer ownership. Malformed persisted rows fail without repairs.
No positional ID or override option exists. Missing/invalid input makes this command
fail safely in Spanish without writes; Django startup/check and OAuth never consult
the variable or provision/reapprove anyone. An already configured rerun changes no
field, including `updated_at`. `.env.example` is reference-only and is never loaded
automatically. Never run these provisioning/migration examples on the owner's
development database. There is no HTTP bootstrap or new route; the frontend remains
the existing mock preview on localhost:5173.

The schema command compares every registered/generated implemented operation against its handwritten contract, reports the implemented subset and fails on missing/undocumented handlers or changed behavioural schemas/security/statuses/media. See [docs/api.md](docs/api.md). It does not pretend the 74 future club/provider operations are implemented. CI runs locked uv install, checks, Ruff, both real nonempty test selections and schema drift checking; frontend CI continues its complete existing suite.

The mock admin can maintain independent page/percentage targets at
`/administracion/lecturas`: add, edit, reorder and confirm recoverable removal.
Warnings require acknowledgement; removed weeks retain completion history for
30-day recovery and lock linked meeting records. No automatic plan generation
or recovery UI is included. All changes last for the mock-client session.

The mock admin can manage meeting dates, optional catalogue book/existing week links,
cancellations and attendance at `/administracion/reuniones`. Meeting form times use
`VITE_CLUB_TIMEZONE` (default `Europe/Madrid`); nonexistent or ambiguous DST times
must be changed before saving. Attendance is editable only after the mock clock's
meeting start and while not cancelled. Revoked attendees remain read-only history.
Saved changes appear on the next navigation to member screens; mock state lasts
only for the client lifetime. Summary/highlight editors and reading-plan editing
are separate issues.

## Testing

```sh
cd frontend
npm test        # unit and component tests
npm run lint
npm run build   # type-check and build
```

CI (`.github/workflows/frontend.yml`) runs these on every push to `main` and every pull request. Backend tests: *(to do)*

## Deployment and demo *(to do: Phase 3)*

See the [portable production deployment guide](docs/deployment.md) for the
explicit HTTPS Compose override, SQLite/media persistence, hosting comparison,
maintenance and recovery. Public cloud provisioning and working staging/production
URLs remain #76. See [fictional demo operation](docs/demo.md) for opt-in seeding.

## How AI was used *(to do)*

This project is built with AI coding agents following a PM → engineer → QA process. See [`AGENTS.md`](AGENTS.md) and [`docs/process.md`](docs/process.md).
