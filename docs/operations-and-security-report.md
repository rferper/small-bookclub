# Operations and security report (#84)

One path through the project's operations evidence, from a deployed version to an
incident's resolution, followed by the security findings and what is *not* proven.
Observation date: 2026-10-19. Everything here uses fictional data. Claims link to the
document or artifact that holds the evidence; this report adds no new evidence.

## 1. Release: what is deployed and how to tell

- Only a green `main` run deploys: staging first, then the reviewer demo, both
  fictional Render Free services ([flow](release-process.md#how-delivery-runs)).
- Each service exposes the exact running commit: `X-Bookclub-Revision` on `/` and
  the matching identity in `/api/health` ([inspection](release-process.md#source-release-tags-and-inspection)).
- After both services verify, CI records the lightweight tag `release-<full SHA>`.
  Four tags exist today (the newest is `release-5af7f8f…`, from run 39250444759).
- **Known gap:** the latest `main` run (39309184984, merge of #113) passed backend,
  frontend and observability, but its Render verifier timed out at staging
  `profile-edit`, so deployment was skipped and no tag was written. That is tracked
  as [#110](https://github.com/rferper/small-bookclub/issues/110) and is unresolved.
  The demos therefore run an earlier tagged revision than `main`. Check
  `/api/health` for what is live now; an absent tag does not prove a commit never
  reached a service.

## 2. Observability: how a problem becomes visible

The opt-in local stack ([overview](../ops/observability/README.md)) collects
metrics, traces and closed-vocabulary logs through an OpenTelemetry Collector into
Prometheus, Tempo and Loki, shown in a Viewer-only Grafana dashboard. Telemetry
excludes request bodies, cookies, SQL, headers and query strings (reviewed in
[the PR #112 audit](../security/pr-audit-112.md)). Retention is not a hard quota,
and OTLP/storage trust the local network.

## 3. The alert

`BookclubApiErrors` fires when at least three 5xx responses and a 20% error share
persist for one minute, grouped by environment and release
([rule and limits](../ops/alerts/README.md)). `node ops/verify-observability.mjs`
drives the unchanged production rule with fictional counters through firing and
resolved delivery; it runs in required CI. It does not detect a total outage,
slow responses, or failures before instrumentation, and silence is not health.

## 4. The responder run

On firing, the owner can run the read-only AI first responder
([README](../ops/oncall/README.md)): a fixed collector reads allowlisted
Docker state and two private health endpoints, the model sees a projected packet,
and it returns closed enum JSON (assessment, confidence, evidence references,
next steps). It cannot run commands, restart, restore, deploy or message anyone.

- **Evidence:** [`fictional-diagnosis.json`](../ops/oncall/fictional-diagnosis.json)
  records one accepted run: assessment `api-errors-observed`, confidence `medium`,
  hypothesis `unknown`, zero tool events, no actions taken, `humanApprovalRequired`.
  Its input was a *fictional fixture*, not a real incident.
- #81 was merged as PR #113 with security and QA PASS after the model/tool gates
  passed their single bounded observations.
- The diagnosis is advisory. It does not establish a cause.

## 5. Resolution: the human steps

1. Triage with the [API-error runbook](../ops/runbooks/api-errors.md): confirm
   environment, release and times; separate observed failures from hypotheses.
2. Compare the dashboard's status counts and traces with the affected release.
3. If a rollback is warranted, the owner follows
   [recovery](../ops/runbooks/recovery.md): choose a known-good Render deploy,
   confirm HTTPS, version, and sign-in/library/sign-out afterwards. Retained
   local data is restored into a new project from a verified backup
   ([backups](backups.md)), never over a running database.
4. Re-collect evidence after recovery. A resolved alert only means the predicate
   stopped holding.

Not exercised: a real incident, or a hosted rollback during this review.

## 6. Security findings

| Source | Result |
|---|---|
| Dependency audits (`pip-audit`, `npm audit`, full lockfiles incl. dev) | Zero known vulnerabilities at observation time. |
| Semgrep CE, seven local rules | Seven RegExp false positives, each triaged with an exact identity. |
| Gitleaks, full history and tracked tree | Five history and five current-file matches, all fictional IDs or unusable passwords; no real secret found. |
| Triage | 17 records in [`security/triage.json`](../security/triage.json); current-file exceptions bind a source hash and expire when the file changes. |
| CI gate | Required aggregate fails on failed, skipped, cancelled or missing security results ([report](../security/reports/2026-10-19-pr-114-ci.json), [method](../security/README.md)). |
| PR audit | [PR #112 audit](../security/pr-audit-112.md): no blocking defect in the bounded review. |
| Agent and data policy | [Inventory](../security/agent-security.md), [policy](../security/ai-tool-data-policy.md). |

## 7. Limits and open items

- **Human validation pending:** the owner has not yet validated the PR #112 AI audit
  (credential-header stripping, private-data projection, bounded failure handling,
  trusted-local-network limitation). Issue #82 stays open until it is recorded.
- **#110 unresolved:** the intermittent Render verifier failure blocks the latest
  delivery and has no established cause.
- **Responder status docs:** reconciled with the #81 merge in issue #116.
- Scanners are small, syntactic and incomplete, not a full audit. The tooling
  proves nothing about the real club instance, which has no deployment yet.
- The monitoring stack is local; there is no hosted monitoring, paging or SLO.
