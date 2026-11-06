# Process

How work moves from the backlog to merged code.

## Backlog

- GitHub issues in `rferper/small-bookclub` are the only active backlog. `docs/tasks.md` was the initial draft and is retired; do not update it.
- Issues are grouped into GitHub milestones, one per course phase (`product-spec.md` §15). Finish a phase's milestone before starting the next, unless the user says otherwise.
- Within **Phase 2: Development**, take issues by label in this order: `frontend` (screens on the mock API), then `contract` (`openapi.yaml`), then `backend`, then `polish`. Within a label, take the lowest-numbered open issue whose dependencies are done, unless the user names one.
- Many `backend` issues were written for server-rendered templates or HTMX. The implementer grooms them for the current stack before coding: endpoints from `openapi.yaml` (changing the contract first if needed), backend implementation, switching related screens from the mock to the HTTP client, and unit + integration tests.
- Infrastructure issues (CI, Docker, deployment, observability, agent pack) also need criteria that can be checked by running something (e.g. "the pipeline fails when a test fails").
- Work that falls outside an issue becomes a new issue, never an unplanned change.

## Default issue lifecycle

The orchestrator picks one issue (see Backlog) and assigns one implementer. The implementer reads the issue, relevant spec and repository instructions, and grooms unclear or stale criteria into a checkable scope before coding. Contradictory criteria or decisions outside the issue go back to the user; do not silently change acceptance criteria during implementation.

1. **Implement and test.** Work on `issue-<n>-<short-slug>`, change `openapi.yaml` before endpoint/client changes, run the checks appropriate to the issue, and commit after meaningful steps. Post a `## Implementation` issue comment with criterion coverage, results, assumptions, branch and commit.
2. **Review when warranted.** Authentication, permission and spoiler changes receive a brief independent, risk-focused security review of the diff, relevant tests and remaining exposure. Record findings in the issue and fix any blocking finding. This is not a second full acceptance-test pass by default.
3. **Finish.** After the required checks and any warranted review pass, the orchestrator merges, pushes and closes the issue with a comment linking the merge commit. It then applies the stop condition before picking another issue.

Issue bodies and comments carry handoffs and review findings. Do not cancel a review already in progress when adopting this workflow.

## Token budget

Keep the lean flow cheap without weakening its checks:

- **Batch related issues.** One implementer may take a cluster of related issues (e.g. voting #31–#34, reviews #35–#39, statistics #40–#42 and #44, recycle bin #46–#47, export and audit #49–#50) in one session. Each issue still gets its own commits, handoff and closing comment.
- **Groom ahead.** Stale backend issues may be groomed in one pass before implementation, so implementers do not re-groom.
- **Model tiers.** Sonnet for grooming, routine CRUD, statistics, infra and docs. Opus for authentication, permission and spoiler logic, and for any security review. Haiku only for mechanical tasks (listing, formatting, simple doc edits).
- **Tests.** Run targeted tests while developing; run the full backend and frontend suites once before merge. Reviewers read the diff and the relevant tests and do not rerun the full suites unless something looks wrong.
- **Short handoffs.** `## Implementation` and review comments stay around 10 lines: criteria covered, checks run, assumptions, branch and commit.

### Escalation

If the lean flow fails on an issue (a check fails after a fix attempt, a review finds a blocking defect, or the criteria turn out ambiguous), stop and recommend the full-loop fallback for that issue to the user, rather than repeating cheap attempts.

## Full-loop fallback

Use the former PM → engineer → QA loop when the user requests it or defects/rework show the lean flow is insufficient. A PM grooms the issue (`docs/team/pm.md`), an engineer implements and tests it (`docs/team/software-engineer.md`), and an independent QA engineer checks every criterion (`docs/team/qa-engineer.md`). The orchestrator coordinates those roles, sends QA failures back for fixes, and merges/closes only after `## QA: PASS`. After three QA FAIL rounds on one issue, ask the user how to proceed. Role-specific restrictions in those documents apply when the full loop is invoked.

Ready-made subagent definitions for these roles and a spoiler-leak specialist are in [`agent-capabilities/agents/`](../agent-capabilities/agents/README.md) and `custom-agent/`; they delegate to the role documents above.

### Stop conditions

Every loop needs a checkable stop condition, for example:

- "Issue #<n> is closed after its required checks and review pass."
- "All open issues numbered ≤ <n> are closed."
- "All open issues have checkable criteria."

"Make it better" is not a stop condition. Stop when a criterion is wrong or contradictory and needs the user's decision.

## Rules

- Only the orchestrator merges and closes issues, after the required checks and review. In the full-loop fallback, wait for QA PASS.
- Do not silently change acceptance criteria during implementation; in the full-loop fallback, the engineer does not groom and QA does not edit code.
- Commit after each meaningful step so any bad change is easy to roll back.
- Milestone 2 issues (#56–#62, milestone "Milestone 2: Discord bot and local AI") are out of scope for the course and start only after the course phases are done and the user says so.
