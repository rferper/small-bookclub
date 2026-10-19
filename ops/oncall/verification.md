# Verification checkpoint - not accepted yet

## Result of the new single-observation window

The sole newly authorized unsuppressed CLI observation was actually invoked once
on candidate `a64e9b6`, after source inspection and 14/14 offline tests passed.
The closed result was:

```json
{"requestCount":1,"credentialHeaders":false,"declarations":{"fieldState":"omitted","count":0,"names":[],"embeddedState":"nonempty","embeddedCount":2,"unknownNames":2,"accepted":false},"startup":["under-development-feature-warning","unclassified-error"],"eventState":"known","completed":false,"phase":"capability-declarations","outcome":"fixture-rejected","cleanup":true}
```

The standard tools field was absent, but responses-lite input exposed two
nonempty embedded declarations whose names were outside the safe diagnostic
allowlist. The fixture rejected before returning fictional inference output.
No credential-bearing header was received on the one loopback request. The known
under-development warning was classified; a second error item remains
unclassified after fixture rejection. No raw payload, name, message, stderr,
identifier, header value or host path was retained. The child closed, listener
closed and exact temporary directory was removed. The existing database/preview
were not used or altered.

This is a failed capability-boundary check, not an accepted no-tool run. The
single new window is exhausted. No scoped warning suppression was added, no
conditional real fictional invocation was made, and production error/unknown/tool
event rejection remains unchanged. No diagnosis/provenance artifact exists.
Required final stack/CI/security/QA remain pending.

Concrete next decision: authorize a source-only redesign of the CLI capability
boundary (including additional-tools registration/serialization), or select a
transport with an independently provable zero-tool request. Any future CLI/model
observation requires a newly explicit bounded checkpoint; no rerun is implied.

## New bounded checkpoint: primary protocol inspection

The new PM checkpoint authorizes exactly one further unsuppressed observation
after offline regressions; prior attempts remain exhausted and unaccepted.
No runtime observation has occurred for this checkpoint at this commit.

Primary source is Codex `rust-v0.163.0`: annotated tag
`129b8ec7ee6f4511557a4856279f529025c25af4` resolves to commit
`83086188ae0614bd882818ff1aa23f3194962012`.

- [Serializer, common.rs](https://github.com/openai/codex/blob/83086188ae0614bd882818ff1aa23f3194962012/codex-rs/codex-api/src/common.rs#L287): optional top-level tools omit `None`.
- [Request construction, client.rs](https://github.com/openai/codex/blob/83086188ae0614bd882818ff1aa23f3194962012/codex-rs/core/src/client.rs#L980): responses-lite omits top-level tools, embedding nonempty tools in `input` as `additional_tools`; standard Responses serializes the tools vector. Omission alone cannot establish zero capabilities. Fresh input must contain only messages and absent/empty declarations in both channels.
- [Protocol models](https://github.com/openai/codex/blob/83086188ae0614bd882818ff1aa23f3194962012/codex-rs/protocol/src/models.rs#L1025): `AdditionalTools` serializes as `additional_tools` with a tools vector.
- [SSE parser/tests](https://github.com/openai/codex/blob/83086188ae0614bd882818ff1aa23f3194962012/codex-rs/codex-api/src/sse/responses.rs#L354): message item added/done, text delta and completed response are supported. Completion requires a response ID; `end_turn` is optional. The fixture explicitly sets `end_turn=true`, uses `phase=final_answer`, and omits optional usage rather than constructing partial usage metadata.
- [Tool registration](https://github.com/openai/codex/blob/83086188ae0614bd882818ff1aa23f3194962012/codex-rs/core/src/tools/spec_plan.rs#L1245): disabled ShellTool returns before command-tool registration regardless of model shell metadata. Utility tools separately register PlanHandler when `update_plan_enabled`; current production arguments do not override that setting. Runtime declarations must still be inspected; known plan metadata is not authorized exposure.

The fixture now distinguishes closed HTTP rejection stages and omitted/empty/
nonempty/malformed top-level and embedded tool fields. Every nonempty declaration
rejects, including a safely named plan tool; unknown names are counted without
printing them. Startup error classification runs even after HTTP rejection.
Offline injected child tests exercise credential refusal, decode/request/output
bounds, HTTP boundary, deadline, prompt/EOF and exact directory/listener cleanup.
All 14 on-call tests pass. No production event-audit or configuration change.

The custom-provider observation can attest only its tested provider/model metadata
path. It is not a global CLI attestation or proof that different metadata cannot
add utilities; trusted CLI/host and preserved configuration remain assumptions.

Further source tracing before spending the observation established that
[resolve_update_plan_enabled](https://github.com/openai/codex/blob/83086188ae0614bd882818ff1aa23f3194962012/codex-rs/core/src/config/mod.rs#L2766)
defaults false (`is_some_and`), while experimental request-user-input defaults
true (`is_none_or`). The pinned
[ToolsToml schema](https://github.com/openai/codex/blob/83086188ae0614bd882818ff1aa23f3194962012/codex-rs/config/src/config_toml.rs#L700)
supports `tools.update_plan.enabled` and
`tools.experimental_request_user_input.enabled`; both are now explicitly false
with argument regressions. This is source-backed capability hardening, not an
inferred repair of the production startup error. The warning remains unsuppressed
and the production error/unknown/tool event audit is unchanged.

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

### Static correction to the observation harness

Review found a harness defect: the CLI arguments end in `-`, but the original
fixture never wrote or closed child stdin. The CLI could therefore wait for
prompt EOF before sending any request. This invalidates that timeout as evidence
about the candidate's provider startup; it does not establish the cause of the
production error item. The corrected harness sends the fixed task and projected
fictional packet (at most 64 KiB), closes stdin and handles pipe errors with a
closed `input-failed` classification. Combined input/output remains bounded.

An offline real Node subprocess regression verifies the exact prompt bytes/hash
arrive and EOF is received before its five-second timeout. On-call tests now pass
10/10. This regression uses no CLI or model. No additional observation or real
invocation has occurred; the remaining original observation awaits PM direction.

### Second and final authorized observation

PM clarified the missing-stdin correction and remaining original observation in
[the issue checkpoint](https://github.com/rferper/small-bookclub/issues/81#issuecomment-6264905291).
The engineer confirmed its announced second observation had not actually been
invoked before its turn ended. The orchestrator then invoked the corrected,
unsuppressed fixture exactly once, at candidate `2610599`.

Closed result: `requestCount=1`, `credentialHeaders=false`, `tools=[]`,
`startup=[]`, `outcome=fixture-rejected`, `cleanup=true`; process exit was 0
because the observation reports its verdict as JSON, not as a production pass.
The fixture reached its local request handler but rejected the request before
completing classification. Empty tool/startup arrays therefore establish neither
an empty capability surface nor absence of the original startup error. The
specific rejected field was deliberately not retained; no cause is inferred.
The temporary child/listener/directory were cleaned. No real model inference or
credential forwarding occurred.

Both authorized observations are now used. No production argument or event gate
was relaxed; no conditional real invocation is justified or attempted. #81 is
parked unmerged and incomplete. A concrete next investigation would add closed
fixture rejection phases with offline adversarial coverage, then explicitly
groom a new bounded observation allowance; it must not silently rerun this one.
Full stack/CI, final security review and independent QA remain pending. Work on
independent issues can continue without treating this checkpoint as acceptance.
