# Public demo deployment preparation (#76)

Status: the local HTTPS stack and reusable smoke check are verified. A hosting
account, public staging/production-demo URLs and hosted rollback evidence are
still pending. This document does not claim a public deployment exists. The real
club remains deferred; every public environment must contain fictional data only.

## Hosting decision boundary

A free Linux VM can run the existing [production Compose recipe](deployment.md)
with persistent SQLite and private media. Use separate projects, hostnames,
secrets, backup locations and volumes for staging and production-demo. On one
machine the current standalone edge owns ports 80/443; a shared edge design must
be implemented and tested before putting both projects behind those ports.
Alternatively, separate approved free VMs can use the standalone recipe directly.
No VM, region, account, DNS hostname or credential has been selected/provisioned.

Current alternatives checked 2026-10-15:

- Render Free supports fictional previews, but SQLite/uploads disappear on
  restart/redeploy/spin-down. Staging and production-demo share the workspace's
  included runtime allowance. Without a payment method, excess usage suspends
  services/builds instead of charging. A resetting demo policy needs the owner's
  explicit acceptance and a separately tested single-container adapter; none is
  claimed here. [Official limits](https://render.com/docs/free).
- Oracle Always Free is a VM candidate with account/card verification and
  capacity constraints. Trial credits are not an ongoing-free hosting plan.
  Provision only approved Always Free resources; no billing upgrade is authorized.
  [Official information](https://www.oracle.com/cloud/free/).
- Fly.io's finite trial is insufficient for the ongoing-free requirement.
  [Trial terms](https://fly.io/docs/about/free-trial/).
- PythonAnywhere Free offers only one web app, so it does not directly provide
  both required environments. [Free features](https://help.pythonanywhere.com/pages/FreeAccountsFeatures/).

Account/secret access requires approval under AGENTS.md. Do not paste credentials
into chat or issue comments. The requested hosting-account clarification must be
resolved before provider-specific implementation or public deployment. A provider's
free-plan name alone does not authorize payment details, billing upgrades or paid
resources.

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

Once a host/account is approved, implement its adapter and record exact commands,
service identifiers and limits here. Then carry out this sequence on fictional
data only:

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

The precise rollback operation depends on the approved host. An ephemeral Render
demo would need an explicitly accepted fixture-reset policy rather than pretending
to recover discarded writes. Do not install automatic CD until #76 has actual hosted
evidence; #77 will gate delivery on CI and reuse this smoke command. Public URLs
and a demonstrated rollback remain open acceptance criteria, not documentation-only
checkboxes.
