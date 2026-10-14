# Native club export

`POST /api/admin/export` produces an authenticated `application/zip` attachment named
`club-de-lectura.zip`, with `Cache-Control: no-store`. It requires CSRF, a current
approved admin, and successful Discord reauthentication for that same native and
Discord identity less than five minutes ago. The server stores the evidence; a
confirmation, client timestamp or another admin's login cannot authorize it. Missing,
stale, future or mismatched evidence returns 409 `reauthentication_required`, while
the admin remains signed in. The screen offers the existing top-level OAuth flow
`GET /api/auth/discord/start?purpose=export`; after returning, confirm export again.

The ZIP contains UTF-8 `manifest.json` and `club.json` conforming to the version-1
`ExportManifest` and `ClubBusinessExport` schemas in `openapi.yaml`. This is a privileged
business-data export: it deliberately contains private reviews, draft meeting records,
revoked profiles and recoverable content. Treat it as private club data. Normal member
endpoints and spoiler gates are unchanged. Available native covers and avatars appear
under static safe `media/cover-<key>.webp` or `media/avatar-<key>.webp` paths, matching
the manifest. Valid missing/unreadable native files are explicitly unavailable; invalid
or external pointers have no media ID. No external URL, data URL or arbitrary local
path is fetched, and symlinked files/directories cannot escape the configured root.

Only declared business fields are projected. Passwords, session rows, OAuth state,
tokens, secret configuration and purged substantive content are excluded. Canonical
IDs, links, completion flags, deletion metadata, rubric anchors and minimal purge
tombstones are retained. Profile favourite IDs preserve the persisted ranked selection,
including recoverable book references. Each successful export creates
one protected, safe actor/name/time event, included once in its archive; failed export
transactions leave no success event. Persistent critical-action auditing is documented in docs/audit.md.

The format promises neither database restoration/import nor backup rotation. Export
policy metadata at `GET /api/admin/backups` truthfully returns pending policy and no
last backup until #48 installs tested automatic backups. Historical copies can contain
deleted data until their bounded retention expires. The mock UI continues to download
an explicitly illustrative JSON file and makes no production reauthentication claim.

Verification uses fictional identities, temporary media, intercepted browser fixtures
and pytest's disposable database. Do not export the owner's real club database as a
test. The implementation stores no generated archive on disk or in an issue comment.
