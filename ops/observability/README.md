# Local private observability

Issue #79 adds optional backend OpenTelemetry and a local evaluation dashboard.
Normal development, tests and the hosted Render demo keep telemetry disabled.
Render's entrypoint explicitly pins it off. No monitoring account or credential
is needed, and nothing is sent to a cloud monitoring service.

## Run without changing an existing preview

From the repository root, choose an unused project name and loopback ports. The
project name isolates the application database and all monitoring volumes from
the owner's normal Compose project. These examples use fictional local data:

```powershell
$env:BOOKCLUB_PORT = '8180'
$env:BOOKCLUB_GRAFANA_PORT = '3300'
$env:DEMO_MODE = 'false'
$env:DISCORD_CLIENT_ID = ''
$env:DISCORD_CLIENT_SECRET = ''
docker compose -p bookclub-monitor-local -f docker-compose.yml -f ops/compose.observability.yml up --build -d --wait
```

Open the app at <http://127.0.0.1:8180> and the provisioned dashboard at
<http://127.0.0.1:3300/d/bookclub-operations>. Generate a few requests, then allow
roughly 15 seconds for export and scraping. An unseeded application still allows
public health requests at `/api/health`; no real club data is required. The local
base Compose configuration uses `development` identity, and versions remain
`unversioned` unless a valid full `BOOKCLUB_REVISION` is supplied.

Grafana permits anonymous Viewer access with dashboard edits denied. Signup,
Basic authentication, the login form and initial admin creation are disabled.
Only Grafana has a published monitoring port, bound to loopback. This assumes a
trusted local machine: anyone on that machine can read the fictional operational
data. Do not expose the port through a public proxy or reuse this configuration
for a shared production installation. Use a fresh dashboard volume when adopting
this configuration; disabling initial admin creation does not erase an existing
Grafana account.

Stop this exact project when finished. The command below deliberately omits
`--volumes`, preserving that project's data for another session:

```powershell
docker compose -p bookclub-monitor-local -f docker-compose.yml -f ops/compose.observability.yml down
```

Add `--volumes` only when intentionally discarding this named project's local
database and monitoring data. Never substitute the owner's preview project.
Clear the example environment overrides after use or close the terminal.

## Signals and privacy boundary

`TELEMETRY_ENABLED=true` is the only opt-in. Invalid flag values fail startup.
Manual Django middleware emits a fresh server span, a request counter, a duration
histogram and a closed `http.request` log event. Structured operational logs emit
only `backend_start` or `backend_event` and a closed severity. Resources contain
the fixed service `small-bookclub-backend`, validated release version and
deployment environment. This code does not change API responses or permissions.

Request attributes contain only a known method, an API-contract route template
and a bounded HTTP status. Unknown paths and denials before routing use
`unmatched`. There are no raw URLs, query values, object IDs, IPs, headers, cookies,
bodies, SQL, arbitrary log extras or exception text/stacks. Incoming trace IDs and
baggage are ignored; trace/log correlation uses newly generated local context.
Exporter diagnostics are excluded from the telemetry handler to prevent loops.

The explicit SDK resource and sampler avoid environment detectors. Transport
projects the final prepared request to fixed local Collector paths with only
protobuf headers; it disables proxy/netrc/cookie credentials, redirects and
environment-supplied OTLP destinations/headers. No automatic browser, database,
provider or SQL instrumentation is installed. The supported Gunicorn entrypoint
loads Django inside each worker. Do not add `--preload`: SDK after-fork behavior
can add process identity outside this closed resource policy.

## Storage, costs and limitations

The existing base Compose file is extended by five pinned free/open-source
services: Collector 0.162.0 and Prometheus 3.15.0 (Apache-2.0), Loki 3.7.8,
Tempo 2.10.8 and Grafana 13.2.4 (AGPL-3.0). A build-only BusyBox 1.37.0 stage
(GPL-2.0) seeds non-root data-directory ownership. See `docs/decisions.md` for
Python dependencies and version choices. No subscription, payment card or new
owner account is required; local CPU, memory and disk are consumed.

Storage and the Collector are accessible only on an internal Compose network.
Grafana alone also joins a dedicated bridge for its loopback published port;
Docker does not publish ports for containers attached only to an internal bridge.
The backend also retains its base application network. Monitoring services run
non-root, drop capabilities and have no Docker socket, host PID namespace or
privilege. Containers have individual memory limits totaling about 1.7 GiB for
monitoring, in addition to the application and Docker overhead. External usage
reporting/update checks are off. Named monitoring volumes are separate from the
application database. Prometheus retains at most 24 hours/128 MB; Loki and Tempo
retain 24 hours through asynchronous compaction. Retention is not an instantaneous
disk quota; inspect local free space and explicitly remove disposable volumes.

Request handling never waits for network export. Span/log queues hold at most
256 records per worker, export in batches of 32, and drop telemetry under load or
outage. HTTP calls use a two-second timeout; metrics export every five seconds.
Metrics retain at most 255 attribute combinations plus one overflow rollup per
worker. Overflow preserves totals/durations but omits status, so status/error
panels may undercount when the cap is reached. Worker restarts reset counters and
queues; this is operational sampling, not an audit trail.

Shutdown requests a three-second flush budget, but the SDK batch processors do
not enforce that as a hard total deadline and may drain queued work longer.
Container shutdown grace can interrupt export; losing monitoring records is
acceptable. Export failure must not alter application responses. Collector queues
and retries are bounded, and memory limits can restart a service. This fixture
has no high availability, alert routing or production authentication design.

## Read the dashboard

The provisioned dashboard has request rate, p95 duration, status/environment
counts, 5xx rate, closed logs and trace search panels. Datasource UIDs are
`prometheus`, `loki` and `tempo`; all use internal URLs through Grafana's proxy.
Useful queries:

- Prometheus: `sum(rate(bookclub_http_requests_total[5m]))` and
  `http_server_request_duration_seconds_count`.
- Loki: `{service_name="small-bookclub-backend"}`. Bodies are closed events;
  structured metadata carries safe fields and generated trace IDs.
- Tempo TraceQL: `{ resource.service.name = "small-bookclub-backend" }`.

If a panel is empty, first generate requests and wait for the initial scrape.
Check only this project's `docker compose ... ps` and service logs. Collector
configuration errors, storage permissions or memory restarts can explain missing
signals while the application remains available. Do not enable raw application
payload logging or external exporters to diagnose this fixture.

## Executable verification

With Docker running and frontend dependencies/Playwright Chromium installed:

```powershell
node ops/verify-observability.mjs
```

The verifier creates an exact random project, generated local secret and isolated
volumes, uses ephemeral loopback ports, and blanks Discord credentials. It checks
real Prometheus counts/durations, Loki events and a Tempo trace through Grafana,
release identity, absence of a fictional private marker, denied dashboard writes
and denied default-admin login. It captures only the fictional dashboard to the
printed temporary evidence directory. Success and failure both remove and verify
the absence of that project's containers, networks and volumes. The required CI
job runs the same check and retains only that PNG for three days.

Backend in-memory SDK and actual Django integration tests additionally exercise
privacy, unknown routes, metric cardinality, original response/error preservation
and the final OTLP wire request under hostile environment settings. Run them with
`uv run pytest tests/unit/test_telemetry.py tests/integration/test_telemetry_http.py`
inside `backend/`. Ordinary complete backend/frontend and container CI gates
remain required before delivery.

References: [Python exporters](https://opentelemetry.io/docs/languages/python/exporters/),
[Loki storage schema](https://grafana.com/docs/loki/latest/operations/storage/schema/),
[Grafana anonymous access](https://grafana.com/docs/grafana/latest/setup-grafana/configure-access/configure-authentication/anonymous-auth/).
