# Automatic content purge

The `purge_expired` Django management command erases eligible soft-deleted content
at or after its stored `purge_due_at` (exactly 30 elapsed days after removal).
It uses an aware server clock, rather than calendar dates or the scheduler's timezone.
An item expiring between daily runs is erased at the next successful run.

Run from `backend/` with the deployment's existing database, private media root,
and environment configuration. Use the native database ID of a current approved
admin, not a Discord ID. Configure it deliberately; the command never creates an
identity, promotes a member, or attributes automatic purges to the deletion actor.

```sh
uv run python manage.py purge_expired --actor-id 123 --dry-run
uv run python manage.py purge_expired --actor-id 123
```

`123` is only a placeholder, not an owner's identity. Dry-run does not change rows,
files, tombstones or the retry queue; it reports eligibility in the current snapshot,
without simulating removals of dependent items. Normal execution visits descendants
before parents. It ignores active and not-yet-expired rows, rechecks each row and admin
inside a transaction, and leaves a minimal kind/ID/actor/time `PurgeRecord`. Repeated
runs are safe. A concurrent restore or another purge causes a row to be skipped.

Retained reviews, vote references, completion history, activity, attendance and other
protected links block erasure. Expired blocked items remain hidden and listed in the
admin recycle bin, with dependency warnings; they cannot be restored after expiry.
The command never destroys history to satisfy retention. A removed child alone does
not authorize deleting an active child or parent. Backups can retain older copies
until their bounded rotation expires; backup scheduling/rotation is tracked in #48.

Private book covers use a durable `CoverErasure` queue containing only validated
opaque file keys and request times. Database deletion and queuing are atomic; file
unlinking runs only after commit. Missing files count as already erased. Filesystem
errors keep the request for retry, and a cover still referenced by any retained book
is preserved. Each subsequent run retries pending requests, including those from an
early manual purge. No blind orphan-directory scan, external URL deletion or backup
erasure is performed.

## Scheduling

Install one daily schedule as the service account that already owns the deployment's
database and media files, after applying migrations through the normal release
procedure. Do not run overlapping copies or run against the development preview.
The schedule is an operator action; startup does not install or execute it.

Example cron entry for a Linux deployment (replace the repository/uv paths and admin
ID; the service account must already have the deployment environment configured):

```cron
15 3 * * * cd /srv/small-bookclub/backend && /usr/local/bin/uv run python manage.py purge_expired --actor-id 123 >> /var/log/bookclub-purge.log 2>&1
```

For Windows Task Scheduler, use a daily task with the existing service identity:

- Program: the absolute path returned by `Get-Command uv`.
- Arguments: `run python manage.py purge_expired --actor-id 123`.
- Start in: the deployment's absolute `backend` directory.
- Configure the task not to start a second instance while one is running, and retain
  its output in the deployment's existing logging mechanism.

Use the same deployment configuration as the application; an empty or alternate
database path is not a production purge. Never put secrets into scheduler arguments.
Deployment-specific containers and scheduling integration belong to #73/#76.

## Failures and verification

Output contains counts only: erased/eligible rows, blocked history, pending cover
requests and retry callbacks scheduled. Pending covers are an explicit cleanup
backlog, not proof of file erasure; shared references can deliberately keep them
pending. Monitor task failures and persistent pending counts. Filesystem failures
do not undo committed content erasure. Correct filesystem permissions and rerun;
do not remove the queue by hand. Missing, pending, revoked or demoted admin identities
fail before new erasure; update the configured native admin ID when membership changes.

Unexpected database failure exits unsuccessfully; earlier completed row transactions
may remain committed. Investigate and rerun rather than reverting tombstones. A
failure rolls back its row, tombstone and queue together. The command doesn't print
private content, cover paths, Discord identities or database exception details.

Run the disposable persistence/clock/filesystem checks from `backend/`:

```sh
uv run pytest tests/integration/test_automatic_purge.py tests/integration/test_recycle.py
```

These use fictional identities and temporary media/test databases. Do not verify by
running the real purge on the owner's database. A passing command test does not claim
that an operator's production scheduler or backup rotation has been installed.
