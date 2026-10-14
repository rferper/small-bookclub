# Security baseline (#51)

Production (`BOOKCLUB_ENV=production`) requires an explicit secret and host list,
disables debug, redirects HTTP to HTTPS, sets Secure session/CSRF cookies and
sends a one-hour HSTS policy. Session cookies are HttpOnly; both cookies use Lax
for the top-level Discord OAuth return. The CSRF cookie remains readable by the
central browser transport. Existing middleware enforces CSRF even on Ninja views.

All backend responses, including redirects and denied/error responses, carry
no-store, noindex/nofollow/noarchive, frame denial and disabled browser device
permissions. Django adds nosniff and no-referrer. The eventual frontend/static
server must apply these headers to HTML too (#73/#76); backend headers do not
configure that server.

## Proxy boundary

Prefer direct TLS to Django unless an isolated trusted proxy terminates it. Set
`TRUST_HTTPS_PROXY=true` only when that proxy strips incoming X-Forwarded-Proto
and supplies its own value and clients cannot access Django directly. No forwarded
IP is trusted. Production hostnames must be explicit, never `*`. Public demo
deployment needs the same HTTPS protection as the private site.

See [Django's HTTPS settings](https://docs.djangoproject.com/en/5.2/ref/settings/#secure-proxy-ssl-header).

## Request budgets

The middleware uses SQLite transactions shared by workers, before endpoint work:

| Group | Budget per 60 seconds | Identity |
| --- | --- | --- |
| Session bootstrap | 120 | Network peer |
| Discord start and callback combined | 30 | Network peer |
| Metadata and both statistics routes combined | 20 | Current member |
| ZIP export | 2 | Current member |

The first request anchors a fixed 60-second window; this permits a double burst
across its boundary. Denials return a Spanish 429 envelope and Retry-After.
Storage failure returns a safe 503; health remains independent of the database.
Membership rejection precedes private-route budgets, so revoked sessions cannot
use them. Cookies, query parameters and forwarded IP changes cannot reset a peer
budget. Expired counters are removed on the next limited request; only keyed
digests, counts and expiry timestamps persist. No reset endpoint is exposed.

A deployment proxy must also limit per-client requests, connections and request
body sizes (3 MiB accommodates one 2 MiB image plus metadata). Behind a proxy the
authentication budget is shared by that network peer. These application limits
are for a small club, not distributed denial-of-service protection.

## Uploads and logs

Existing shared image validation accepts JPEG/PNG/WebP only, verifies actual
format, caps files at 2 MiB and dimensions at 16 million pixels, decodes then
re-encodes WebP to discard embedded metadata. Private native file paths remain
guarded. Django additionally limits non-file request data to 64 KiB, fields to
30 and files to two. The edge body cap is still required because multipart files
can reach temporary disk before application validation.

Backend logging uses a closed JSON event/level formatter. It never formats
messages, arguments, request objects, URLs or exception tracebacks. This trades
detailed diagnostics for privacy until dedicated safe telemetry is added (#79).
Do not add raw exception logging or enable SQL/provider debug logs. Configure
proxy/application-server access logs without query strings, bodies, cookies,
authorization headers or member identifiers; Django cannot control those logs.
See [Django logging](https://docs.djangoproject.com/en/5.2/topics/logging/).

Verification uses disposable tests, including production cookie/HTTPS checks,
forged forwarding headers, cross-client budgets, expiry, fail-closed storage,
revocation precedence, log redaction, CSRF and invalid uploads. No development
database is migrated by verification. Operators must run migrations on deployment.
