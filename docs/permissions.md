# Backend permissions

`backend/users/access.py` owns pure permission decisions for the section 3 matrix.
Use `is_admin`, `is_current_curator`, `can_edit_profile`, `can_edit_review`,
`can_manage_vote`, `can_view_reviews`, or `permission_refusal` instead of ad-hoc
role checks. Effective membership means a current, persisted, authenticated,
approved user with no revocation time. Curator is a current assignment, not a role.

IDs and completion facts passed to these helpers must come from server state.
Convert route resource IDs at the service boundary, look up the resource, then use
its stored owner ID; never accept an ownership or curator claim from request data.
Own-action APIs derive their owner solely from the session and reject submitted
ownership keys, even when they match the current user. Admin cannot implicitly edit
another profile/review or bypass rating spoilers. Review visibility for every book
requires both personal completion and the viewer's own submitted complete rating.
Tie-winner writes are admin-only under the current API contract.

`@require_permission(action, context=...)` guards tuple-returning Django Ninja
services. It refreshes the identity before executing the optional context callback
or handler. Membership denial is 401; insufficient authority is 403. Admin-only
denial occurs before the context callback. A context callback supplies only trusted
authority facts such as the current curator assignment or persisted ownership;
resource/lifecycle lookups follow the API's operation-specific denial precedence.

For mutations, place the guard inside the transaction and recheck current
authority after acquiring domain locks. SQLite does not provide row locks through
`select_for_update`; atomic transactions and database constraints are still
required. Permission helpers do not replace CSRF, ownership-injection rejection,
input validation, lifecycle checks or spoiler-safe response projections. Services
return their tuples through the existing safe API response wrapper.

`backend/tests/unit/test_permissions.py` covers every matrix action for anonymous,
member, assigned curator and admin, foreign ownership, revoked/pending identities,
spoiler prerequisites and guard execution order. Mounted integration tests verify
that actual session and persistence boundaries retain these decisions.
