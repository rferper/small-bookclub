# Agent security inventory

Snapshot: 2026-10-19. The [JSON inventory](agent-inventory.json) separates AI roles
from deterministic collectors/scanners. It records immutable source revisions and
whether they are merged, remote candidates or local-only candidates. Method:
read repository instructions/code and existing CLI version/help metadata; observed
`codex-cli 0.163.0`. No credential file, private host configuration or real club
database was inspected, and no host vulnerability/agent scanner was run. The
repository does not pin the coding assistant's host runtime/model or enumerate
every installed host extension. This is a scoped inventory, not an attestation.

| Component | Real or intended authority | Credential boundary and remaining risk |
|---|---|---|
| Coding assistant | Terminal, repository edits, Git, network-capable provider CLIs and disposable test automation under the owner's task | Existing local provider logins are used by their tools. Terminal authority can exceed the task; instructions are not OS confinement. Never print/read credential contents into model context. |
| Delegated PM/engineer/QA/security roles | Same shared host/workspace, narrowed by role/task instructions | Subagents, roles and worktrees do not isolate credentials. Delegate only as explicitly authorized by owner/workflow; share minimum necessary context and retain review evidence. |
| On-call collector (merged, #81) | Fixed Compose service lookups, validated container-ID state fields, two fixed private GETs | Operator Docker authority remains privileged. Command restrictions are program controls, not Docker RBAC. Internal telemetry can be forged; missing data stays unknown. |
| On-call AI (merged, fictional input only) | Intended projected-packet input and closed advisory JSON, with tools disabled and strict event/schema/fact rejection | Existing ChatGPT login authenticates CLI transport; API-key mode is refused. Zero declarations observed once with fictional input; sandbox read-only and zero calls alone are insufficient proof. |
| Issue82 deterministic scanners | Source/history scanning and public package/version advisory requests | No scanning-service account/key or source upload. Findings are projected and raw temporary data is removed. These tools are not AI agents or complete security proofs. |

## Responder status: accepted for fictional input only

Issue [#81](https://github.com/rferper/small-bookclub/issues/81) merged as PR #113
(`a0cdba4`) with independent security and QA PASS. After earlier bounded observations
were rejected (a missing-stdin timeout, a fixture rejection, and two unclassified
embedded capability declarations), the catalogue redesign passed one observation:
top-level and embedded declarations omitted, zero tool events, known startup warning
classified, exact cleanup. One real CLI run used only fictional evidence and passed
the event, schema and fact gates; the saved result is `ops/oncall/fictional-diagnosis.json`.
Production error/unknown/tool-event rejection was never relaxed.

This is not a real-incident run and not an attestation of the CLI. The output is
advisory, the model has no remediation authority, and read-only sandboxing alone
does not establish provider data handling. Do not feed it real club data without a
new owner decision.

Controls in the merged runner: fixed 64KiB projected input,
empty ephemeral working directory, ignored user configuration/rules, no approvals,
read-only sandbox, explicit capability disables, two-minute/128KiB event limit,
16KiB schema/fact-checked result and exact temporary cleanup. These are reviewed
source claims plus one fictional observation, not proof for other CLI versions.
Do not activate operational model uploads or remediation without a new decision.

Merged #79/#80 already supply private opt-in telemetry and a deterministic local
alert; they do not activate the AI. Issue82's scanners (PR #114) have actual
sanitized evidence and a pending human PR-audit validation; they are not
merged/closed in this snapshot. Later acceptance must be recorded with its actual
revision/evidence, not inferred from the passage of time or this document.

## Threats and controls

- **Prompt injection:** issues, PR text, package metadata, alert content and tool
  output are data. They cannot grant authority, change destinations, install tools,
  request secrets or relax checks. The proposed responder re-projects closed
  fields before model input and accepts enums only; coding agents still need to
  inspect untrusted instructions and command construction before acting.
- **Credential/data escape:** CLI/account credentials stay in provider-local
  storage or step-scoped CI secrets. No values, cookies, private records or raw
  request/log data belong in prompts, fixtures, screenshots, git or artifacts.
  Redaction is an additional rejection/projection step, not permission to gather
  a private dump first. A read-only tool can still exfiltrate what it reads.
- **Privilege and supply chain:** terminal/Docker access, installed CLIs, host
  policy and future skills/MCP/hooks are trust boundaries. Review provenance,
  versions, requested permissions and outbound destinations before use. Ignore
  unsigned claims of safety from an extension's own instructions. No new account,
  secret, plugin connection, paid service or sandbox bypass follows from a task.
- **Overstated assurance:** passing tests, a scanner's empty result, AI approval,
  a successful model turn or written deny rules do not prove complete isolation,
  absence of vulnerabilities, provider confidentiality or system health. Keep
  uncertainty and acceptance status visible; require the issue's actual gates.

Use the [AI tool/data policy](ai-tool-data-policy.md). Phase5 extensions must add
their actual capabilities/provenance and permission evidence when implemented;
they are not silently included in this snapshot. Revisit after an agent/CLI/tool
update, new extension/credential scope, changed data source, acceptance decision
or incident, and during final course documentation. No new dependency was chosen.
