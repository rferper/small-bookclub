# Soft deletion

Future content models inherit `core.models.SoftDeleteModel` and its `Meta`
options/constraints (extend the constraint list when adding domain constraints).
The default `objects` manager hides removed rows; `all_objects` is the unfiltered
base manager for authorized recycle-bin, restore and purge services. Relationship
traversal through the base manager can still resolve removed parents, so member
services must explicitly check parent visibility before projecting child data.

Call `row.soft_delete(actor)` or `row.restore(actor)` with the session-derived
administrator. The methods reload both the actor and row inside a transaction;
revoked, pending and ordinary members are refused. Repeated transitions return
False without changing original deletion metadata. Removal sets aware server
timestamps with a deadline of exactly 30 elapsed days; restore is refused when
server now is equal to or later than the deadline. SQL constraints forbid partial
metadata or another deadline. The deletion actor is protected from hard removal.

Restore changes only the selected row. Domain services must validate required
parents and lifecycle rules atomically; `validate_restore()` is an override hook.
Database constraints remain the final protection against conflicting restorations.
SQLite transactions do not imply row locks from `select_for_update`.

Ordinary instance/queryset `delete()` raises to prevent accidental permanent
removal. Explicit `hard_delete()` is a low-level primitive for trusted purge
services; it does not itself authorize an HTTP request or choose a retention
deadline. Those services must enforce admin/job authority and domain cascade
policy. Recycle-bin endpoints, graph restoration and scheduled purge belong to
#46/#47. No production content table or background worker is created by #12.
