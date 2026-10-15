# Render Free fictional demos (#76)

Status: the owner selected Render Free and accepted resetting fictional demo data.
Account connection, public staging/production-demo URLs and hosted rollback evidence
are still pending. This document does not claim a public deployment exists. The
real club remains separate and must use retained storage before real data entry.

## Selected free plan and storage policy

The root `render.yaml` declares two separate Docker web services, each explicitly
`plan: free`, with its own generated secret and isolated SQLite/media filesystem.
No database, persistent disk, cron service, paid environment or custom domain is
requested. Automatic deployment is off until gated delivery in #77. The current
review branch is explicit so the first deployment does not depend on merging an
issue whose hosted acceptance evidence is still outstanding.

Conditions checked 2026-10-15: free services sleep after 15 idle minutes; their
filesystem is discarded on spin-down/restart/redeploy. Both demos share 750 included
instance-hours per month. Keep the account without a payment method: exceeding
included usage can suspend services/builds instead of charging. Each free service
has 512 MB memory and limited CPU; cold starts are expected. [Free limits](https://render.com/docs/free),
[service plans](https://render.com/docs/blueprint-spec).

Every startup runs migrations and the existing guarded `seed_demo` command before
serving traffic. Existing marked demo data is preserved if a process restarts with
the same filesystem; a new discarded filesystem receives fresh fixtures. Reviewer
edits/uploads/sessions are disposable, not backed-up club history. Rollback means
starting the older reviewed image with its compatible fresh fictional fixtures;
it does not recover discarded edits. Never copy real club data into these services.

For a future retained installation, the [portable Compose recipe](deployment.md)
and existing backup/restore commands remain available. Switching hosts does not
require replacing SQLite, but data discarded by this demo host cannot be recovered.

## Single-container runtime and ingress

`deploy/render/Dockerfile` builds the existing HTTP-mode frontend and locked Python
dependencies. Debian's free/open-source Nginx package supplies the same static/API
proxy pattern within one container because Render Free does not run Compose or a
private backend service. No new application dependency or API endpoint is added.

Render owns public TLS and HTTP-to-HTTPS forwarding. The container listens on
`0.0.0.0:$PORT`; Nginx sends API traffic to Gunicorn bound only to `127.0.0.1:8000`,
overwriting forwarded protocol to HTTPS and stripping forwarded client IP. This
trust configuration is for Render's ingress only, not a directly exposed HTTP club
server. The existing 3 MiB body cap, connection/request limits, privacy headers and
disabled raw request/error logs remain. Peer budgets are shared behind the proxy.

Both processes run as UID 10001. The Python entry point supervises them, fails if
either exits unexpectedly and forwards shutdown, with bounded termination waits.
Startup requires explicit demo mode, a private generated secret, a valid hostname
from `RENDER_EXTERNAL_HOSTNAME`, dedicated `/tmp/bookclub-render` storage and no
Discord credentials. It fixes production security settings regardless of inherited
development variables. Real-club storage paths are refused. The real club's future
authentication choice is separate; the public demo needs no Discord account.

## Account connection and first deployment

After reviewing passing checks, the owner can open this branch-specific Blueprint:

[Review the Render Free deployment](https://render.com/deploy?repo=https://github.com/rferper/small-bookclub/tree/issue-76-public-demo)

Sign up/sign in to Render in the owner's own browser. This does not require a
connected browser session in the coding agent or sharing a password/API key. Review
that both listed services are **Free**, have distinct names/generated secrets, and
no paid add-ons or payment method. Then approve their creation. The public GitHub
source is sufficient; authorize only this repository if Render asks for GitHub
access. Check that Blueprint Auto Sync is off as well as service auto-deploys,
so later source/config changes require a deliberate rollout until #77.

Render supplies each actual `onrender.com` hostname; it may append a suffix if a
name is already taken. No DNS purchase or hardcoded hostname is needed. Record the
two real URLs and deployed source commit after creation, and run the smoke below.
The account connection is the remaining owner step under AGENTS.md; credentials
must stay in Render's private settings, outside git/chat/logs/screenshots.

For later manual changes, use the service's **Manual Deploy** control to deploy a
specific reviewed commit. Deploy staging first and verify it before selecting that
same commit for production-demo. To demonstrate rollback on staging, deploy a
second known-good revision, choose the previous successful deploy's rollback action,
then rerun smoke and restore the intended revision. Render Free keeps only its two
most recent previous deploys available for rollback. [Deployment controls](https://render.com/docs/deploys),
[free rollback limits](https://render.com/docs/free).

Migrations/seed run inside startup rather than a paid pre-deploy/one-off job. Free
services have no operator shell/one-off job facility. Do not add an admin or public
reset/export endpoint to work around that limitation; the existing demo member is
an ordinary member and a discarded filesystem safely reseeds at startup.

## Local artifact verification

With Docker, frontend dependencies and Chromium installed, run from the root:

```sh
node deploy/render/verify.mjs
```

This uses the repository Compose files with an explicit test override. Two random
projects, independent secrets, four unused loopback ports, separate TLS CAs and
512 MB Render-image memory caps isolate staging/production-demo. The outer proxy
forwards every asset and API request to the actual single-container artifact.
Only fictional data is seeded. Checks cover verified TLS, real demo sign-in/library/
sign-out, a profile edit/reload, cross-environment profile/session isolation,
locked ratings, and container recreation followed by reset/reseed. The script prints
the temporary screenshot directory; inspect both screenshots. Subprocesses are
bounded to 300 seconds, Compose readiness to 180, smoke subprocesses to 180 and TLS
readiness to 30 attempts. Normal success/failure closes browsers and removes only
the printed projects' containers/networks/volumes. Abrupt interruption can prevent
cleanup; use those exact project names and the same three Compose files to inspect
and remove them, preserving owner resources. Local tests do not replace hosted
provider verification.

## Reusable post-deploy smoke

Install the existing frontend dependencies and Chromium, then run from the root:

```sh
DEMO_URL=https://<actual-staging-host> node deploy/smoke-demo.mjs
DEMO_URL=https://<actual-production-demo-host> node deploy/smoke-demo.mjs
```

`DEMO_URL` must be an explicit HTTPS origin with no embedded credentials, path,
query or fragment. TLS verification is mandatory for public hosts. Liveness may
retry for up to 120 seconds for a free-host cold start (10-second requests and
2-second intervals); application/sign-in assertions do not retry failures. Browser
actions have a 15-second default timeout. Run the whole command under the release
job's bounded timeout too.

The check refuses sign-in unless `/api/session` advertises the existing guarded
fictional demo, then uses the real Spanish sign-in button, real API client and
Django session. It checks ordinary-member role, Secure/Lax CSRF cookies,
Secure/HttpOnly/Lax session cookies, the home and library API/UI, privacy headers,
horizontal layout and browser/network errors. It signs out at the end. It creates
no book, vote, review, reading-progress or profile changes and uses no Discord
credentials. A demo-off real club instance is rejected before sign-in.

Optionally set `SMOKE_SCREENSHOT` to a dedicated evidence filename. The existing
`node deploy/verify-production.mjs` invokes this check on an isolated local TLS
stack, supplies its public CA via `SMOKE_LOCAL_CA`, inspects the library and cleans
the stack. That CA option is accepted only for loopback hosts; it never installs
host trust or relaxes public TLS validation. Local success is not public-host
acceptance evidence. Browser contexts are closed in `finally`; abrupt termination
can prevent cleanup, so retain a bounded job and inspect failed runs.

## Hosted release and rollback evidence still required

After account connection, record service identifiers and actual URLs here. Carry
out this sequence on fictional data only:

1. Record the source commit and current deployed revision. Verify staging and
   production-demo use distinct hostnames, secrets and database/media storage.
2. Capture a consistent backup where persistence is retained. Keep private backup
   material out of web roots, source control, screenshots and public CI artifacts.
3. Deploy the candidate to staging. Apply migrations before traffic and seed only
   through the guarded `seed_demo` command on its intended fictional installation.
   Confirm the provider reports the intended source revision.
4. Run the HTTPS smoke against the actual staging URL and inspect the optional
   screenshot. Check that staging edits cannot change production-demo content.
5. Deploy the same tested revision to production-demo and run the same smoke at
   its actual URL. Record both URLs and timestamped outcomes in the issue handoff.
6. Exercise the provider's documented rollback with a previous known-good source
   revision, run the smoke again, then restore the intended candidate if appropriate.
   Application rollback alone is not database rollback. If schema compatibility is
   uncertain, stop writers and recover the matching snapshot into new isolated
   storage before cutover, as described in [deployment.md](deployment.md).

The accepted Render reset policy does not recover discarded writes. Do not install
automatic CD until #76 has actual hosted
evidence; #77 will gate delivery on CI and reuse this smoke command. Public URLs
and a demonstrated rollback remain open acceptance criteria, not documentation-only
checkboxes.
