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
| Proposed on-call collector | Fixed Compose service lookups, validated container-ID state fields, two fixed private GETs | Operator Docker authority remains privileged. Command restrictions are program controls, not Docker RBAC. Internal telemetry can be forged; missing data stays unknown. |
| Proposed on-call AI | Intended projected-packet input and closed advisory JSON, with tools disabled and strict event/schema/fact rejection | Existing ChatGPT login authenticates CLI transport; API-key mode is refused. Actual zero-tool declarations remain unestablished. Sandbox read-only and zero observed calls are insufficient proof. |
| Issue82 deterministic scanners | Source/history scanning and public package/version advisory requests | No scanning-service account/key or source upload. Findings are projected and raw temporary data is removed. These tools are not AI agents or complete security proofs. |

## Responder status: not accepted

Issue [#81](https://github.com/rferper/small-bookclub/issues/81#issuecomment-6266359008)
is parked at local candidate `1bfc525`. The complete runner has accepted no saved
fictional diagnosis. Its first bounded observation timed out because stdin was
not closed; the corrected final observation reached its loopback fixture but was
rejected before capability/startup classification. Neither result proves zero
exposed tools, absent warnings or a root cause. Two observations are used; the
conditional real run was not justified or attempted. No further experiment is
implied by that original checkpoint. A subsequently re-groomed single observation
inspected both top-level and Responses Lite embedded declarations: top-level tools
were omitted, but two embedded declarations were nonempty/unclassified. It was
rejected at the capability gate, with no credential-bearing headers and successful
cleanup. Exact names and executable authority were not retained or established;
do not guess them. The unused conditional real model check remains locked, and
production warning suppression/event acceptance were not relaxed. Preserve this
new checkpoint and strict gates; source-only redesign is the next step.

Intended controls are visible in that candidate: fixed 64KiB projected input,
empty ephemeral working directory, ignored user configuration/rules, no approvals,
read-only sandbox, explicit capability disables, two-minute/128KiB event limit,
16KiB schema/fact-checked result and exact temporary cleanup. These are reviewed
design/source claims, not proof that the deployed/default CLI surface meets them.
Do not activate operational model uploads or remediation while acceptance is
unresolved. Source/helper paths in the inventory refer to the stated Git objects;
the #81 candidate is intentionally local and absent from main.

Merged #79/#80 already supply private opt-in telemetry and a deterministic local
alert; they do not activate the AI. Issue82's remote candidate `0322da1` has actual
sanitized scanner evidence and a pending human PR-audit validation; it also is not
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
