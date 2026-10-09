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

## Architecture *(to do: completed by #1 and #63)*

| Part | Technology | Role |
|---|---|---|
| Frontend | React, Vite, TypeScript, Tailwind (`frontend/`) | Screens; calls the backend only through one API client module. |
| Backend | Django + Django Ninja (`backend/`) | JSON API, permissions and spoiler gating, admin. |
| API contract | `openapi.yaml` | Agreed endpoints; the backend follows it, the frontend is built against it. |
| Database | SQLite | Club data; settings per environment (dev, test, demo, production). |
| Containers | Docker, `docker-compose.yml` | Runs the full system with one command. |
| CI/CD | GitHub Actions (`.github/workflows/`) | Runs tests on every push; deploys the demo when they pass. |

## Running it *(to do: #1)*

## Testing *(to do: #1)*

## Deployment and demo *(to do: #63)*

## How AI was used *(to do)*

This project is built with AI coding agents following a PM → engineer → QA process. See [`AGENTS.md`](AGENTS.md) and [`docs/process.md`](docs/process.md).
