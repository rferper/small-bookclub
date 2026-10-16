# Portable production deployment (#55)

This recipe targets one Linux machine with Docker Engine and Compose 2.24.4+
(the override removes inherited ports with `!reset`). It runs the existing
images with SQLite. The separate fictional Render Free services are live at
[staging](https://small-bookclub-staging.onrender.com) and
[production-demo](https://small-bookclub-demo.onrender.com).
See [public-demo.md](public-demo.md) for provider-specific setup, migration/seed
startup, smoke commands, reset/recovery/rollback procedure and verification status.
Hosted rollout/rollback evidence remains part of #76; automated delivery is #77
and versioned release policy is #78. The real private club remains deferred.

## Hosting choices, checked 2026-10-15

| Option | Persistence and access | Cost/account constraints | Fit |
| --- | --- | --- | --- |
| Self-host existing equipment | Keep SQLite/media on a local disk; expose only HTTPS and HTTP for certificate validation. Requires reachable inbound ports and DNS. | No hosting subscription; equipment, electricity and connection still have costs. CGNAT/router restrictions can prevent inbound access. | Portable private club deployment when the owner has suitable hardware. It alone does not meet the course's free-cloud demo requirement. |
| Free cloud VM, e.g. Oracle Always Free | A VM with persistent block storage can run the same Compose stack. Backups must leave that VM. | Always Free has capacity/eligibility limits; signup requires an account and payment-card verification. Trial credit is time limited and is not an ongoing-free plan. | A candidate to evaluate with the owner in #76; no account or region chosen here. [Official terms](https://www.oracle.com/cloud/free/). |
| Free web service, e.g. Render Free | Filesystem changes disappear at restart/redeploy/spin-down; free services cannot attach persistent disks. | Free Postgres expires after 30 days; moving databases would also contradict the selected SQLite runtime. | Unsuitable for a retained SQLite/media instance under the no-paid-hosting constraint. [Free limitations](https://render.com/docs/free). |
| Hybrid cloud edge + self-hosted application | The database and private media stay on the application machine; an edge must forward the whole same-origin app securely. | Adds a provider account, tunnel/edge terms and another availability dependency. No tunnel/service is selected or configured. | Possible later, but a separately hosted static frontend alone cannot supply this same-origin session/CSRF architecture. |

Free-tier availability and terms change. Recheck them before creating resources;
never enable billing, buy a domain, or substitute a paid persistent disk. The
course demo needs an eligible free cloud option and a working URL separately.

## Storage and trust boundary

The production override is `deploy/compose.production.yml`, always applied after
the root `docker-compose.yml`. A non-root Caddy container terminates TLS and
connects only to Nginx on the edge network. Nginx connects to Django on a separate
application network. Only Caddy publishes ports; neither application service
has a host port. Do not attach untrusted services to these networks or publish
Nginx/Django manually.

Caddy handles certificates/renewal and HTTP-to-HTTPS redirection. Nginx serves
compiled frontend assets, SPA fallback and the same-origin `/api/` proxy.
`deploy/nginx.production.conf` keeps the base body/connection/request limits and
privacy headers, changing only forwarded protocol to literal `https`. Both hops
overwrite protocol and strip forwarded client IP; Django trusts HTTPS only on
this isolated path. Thus application peer budgets are shared at Nginx, and
Nginx's 10 requests/second, burst 30 and 20-connection budget is shared at Caddy.
These limits suit this small club; adding a proxy requires a fresh trust review.

The project-scoped `club_data` volume contains `/data/club.sqlite3` and
`/data/private_media`. Private uploads are served only by authorized API routes;
never expose them through Caddy, Nginx, object-store public URLs or static mounts.
Keep one backend replica on one machine and use local persistent storage, not
ephemeral filesystems, network-shared SQLite, or separate writable replicas.
Project-scoped `caddy_data`/`caddy_config` preserve certificate state. Backups use
an explicit private host directory mounted at `/backups`, outside all web roots.

All three runtimes use non-root users. Caddy's inherited binary capability is
removed; its container drops capabilities, disallows new privileges and permits
binding low ports through a container-local network sysctl. No Docker socket is
mounted. Caddy access logging is not enabled and runtime logs are discarded to
avoid request/error records containing OAuth codes or private URLs. Existing
Nginx raw logs are off; Django retains closed safe events. Diagnose with health,
container state and bounded smoke checks; safe telemetry is tracked in #79.

## Configure and start an intended instance

Prerequisites: a supported Docker Linux host, persistent disk, an existing free
DNS hostname controlled by the operator, and inbound TCP 80/443 pointing at that
host. Do not run public deployment commands on an owner's development preview.
No account, DNS change, firewall rule or host schedule is installed by this guide.

Copy `deploy/production.env.example` **outside the checkout** to a private file,
for example `/srv/bookclub-private/production.env`. Set restrictive ownership and
mode 600. Generate a private key locally, e.g.
`python -c 'import secrets; print(secrets.token_urlsafe(64))'`, and store it there.
Do not paste keys into issue comments or commit environment/config output.

| Variable | Value |
| --- | --- |
| `BOOKCLUB_HOST` | One actual DNS hostname, without scheme, path, wildcard or port. |
| `SECRET_KEY` | Private generated per-instance key; empty input is refused. |
| `BACKUP_DIRECTORY` | Absolute private host directory, precreated and writable by container UID/GID 10001. On Linux, operator creates it with mode 700 and that ownership. |
| `CLUB_TIMEZONE` | Explicit IANA timezone, default Europe/Madrid; used at backend runtime and frontend build. Rebuild after changing it. |
| `DEMO_MODE` | `false` for the private club. Only explicitly fictional demo/staging instances use `true`. |
| `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET` | Owner-supplied credentials for real Discord sign-in. Optional for anonymous health/session and fictional demo. |

The override fixes `BOOKCLUB_ENV=production`, `DEBUG=false`, exact allowed host,
secure cookies, trusted proxy and callback
`https://<BOOKCLUB_HOST>/api/auth/discord/callback`. Register that exact callback
in the owner's Discord application before testing real sign-in. No credentials
are required to build/start the anonymous site. Default public ports are 80/443;
`BOOKCLUB_BIND_IP`, `BOOKCLUB_HTTP_PORT`, `BOOKCLUB_HTTPS_PORT` permit deliberate
network mappings. Public certificate validation still requires 80/443 externally.
Keep `TLS_ISSUER=acme` (default) for public deployment.

From the repository root, use the same explicit project/file combination for
every operation (POSIX shell examples):

```sh
docker compose --env-file /srv/bookclub-private/production.env -p bookclub-production -f docker-compose.yml -f deploy/compose.production.yml config --quiet
docker compose --env-file /srv/bookclub-private/production.env -p bookclub-production -f docker-compose.yml -f deploy/compose.production.yml up --build -d --wait --wait-timeout 180
docker compose --env-file /srv/bookclub-private/production.env -p bookclub-production -f docker-compose.yml -f deploy/compose.production.yml ps
curl --fail https://<your-host>/api/health
```

`config --quiet` validates without printing secrets. Health is process liveness,
not a complete database/provider check. Verify the HTTPS sign-in page, anonymous
session, private 401 and missing-CSRF 403 too. TLS failure must not be bypassed
with insecure browser/curl settings on a public deployment. Automatic migrations
run on the selected container database before serving traffic.

Bootstrap the intended real owner once with an explicitly supplied Discord ID:

```sh
docker compose --env-file /srv/bookclub-private/production.env -p bookclub-production -f docker-compose.yml -f deploy/compose.production.yml exec -e INITIAL_ADMIN_DISCORD_ID=<owner-discord-id> backend python manage.py bootstrap_admin
```

Then sign in, customize the native profile and approve members through the UI.
This command has no startup/HTTP equivalent; changing its ID cannot transfer an
existing administrator. The scheduled purge uses the administrator's **native
website ID**, not the Discord ID; obtain that from the administrator member view.

## Fictional demo and staging

Give each instance its own project name, private env file, hostname, secret,
backup directory and volumes. For a fictional demo, set `DEMO_MODE=true` in its
private env file and explicitly run `python manage.py seed_demo` through that
project's backend after startup. See [demo.md](demo.md). No seed runs on startup;
the command refuses unmarked real club data. The fictional seed creates no admin.
Do not install a purge schedule for an instance lacking an explicitly configured
approved administrator. Never copy real club data into a demo or staging volume.
Separate public hosts on one machine need a shared edge design in #76; this recipe
owns host ports 80/443 and must not be started twice on those same ports.

## Maintenance: backups and expired-content purge

`deploy/maintenance.sh` runs only against its explicit project/env file and reuses
the running backend environment. It creates no identity or schedule. Configure
the Linux operator's protected scheduler environment with absolute paths:

```sh
export BOOKCLUB_DIR=/srv/small-bookclub
export BOOKCLUB_ENV_FILE=/srv/bookclub-private/production.env
export BOOKCLUB_PROJECT=bookclub-production
export BACKUP_KEEP=7
export PURGE_ACTOR_ID=<approved-native-admin-id>
sh "$BOOKCLUB_DIR/deploy/maintenance.sh" backup
sh "$BOOKCLUB_DIR/deploy/maintenance.sh" purge-dry-run
```

These are examples: settle the actual frequency/retention/off-device destination
with the operator. `BACKUP_KEEP` is validated by the existing command (1–30).
Backups contain private DB/media, sessions and removed/revoked records. Archives
are not encrypted; use an encrypted host/destination and an encrypted off-device
copy under operator control, with separately protected secrets/configuration.
Daily backups with seven snapshots are an illustrative finite retention, not a
guarantee of no loss; old snapshots retain deleted content until rotation.

After manually checking a backup and purge dry-run, install daily jobs under an
operator authorized to use Docker. Docker access grants control of the host.
Cron must define the variables above (do not source the Compose env file as shell
code). Precreate a private common lock/log file and use **the same lock** for both:

```cron
30 2 * * * /usr/bin/flock -n /srv/bookclub-private/maintenance.lock /bin/sh /srv/small-bookclub/deploy/maintenance.sh backup >> /srv/bookclub-private/maintenance.log 2>&1
15 3 * * * /usr/bin/flock -n /srv/bookclub-private/maintenance.lock /bin/sh /srv/small-bookclub/deploy/maintenance.sh purge >> /srv/bookclub-private/maintenance.log 2>&1
```

The scheduler host's timezone determines these times. Never overlap maintenance
or a database upgrade/restore. A held lock returns nonzero; alert/investigate
failed/skipped jobs and persistent purge backlog, then rerun deliberately.
Backups use SQLite's existing consistent capture and bounded rotation, not live
raw file copies. Purge respects dependencies and can leave blocked history;
30 days means eligibility, not a promise of deletion at that exact instant.
See [backups.md](backups.md) and [purge.md](purge.md) for guarantees/failures.

## Restart, upgrade and recovery

`down` without `--volumes` preserves storage; `up -d` reuses it. Never use
`down --volumes` or global Docker prune on a retained instance. Record the current
code revision and take/check an off-device backup before upgrading. Update the
reviewed checkout, rebuild and run the same explicit `up --build -d --wait`, then
smoke-check health/session/sign-in. A container recreation is not a backup.

If startup/migrations or smoke checks fail, stop writes and investigate. Do not
assume old application code can read a newly migrated schema. Recover the matching
backup and previous code/config into a **new recovery project/volume** while the
old project stays stopped. `restore_club_backup --archive /backups/<archive>.zip
--destination /backups/recovery-<unique-name>` validates into a new directory and
refuses overwrite. Inspect its database/media and integrity before cutover.
An operator then copies recovered `database.sqlite3` and `media/` into the new
volume's `/data/club.sqlite3` and `/data/private_media`, respectively, with UID/GID
10001 ownership; preserve the original volume and backup. Restore the separately
protected key/timezone/OAuth/host configuration, start the intended code revision
and verify records/media/permissions before changing traffic. Starting Django can
apply migrations, so choose the code revision before the recovery start. Tested
public staged rollout/rollback and traffic switching are #76, not claimed here.

## Disposable local verification

With Docker and frontend dependencies/Chromium installed, run from the root:

```sh
node deploy/verify-production.mjs
```

It chooses a random project and two unused loopback ports, random test key, local
hostname and Caddy's internal issuer. It copies only the public local CA certificate
to its printed temporary evidence directory and verifies HTTPS against that CA;
it never installs host trust. A disposable browser context ignores that local CA
only for its screenshot. No public DNS, ACME account, real credentials or club data
is used. It verifies closed ports, redirect/headers, spoofed forwarding, CSRF/Secure
cookies, demo off then explicit fictional seed, backup/restore, purge dry-run and
recreation persistence. Tests use a new fictional admin solely for dry-run.

The runner uses 180-second Compose readiness, 300-second subprocess bounds,
10-second HTTP timeouts and a 30-attempt local TLS readiness loop. Its `finally`
closes Chromium and removes only its own containers/networks/volumes. Abrupt host
termination can interrupt cleanup; use the printed exact project with both Compose
files to inspect/remove it. Fictional backup/screenshot/public-CA evidence remains
in the printed temporary directory; private certificate keys leave with the volume.
Inspect the screenshot before recording PASS. Owner projects/previews are not used.

Technical references: [Compose merge/reset](https://docs.docker.com/reference/compose-file/merge/),
[Caddy automatic HTTPS](https://caddyserver.com/docs/automatic-https),
[Caddy forwarding defaults](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy),
[Django HTTPS proxy trust](https://docs.djangoproject.com/en/5.2/ref/settings/#secure-proxy-ssl-header).
