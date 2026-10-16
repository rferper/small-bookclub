# Continuous delivery (#77)

## Scope and activation status

This flow delivers only the existing resetting fictional Render Free services:
[staging](https://small-bookclub-staging.onrender.com) and the
[reviewer demo](https://small-bookclub-demo.onrender.com). It never deploys the
private club or provisions paid resources. SQLite/uploads remain disposable;
startup migrates and safely initializes fictional fixtures before serving traffic.

Delivery requires the two service-specific GitHub secrets below and this workflow
on main. The owner-provided hooks were installed through hidden terminal input on
2026-10-16. A passing branch check alone does not prove that automatic delivery has
happened. The [issue #77 verification and activation log](https://github.com/rferper/small-bookclub/issues/77)
records the observed main run, provider revisions and smoke results; use that log
to distinguish prepared configuration from a completed hosted release.

## How delivery runs

1. `.github/workflows/ci.yml` keeps the complete backend/frontend/contract/lint/
   build/accessibility/native/HTTPS/Render artifact checks. Its required aggregate
   must succeed before the `deploy` job can call `.github/workflows/deploy.yml`.
2. Only a `push` to `refs/heads/main` in `rferper/small-bookclub` may deploy. Branch,
   PR, fork and manual CI runs do not reach release steps or deployment secrets.
   The reusable workflow and Node runner independently repeat those guards.
3. Staging receives its own deploy hook only in the release step, after dependency
   and browser installation. The runner checks the current main SHA through
   GitHub's read-only token and posts the exact tested full SHA to the fixed
   staging service hook once. Render builds that revision's image; its existing
   guarded startup performs migrations and fictional seeding.
4. For at most ten minutes, the runner checks strict public HTTPS, the intended
   running revision at the frontend root and successful Django health. A previous
   still-healthy instance with a different revision cannot satisfy readiness.
5. The existing native Playwright smoke verifies the intended revision in the
   browser, real demo member sign-in/home/library/sign-out, secure cookies,
   privacy headers and browser/network checks. Its subprocess gets no deploy-hook,
   GitHub token, local test CA or TLS override. It is bounded to three minutes.
6. Only a delivered staging result permits the production-demo job. That job has
   only its own hook and repeats the current-main, exact-revision, health and
   browser checks for the same tested commit.

Main CI/delivery is serialized with `cancel-in-progress: false`; branch and PR
checks remain cancellable. New pushes do not interrupt an active promotion midway.
Before each trigger, a superseded main commit skips delivery. Main can still
advance just after that check: an already-started deployment remains a previously
tested candidate, while the next queued successful main run advances the demos.
No untested latest-branch build is substituted for the explicit SHA.

The running revision comes from Render's validated 40-hex `RENDER_GIT_COMMIT`.
Nginx exposes `X-Bookclub-Revision` only for an exact `/` request, preserving all
privacy headers and leaving JSON APIs unchanged. It contains a public source SHA,
not a credential. Normal UI text and API payloads are unchanged.

## One-time terminal setup

Use the already owner-authorized Render CLI for inspection; credentials stay in
its private local configuration. Do not upload an account-wide Render API key or
the expiring local CLI token to GitHub. The two service deploy hooks authorize
only deploys of their respective existing service. Native Render auto-deploys and
Blueprint Auto Sync must stay **off**: GitHub controls the staging order.

Render exposes each secret hook in that service's **Settings → Deploy Hook**.
The public service metadata/API does not return those values. After the artifact
passes tests and independent security review, the owner can copy each hook from
their ordinary Render dashboard and enter it at the hidden prompt in PowerShell:

```powershell
gh secret set RENDER_STAGING_DEPLOY_HOOK --repo rferper/small-bookclub
gh secret set RENDER_DEMO_DEPLOY_HOOK --repo rferper/small-bookclub
gh secret list --repo rferper/small-bookclub
```

Use the staging hook for `small-bookclub-staging` (`srv-db8tjebbc2fs73c55du0`) and
the demo hook for `small-bookclub-demo` (`srv-db8tjebbc2fs73c55dtg`). The runner
rejects a swapped service, non-HTTPS origin, credentials/fragment, duplicate query
keys or an unexpected URL path. Do not paste values into chat, command arguments,
source files, logs or screenshots. `gh secret list` shows names/timestamps only.
This needs no ChatGPT plugin or browser connected to the coding agent.

`render.yaml` declares both services on `main` with native auto-deploy off. Keep
the existing services, generated session secrets and storage policy; inspect exact
IDs before any provider update. Do not create replacements or resync an unrelated
Blueprint. The [provider guide](public-demo.md) documents terminal login and
manual inspection/rollback commands.

## Failures and recovery

- Missing/malformed configuration or a failed current-main check fails before
  using a hook. A superseded commit is explicitly skipped, never marked delivered.
- A hook HTTP error, redirect, malformed response or queued `202` without a clear
  deployment ID fails. An uncertain POST is not retried blindly; inspect provider
  deployment metadata before trying again.
- Build/migration/startup failure leaves the old instance or times out waiting for
  the intended revision. Old health alone never passes candidate readiness.
- Readiness/smoke failure exits nonzero; failed staging cannot promote production.
  A smoke failure can leave staging on the new candidate, while production-demo
  retains its last working version. A failed production smoke reports failure
  rather than claiming readiness or automatically reversing database changes.
- Errors use controlled phase names. Raw request exceptions, hook URLs, headers,
  cookies and response bodies are not logged. Investigate privately through the
  owner-authorized CLI and allowlisted startup events.

To pause delivery, remove the two repository hook secrets (or revert the CI caller)
and leave native auto-deploy/Auto Sync off. Subsequent main release jobs fail
closed; existing demos keep serving their current version. For a compromised
hook, regenerate that service's hook in Render and replace only its GitHub secret.

For rollback, use the previously tested
[actual provider rollback and reset procedure](public-demo.md#actual-provider-rollback-from-the-terminal).
Free retains only two previous build artifacts. The database/media are reset and
reseeded, not recovered reviewer edits. Application rollback is not database
rollback; verify the older image can initialize its matching fixtures. Broader
versioned images/tags and release policy remain #78.

## Verification

The [initial full candidate CI](https://github.com/rferper/small-bookclub/actions/runs/38881729628)
passed application, contract, accessibility, native browser, HTTPS and Render
artifact checks. The [isolated assertion-failure probe](https://github.com/rferper/small-bookclub/actions/runs/38882156277)
failed the required aggregate and skipped delivery; its branch/worktree were
removed and the failing test was never merged. Local full suites passed with
1,603 backend tests (one skipped) and 1,273 frontend tests. The final hook-key
validation adds shorter fictional keys and empty/invalid/oversized rejection;
all 42 offline release tests pass. Both [initial security review](https://github.com/rferper/small-bookclub/issues/77#issuecomment-6212625537)
and [key-validation delta review](https://github.com/rferper/small-bookclub/issues/77#issuecomment-6214046561)
passed. These preparation results do not replace the hosted activation log above.

From the repository root, run the offline release tests:

```powershell
node --test deploy/render/release.test.mjs deploy/render/verify-diagnostics.test.mjs
```

They evaluate the actual caller/reusable workflow guards across trusted/untrusted
events and prerequisite outcomes, with injected HTTP/clock/browser boundaries.
They also exercise exact-ref triggers, stale main, old running revisions, deadline/
health/trigger/smoke failure, wrong-service hooks and secret-safe error/child-env
handling. They require no Render account or public network. Backend CI runs them
before its application tests.

Run the existing full application checks as documented in [testing.md](testing.md).
The disposable `node deploy/render/verify.mjs` verifies the actual image's root
revision header, absence of that header on JSON APIs, native browser smoke,
isolation and reset/reseed. Inspect its fictional screenshots and allow its exact
temporary projects to clean up; preserve the owner's database/preview.

The verifier prints each environment/phase as it starts and completes. A failure
reports that active phase, the last completed phase, and a fixed classification
(request failure, API timeout, browser timeout, assertion, HTTP status, JSON,
startup/cleanup command, TLS readiness or native smoke). Bounded request context
contains only approved method/path pairs, status codes or allowlisted browser
network codes. Raw exceptions and their automatic cookie headers stay suppressed.
The optional `staging-verifier.png` records the fictional profile page separately
from the native-smoke screenshots; CI retains only these named PNGs for three days.

To exercise failure handling in real disposable stacks, the local verifier accepts
only these explicit probes (each is expected to exit **1**):

```powershell
node deploy/render/verify.mjs --fault=api-bootstrap
node deploy/render/verify.mjs --fault=profile-edit
node deploy/render/verify.mjs --fault=cleanup
```

They inject a controlled failure after the selected staging phase. All temporary
projects still run cleanup; the cleanup probe injects only after removal succeeds.
These probes do not deploy publicly or explain earlier CI network failures. The
normal invocation retains every assertion with no retries or increased timeouts.
The saved profile response and button click are observed together so a rejected
response wait cannot terminate Node outside the verifier's safe catch while a
click remains pending; the subprocess regression distinguishes the former sequence
from this correction. No evidence currently links that confirmed defect to the
earlier `/api/home`, `/api/auth/demo` or generic post-smoke failures.

After activation, inspect the automatic main run:

```powershell
gh run list --workflow ci.yml --branch main
gh run view <run-id>
render deploys list srv-db8tjebbc2fs73c55du0 -o json
render deploys list srv-db8tjebbc2fs73c55dtg -o json
```

Record the main SHA, successful CI aggregate, staging deploy/smoke followed by
production-demo deploy/smoke and provider revisions. Also retain failure-probe
evidence that failed CI blocks release. Do not treat a trigger response, an old
healthy instance, or a branch-only run as completed automatic delivery.
