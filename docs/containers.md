# Container operation (#73)

The owner chose SQLite. It runs inside the backend on local volume storage;
there is no separate database container. Keep a single backend service/replica.
The frontend contains compiled HTTP-mode assets and proxies `/api/` to Django.
SPA routes fall back to index.html; native media is never a public static mount.

## Start and configure

From the root, `docker compose up --build`. Browse http://localhost:8080.
Use `docker compose ps` for health and `docker compose logs backend` for startup.
Gunicorn access logging and Nginx request/error logging are disabled to avoid
logging private URLs, OAuth codes and request data. Safe application logs remain.

Compose reads exported variables or a root `.env` file (never commit secrets).
Defaults use loopback HTTP and a local-only key, with no Discord credentials.
`BOOKCLUB_PORT`, `CLUB_TIMEZONE`, `SECRET_KEY`, `DISCORD_CLIENT_ID`,
`DISCORD_CLIENT_SECRET`, `DISCORD_REDIRECT_URI` are the available overrides.
`DEMO_MODE` is false by default; see [demo.md](demo.md) for explicitly seeding a
separate fictional demo project/volume and enabling its existing sign-in button.
See README for callback/port and timezone rebuild requirements. The backend port
is internal; the frontend is published on 127.0.0.1 only. Do not expose this local
configuration publicly; public deployment/TLS is #76.

Migrations run on startup before serving traffic; failure stops the backend.
Health is process liveness, not a full database/provider readiness probe. Compose
waits for it before starting Nginx. Both image runtimes are unprivileged. The
backend `/data` named volume persists `club.sqlite3` and `private_media`.

An owner bootstrap requires an explicit intended Discord ID:

```sh
docker compose exec -e INITIAL_ADMIN_DISCORD_ID=100000000000000001 backend python manage.py bootstrap_admin
```

That ID is fictional: replace it with the actual owner's ID for a real instance.
Never run this against someone else's instance. No seed/demo member is created by
startup. Use `docker compose exec backend python manage.py check` for Django checks.

## Preserve and back up data

`docker compose down` stops containers and keeps the volume. Starting again
reuses it; migrations are idempotent. Rebuild with `docker compose up --build -d`.
Do not remove volumes or use `down --volumes` on a retained instance. A rebuild
is not a backup or a migration rollback; make a backup before upgrading.

Run `python manage.py backup_club --help` inside the backend for the existing
SQLite/media backup command and follow [backups.md](backups.md). Write archives to
a writable private location and copy them off the volume, for example with
`docker compose cp`. Retain the secret/configuration separately. Do not copy a
live raw database file as a substitute for the consistent backup command.

## Disposable verification

Use a unique project name and unused loopback port, for example export
`BOOKCLUB_PORT=18873` and run `docker compose -p bookclub-check up --build -d --wait`.
This creates a separate named volume. Never reuse the owner's project name.

Verify `/api/health`, anonymous `/api/session`, private 401, protected CSRF writes,
HTML privacy headers and a direct SPA route through that port. Create only
fictional fixtures via `docker compose -p bookclub-check exec backend ...`.
Verify a written fixture and media survive `up -d --force-recreate --wait`.
Use terminal Playwright against that same disposable stack, inspect desktop/mobile
screenshots and console/network results, and run the normal tests in docs/testing.md.

Finish with `docker compose -p bookclub-check down --volumes --remove-orphans`
**only for the unique disposable verification project**. Do not touch owner
containers/volumes. Images/build caches can remain for future builds.

Build references: [uv Docker](https://docs.astral.sh/uv/guides/integration/docker/),
[Compose startup order](https://docs.docker.com/compose/how-tos/startup-order/),
[unprivileged Nginx](https://github.com/nginx/docker-nginx-unprivileged).

## Verification record (2026-10-14)

Built both images and started project `bookclub-verify-73` on loopback port 18873.
Both services became healthy. Proxy checks passed for health/session, SPA fallback,
privacy headers, private 401, missing-CSRF 403 and same-origin token-authenticated
logout 204. A fictional member/book, server session and private native WebP avatar
survived force recreation. Runtime UIDs were 10001 and 101. Terminal Playwright
rendered the actual HTTP-mode sign-in and authenticated library at desktop/mobile
widths; screenshots were inspected with no overflow, page errors or failed requests.
The disposable containers/network/volume were removed afterwards.

Backend: 1,574 passed, one existing Windows symlink skip (366.45 seconds).
Frontend: 1,271 passed; lint/build passed. Backend lint/format and missing-migration
checks passed. Independent runtime/proxy security review and follow-up passed.
Gunicorn's unused control socket is explicitly disabled for the non-root runtime;
the backend health timing allows slower Docker Desktop startup. Proxy dependency
restart keeps upstream resolution current after explicit backend recreation.
