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
