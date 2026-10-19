# AGENTS.md

Private website for a book club of 6–10 friends, and the author's course final project.
Django + Django Ninja JSON API, React + Vite + TypeScript frontend, SQLite, Spanish UI.
The backlog lives in GitHub issues (`rferper/small-bookclub`); work on one issue at a time. Multiple issues may be completed sequentially in a session when the user explicitly authorizes it.

## Repository layout

- `backend/`: Django project and JSON API (Django Ninja), with its tests.
- `frontend/`: React + Vite + TypeScript + Tailwind app, with its tests.
- `openapi.yaml`: the API contract between frontend and backend.
- `docker-compose.yml`: runs the full system locally.
- `.github/workflows/`: CI (tests) and CD (deploy the demo when tests pass).
- `docs/`: supporting documentation. `security/` and `ops/`: audit and operations artifacts.
- `product-spec.md`: product specification.

## Commands

The frontend exists; backend commands work once `backend/` is created.

- Backend (run inside `backend/`; uv manages all backend dependencies):
  - Install dependencies: `uv sync`
  - Add a dependency (free and open-source, recorded in `docs/decisions.md`): `uv add <PACKAGE-NAME>`
  - Run a Python file: `uv run python <PYTHON-FILE>`
  - Unit tests: `uv run pytest -m "not integration"`; integration tests: `uv run pytest -m integration`; all: `uv run pytest`
  - Lint and format: `uv run ruff check .` and `uv run ruff format .`
  - Migrations: `uv run python manage.py makemigrations` then `uv run python manage.py migrate`
  - Run the API: `uv run python manage.py runserver`
- Frontend (run inside `frontend/`):
  - Install dependencies: `npm ci`
  - Tests: `npm test`; lint (oxlint): `npm run lint`; type-check and build: `npm run build`
  - Until the backend exists, the app runs on the mock API client in `frontend/src/api/mock/` (fictional data).
  - Run the app: `npm run dev`
- Full system: `docker compose up --build`
- GitHub issues: `gh issue view <n>`, `gh issue comment <n> --body-file <file>`

## Rules

- `product-spec.md` is the source of truth for product behaviour. Do not add features it lists as non-goals, and do not re-ask its settled decisions.
- `openapi.yaml` is the API contract. Change it first, in the same issue, before changing an endpoint or the frontend code that calls it. Backend tests check responses against it.
- The frontend talks to the backend only through its central API client module; no `fetch` calls scattered in components.
- Agents may choose free, open-source dependencies, and must record each one and why in `docs/decisions.md`. Anything paid, or needing the user's accounts or secrets, still needs the user's approval first. Backend dependencies go in `backend/pyproject.toml` via `uv add`; frontend dependencies go in `frontend/package.json` via `npm install`. No paid services, APIs or hosting.
- User-facing text is Spanish; code, comments and docs are English.
- Every permission and spoiler rule is enforced in the backend, using the central helpers. The API never returns data the user may not see; hiding it in the frontend is never enough.
- Use fictional data in tests, fixtures and the public demo; never invent real club data.
- Commit to git regularly, after each meaningful step, so any bad change is easy to roll back.
- When leaving a local preview running, include its clickable URL in the user-facing handoff.
- A change is done only when its tests pass. Never claim something works without running it.
- Stay inside the issue you were given. If you find other needed work, say so in an issue comment instead of doing it.
- Default issue workflow: one implementer reads and grooms the issue as needed, implements and tests it, and posts a GitHub handoff. Use a brief independent security review when authentication, permissions or spoilers warrant one. The full PM → engineer → QA loop is a fallback, not mandatory; see `docs/process.md`.
- Optimize for low token usage: keep handoffs short, share only relevant context, avoid repeated role/checkpoint conversations, and stabilize a candidate before full CI. Preserve required tests and security gates; reserve additional agents and expensive reasoning for work that needs them.
- Record reversible technical decisions in `docs/decisions.md`.
- When the user corrects how an agent works, update this file or the relevant linked doc.
- Before asking the owner to choose or connect a hosting account, explain the realistic options in plain language, their free-tier conditions, data persistence, maintenance and payment-card requirements, and a recommendation. Discuss those tradeoffs before treating hosting selection as an account-connection step.
- The owner does not connect a browser. Use terminal Playwright in a disposable environment for local visual checks; this workflow is already authorized and must not be requested again. Preserve the owner's database and preview, inspect screenshots, and stop temporary verification servers afterwards.
- This project is operated through a terminal. Do not ask the owner to install or connect ChatGPT plugins. Prefer provider CLIs or APIs for external operations; when authentication is needed, use the provider's local login flow without putting credentials in chat or git.
- If a local verification needs Docker and the daemon is closed, ask the user to open Docker Desktop before recording Docker as unavailable. Use only the repository's existing Compose setup and preserve the owner's database and preview.

## Documents

Read a document when its topic applies; do not load all of them by default.

- `docs/process.md`: the default issue workflow, risk-focused review, and full-loop fallback. Read when coordinating work or unsure of your role.
- `docs/team/pm.md`, `docs/team/software-engineer.md`, `docs/team/qa-engineer.md`: role definitions. Read the one for the role you were given.
- `docs/task-template.md`: the groomed issue format.
- `product-spec.md`: full product spec. Read the sections relevant to your issue. §15 lists the course requirements.
- `docs/testing-guidelines.md`: read before writing or reviewing tests.
- `docs/design-system.md`: read before any frontend UI or CSS work.
- `docs/decisions.md`: technical decisions already made. Read before choosing a library or pattern.
- `security/ai-tool-data-policy.md` and `security/agent-security.md`: permitted agent data, tool authority, approval reuse, provenance and known gaps. Read before new agent/tool/data-flow work.
