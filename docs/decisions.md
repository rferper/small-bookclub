# Decisions

Short records of technical decisions. Add one entry per decision; newest at the bottom.

## 2026-10-08: Django + HTMX instead of Next.js (superseded 2026-10-09)

**Decision:** Build the website with Django, server-rendered templates with HTMX and Alpine.js, SQLite, and django-allauth for Discord OAuth.
**Why:** The site is small, admin-heavy and permission-sensitive. Django's admin, auth, migrations and server rendering cover much of that, and server rendering makes spoiler gating easier to enforce and test. Python also matches the Milestone 2 AI worker.
**Consequence:** Deviates from the spec's suggested Next.js stack (§7), which left the choice open (decision #82). The Discord voice bot's language is decided separately by the spike in #56.

## 2026-10-08: GitHub issues are the backlog

**Decision:** Tasks live in GitHub issues; `docs/tasks.md` is retired. Work follows the PM → engineer → QA process in `docs/process.md`.

## 2026-10-09: Separate frontend and JSON API (supersedes "Django + HTMX")

**Decision:** Split the app into `backend/` (Django + Django Ninja JSON API, SQLite, django-allauth for Discord OAuth) and `frontend/` (React + Vite + TypeScript + Tailwind). `openapi.yaml` at the repo root is the API contract.
**Why:** The project is also a course final project that requires a separate frontend with centralised API calls, an OpenAPI contract the backend follows, and tests on both sides. Django keeps the ORM, migrations, admin and allauth; Ninja adds typed request and response schemas. The frontend stack matches what Lovable generates, so Lovable can be used for screen prototypes.
**Consequence:** Spoiler and permission gating stays server-side: endpoints never return data the user may not see, and tests check JSON response bodies. Authentication uses same-site session cookies with CSRF protection (exact flow decided in #5). Issues written for server-rendered templates or HTMX are re-groomed for API + frontend when picked up.

## 2026-10-09: Contract-first API

**Decision:** The frontend is built first against a mock API client. `openapi.yaml` is then written by hand from what the screens need; the backend implements it and its tests validate responses against it. Once the contract exists, the frontend's API types are generated from it.
**Why:** The course grades an OpenAPI spec that reflects frontend requirements and is the contract for backend development.
**Consequence:** Until the backend exists, mock-client types are the draft contract. After `openapi.yaml` exists, any endpoint change starts with an `openapi.yaml` change in the same issue, and a CI check fails if the backend's generated schema drifts from it.

## 2026-10-09: Frontend first with a mock API client

**Decision:** Build all Milestone 1 screens in `frontend/` before the backend. Components call only `src/api/` (one typed client interface); a mock implementation returns fictional fixtures, and an HTTP implementation replaces it when the backend is ready. No mocking library: the mock is plain TypeScript.
**Why:** The user wants to see and shape the UI first; it also yields the API requirements for `openapi.yaml`.
**Consequence:** Permission and spoiler rules shown in the mock (locked states) are only a preview; the backend must enforce them. The mock must model gated responses the way the API will (data absent, not hidden).

## 2026-10-09: Public demo instance with fictional data

**Decision:** Deploy a public demo to a free cloud host, with seeded fictional data and a demo sign-in, enabled only by a `DEMO_MODE` setting. The real club instance never enables it, and its hosting stays deferred (spec §7).
**Why:** The course requires a working cloud URL and peer review; reviewers cannot be on the club's Discord allowlist.
**Consequence:** Demo sign-in must be impossible to enable without `DEMO_MODE`, and tests prove it. No real club data ever goes into the demo. Demo data may be reset on every deploy, so an ephemeral free-tier disk is acceptable for the demo.

## 2026-10-09: Milestone 2 after the course

**Decision:** The Discord recording bot and local AI (#56–#62) are out of scope for the course deadline and start only when the user says so.
**Why:** No course criterion needs them, and they carry the highest technical risk.
