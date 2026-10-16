# Render Free fictional demos (#76)

Status: both Render Free services are live on candidate `4cbb767`. Public HTTPS
smoke, native profile persistence, environment isolation, staged promotion and
actual provider rollback/reset checks passed on 2026-10-16; evidence is below.
The real club remains separate and must use retained storage before real data entry.

| Environment | Public URL | Provider service ID |
| --- | --- | --- |
| Staging | https://small-bookclub-staging.onrender.com | `srv-db8tjebbc2fs73c55du0` |
| Production-demo | https://small-bookclub-demo.onrender.com | `srv-db8tjebbc2fs73c55dtg` |

## Selected free plan and storage policy

The root `render.yaml` declares two separate Docker web services, each explicitly
`plan: free`, with its own generated secret and isolated SQLite/media filesystem.
No database, persistent disk, cron service, paid environment or custom domain is
requested. Native service auto-deploy and Blueprint Auto Sync stay off;
[GitHub delivery](release-process.md) controls the tested staging-to-demo order.
The Blueprint tracks main; hook triggers explicitly pin the tested commit.

Conditions rechecked 2026-10-16: free services sleep after 15 idle minutes; their
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

For a fresh installation after reviewing passing checks, open the main Blueprint:

[Review the Render Free deployment](https://render.com/deploy?repo=https://github.com/rferper/small-bookclub/tree/main)

Sign up/sign in to Render in the owner's own browser. This does not require a
connected browser session in the coding agent or sharing a password/API key. Review
that both listed services are **Free**, have distinct names/generated secrets, and
no paid add-ons or payment method. Then approve their creation. The public GitHub
source is sufficient; authorize only this repository if Render asks for GitHub
access. Check that Blueprint Auto Sync is off as well as service auto-deploys,
so source/config changes follow the gated GitHub release process.

Render supplies each actual `onrender.com` hostname; it may append a suffix if a
name is already taken. No DNS purchase or hardcoded hostname is needed. Record the
two real URLs and deployed source commit after creation, and run the smoke below.
The owner performs account operations under AGENTS.md; credentials must stay in
Render's private settings, outside git/chat/logs/screenshots.

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

## Terminal access to the existing Render services

This project is operated from a terminal; ChatGPT plugin installation/connection
is not part of the workflow. The free, Apache-2.0 official Render CLI can inspect
services/deployments and trigger deployment of an explicit commit. On Windows:

```powershell
winget install --id Render.CLI --exact --source winget
# Open a new PowerShell tab after installation so PATH is refreshed.
render --version
render login
```

The owner completes the browser's **Authorize CLI** step and selects the workspace
containing the two existing demo services. This is the owner's ordinary browser,
not a browser connected to the agent. The CLI stores its token locally outside
the repository; never paste it, its configuration file or an API key into chat,
git or logs. After login, the agent can inspect the two known services and their
deployment metadata before operating on their exact IDs. Do not create replacement
services or modify unrelated resources. Native automatic deployments remain off; see [GitHub delivery](release-process.md).
See the [official CLI setup and command reference](https://render.com/docs/cli).

The CLI/API access is now owner-authorized. Before any mutation, check the exact
service name/repository, Free plan, auto-deploy off and current deploy revision.
The service IDs below are identifiers, not credentials:

```powershell
$stagingId = 'srv-db8tjebbc2fs73c55du0'
$demoId = 'srv-db8tjebbc2fs73c55dtg'
render services -o json
render deploys list $stagingId -o json
render deploys list $demoId -o json
```

Deploy the reviewed, CI-passing candidate to staging first. Capture the returned
deployment ID and poll the metadata until that exact ID is `live`; build/update
failure or a ten-minute deadline is failure, never successful readiness. Do not
promote merely because the previous deployment still answers health requests.

```powershell
$candidate = '4cbb767c90d31b8ef54341ca40d8390d3d229a65'
render deploys create $stagingId --commit $candidate -o json --confirm
# Wait for the returned ID to be live at the intended commit, then:
$env:DEMO_URL = 'https://small-bookclub-staging.onrender.com'
node deploy/smoke-demo.mjs
# Only after staging passes, promote the same source:
render deploys create $demoId --commit $candidate -o json --confirm
# Wait for this returned ID to be live, then:
$env:DEMO_URL = 'https://small-bookclub-demo.onrender.com'
node deploy/smoke-demo.mjs
```

Every new instance automatically runs `python manage.py migrate --noinput` and
`python manage.py seed_demo` before Nginx/Gunicorn start. No operator shell,
paid pre-deploy job or separate migration command is required on Render Free.
Startup failure exits nonzero; the provider keeps the prior successful instance.
Inspect only allowlisted migration-success/seed-created events in provider logs;
never publish raw request errors, environment values or CLI token configuration.

For an intentional fictional storage reset/recovery on staging, the CLI's exact
restart command is:

```powershell
render restart $stagingId -o json --confirm
render services instances $stagingId -o json
# Confirm replacement-instance startup/readiness, then rerun staging HTTPS smoke.
```

Restart/redeploy recovery reseeds disposable fixtures; it does not restore reviewer
edits. A restart can retain the same deployment ID: confirm the new instance and
its startup events, not a nonexistent new deploy record. The retained real-club
backup/restore process remains in [deployment.md](deployment.md).

### Actual provider rollback from the terminal

CLI v2.29.0 has no rollback subcommand. Use Render's documented
[rollback API](https://api-docs.render.com/reference/rollback-deploy), which reuses
the previous build artifact, rather than describing a newly built old commit as a
provider rollback. Choose a still-retained successful staging deployment from
`render deploys list`; Free retains only two previous artifacts. The following
PowerShell command uses the owner's local CLI token privately. Replace the example
target with the currently intended known-good deployment ID before running:

```powershell
@'
import json, pathlib, urllib.error, urllib.request, yaml
service_id = 'srv-db8tjebbc2fs73c55du0'  # Staging only.
target_deploy = 'dep-db8uasqvcj2c73b8hntg'  # Historical example; check retention.
config = yaml.safe_load((pathlib.Path.home()/'.render'/'cli.yaml').read_text())
headers = {'Authorization': 'Bearer '+config['api']['key'],
           'Accept': 'application/json', 'Content-Type': 'application/json'}
def api(path, payload=None):
    body = json.dumps(payload).encode() if payload else None
    req = urllib.request.Request('https://api.render.com/v1'+path,
                                 headers=headers, data=body)
    try:
        with urllib.request.urlopen(req, timeout=30) as response:
            return json.load(response)
    except urllib.error.HTTPError as error:
        raise SystemExit('Render API HTTP '+str(error.code)) from None
service = api('/services/'+service_id)
assert service['name'] == 'small-bookclub-staging'
assert service['repo'] == 'https://github.com/rferper/small-bookclub'
assert service['serviceDetails']['plan'] == 'free'
assert service['autoDeploy'] == 'no'
previous = api('/services/'+service_id+'/deploys/'+target_deploy)
assert previous['status'] in ('live', 'deactivated')
result = api('/services/'+service_id+'/rollback', {'deployId': target_deploy})
print(json.dumps({key: result.get(key) for key in ('id','status','createdAt')}))
'@ | uv run --project backend python -
```

Poll the returned rollback deployment ID until live, verify the expected source
revision and rerun public smoke. Do not retry an uncertain POST blindly: inspect
deployment metadata first. API rollback leaves auto-deploy settings unchanged;
keep them off. A rollback does not reverse database migrations. The demonstrated
`43faf1d`/`4cbb767` pair has identical application code and schema; new instances
initialize a fresh fictional database. For future schema changes, verify the
older image can initialize its own compatible fixtures before rollback; never
attach a newer retained database to older code without a tested recovery plan.

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

## Hosted verification, 2026-10-16

The owner supplied both public URLs. The existing smoke passed against each actual
host with strict public certificate verification, the real Spanish sign-in UI,
ordinary-member identity, home/library APIs, Secure/HttpOnly/Lax session cookies,
Secure/Lax CSRF cookies, HTML privacy headers and sign-out. Both fictional library
screenshots were inspected. Run from the repository root in PowerShell:

```powershell
$env:DEMO_URL = 'https://small-bookclub-staging.onrender.com'
node deploy/smoke-demo.mjs
$env:DEMO_URL = 'https://small-bookclub-demo.onrender.com'
node deploy/smoke-demo.mjs
Remove-Item Env:DEMO_URL
```

An additional terminal Playwright check passed at `2026-10-16T08:05:39.940Z`:
both sessions were ordinary fictional members; each host rejected the other host's
session with 401; finished-book club ratings returned exactly `{ "status": "locked" }`.
A unique fictional staging display name was saved through the real profile UI,
survived page reload and matched the native API response, while production-demo's
display name stayed unchanged. The original staging value was restored, verified
after reload, and both verification sessions signed out. No uploads, books,
ratings or reading progress were changed. The check guarded demo availability
before sign-in and refused restoration over an unexpected concurrent display-name
edit. Temporary script/screenshots contain only fictional data and stay outside git.

The owner initially copied each service's successful Events entry: `43faf1d`, live
on 2026-10-16 at 10:03 Europe/Madrid (08:03 UTC). Subsequent owner-authorized CLI/API
access independently confirmed both initial deploys and the rollout below.
[Full source CI passed](https://github.com/rferper/small-bookclub/actions/runs/38869216657).

An independent risk-focused security review found no blocking findings in the
reviewed source or observable public behavior. Its separate strict-TLS health/
session reads at `2026-10-16T08:06:40Z` verified anonymous guarded-demo bootstrap,
Secure CSRF and privacy/HSTS headers on both hosts, including requests carrying
client-supplied forwarding headers.

The later independent review also checked actual provider metadata: both services
are Free/manual/demo with distinct nonempty secrets, blank Discord credentials,
expected ephemeral storage and no persistent disks. The `small-bookclub-demos`
Blueprint (`exs-db8tinjl550s73f5clqg`) has Auto Sync off. Secret values were compared
in memory only, never recorded. Provider settings and hosted behavior are now
supported by the following additional evidence, rather than the initial public
read-only observation alone.

### Hosted rollout and rollback evidence

All times below are UTC on 2026-10-16. Full candidate source:
`4cbb767c90d31b8ef54341ca40d8390d3d229a65`; previous known-good source:
`43faf1da5fe37ddd298ac4bc3f9b550b5ef58699`. They have identical application/image
inputs and schema; differences are deployment documentation. Later verification
error-redaction/documentation commits do not change the deployed application.

| Operation | Source | Provider deploy ID | Live at | Result |
| --- | --- | --- | --- | --- |
| Initial staging | `43faf1d` | `dep-db8tjejbc2fs73c55eug` | 08:03:19.378111 | Smoke PASS |
| Initial production-demo | `43faf1d` | `dep-db8tjerbc2fs73c55fn0` | 08:03:43.966298 | Smoke PASS |
| Candidate staging | `4cbb767` | `dep-db8u90mq1p3s739dtjc0` | 08:48:26.071590 | Smoke PASS; screenshot 08:48:53 |
| Actual staging rollback | `43faf1d` | `dep-db8uasqvcj2c73b8hntg` | 08:52:23.502336 | `trigger: rollback`; smoke PASS; screenshot 08:53:41 |
| Restore staging candidate | `4cbb767` | `dep-db8ucf0n74is73csaro0` | 08:55:55.100777 | Smoke PASS; screenshot 08:56:36 |
| Promote production-demo | `4cbb767` | `dep-db8udjjbc2fs73c7ruqg` | 08:58:21.379793 | Smoke PASS; screenshot 08:59:04 |

Only after each exact deployment was live was its public URL checked with
`DEMO_URL=<that HTTPS origin> node deploy/smoke-demo.mjs`. Every smoke passed
strict TLS, actual UI/API member sign-in/home/library/sign-out, cookies/privacy,
layout and browser/network checks. The screenshots were inspected. Production-demo
stayed on its initial known-good version throughout the staging candidate/rollback/
restore sequence, then received the same candidate after staging smoke passed.

At `08:50:33.464Z`, a controlled terminal Playwright check saved a fictional staging
display-name marker and a generated 16x16 PNG avatar through the native profile UI.
They survived reload; the authenticated avatar request returned 200, an anonymous
request returned 401 and the same path on production-demo returned 404. The demo's
profile/avatar stayed unchanged. This marker was intentionally retained across
the immediately following provider rollback. At `08:53:44.525Z`, after that rollback
was live, the original seeded name/no-avatar had returned, the old avatar path
returned 404 to an authenticated member, production-demo remained unchanged,
fresh-seed club ratings were exactly locked, and foreign sessions were rejected
with 401 in both directions. Verification sessions signed out.

Allowlisted provider startup events independently showed 55 successful migrations
and `Demo ficticia creada.` at `08:52:01.19522128Z`, before rollback became live.
Production-demo promotion likewise recorded 55 successful migrations and fresh
seeding at `08:57:56.273626359Z`, before it became live. Raw provider logs and token/
environment values are not published. This confirms fresh hosted initialization,
not recovery of discarded reviewer writes.

After promotion, native profile UI edits survived reload and matched the API on
staging at `08:59:08.593Z` and production-demo at `08:59:19.152Z`; both original
names were restored and sessions signed out. Hosted checks do not assume a shared
public reviewer account stays permanently locked: the exact locked assertion above
was specific to the controlled fresh-seed rollback state. Ongoing eligibility
may legitimately change when public reviewers complete/rate a book.

An additional staging-only restart test prepared another fictional profile/avatar
marker at `08:59:41.261Z`, then successfully ran
`render restart srv-db8tjebbc2fs73c55du0 -o json --confirm`. Render kept deployment
`dep-db8ucf0n74is73csaro0` and reported replacement instance
`srv-db8tjebbc2fs73c55du0-m5h2n`, created at `09:00:22Z`. Public smoke passed after
restart. The first generic reset verification returned failure without identifying
the assertion/request; its cause is unknown. Separate reads at `09:02:14.742Z`
confirmed the original seeded name, no avatar, old upload 404 and locked ratings.
Bounded provider logs recorded 55 migration successes and fresh seed creation at
`09:01:20.736932378Z` for that restart.
The complete reset/session-isolation check then passed at `09:02:58.578Z`, including
unchanged production-demo and foreign-session rejection in both directions.
Verification sessions signed out; no marker/upload remains. This records observed
restart reset/reseed behavior separately from the already successful rollback.

## Repeatable release and rollback procedure

Record provider service identifiers and actual deployed revisions, then carry out
this sequence on fictional data only:

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

The accepted Render reset policy does not recover discarded writes.
[Continuous delivery](release-process.md) gates GitHub releases on CI and reuses
the smoke command. Keep native service auto-deploy and Blueprint Auto Sync off.
