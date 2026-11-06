# AI-assisted workflow

How this project was built with AI coding agents, and how every result was checked by
a person and by automation. The owner wrote the specification, delegated work through
GitHub issues and reviewed the outcomes; agents wrote and tested the code.

## 1. Specification first

`product-spec.md` is the single source of truth for behaviour, non-goals and the
course requirements (§15). Agents may not add features it lists as non-goals and may
not re-ask settled decisions. The spec, the backlog and the agent rules were written
before any code.

## 2. Task delegation through issues

- The backlog is GitHub issues in `rferper/small-bookclub`, grouped in milestones that
  follow the course phases. One issue is worked at a time, on branch
  `issue-<n>-<slug>`, with a pull request containing `Closes #<n>`.
- Issues follow [`task-template.md`](task-template.md): goal, description and
  acceptance criteria that can be checked by running something.
- Work outside the current issue becomes a new issue or a comment, never an
  unplanned change.
- Each issue ends with a short `## Implementation` comment (criteria covered, checks
  run with results, assumptions, branch, commit). Those comments are the audit trail.

## 3. Roles

[`process.md`](process.md) defines two flows:

- **Default (lean):** one implementer grooms the issue, implements it contract-first,
  tests it and posts the handoff. Authentication, permission and spoiler changes also
  get a short independent security review.
- **Full loop (fallback):** PM ([`team/pm.md`](team/pm.md)) grooms the issue,
  engineer ([`team/software-engineer.md`](team/software-engineer.md)) implements it,
  QA ([`team/qa-engineer.md`](team/qa-engineer.md)) verifies every criterion and
  answers `## QA: PASS` or `FAIL`. The orchestrator merges only after PASS. It is the
  escalation path when the lean flow fails.

Ready-made subagent definitions for these roles and a read-only spoiler-leak reviewer
are in `agent-capabilities/agents/` and `custom-agent/`; see
[`agent-extension-pack.md`](agent-extension-pack.md).

## 4. Context files

Agents receive only what they need:

| File | Role |
|---|---|
| `CLAUDE.md` → `AGENTS.md` | Stack, commands, rules, and which document to read for which topic. |
| `product-spec.md` | Product behaviour; sections read per issue. |
| `openapi.yaml` | API contract, changed before any endpoint or caller. |
| `docs/decisions.md` | Technical decisions and every dependency with its reason. |
| `docs/testing-guidelines.md`, `docs/design-system.md` | Read before tests or UI work. |
| `security/ai-tool-data-policy.md`, `security/agent-security.md` | What data and tools agents may use. |
| Agent memory | Owner preferences, for example: free dependencies are allowed and recorded; paid or account-bound choices need approval. |

Corrections from the owner are written back into `AGENTS.md` or the linked doc so
they apply to every later session.

## 5. Example prompts

Prompts stay short because the context lives in the files above:

- "Work on issue #31." The implementer reads the issue, the relevant spec sections and
  docs, then follows the `issue-loop` skill.
- "Continue working on the issues." A stop condition from `process.md` decides when to
  halt: all open non-Milestone-2 issues are closed, or a criterion needs the owner.
- "Review this diff for spoiler leaks." Runs `spoiler-leak-reviewer`, which is
  read-only and reports where an API response could reveal data the user may not see.
- "Explain the hosting options before asking me to connect an account." Rule in
  `AGENTS.md`: tradeoffs (free tier, persistence, card requirements) first, account
  connection second.

## 6. Manual review and verification

Nothing is accepted on an agent's word:

1. **Tests must be run.** `AGENTS.md`: never claim something works without running
   it. Handoffs list the commands and counts (see [`progress.md`](progress.md)).
2. **Contract checks.** Backend tests compare responses with `openapi.yaml`; the
   frontend validates the contract and regenerates types, failing on drift.
3. **Independent review for risk.** Permission and spoiler rules live only in the
   backend and are reviewed separately; findings are recorded in the issue.
4. **CI as the final gate.** One required aggregate job covers backend, frontend,
   accessibility, container builds, browser journeys, observability and security
   scans ([`ci.md`](ci.md)). Hooks and permissions are a first line, never the only one.
5. **Owner review.** The owner reads each pull request and handoff, decides on
   anything outward-facing (merging, hosting accounts, paid services) and tests the
   result in the running preview or the public demo.
6. **Security audit.** PR audit output, deterministic scan findings, agent security
   notes and the AI data policy are in `security/`; the operations side is in `ops/`
   and summarised in [`operations-and-security-report.md`](operations-and-security-report.md).

## 7. Guardrails

Hooks refuse risky git commands, run fast checks on commit and block real data in
fixtures; the MCP server exposes read-only project facts. They reduce mistakes and
are not a sandbox ([`agent-extension-pack.md`](agent-extension-pack.md),
[`permissions.md`](permissions.md)).

## 8. Models used and how they were managed

Several models were used as coding agents: Claude Opus 5.5 and Claude Sonnet 5.5 (Claude Code),
GPT Sol (medium reasoning) and GPT Luna (Codex). No record was kept of which model did which
task, so none is claimed; the process above is the same for all of them.

- **Selection by risk (policy).** [`process.md`](process.md) assigns Sonnet to grooming,
  routine CRUD, infrastructure and documentation, and Opus to authentication, permission and
  spoiler logic and every security review.
- **Runtime model.** The on-call responder runs `gpt-6.1-sol` through the installed Codex CLI
  0.163.0 with the owner's existing ChatGPT login: name pinned, API-key mode refused, tools
  disabled, input a projected packet, output a closed JSON schema, never run in CI.
- **Data and authority.** Models receive only fictional data or reviewed operational metadata
  ([`ai-tool-data-policy.md`](../security/ai-tool-data-policy.md)). Models never choose commands;
  the one automatic action is fixed code (#127). Merges, hosting accounts and paid services need
  the owner.
- **Checks on model output.** Tests, the OpenAPI contract, CI, security scans and the owner's
  review apply to every change regardless of which model wrote it.
