# Verification checkpoint - not accepted yet

Candidate lineage: `22f1e2e`, `9a56b9f`, then closed startup-phase diagnostics.
Offline on-call tests: 9 passed. Combined operator tests before the latest added
auth-mode case: 100 passed. No model inference occurs in those injected tests.
Independent security review approved `9a56b9f` subject to its trusted CLI/host
assumptions; later deltas need final review.

Four actual headless CLI attempts were made against fictional input using the
existing ChatGPT login and strict tool/event/schema gates. None was accepted by
the complete runner. Preflight version and ChatGPT authentication passed. Two
instrumented attempts showed CLI exit0; one additionally established a valid
final diagnosis alongside an `item.completed` event of type `error` and a normal
agent message. Raw event messages, thread IDs and stderr were not printed or
saved; exact cause of the startup error item is not established.

The ineffective `unified_exec=false` override was removed according to official
configuration documentation; command tools remain disabled by `shell_tool=false`.
The subsequent verification still failed at the unchanged event audit. This
change therefore did not resolve the failure. No valid accepted diagnosis file,
repair, final QA PASS, merge or closure is claimed.

Per docs/process.md, stop the lean retry loop and use the full PM -> engineer ->
independent QA fallback. No additional paid/model invocation should be an
unbounded diagnostic loop. Next engineering observation must classify the startup
notice safely, preferably with a local non-inference transport fixture, while
retaining disabled capabilities, strict error/tool gates, projection and cleanup.
Any real model check after a justified fix must remain bounded and fictional.
Required issue CI and real-stack safe collection remain pending.

## Full-loop bounded observation checkpoint (2026-10-19)

The groomed checkpoint allowed two local non-inference observations and, only
after a justified correction, one fictional authenticated invocation. The first
observation used `observe-startup.mjs`: fixed loopback Responses fixture, empty
temporary home/config, custom provider with `requires_openai_auth=false`, no
environment key, no auth-file reads and no forwarding implementation. The
fixture inherits the production capability-disable arguments unchanged and
replaces only provider transport for this observation. Official references:
[no-auth providers](https://learn.chatgpt.com/docs/auth) and
[configuration reference](https://learn.chatgpt.com/docs/config-file/config-reference).

Closed result: `requestCount=0`, `credentialHeaders=false`, `tools=[]`,
`startup=[]`, `outcome=timeout`, `cleanup=true`. The 30-second limit expired
before the local provider received a request. Combined bounded input/output was
below 128 KiB. The child exited after termination, listener/connections closed,
and the exact generated temporary directory was removed. Raw messages,
request bodies, stderr, identifiers and host paths were not retained or printed.
No real credential or model inference was used by the fixture.

This is **not** proof of zero capabilities or credential exclusion on an actual
request: there was no outbound declaration to inspect. The startup cause remains
unexplained. Per the checkpoint's first-unknown stop condition, the second local
observation and the conditional real invocation were not used. No production
argument/event-audit correction is justified by this result. In particular,
`suppress_unstable_features_warning=true` remains an unproven repair hypothesis;
the runner still rejects all error/unknown/tool events.

Targeted offline tests: `node --test ops/oncall/oncall.test.mjs` passed 9/9.
No accepted diagnosis/provenance exists; complete stack/CI/full suites and final
security/QA remain pending. Next decision: PM/owner must explicitly authorize a
revised bounded startup investigation or choose another no-tool transport whose
capability boundary can be independently established. No rerun is implied.
