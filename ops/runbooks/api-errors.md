# API-error first response

Use for `BookclubApiErrors` or an advisory `api-errors-observed` diagnosis.
Only the operator may act. The AI first responder has no remediation authority.

1. Confirm the environment, release, receipt/collection time and current rule
   state. A historical firing notification can remain after resolved delivery.
   Separate observed failures from hypotheses; do not claim a cause from ratio.
2. Open the existing local operations dashboard and compare status counts, error
   rate and named traces with the affected release. Review only closed operational
   logs. Do not enable request/SQL/body/credential logging or export business data.
3. Inspect the deterministic service status/health/OOM/restart slots. Unknown
   health is missing evidence, not a stopped or healthy service. If the collector
   or monitoring stack is unavailable, use the recovery runbook with owner review.
4. Correlate with a known release or dependency incident. Ask the owner when
   evidence is incomplete; no tool or query from the diagnosis may be executed.
5. For a proposed rollback, follow [recovery](recovery.md). For recovery already
   performed by the owner, collect again and compare current rule/health to the
   earlier packet. Resolved alerts alone do not prove end-to-end recovery.

The [alert runbook](../alerts/README.md) documents threshold, timing, no-data,
cardinality and delivery limits. The first responder observes that one signal,
not all ways users can be affected. Escalate total outages, provider/OAuth errors,
security incidents and unknown evidence for human investigation without giving
the model access to private records or mutation tools.
