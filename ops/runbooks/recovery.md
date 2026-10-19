# Owner-controlled rollback and recovery

This is a decision/checklist for a human, not a command plan for the AI.
The responder may recommend inspection or owner escalation only. It never calls
Docker/provider write operations, runs migrations, restores data or changes traffic.

Before a change, the owner identifies the exact environment/project, active
revision and last known good revision, checks current evidence, records the
intended outcome and protects retained data/configuration. Do not experiment on
the working public release to reproduce an unexplained verifier failure (#110).

## Fictional Render demos

Use the already tested [terminal provider rollback procedure](../../docs/public-demo.md#actual-provider-rollback-from-the-terminal)
and [release identity checks](../../docs/release-process.md). The owner chooses a
known successful provider deployment/revision; the AI does not trigger it. A
source tag does not retain a provider image or roll back a database. Demo local
storage is ephemeral: recreation reseeds fictional fixtures and loses reviewer
edits. Confirm HTTPS, exact version/environment and normal sign-in/library/
sign-out afterward; record the actual revision/outcome. Never claim a deployment
trigger or an old healthy response proves successful recovery.

## Retained local data

Follow [deployment recovery](../../docs/deployment.md#restart-upgrade-and-recovery)
and the [validated backup/restore procedure](../../docs/backups.md). Stop writers
only with owner authorization; preserve the original volume and verified archive.
Recover matching code/data into a new directory/project instead of overwriting a
running database. Application rollback may be incompatible with migrated data.
Restore secrets/configuration separately and privately, inspect recovered records,
media and permission/spoiler behavior, then explicitly authorize cutover.
Never use global Docker prune or remove retained volumes as incident cleanup.

## Monitoring-only failure

Confirm the exact local monitoring project and private topology. An owner may
choose a targeted service restart after inspecting the failure; missing telemetry
does not justify restarting the application or changing data. Keep existing
dashboard accounts/volumes and owner preview intact. Notification history can
reset/repeat after restart. Recheck health, all three signals, rule state and
terminal delivery, and record remaining gaps. Leave automatic remediation off.
