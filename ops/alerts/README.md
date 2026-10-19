# Local user-impact alert

The explicit [observability overlay](../observability/README.md) loads one
`BookclubApiErrors` rule from [alerts.yaml](../alerts.yaml). At least three
server errors and a 20% or greater error share among known API responses over
two minutes must persist for one minute. It groups by environment and release,
so a previous release cannot mask a new release's failures. Health checks,
unmatched routes and the status-less cardinality overflow rollup are excluded.
4xx responses alone do not fire. This threshold fits a small, low-traffic club;
it is an operational signal, not an availability SLO or count of distinct people.

## Start and watch

From the repository root, with Docker running:

```powershell
docker compose -f docker-compose.yml -f ops/compose.observability.yml up --build -d
docker compose -f docker-compose.yml -f ops/compose.observability.yml logs -f alert-receiver
```

**The watched terminal is the notification channel.** Keep it open to be told
about firing and resolved events. This does not deliver phone/email/Discord
notifications, monitor Render, or operate when the local stack is stopped.
Default Compose and Render telemetry remain disabled. Do not enable this overlay
on a public host or combine it with the production overlay.

Prometheus sends alerts to private Alertmanager, which groups by alert/environment/
release, waits five seconds, then sends the private receiver a webhook. State
changes are grouped every five seconds; unchanged firing groups repeat hourly.
Prometheus evaluates every five seconds and scrapes every five seconds, in
addition to Collector/SDK export delays. Delivery is asynchronous and best effort.
Alertmanager retries failed webhook delivery; it does not guarantee an on-time
notification. Its dedicated volume retains deduplication state for 24 hours.

The receiver prints only a fixed Spanish summary, alert/severity/service,
validated environment and release, bounded error ratio, the configured threshold
and time window, a fixed runbook path, state and server receipt time. The ratio is
the rule's most recent alert annotation, not a fresh calculation at receipt time.
Incoming arbitrary annotations, URLs, headers and content are not copied. No
notification contains member identity, book details, review text or credentials.
The receiver has no outward calls, action execution, durable event database or
published port. Its internal `GET /events` returns the latest 64 projected
notifications for verification and read-only inspection. Webhooks are limited to
32 KiB/eight alerts; connections and timeouts are bounded; Docker rotates its
console logs at 1 MiB across three files. Treat the internal network as trusted:
these operational services have no authentication and private peers can forge
input. They must remain on the isolated monitoring network.

## Trigger and recover safely

Run the existing exact-project verifier:

```powershell
node ops/verify-observability.mjs
```

It validates the production Prometheus/Alertmanager configuration and runs the
rule tests. After real healthy requests and the existing private signal checks,
the explicitly opted-in `alert-test` profile emits **fictional cumulative OTLP
counters**, not real failed application responses. They use environment `test`
and an all-4 synthetic release identity, avoiding the running application's
series. Twenty seconds of baseline, 80 seconds of errors and 140 seconds of
healthy recovery drive the unchanged production rule and actual notification
pipeline. The check verifies quiet healthy traffic, then firing followed by
resolved delivery and an inactive rule. Allow about six minutes for the whole
verifier, longer on first image builds. No rule/timeout is shortened for testing.
The fixture refuses to run without an explicit exact disposable-project identity.
Do not invoke it in the owner's running monitoring project; use the verifier.
Its `finally` removes only its random project's containers, networks and volumes,
even on failure. It leaves the owner's database and preview untouched.

Offline rule cases cover healthy/client errors, low ratio/volume, pending/firing,
brief bursts, recovery, counter resets, excluded routes and missing/stale data.
Receiver HTTP/projection tests run with `node --test ops/alerts/receiver.test.mjs`.
The required observability CI job runs the complete real notification check;
a failure blocks the required aggregate and deployment.

## Triage and limits

1. Confirm state, environment, release and receipt time in the notification.
2. Open the local Grafana dashboard described in the observability runbook;
   inspect status counts, rates and named traces for the affected release.
3. Check that exact Compose project's backend/Collector/service state and closed
   operational logs. Do not enable payload/SQL/credential logging to diagnose it.
4. Investigate the release or service failure before acting. The alert performs
   no rollback, restart, database change or external communication.
5. Check recovery and the current error rate. A resolved alert only means this
   error predicate stopped holding; it does not prove service health.

No traffic, a stopped application, missing telemetry, a stopped monitoring stack,
or cardinality overflow can produce **no alert** despite impact. Counter resets
are handled by `increase`, but restarts lose receiver history and may repeat
notifications; changing releases splits the window. Small sample extrapolation
means the rule's `increase` is an estimate, not an exact failed-request count.
Retention is asynchronous and not a hard disk quota. This single alert does not
detect total outage, delayed responses, OAuth/provider failures that become 4xx,
or failures before backend instrumentation. Monitoring those needs separate
backlog scope. Anonymous local Grafana viewing and existing shutdown/export
limitations remain as documented under #79.

References: [Prometheus alerting rules](https://prometheus.io/docs/prometheus/latest/configuration/alerting_rules/),
[rule testing](https://prometheus.io/docs/prometheus/latest/configuration/unit_testing_rules/),
[Alertmanager webhooks](https://prometheus.io/docs/alerting/latest/configuration/#webhook_config).
