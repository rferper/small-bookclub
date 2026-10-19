# Pinned CLI capability design (review prerequisite, not runtime acceptance)

Reviewed source: Codex `rust-v0.163.0`, annotated tag
`129b8ec7ee6f4511557a4856279f529025c25af4`, resolved commit
`83086188ae0614bd882818ff1aa23f3194962012`. Earlier local version preflight
reported `codex-cli 0.163.0`; the production runner still requires exactly that
version. This reconciles version/source selection, not installed-binary provenance
or reproducible-build attestation. No CLI observation was performed for this map.
All links below are immutable primary source at that commit.

## Fresh execution construction and contributor map

[exec/src/lib.rs:731](https://github.com/openai/codex/blob/83086188ae0614bd882818ff1aa23f3194962012/codex-rs/exec/src/lib.rs#L731)
constructs an in-process app-server client with `SessionSource::Exec` and the
resolved CLI overrides. Its
[initialize capabilities](https://github.com/openai/codex/blob/83086188ae0614bd882818ff1aa23f3194962012/codex-rs/app-server-client/src/lib.rs#L242)
set `extensions: None`. The normal fresh
[ThreadStartParams](https://github.com/openai/codex/blob/83086188ae0614bd882818ff1aa23f3194962012/codex-rs/exec/src/lib.rs#L1439)
does not set dynamic tools or inject thread extension data: those use default
`None`. The runner cannot select resume/fork/review or supply dynamic tool inputs.

With ignore-user-config, [exec/lib.rs:717](https://github.com/openai/codex/blob/83086188ae0614bd882818ff1aa23f3194962012/codex-rs/exec/src/lib.rs#L717)
uses EnvironmentManager::from_env, not persisted CODEX_HOME environment selection.
The environment allowlist strips remote executor/Noise variables. The default
[environment provider](https://github.com/openai/codex/blob/83086188ae0614bd882818ff1aa23f3194962012/codex-rs/exec-server/src/environment_provider.rs#L72)
therefore selects local execution. Its
[local environment](https://github.com/openai/codex/blob/83086188ae0614bd882818ff1aa23f3194962012/codex-rs/exec-server/src/environment.rs#L786)
has empty ready_info, so selected_capability_roots returns empty. Fresh default
thread selection supplies no additional capability roots. This establishes the
supported local empty-root path, separately from rejecting injected host roots.

The fixed
[thread_extensions constructor](https://github.com/openai/codex/blob/83086188ae0614bd882818ff1aa23f3194962012/codex-rs/app-server/src/extensions.rs#L50)
installs queue (when supplied), history notes, message board, goal (when state DB
exists), git attribution, guardian, memories, MCP/plugin lifecycle, web, image,
and skills. Installation is not equivalent to a nonempty executor contribution.

| Installed contributor | Reason no model executor survives this design |
| --- | --- |
| History notes | `features.token_budget={enabled=false,use_history_notes_extension=false}`. Its config requires notes enabled **and** OpenAI/Codex authentication; therefore no assumption from the no-auth provider is used for the authenticated path. [Activation and tools](https://github.com/openai/codex/blob/83086188ae0614bd882818ff1aa23f3194962012/codex-rs/ext/history-notes/src/extension.rs#L45), [canonical config](https://github.com/openai/codex/blob/83086188ae0614bd882818ff1aa23f3194962012/codex-rs/features/src/feature_configs.rs#L372). |
| Message board | Both `agent_message_board` and `multi_agent_v2` false. Fresh exec supplies no explicit LocalBoardConnection, so the factory returns None. [Factory](https://github.com/openai/codex/blob/83086188ae0614bd882818ff1aa23f3194962012/codex-rs/core/src/agent_message_board.rs#L64). No Binding means no tool contribution. |
| Goals | `features.goals=false`; constructor config selects disabled runtime; tools require a runtime with visible tools. [Tool gate](https://github.com/openai/codex/blob/83086188ae0614bd882818ff1aa23f3194962012/codex-rs/ext/goal/src/extension.rs#L559). |
| Memories | `features.memories=false`; `enabled` is MemoryTool AND use_memories, and tools also require dedicated_tools. [Config and contribution](https://github.com/openai/codex/blob/83086188ae0614bd882818ff1aa23f3194962012/codex-rs/ext/memories/src/extension.rs#L45). |
| Web | `web_search="disabled"`; web contribution availability and the core append special-case both close this path. [Contributor](https://github.com/openai/codex/blob/83086188ae0614bd882818ff1aa23f3194962012/codex-rs/ext/web-search/src/extension.rs#L122). |
| Image generation | The extension may contribute an executor under OpenAI authentication despite the feature disable. The central append special-case checks image_generation_available, whose first guard is `features.image_generation=false`, and therefore omits that executor. [Contributor](https://github.com/openai/codex/blob/83086188ae0614bd882818ff1aa23f3194962012/codex-rs/ext/image-generation/src/extension.rs#L86), [central filter](https://github.com/openai/codex/blob/83086188ae0614bd882818ff1aa23f3194962012/codex-rs/core/src/tools/spec_plan.rs#L1663). |
| Skills | `cloud.skills.enabled=false` removes cloud availability; `plugins=false`, no explicit selected capabilities, empty workspace and no host discovery leave no selected executor roots. `skill_tools` returns empty when cloud is unavailable and executor_query is None. Host discovery/search/install disables are retained. [Query construction](https://github.com/openai/codex/blob/83086188ae0614bd882818ff1aa23f3194962012/codex-rs/ext/skills/src/extension.rs#L286), [executor gate](https://github.com/openai/codex/blob/83086188ae0614bd882818ff1aa23f3194962012/codex-rs/ext/skills/src/tools/mod.rs#L59). Injected roots remain an unsupported host action, not something the feature flag proves impossible. |
| Guardian | Fresh normal exec does not create a reviewer child; `approval_policy="never"` and disabled history-tools feature are retained. Guardian's ordinary installer contributes thread/turn lifecycle, not parent model tools. Conversation-history tools are explicitly constructed only for a separate reviewer child. [Child construction](https://github.com/openai/codex/blob/83086188ae0614bd882818ff1aa23f3194962012/codex-rs/ext/guardian-v2/src/sync_reviewer/mod.rs#L107), [installer](https://github.com/openai/codex/blob/83086188ae0614bd882818ff1aa23f3194962012/codex-rs/ext/guardian-v2/src/sync_reviewer/mod.rs#L247). |
| Queue, git attribution, MCP/plugin lifecycle | The pinned constructor does not install these as model ToolContributors. MCP server tools are separately appended by core: no configured/managed/injected servers are supported, apps/plugins disabled, orchestrator MCP disabled. No lifecycle hook is mistaken for tool absence. |

The constructor's supported configuration therefore yields an empty appended
executor set under these stated fresh-host inputs, not an empty installed
extension registry. [extension_tool_executors](https://github.com/openai/codex/blob/83086188ae0614bd882818ff1aa23f3194962012/codex-rs/core/src/tools/spec_plan.rs#L349)
iterates every contributor; [append_extension_tool_executors](https://github.com/openai/codex/blob/83086188ae0614bd882818ff1aa23f3194962012/codex-rs/core/src/tools/spec_plan.rs#L1647)
otherwise registers arbitrary contributed executors. Only web/image receive
special filtering there; the empty set above is necessary.

## Independent core registry and metadata controls

[build_tool_router](https://github.com/openai/codex/blob/83086188ae0614bd882818ff1aa23f3194962012/codex-rs/core/src/tools/spec_plan.rs#L121)
adds core sources, MCP tools, extensions, dynamic tools and hosted specifications,
then generates wrappers/search tools. None may be skipped in the argument.

| Branch | Explicit control |
| --- | --- |
| Shell/exec/write-stdin | shell_tool=false, shell metadata disabled. |
| MCP resources | No MCP servers; orchestrator MCP/apps/plugins false; direct model mode avoids CodeModeOnly helper registration. |
| Plan/questions | Canonical tools.update_plan.enabled=false and tools.experimental_request_user_input.enabled=false. |
| Deferred environment, permissions, token-budget/context-window | deferred_executor=false; request_permissions_tool=false; token-budget enabled=false. |
| Async messages, clock, test-sync | Empty model experimental_supported_tools; send_message_to_user_async=false and current_time_reminder=false. |
| Sleep | sleep_tool=false. |
| Plugin suggestions/install | tool_suggest/apps/plugins false. |
| Apply patch | apply_patch_tool_type=null, independent of shell gate. |
| View image | view_image=false and text-only model modality. |
| Collaboration | multi_agent/multi_agent_v2 false and model multi_agent_version=disabled. |
| Code-mode wrappers | code_mode/code_mode_only/code_mode_tool_search/code_mode_host false and model tool_mode=direct. |
| Tool search | No deferred/external tools and model supports_search_tool=false. |
| Hosted search/image | Existing disabled web/image controls; responses-lite also returns no hosted specifications. |
| Dynamic tools | Fresh ThreadStartParams default None; not resumed/injected. |

The complete branch bodies are
[spec_plan.rs:1177-1674](https://github.com/openai/codex/blob/83086188ae0614bd882818ff1aa23f3194962012/codex-rs/core/src/tools/spec_plan.rs#L1177).
Other existing browser, app, hook, automation, dependency, daemon, skill and
credential-tool disables remain present.

## Exact catalogue and cross-provider consistency

`gpt-6.1-sol` is the pinned bundled catalogue's priority-1 listed model. The new
single-entry catalogue deliberately uses that literal slug, rather than claiming
to reproduce current account/remote default selection or entitlement. Complete
metadata is closed by exact structural/value validation; extra/missing fields,
entries, slug changes and unsafe values fail before any child process. The same
validated bytes are copied into each temporary workspace and selected with
literal `--model` plus `model_catalog_json`; evidence/callers cannot choose them.
The catalogue contains a fixed original read-only JSON instruction template.
An independent pinned wire-field/schema check also enforces the canonical-or-
legacy instruction guard from
[openai_models.rs:913](https://github.com/openai/codex/blob/83086188ae0614bd882818ff1aa23f3194962012/codex-rs/protocol/src/openai_models.rs#L913):
absence of both base_instructions and model_messages.instructions_template is
invalid, even if other metadata is well formed. The reviewed catalogue accepts
only the canonical fixed template, never the legacy fallback alternative.

[Catalogue loading](https://github.com/openai/codex/blob/83086188ae0614bd882818ff1aa23f3194962012/codex-rs/core/src/config/mod.rs#L2193)
fails on missing/malformed/empty input. Both provider paths use
[ConfiguredModelProvider](https://github.com/openai/codex/blob/83086188ae0614bd882818ff1aa23f3194962012/codex-rs/model-provider/src/provider.rs#L335);
[create_models_manager](https://github.com/openai/codex/blob/83086188ae0614bd882818ff1aa23f3194962012/codex-rs/model-provider/src/provider.rs#L388)
selects StaticModelsManager before remote endpoint/cache construction.
[Static reads/ETag handling](https://github.com/openai/codex/blob/83086188ae0614bd882818ff1aa23f3194962012/codex-rs/models-manager/src/manager.rs#L804)
cannot refresh metadata. An exact selected slug present in this catalogue avoids
the prefix/missing-model fallback paths; no alternate model selection is exposed.
An unavailable model must fail existing strict subprocess/event gates, with no
provider/account/API-key fallback. Existing authentication/provider/sandbox stay.

[responses-lite serialization](https://github.com/openai/codex/blob/83086188ae0614bd882818ff1aa23f3194962012/codex-rs/tools/src/tool_spec.rs#L95)
can wrap several function/custom leaves in a functions namespace. The observer
projects wrapper and leaf counts separately, validates bounded one-level namespace
structures, and rejects every nonempty/malformed/unknown declaration in either
wire channel. Historical count two remains two serialized definitions, without
proven identities/leaf counts. No observation has accepted this redesigned runner.

## Limits

This reasoning assumes the pinned trusted CLI/host, no binary tampering, no
managed policy overriding/conflicting with the explicit gates, no injected MCP,
dynamic tools, LocalBoardConnection, selected executor capability roots or custom
extensions. Such injection is unsupported, not an absence proven by configuration.
Source/binary version agreement is not attestation. Independent source-focused
security confirmation must precede the new observation; final security/QA and all
original acceptance checks remain required. The production event audit is unchanged.
