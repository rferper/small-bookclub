# Continuous integration (#74)

`.github/workflows/ci.yml` runs on every push (including main), every pull request
and manual dispatch. It replaces the separate backend/frontend workflows while
retaining their checks. Read-only repository permissions apply to every job;
there are no deployment credentials, provider accounts or publishing steps.

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
requires all three results to be `success`; failed, skipped or cancelled jobs
cannot produce a green aggregate result. This is the check suitable for later
branch protection/release gating; no repository protection settings are changed.

All shell steps use Bash's fail-fast behavior. No test/check uses
`continue-on-error` or masks its exit status. New pushes cancel older runs for
the same branch/PR, avoiding redundant work without accepting partial results.

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
