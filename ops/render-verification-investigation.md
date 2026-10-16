# Intermittent disposable Render verification (#110)

Status: **unresolved checkpoint**; three serial Linux baselines passed without
reproducing the historical failure. No cause or repair established. Awaiting
the owner's decision; no further experiment, merge or closure is authorized
by the initial budget.

The [pre-experiment hypothesis matrix](https://github.com/rferper/small-bookclub/issues/110#issuecomment-6215567213)
defines the evidence and stop conditions. The relevant baseline is
`db9ce6151164f8e6f49e2b0a29b11ea25a39945e`; initial changes add opt-in evidence,
not a behavior correction. Closed #77 and its accepted automatic release remain
unchanged. Public demos receive no investigation traffic.

## Historical observations

| Run | Sanitized observation (UTC, 2026-10-16) | Limit |
|---|---|---|
| [PR 38891150965 attempt 1](https://github.com/rferper/small-bookclub/actions/runs/38891150965/attempts/1) | One Render smoke passed at 11:09:26.133; later native `/api/home` network failure at 11:10:21.991; generic catch at 11:10:22.075. | Browser error code/protocol/canceled state were not captured. |
| [Same PR, attempt 2](https://github.com/rferper/small-bookclub/actions/runs/38891150965/attempts/2) | One Render smoke passed at 11:14:17.161; later native `/api/auth/demo` network failure at 11:15:11.462; generic catch at 11:15:11.551. | The changed failing path does not establish a common cause. |
| [Main 38893519614](https://github.com/rferper/small-bookclub/actions/runs/38893519614) | Render smokes passed at 11:29:20.016 and 11:29:35.015; controlled generic catch at 11:29:50.556, before any logged recreation command. | Approximately 15 seconds suggests a timed operation but does not identify it. No uncaught/unhandled/TimeoutError line was found. |

These historical logs identify Ubuntu 24.04.5, Node 24.21.0,
Playwright 1.64.1 and Chrome for Testing 156.0.8078.4. The separately diagnosed
Windows dependency-install collision and the proven saved-response observation
defect do not establish these historical causes.

## Experiment boundaries

Use the actual GitHub `ubuntu-latest` job, serially, with the existing base,
production and Render Compose overlays. Chromium connects to loopback Caddy TLS,
which forwards to frontend Nginx, then the Render image's Nginx/Gunicorn/Django.
Each environment has its own generated secret, ephemeral SQLite/media and exact
temporary Compose project. The backend retains the 512 MiB memory cap. Record
runtime/browser/proxy versions, runner kernel/CPU/memory and fixed container and
cgroup memory fields for each invocation; ordinary image-build logs identify
base-image digests and the runner setup identifies its image version.

Initial budget: **three serial baseline invocations maximum**. The branch push
starts invocation 1; only dispatch invocation 2/3 after its predecessor finishes.
Do not open a PR during this budget because its CI would duplicate experiments.
Stop early for a reproduced mechanism. Any later perturbation must have an
evidence-connected hypothesis and recorded prediction; at most three such
configurations, each with at most three serial invocations. An unused allowance
does not justify speculative configurations or repetition. If no mechanism
emerges, publish an unresolved checkpoint and await the owner's decision.

`BOOKCLUB_RENDER_EVIDENCE=1` opts the disposable verifier into fixed state/version
snapshots. Its child smoke additionally requires an explicitly fictional world,
loopback HTTPS origin and local CA. The CDP observer retains only fixed first-party
method/path pairs, allowlisted protocol/error, numeric status/duration and
canceled/blocked booleans. It never serializes CDP requests/responses, headers,
bodies, cookies, query strings, request IDs or raw exceptions. Pending state and
output have hard bounds. Container inspection requests only status/running/OOM,
exit code and restart count for the exact owned service IDs; cgroup counters and
memory peak are numeric. `Config.Env`, `State.Error`, labels, mounts and commands
are excluded. Public release jobs do not set this flag or receive this evidence.

## Execution log

The instrumentation received [independent privacy/security approval](https://github.com/rferper/small-bookclub/issues/110#issuecomment-6215653837)
before the first branch push. All baseline invocations use instrumentation commit
`726aea6d99c780ae49290b9081ccbe5b380ef7f8`, with relevant application/proxy
behavior unchanged from `db9ce61`. Passing runs alone are not a repair.

| Baseline | CI run | Result |
|---|---|---|
| 1 (branch push) | [38901854327](https://github.com/rferper/small-bookclub/actions/runs/38901854327) | All required checks passed; Render verification 12:43:22–12:44:17 UTC. Both native smokes and all subsequent phases completed, including exact-project cleanup. |
| 2 (serial manual dispatch) | [38937335400](https://github.com/rferper/small-bookclub/actions/runs/38937335400) | All required checks passed; Render verification 17:14:16–17:15:29 UTC. Both native smokes and all subsequent phases completed, including exact-project cleanup. |
| 3 (serial manual dispatch) | [38938366957](https://github.com/rferper/small-bookclub/actions/runs/38938366957) | All required checks passed; Render verification 17:21:32–17:22:53 UTC. Both native smokes and all subsequent phases completed, including exact-project cleanup. |

Baseline 1 ran on Ubuntu 24.04.5, runner image `20261012.334.1`, kernel
6.17.0, 4 CPUs and 16,766 MB memory. Node 24.21.0, Playwright 1.64.1 and
Chromium 156.0.8078.4 match the recorded historical versions. Both worlds used
Docker 28.0.4, Compose 2.38.2, Caddy 2.11.7, frontend Nginx 1.28.2,
backend Nginx 1.26.3, Python 3.13.16, Django 5.2.18 and Gunicorn 25.3.0.
The exact overlays are `docker-compose.yml`, `deploy/compose.production.yml`
and `tests/render/compose.yml`: loopback TLS, ephemeral backend storage and
512 MiB backend cap. Normal CI build logs retain resolved image digests.

All baseline 1 service snapshots were running with zero restart counts,
zero exit codes and `oomKilled=false`. All sampled cgroup low/high/max/OOM
counters were zero. Staging's pre-smoke peak was 125,685,760 bytes; its
123,228,160-byte pre-cleanup peak belongs to the deliberately recreated
backend, not the same container. Production-demo peaks were 127,524,864 and
128,212,992 bytes respectively. These samples give no evidence of memory
pressure in this run; they cannot exclude pressure in historical runs.

Observed first-party browser responses used HTTP/2. CDP reported
`ERR_ABORTED`, `canceled=true`, `blocked=false` after HTTP 204 for both
demo sign-in and logout in both worlds, while the native smoke's Playwright
request-failure assertion passed. These CDP events therefore do not by
themselves reproduce the historical failing smoke or prove a transport defect.
Both `/api/home` responses completed with HTTP 200. One production-demo
session request was pending when the observer flushed at smoke completion;
that bounded observation does not establish failure.

Local operator regressions were rerun on 2026-10-16:
`node --test deploy/render/release.test.mjs deploy/render/verify-diagnostics.test.mjs deploy/render/transport-evidence.test.mjs`
passed **60/60**. Baseline 1 also passed backend unit/integration/contract,
frontend tests/contract/type/lint/build/accessibility, native browser journeys
and production Compose verification in CI. Deployment was skipped by its
existing branch/event guards. Successful-run screenshots are not uploaded
by the existing failure-only artifact policy, so no screenshot inspection is
claimed from this run.

Baseline 2 used the same OS image, kernel, CPU count and all listed software
versions as baseline 1; reported runner memory was 16,765 MB. All service
snapshots again showed running, zero exit/restart and no OOM; all sampled
cgroup counters were zero. Staging peaks were 125,841,408 bytes before smoke
and 123,518,976 after deliberate recreation; production-demo peaks were
127,688,704 and 128,385,024 bytes. Both home requests completed over HTTP/2
with status 200. The same four post-204 canceled CDP events appeared without
failing the smoke. All observed requests finished before flush in this run.
Cleanup removed the exact `bookclub-render-staging-bdd41523` and
`bookclub-render-production-demo-f07039b1` projects' three containers, two
networks and two Caddy volumes each. Both deployment jobs were skipped.

Baseline 3 used the same OS image, kernel, CPU count and software versions;
runner memory was 16,766 MB. All service snapshots showed running, zero
exit/restart and no OOM; all sampled cgroup counters were zero. Staging peaks
were 127,467,520 bytes before smoke and 123,314,176 after deliberate recreation;
production-demo peaks were 125,231,104 and 127,012,864 bytes. Both home requests
completed over HTTP/2 with status 200. The same four post-204 canceled CDP
events appeared without failing the smoke; no observed request remained
pending at flush. Cleanup removed the exact `bookclub-render-staging-5160473d`
and `bookclub-render-production-demo-7ba62904` projects' three containers,
two networks and two Caddy volumes each. Deployment was skipped.

For completeness, baseline 1's cleaned projects were
`bookclub-render-staging-db958b7d` and
`bookclub-render-production-demo-d8607236`, with the same resource counts.
The Render backend has no persistent data volume; its ephemeral filesystem
is removed with its container. No local Docker operation, owner's database
mutation, preview restart or public-service experiment was needed in this
continuation. All three CI runs passed the complete checks listed above.
No success screenshots were retained for inspection under the existing
failure-only artifact policy; this remains a limitation, not visual QA PASS.

## Unresolved checkpoint and next decision

The initial budget is exhausted: **3/3 baseline invocations, zero perturbation
configurations**. No failure mechanism was reproduced on the relevant baseline,
so there is no focused correction, baseline-failing/repair-passing regression,
repair SHA or final independent QA PASS to claim. The previously fixed promise
observation defect remains distinct from these historical unknowns.

| Hypothesis | Result of the bounded samples |
|---|---|
| Browser lifecycle cancels a request and fails the smoke | Post-204 CDP cancellations were observed on every passing smoke, without Playwright request failures. This alone is insufficient to explain the historical failing home/auth requests. |
| Proxy/transport interruption | Observed responses used HTTP/2; no failing smoke or interruption signature was captured. HTTP/2 use alone does not justify disabling it. |
| Resource pressure or unexpected lifecycle | No sampled OOM/limit event or unexpected restart; resource pressure is unsupported for these samples, not ruled out historically. The explicit staging recreation still passed reset checks. |
| Later post-smoke operation fails | Every bootstrap/profile/isolation/spoiler/restart/reset phase completed in all three runs. The suppressed historical operation remains unrecoverable from its existing logs. |
| Stale DNS or a shared dependency-install collision explains history | Neither is established: historical main failed before recreation; the Windows collision does not match isolated CI installation order. |

**Recommended next option:** keep #110 open as unresolved, stop dedicated reruns
and resume the course backlog only after the owner's decision. A naturally
recurring failure with the reviewed diagnostics may provide the missing
mechanism. Accepting an investigation-only outcome would be a separate owner
decision and must not be described as a repair.

Alternatively, the owner may authorize a new bounded experiment after choosing
a concrete hypothesis and predicted failure signature. A possible investigation
would compare the reviewed opt-in CDP observer with the original observation
setup, because the current samples cannot exclude observer-induced timing
changes. This is only an experimental limitation, not an observed cause; a
new plan would need to preserve closed request/phase evidence and all guards.
There is no evidence at this checkpoint to select a transport, timeout or
application-behavior correction.

The report is committed locally without a branch push, which would otherwise
start an unbudgeted fourth CI baseline. The GitHub issue checkpoint retains
run links and conclusions. No PR, merge, issue closure or final repair QA is
performed at this unresolved stop.
