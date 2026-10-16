# Intermittent disposable Render verification (#110)

Status: investigation only; no cause or repair established.

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

No baseline invocation has run yet. The instrumentation's offline regressions
must pass focused privacy review before the first branch push. Passing runs alone
will not be called a repair.
