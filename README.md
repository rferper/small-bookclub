# small-bookclub

A private website for a book club of 6–10 friends: a calm, cottage-style digital library in Spanish.
It is also the author's final project for an AI-assisted development course.

**Demo (fictional data, no Discord needed):** https://small-bookclub-demo.onrender.com
· staging: https://small-bookclub-staging.onrender.com. Use the Spanish trial-account button on
the sign-in page. The free host can take about a minute to wake, and fictional edits reset on restart.

## The problem

The club reads one book about every two months, meets weekly on Discord, and splits each book into weekly portions. Today that lives in chat messages and memory: who is reading what, which pages are due this week, what was said at each meeting, which book is next and what everyone thought of past books.

## What it does

- Shows the current book, this week's reading (percentage and page range) and the next meeting.
- Lets members mark weekly reading as done, visible to the others, with no pressure or reminders.
- Browses every club book as a bookshelf or a timeline.
- Runs the vote for the next book: the curator proposes a shortlist and members approve as many as they like.
- Collects ratings on five criteria (Disfrute, Estilo, Personajes, Trama, Huella); others' ratings appear only after submitting one's own.
- Shows meeting summaries and highlights, unlocked only after reading that week's portion.
- Offers simple statistics and taste similarities between members.
- Gives admins screens for the member allowlist, reading plan, meetings, attendance, summaries, recycle bin, export and audit log.

Expected behaviour: only approved members can sign in (Discord login plus an admin-managed allowlist).
Every permission and spoiler rule is enforced by the backend, which never returns data a member may not see.
The full specification, including non-goals, is in [`product-spec.md`](product-spec.md).

## Architecture

```
Browser ── React app ──(one API client module)──▶ nginx proxy ──▶ Django Ninja API ──▶ SQLite + media volume
                                     ▲                                  │
                              openapi.yaml (contract) ◀── tests check responses
```

| Part | Technology | Role |
|---|---|---|
| Frontend | React, Vite, TypeScript, Tailwind (`frontend/`) | Screens. Talks to the backend only through the central API client (`src/api/`), which has a mock implementation (fictional data) and an HTTP implementation. |
| Backend | Django 5.2 + Django Ninja (`backend/`) | JSON API, authentication (Discord OAuth via django-allauth), permissions, spoiler gating, admin features. |
| API contract | `openapi.yaml` | Agreed endpoints. The frontend types are generated from it and the backend tests check responses against it. |
| Database | SQLite | Club data. One file per environment (development, test, demo, production), chosen by `DATABASE_PATH` and `BOOKCLUB_ENV`; see [backend setup](docs/backend-setup.md). |
| Containers | Docker, `docker-compose.yml` | Backend (Gunicorn, non-root) and proxy serving the built frontend; data in a named volume. |
| CI/CD | GitHub Actions (`.github/workflows/`) | Tests, scans and image builds on every push and PR; when they pass on `main`, staging and then the demo deploy to Render Free. |
| Observability | OpenTelemetry, Prometheus, Loki, Tempo, Grafana (`ops/`) | Opt-in local stack, an alert rule and a read-only on-call responder. |

Request flow: the browser loads the static React build from the proxy; the app calls `/api/...` on the same
origin; Django authenticates the session, checks membership and spoiler rules, reads/writes SQLite and returns
JSON shaped by `openapi.yaml`.

Repository map: `frontend/`, `backend/`, `openapi.yaml`, `docker-compose.yml`, `.github/workflows/`,
`docs/` (supporting docs), `security/` (scans, PR audit, agent security notes, AI data policy),
`ops/` (runbooks, observability, diagnosis), `agent-capabilities/`, `agent-hooks/`, `mcp-server/`,
`custom-agent/` (agent extension pack, see [`docs/agent-extension-pack.md`](docs/agent-extension-pack.md)).

## Set up and run

Requirements: Git, Docker Desktop (for the full system), Node.js 24 and npm, Python 3.13 with
[uv](https://docs.astral.sh/uv/getting-started/installation/) (for development servers and tests).

### Full system with Docker Compose

From the repository root:

```sh
docker compose up --build
```

Open http://localhost:8080. The built React app uses the real Django API through one origin. No Discord
credentials are needed to see the Spanish sign-in page. To try the app with fictional data and the
trial-account button, start it in demo mode on its own project and volume:

```sh
DEMO_MODE=true BOOKCLUB_PORT=18875 docker compose -p bookclub-demo up --build -d --wait
docker compose -p bookclub-demo exec backend python manage.py seed_demo
```

(PowerShell: set `$env:DEMO_MODE = 'true'` and `$env:BOOKCLUB_PORT = '18875'` first.) See
[`docs/demo.md`](docs/demo.md). Never enable demo mode on a volume holding real club data.

SQLite and uploaded media live in the Compose named volume. `docker compose down` keeps data;
**never use `down --volumes` on an instance whose data you want to keep.** Migrations run before the
backend starts. Optional shell variables: `BOOKCLUB_PORT` (default 8080), `CLUB_TIMEZONE`
(default Europe/Madrid), `SECRET_KEY`, `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `DISCORD_REDIRECT_URI`
(set it to `http://localhost:<port>/api/auth/discord/callback` if you change the port). The fallback secret
and plain HTTP are for local use only. Details: [`docs/containers.md`](docs/containers.md).

To create the first admin, set `INITIAL_ADMIN_DISCORD_ID` and run `bootstrap_admin`; see
[`docs/backend-setup.md`](docs/backend-setup.md#explicit-initial-owner-bootstrap-6).

### Development servers

```sh
cd frontend && npm ci && npm run dev          # http://localhost:5173, fictional mock data by default
cd backend && uv sync --locked && uv run python manage.py migrate && uv run python manage.py runserver
```

Environments, database settings and the HTTP client switch are described in
[`docs/backend-setup.md`](docs/backend-setup.md) and [`docs/api.md`](docs/api.md).

## Test

| Suite | Command | Where |
|---|---|---|
| Backend unit | `uv run pytest -m "not integration"` | `backend/` |
| Backend integration (real database and HTTP workflows, migrations) | `uv run pytest -m integration` | `backend/` |
| Backend lint and format | `uv run ruff check .` and `uv run ruff format --check .` | `backend/` |
| Contract drift | `uv run python -m config.contract` | `backend/` |
| Frontend unit and component | `npm test` | `frontend/` |
| Frontend lint, type-check, build | `npm run lint`, `npm run build` | `frontend/` |
| Contract validation and generated types | `npm run validate:contract`, `npm run check:api` | `frontend/` |
| Accessibility and browser journeys | `npm run test:a11y`, `npm run test:e2e` | `frontend/` |
| Agent hooks and MCP server | `node --test agent-hooks/hooks.test.mjs mcp-server/server.test.mjs` | root |

Backend tests need `BOOKCLUB_ENV=test` and `DATABASE_PATH=:memory:`; they use fictional data only and no
Discord account or network. Integration tests are separated by the `integration` pytest marker. Full
instructions: [`docs/testing.md`](docs/testing.md), [`docs/browser-tests.md`](docs/browser-tests.md).

## CI/CD and deployment

`.github/workflows/ci.yml` runs backend, frontend, container, observability and security jobs on every push
and pull request, ending in one required aggregate job ([`docs/ci.md`](docs/ci.md)). On `main`, when it passes,
`deploy.yml` deploys staging, verifies it and then deploys the demo; rollback is a documented manual procedure
([`docs/release-process.md`](docs/release-process.md)). Both run on Render Free from the repository's Docker
images ([`docs/public-demo.md`](docs/public-demo.md)). A production-style deployment for the real club (HTTPS
Compose override, persistence, backups, hosting comparison) is in [`docs/deployment.md`](docs/deployment.md)
and [`docs/backups.md`](docs/backups.md). Local observability: [`ops/observability/README.md`](ops/observability/README.md).

## Security and operations

[`security/README.md`](security/README.md) (deterministic scans, PR audit, agent security, AI tool and data
policy) and [`docs/operations-and-security-report.md`](docs/operations-and-security-report.md) (operations and
security report). Runbooks are in [`ops/runbooks/`](ops/runbooks/).

## How AI was used

The project is built with AI coding agents under a written process: specification first, work delegated through
GitHub issues, a PM → engineer → QA flow (with a leaner default), context files, and manual review plus automated
verification of every result. Full description, with example prompts:
[`docs/ai-workflow.md`](docs/ai-workflow.md). Agent rules: [`AGENTS.md`](AGENTS.md); process:
[`docs/process.md`](docs/process.md); extension pack (skills, subagents, MCP server, hooks, permissions):
[`docs/agent-extension-pack.md`](docs/agent-extension-pack.md).
