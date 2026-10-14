# Critical-action audit

`GET /api/admin/audit-log` is read-only and restricted to current approved admins.
Anonymous, pending and revoked identities receive 401; active members and current
curators receive 403. There is no audit update or delete endpoint. Native audit and
privileged ZIP export share the same safe metadata projection, ordered by descending
server occurrence time, then descending UUID for equal instants.

The central recorder stores successful transitions for member approval/revocation/
restoration, curator replacement/clearing, book status changes, summary/highlight
publication/withdrawal, vote closure/tie resolution, soft deletion/restoration/purge
and export. An initially published highlight is a publication transition. Replacing
a curator records clearing the old assignment and assigning the new one; revoking
the current curator records revocation and clearing. Current curators' successful
vote closure is attributed to them. Scheduled purge uses its explicitly configured
admin actor. Normal reads, unchanged settings, failed/refused requests and duplicate
deletion/restoration/closure do not create successful-transition events.

Business writes and audit inserts share a transaction. A failed audit insert fails
the business operation safely, rather than allowing an unaudited critical change.
Attribution refreshes current membership/authority and snapshots the actor's display
name; subsequent profile rename or revocation does not rewrite it. Target fields use
native type/ID and fixed generic labels (for example, `Libro` and `Cita literaria`).
SQL constraints enforce the action/subject pairing, native ID and generic label.
There is no subject foreign key to prevent eligible erasure: audit metadata survives
permanent deletion without retaining deleted substantive content.

No request payload, free-form note, review, summary/highlight/quote text, scores,
profile fields, Discord ID, token, password or media path is recorded. Generic labels
also avoid copying removed catalogue titles. The interface presents who acted, which
type/ID changed and when, and provides no editing controls. The mock remains explicitly
illustrative; native successful exports are labelled as club exports.

Migration preserves the export UUIDs, immutable names and times recorded by #49 and
adds their fixed exported/club metadata. Other actions begin recording with #50; no
history is invented by backfilling existing rows, deletion metadata or purge records.
This is an application audit, not an external tamper-proof ledger or backup policy.

Run fictional API, SQL and migration verification from `backend/`:

```sh
uv run pytest tests/integration/test_audit.py tests/integration/test_export.py
```

Tests migrate only the disposable pytest database. Do not migrate or exercise deletion
on the owner's database as part of verification. Deployment applies migrations through
the normal release procedure.
