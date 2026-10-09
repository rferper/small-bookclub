# Process

How work moves from the backlog to merged code.

## Backlog

- GitHub issues in `rferper/small-bookclub` are the only active backlog. `docs/tasks.md` was the initial draft and is retired; do not update it.
- Issue numbers match the original task numbers and roughly the build order, with one exception: #63 (demo deployment and CD) comes right after #1. Follow the build order in `product-spec.md` §15. Otherwise pick the lowest-numbered open issue whose dependencies are done, unless the user names one.
- Many issues were written for server-rendered templates or HTMX. When grooming one, the PM rewrites it for the current stack: `openapi.yaml` change, backend endpoint, frontend screen, and their tests.
- Work that falls outside an issue becomes a new issue, never an unplanned change.

## Roles

| Role | Does | Never does | Definition |
|---|---|---|---|
| Orchestrator | Runs the lifecycle, launches the other roles as subagents, merges and closes issues after QA PASS. | Grooms, implements or verifies itself. | This file |
| Product Manager | Grooms an issue into the task template. | Writes code. | `docs/team/pm.md` |
| Software Engineer | Implements one groomed issue with tests. | Changes acceptance criteria or closes issues. | `docs/team/software-engineer.md` |
| QA Engineer | Verifies each acceptance criterion against the running code and tests. | Fixes anything. | `docs/team/qa-engineer.md` |

Handoffs happen only through the issue: the groomed issue body and issue comments. Each subagent starts fresh and reads the issue, so everything it needs must be written there.

## Orchestrator lifecycle

The orchestrator is the main Claude Code session. It launches each role as a fresh subagent with a prompt like: "You are the <role>. Read `docs/team/<role>.md` and follow it for issue #<n>."

1. **Pick** the next open issue (see Backlog).
2. **Groom.** Launch the PM on the issue. This step is never skipped, even for issues that look obvious. If the PM reports that the issue is blocked or needs a decision from the user, stop and ask the user.
3. **Implement.** Launch the Software Engineer on the groomed issue. The engineer works on branch `issue-<n>-<short-slug>` and ends with an implementation comment on the issue.
4. **Verify.** Launch the QA Engineer on the issue and branch. QA ends with a comment starting `## QA: PASS` or `## QA: FAIL`.
5. **On FAIL**, go back to step 3 and tell the engineer to address the latest QA comment. After 3 FAIL rounds on the same issue, stop and ask the user.
6. **On PASS**, merge the branch into `main`, push, and close the issue with a comment linking the merge commit.
7. **Repeat** from step 1 until the stop condition holds.

### Stop conditions

Every loop needs a checkable stop condition, for example:

- "Issue #<n> is closed after QA PASS."
- "All open issues numbered ≤ <n> are closed."
- "All open issues have been groomed" (PM-only loop).

"Make it better" is not a stop condition. Also stop when an engineer comments that an acceptance criterion is wrong or contradictory; that needs the PM or the user.

## Rules

- Only the orchestrator closes issues, and only after QA PASS.
- The engineer never edits acceptance criteria; the QA engineer never edits code.
- Commit after each meaningful step so any bad change is easy to roll back.
- Milestone 2 issues (#56–#62) are out of scope for the course and start only after Milestone 1 is stable and the user says so.
