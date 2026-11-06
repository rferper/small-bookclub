# Backend setup, environments and bootstrap

Detail moved out of the README. The backend is Python 3.13, Django 5.2 LTS and Django
Ninja; [uv](https://docs.astral.sh/uv/getting-started/installation/) manages dependencies.

## Separate development servers

```sh
cd backend
uv sync --locked
uv run python manage.py migrate
uv run python manage.py runserver 127.0.0.1:8000
curl http://localhost:8000/api/health   # {"status":"ok"}
```

```sh
cd frontend
npm ci
npm run dev   # http://localhost:5173
```

The frontend uses fictional mock data by default. To make it call the real API, select
the HTTP client as described in [`api.md`](api.md#central-http-transport-and-client-selection-105).
Discord credentials are optional for startup; without them the OAuth start route
answers a safe Spanish 503. Authentication details: [`api.md`](api.md#finite-discord-authentication-5).

## Environments and database

`backend/.env.example` documents the shell variables; it is a reference and is never
loaded automatically. Settings read environment variables directly. The SQLite file
is chosen by `DATABASE_PATH` (relative paths resolve inside `backend/`; `:memory:` is
supported for tests), so each environment has its own database.

| `BOOKCLUB_ENV` | Debug default | Secret and hosts | Secure session/CSRF cookies |
|---|---|---|---|
| development | true | Public development fallback, local hosts | false |
| test | false | Public development fallback, local hosts | false |
| demo | false | Private `SECRET_KEY` and real hosts before deployment | per deployment |
| production | false (true is refused) | Explicit `SECRET_KEY` and `ALLOWED_HOSTS` required | true |

Other variables: `CLUB_TIMEZONE` (default `UTC` locally, `Europe/Madrid` in Compose;
never the machine's), `DEMO_MODE` (explicit boolean, default false, see
[`demo.md`](demo.md)), `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`,
`DISCORD_REDIRECT_URI`. `LANGUAGE_CODE=es` and `USE_TZ=True` always apply. An invalid
selector, boolean, timezone or blank database path fails at startup. Never commit a
real secret or database.

## Tests

See [`testing.md`](testing.md). In short, from `backend/`:

```powershell
$env:BOOKCLUB_ENV = 'test'
$env:DATABASE_PATH = ':memory:'
uv run pytest -m "not integration"   # unit
uv run pytest -m integration         # database and HTTP workflows
uv run ruff check .
uv run ruff format --check .
uv run python -m config.contract     # implemented routes vs openapi.yaml
```

## Verify migrations on a disposable database

Never reset or migrate the owner's development database to check migrations.

```sh
dir=$(mktemp -d)
export DATABASE_PATH="$dir/empty.sqlite3"
uv run python manage.py migrate --noinput
uv run python manage.py migrate --noinput          # nothing to apply
uv run python manage.py makemigrations --check --dry-run
```

The integration suite repeats this in pytest's temporary directory.

## Explicit initial owner bootstrap (#6)

`bootstrap_admin` reads only `INITIAL_ADMIN_DISCORD_ID`, an exact string of 17–20
ASCII digits. It creates an approved native admin (placeholder name `Administrador`,
unusable password); no OAuth call, email or Django superuser is involved. Nothing is
created or elevated automatically at startup or login.

```sh
dir=$(mktemp -d)
export BOOKCLUB_ENV=test DATABASE_PATH="$dir/disposable.sqlite3"
uv run python manage.py migrate --noinput
INITIAL_ADMIN_DISCORD_ID=100000000000000001 uv run python manage.py bootstrap_admin
```

The ID above is fictional. Rerunning with the same ID changes nothing; a different
admin row blocks the command, so changing the variable cannot transfer ownership.
Missing or invalid input fails safely in Spanish without writes. Do not run these
examples against the owner's development database. In Compose use
`docker compose exec backend python manage.py bootstrap_admin` with the intended
variable set explicitly.
