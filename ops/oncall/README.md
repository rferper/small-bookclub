# Read-only AI first responder

This is a manual, bounded first response for the private local monitoring stack.
The deterministic collector can inspect only fixed operational state. The model
gets a projected packet and returns advisory enum-based JSON. It cannot choose
commands, query production, inspect a database, deploy, restart, restore, message
anyone or carry out its recommendations. See the machine-readable
[autonomy policy](autonomy-policy.json) and [task](task.md).

## Collect

With the existing monitoring project running, from the repository root:

```sh
sh ops/collect-evidence.sh bookclub-monitor-local
```

On Windows without a POSIX shell:

```powershell
node ops/oncall/collect.mjs bookclub-monitor-local
```

Use the exact project you started, not an invented resource name. The collector
uses only fixed Compose files and known service names. It asks `compose ps` for
IDs, validates exact IDs, then inspects only status, health, OOM and restart
counts. It never dumps environment/configuration, logs, commands, mounts, SQL or
business responses. A fixed Node reader inside the private receiver sends only
two bounded GETs: Prometheus rules and receiver events. Docker access belongs to
the operator, not the AI. The collector's code/arguments are the allowlist; its
Docker identity itself is not a restricted Docker account.

Commands have finite time/output limits and a 90-second collection budget;
unavailable/malformed results become explicit unknowns. The packet includes all
nine known service slots, rule state/health and at most eight validated recent
notifications, with no container IDs, host paths, tokens or arbitrary text.
No health probe means unknown health. Collection is a sequence of observations,
not an atomic snapshot. A previous firing event can remain after recovery.
Missing alerts do not prove health. Private monitoring peers can forge telemetry;
the packet is evidence of observations, not a trusted cause assertion.

## Diagnose

The installed, already authenticated Codex CLI **0.163.0** is the tested runner.
It uses the operator's existing ChatGPT plan allowance. No new account, API key,
paid API integration, plugin or persistent CLI configuration is installed.
Offline CI never calls the model. Do not install/connect anything to run tests.

For the fictional fixture (contains no club data):

```powershell
node ops/oncall/diagnose.mjs ops/oncall/fictional-evidence.json
```

For local operational evidence, first save/review the collector output in a
private location **outside git**, then explicitly opt in to sending only its
projected fields through your existing CLI model connection:

```powershell
node ops/oncall/diagnose.mjs C:/private-bookclub-ops/evidence.json --allow-local-evidence
```

Review data/account policy before this opt-in. Never substitute private business
records or raw logs. The runner strips unknown input fields again, rejects large
input, and rejects local evidence without the explicit flag. It does not accept
a model name, provider, command, endpoint or executable supplied by evidence.
It inherits the tested CLI's default model and saved authentication; API-key,
GitHub, Render, Docker and application variables are excluded from the child
environment. No credential content is read or copied by these scripts.

The one-shot invocation ignores user configuration and rules, disables project
instructions and host skill discovery, uses an empty temporary working directory,
an ephemeral session, read-only sandbox and no approvals. Shell/exec, web search,
apps, plugins, subagents and skill search/install are explicitly disabled. The
read-only sandbox alone is not a secret-redaction boundary: projecting the input
and removing tools/configuration are necessary too. This supported invocation
assumes the installed CLI and host administrator are trusted and do not inject
managed tools/hooks. Do not bypass a managed-policy or sandbox refusal.

The runner allows at most two minutes/128 KiB of agent events and 16 KiB of final
output. It accepts only ordinary text/reasoning events and complete turns; tool
activity or unknown events fail the run. This audit is a further rejection check,
not a replacement for disabling tools before inference. Output must match the
[closed schema](diagnosis.schema.json) and observed facts. No executable prose,
commands, URLs or arbitrary recommendations survive. Confidence cannot be high,
causes remain hypotheses, human approval is always required, and actionsTaken
must be empty. Failures suppress raw agent/stderr/credential details. Only this
exact generated temporary directory is removed; user configuration is unchanged.

The saved [fictional diagnosis](fictional-diagnosis.json) records one actual
headless run, projected-input SHA-256, tested CLI and a zero-tool-event audit.
The [verification note](verification.md) distinguishes live inference from offline
subprocess tests. It is not evidence of a production incident or repair.

## Verify and use the result

```powershell
node --test ops/oncall/oncall.test.mjs
node ops/verify-observability.mjs
```

Offline tests inject the subprocess boundary and verify exact read-only queries,
input projection, schema/fact checks, credential stripping, failed/hostile agent
output and exact temporary cleanup. The real-stack verifier collects actual
safe state after its fictional alert fires/resolves, then preserves all prior
privacy/Viewer/signal/cleanup checks. These run in required CI. The real model
sample is a separate manual, bounded verification, not a network dependency of CI.

Interpret `assessment` with its `evidenceRefs`, low/medium confidence and possible
`hypotheses`; never treat a model selection as an established cause. Follow the
[API error triage](../runbooks/api-errors.md) or
[human recovery](../runbooks/recovery.md) runbook. Owner review authorizes any
later action separately; this runner cannot apply one.

References: [official non-interactive execution](https://learn.chatgpt.com/docs/non-interactive-mode),
[official CLI options](https://learn.chatgpt.com/docs/developer-commands?surface=cli),
[official configuration reference](https://learn.chatgpt.com/docs/config-file/config-reference).
Flags were also checked against the installed CLI help/feature inventory.
