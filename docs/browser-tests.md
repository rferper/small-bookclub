# Native browser journeys (#54)

From `frontend/`, install locked dependencies with `npm ci`, install Chromium
with `npx playwright install chromium`, then run:

```text
npm run test:e2e
```

Docker Desktop/Engine and Compose must be running. The command builds the
repository's existing backend/frontend images and starts both services. It does
not reuse a preview. A random project name and two OS-allocated loopback ports give
each run its own network and named SQLite/private-media volume. Only fictional
fixtures enter that new volume. The runner removes that project's containers,
network and volume in `finally` after either success or failure; images/build
cache remain. Owner containers, databases, ports and media are never selected.

Startup readiness is bounded to 180 seconds, each shell subprocess to 300
seconds (browser runner 240; cleanup 60), each journey to 90 seconds and the
Playwright run to 180 seconds. A failure exits nonzero, and a cleanup failure
also fails the command and prints the exact disposable project for inspection.
Abrupt process/host termination can prevent `finally` cleanup. If that happens,
use the exact printed `bookclub-e2e-*` project with the same two Compose files
and `down --volumes --remove-orphans`; never substitute the owner's project.
The free-port reservation is released immediately before Compose starts; a
competing bind causes startup failure rather than connecting to that server.

Both actors share the proxy's network peer and its unchanged production request
limit (10 requests/second, burst 30). Each journey starts with a bounded 3.2-second
quiet period to refill that burst budget. This keeps fast CI automation from
inheriting the previous actor's burst; HTTP errors still fail without retries.

## Real application, external-provider fixture

`tests/e2e/compose.yml` is an explicit test-only override. It mounts
`tests/e2e/` read-only at `/e2e` and selects a test WSGI entry point instead of
`config.wsgi`. Normal Compose never loads that override; normal backend images
copy `backend/`, not the root test fixture directory. No production auth bypass,
test endpoint, service feature flag or club API response mock is added.

The test WSGI module accepts only the test environment with demo sign-in off.
It replaces requests to the exact external Discord token/profile URLs with
fictional provider responses, requiring known codes and a PKCE verifier. Other
outbound requests fail closed. A second, loopback-only test service supplies a
fictional authorization page. The test WSGI adapter points only its authorization
URL at that service. Playwright checks state/PKCE/redirect parameters and clicks
the actor's sign-in link, which returns a fictional code and the original state
to the real callback. The production
allauth adapter validates that state and performs the mocked provider exchange;
normal Django membership, sessions, CSRF and native club services remain active.
The mock checks PKCE parameter presence; it does not prove a real Discord server
accepts the verifier/challenge or exercise that provider's availability.

The fixture command invokes the existing fictional seed privately with a
temporary settings override; the serving process keeps DEMO_MODE=false. The
ordinary desktop/mobile identities are distinct, initially have no completion
or reviews, and are never curators/admins. They share only immutable fixture
content and independent approvals/reviews. Each browser receives a new context.
The command refuses an already seeded volume, so reruns always start fresh.

## Coverage and evidence

Both 1440x1000 desktop and 360x800 phone journeys use the production HTTP client
through Nginx/Django to sign in, edit their profile, complete a linked reading
week, unlock a meeting summary, cast an approval, finish a book, submit all five
scores, see foreign ratings and browse/filter the reading timeline. Native
keyboard radios exercise the rating form. Assertions check JSON sentinel
absence before eligibility, including after finishing without submitting, then
presence after unlocking, plus persisted reloads and a final direct database
verification of both actors' independent mutations.

Console/page errors, failed requests, HTTP error responses and horizontal
overflow fail the tests. Screenshots of unlocked ratings and the timeline at
both widths, failure screenshots and retained failure traces go into ignored
`frontend/test-results/e2e/`; inspect these during local verification. Traces
contain only fictional data. The runner closes browser contexts/processes and
then cleans the stack. Do not commit browser artifacts or sensitive data.
CI retains failure evidence as the `native-browser-failures` artifact for three
days and prints unexpected HTTP status/path diagnostics without query strings.

The existing CI containers job runs this command after backend/frontend checks
and image builds. A browser/fixture/cleanup assertion failure fails that job and
the existing required aggregate. Unit/integration/contract/accessibility checks
stay separate and unchanged. See [testing.md](testing.md) for those commands.
This suite needs no Discord account or live provider network; initial npm/image
and browser installation still requires downloads when not cached.
