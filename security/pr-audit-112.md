# AI PR audit: private OpenTelemetry

Reviewed 2026-10-19 by the coding assistant for issue #82.
Real pull request: [#112](https://github.com/rferper/small-bookclub/pull/112).
Base `aae8fe36ef59873a428cb8ce1163287b652a1fe1`, reviewed head
`6d50349d348cc3ef45f6105dc0d3220620bd123b`, merge
`8a22b0e8b7d03449304b067d6741045e7be6831a`.

Scope: the PR's telemetry code/tests, settings/environment opt-in, Render guard,
private Compose topology and monitoring configuration. Focus: credentials/private
review data leaving the backend, unbounded labels, monitoring access and failure
effects. This is a source/test review, not a hosted penetration test or complete
third-party component audit. No provider or account changes were made.

| Observation | AI disposition | Evidence |
|---|---|---|
| SDK/environment headers can carry credentials despite constructor headers | Mitigated in this PR | `local_session.send` replaces the final prepared wire headers and fixes destination/method, disables proxies/netrc/redirects; the actual transport regression verifies that boundary. |
| Request paths, bodies, cookies, SQL, log text or incoming trace context could leak private content | Mitigated for the reviewed instrumentation | Explicit route/method/status projection, fresh trace context, zero events/links, closed log events and explicit Resource; adversarial SDK/HTTP tests inspect actual exported records. No automatic SQL instrumentation. |
| Monitoring outage/cardinality could affect the app | Bounded, residual operational risk | Middleware preserves application results/exceptions, exporter queues/series and timeouts are finite. Missing telemetry is still possible and is not health evidence. |
| Internal peers can forge/read unauthenticated monitoring traffic | Documented deployment limitation | OTLP/storage are private local-only services; only loopback Grafana Viewer ingress is published. This is a trusted local evaluation network, not an authenticated or public multi-tenant monitoring service. Do not expose it publicly. |

No new blocking defect was identified in this bounded review. This is not a
claim that all vulnerabilities are absent. Existing risk-focused security review
and QA recorded on #79 are supporting AI evidence, not the human validation below.

Verification: the reviewed telemetry implementation and two test files are
unchanged between the PR head and current main. Ran
`uv run pytest tests/unit/test_telemetry.py tests/integration/test_telemetry_http.py -q`:
**12 passed** on 2026-10-19. Broader candidate CI is recorded separately.

## Human validation

**Pending owner review.** A human must confirm or correct the four dispositions
and the stated limits. Neither this AI-authored report nor merging a previous
AI-authored change counts as human validation. Record the owner's actual response
and date here before claiming this acceptance criterion complete.
