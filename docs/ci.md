# Continuous integration (#74)

`.github/workflows/ci.yml` runs on every push (including main), every pull request
and manual dispatch. It replaces the separate backend/frontend workflows while
retaining their checks. Read-only repository permissions apply to every job;
application checks receive no deployment credentials. After the required aggregate
succeeds, trusted main pushes call the [staged delivery workflow](release-process.md);
only its release steps receive the corresponding service deploy hook.

Backend and frontend jobs run independently with 20-minute limits. Backend
installs Node 24/frontend dependencies for the real HTTP bridge, uv 0.12.7 and
Python 3.13, then runs Django checks, Ruff lint/format, unit and integration pytest
selections and generated OpenAPI drift checking. Its database is test-only memory.

Frontend installs locked dependencies and runs OpenAPI validation, generated-type
freshness, contract examples, type-boundary mutations, lint, Vitest, build and
Playwright/axe checks on fictional mock screens. Chromium is installed on the
runner. Browser full-stack journeys remain #54.

After both jobs succeed, the container job validates Compose and builds both
multi-stage images with Buildx. It does not push images or start a deployment.
The final **All CI checks passed** job runs even when prerequisites fail and
requires backend, frontend, containers, observability and security results to be `success`;
failed, skipped or cancelled jobs
cannot produce a green aggregate result. Delivery requires this successful result;
no repository protection settings are changed.

The observability job also waits for backend/frontend, then runs the existing
base Compose file with its explicit local monitoring overlay in an exact random
disposable project. Real fictional requests must reach Prometheus, Loki and Tempo
through Grafana. Topology, loopback publication, privacy markers, read-only access, production
alert rule tests, real private firing/resolved delivery and exact-project cleanup
are assertions. Only the fictional dashboard PNG is
retained for three days; a failed observability job blocks the required aggregate
and delivery. See [local observability](../ops/observability/README.md).

The independent security job installs checksum-verified Gitleaks and pinned
Semgrep CE/pip-audit, verifies fictional detection/redaction and local rule
fixtures, then scans the tracked tree/full git history and both dependency locks.
Execution failures and untriaged findings block the aggregate. Only the projected
JSON summary is retained for three days; raw scanner output and secret matches
are never artifacts. See [security evidence](../security/README.md) for exact
commands, source-bound expiring false-positive triage and coverage limits.

All shell steps use Bash's fail-fast behavior. No test/check uses
`continue-on-error` or masks its exit status. New branch/PR pushes cancel older runs. Main runs queue without cancellation so
an active staged release can finish safely. Offline delivery guards and failure
boundaries run in the backend job with Node's built-in test runner.

Use `gh run list --workflow ci.yml` and `gh run view <run-id> --log-failed` to
inspect results. Reproduce individual commands using [testing.md](testing.md);
container prerequisites/operation are in [containers.md](containers.md).

Failure-propagation verification uses a disposable branch with an intentionally
failing unit test, never a committed failure on main. Record observed run links
in the issue handoff; remove that remote probe branch afterwards. A successful
unmodified issue-branch CI run is required before merging this workflow change.

Verified on 2026-10-14: [clean CI run](https://github.com/rferper/small-bookclub/actions/runs/38606126599)
passed backend, frontend, both image builds and the aggregate. The isolated
[failure probe](https://github.com/rferper/small-bookclub/actions/runs/38606274648)
failed at the intentional unit assertion, skipped image builds and failed the
aggregate while frontend checks passed. The probe branch/worktree were removed;
the failing test was never merged into the issue branch or main.
