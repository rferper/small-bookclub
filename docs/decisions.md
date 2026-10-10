# Decisions

Short records of technical decisions. Add one entry per decision; newest at the bottom.

## 2026-10-08: Django + HTMX instead of Next.js (superseded 2026-10-09)

**Decision:** Build the website with Django, server-rendered templates with HTMX and Alpine.js, SQLite, and django-allauth for Discord OAuth.
**Why:** The site is small, admin-heavy and permission-sensitive. Django's admin, auth, migrations and server rendering cover much of that, and server rendering makes spoiler gating easier to enforce and test. Python also matches the Milestone 2 AI worker.
**Consequence:** Deviates from the spec's suggested Next.js stack (§7), which left the choice open (decision #82). The Discord voice bot's language is decided separately by the spike in #56.

## 2026-10-08: GitHub issues are the backlog

**Decision:** Tasks live in GitHub issues; `docs/tasks.md` is retired. Work follows the PM → engineer → QA process in `docs/process.md`.

## 2026-10-09: Separate frontend and JSON API (supersedes "Django + HTMX")

**Decision:** Split the app into `backend/` (Django + Django Ninja JSON API, SQLite, django-allauth for Discord OAuth) and `frontend/` (React + Vite + TypeScript + Tailwind). `openapi.yaml` at the repo root is the API contract.
**Why:** The project is also a course final project that requires a separate frontend with centralised API calls, an OpenAPI contract the backend follows, and tests on both sides. Django keeps the ORM, migrations, admin and allauth; Ninja adds typed request and response schemas. The frontend stack matches what Lovable generates, so Lovable can be used for screen prototypes.
**Consequence:** Spoiler and permission gating stays server-side: endpoints never return data the user may not see, and tests check JSON response bodies. Authentication uses same-site session cookies with CSRF protection (exact flow decided in #5). Issues written for server-rendered templates or HTMX are re-groomed for API + frontend when picked up.

## 2026-10-09: Backlog follows the course phases

**Decision:** GitHub milestones mirror the course modules (Development, Deployment, DevOps and security, Agent extension pack, Final documentation); labels `frontend`, `contract`, `backend`, `polish`, `infra` and `agents` order the work inside a phase. The PM → engineer → QA loop applies to every issue.
**Why:** The course builds horizontally (frontend prototype, then contract, then backend, then deployment), while the original issues were vertical feature slices.
**Consequence:** Existing feature issues #2–#50 become backend issues in Development; new issues cover the frontend sections, the contract and phases 3–6. Postgres for deployed environments (as in the course) is decided in the Docker Compose issue.

## 2026-10-09: Contract-first API

**Decision:** The frontend is built first against a mock API client. `openapi.yaml` is then written by hand from what the screens need; the backend implements it and its tests validate responses against it. Once the contract exists, the frontend's API types are generated from it.
**Why:** The course grades an OpenAPI spec that reflects frontend requirements and is the contract for backend development.
**Consequence:** Until the backend exists, mock-client types are the draft contract. After `openapi.yaml` exists, any endpoint change starts with an `openapi.yaml` change in the same issue, and a CI check fails if the backend's generated schema drifts from it.

## 2026-10-09: Frontend first with a mock API client

**Decision:** Build all Milestone 1 screens in `frontend/` before the backend. Components call only `src/api/` (one typed client interface); a mock implementation returns fictional fixtures, and an HTTP implementation replaces it when the backend is ready. No mocking library: the mock is plain TypeScript.
**Why:** The user wants to see and shape the UI first; it also yields the API requirements for `openapi.yaml`.
**Consequence:** Permission and spoiler rules shown in the mock (locked states) are only a preview; the backend must enforce them. The mock must model gated responses the way the API will (data absent, not hidden).

## 2026-10-09: Public demo instance with fictional data

**Decision:** Deploy a public demo to a free cloud host, with seeded fictional data and a demo sign-in, enabled only by a `DEMO_MODE` setting. The real club instance never enables it, and its hosting stays deferred (spec §7).
**Why:** The course requires a working cloud URL and peer review; reviewers cannot be on the club's Discord allowlist.
**Consequence:** Demo sign-in must be impossible to enable without `DEMO_MODE`, and tests prove it. No real club data ever goes into the demo. Demo data may be reset on every deploy, so an ephemeral free-tier disk is acceptable for the demo.

## 2026-10-09: Milestone 2 after the course

**Decision:** The Discord recording bot and local AI (#56–#62) are out of scope for the course deadline and start only when the user says so.
**Why:** No course criterion needs them, and they carry the highest technical risk.

## 2026-10-09: Frontend toolchain and dependencies

**Decision:** `frontend/package.json` uses these free, open-source packages:
- Runtime: `react` and `react-dom` (UI), `react-router` (client-side routes for the nav sections, detail pages and not-found page).
- Build: `vite` with `@vitejs/plugin-react` (dev server and bundler), `typescript` (type-check in `npm run build`), `tailwindcss` with `@tailwindcss/vite` (design tokens as Tailwind theme colours).
- Tests: `vitest` (runner sharing Vite's config), `jsdom` (browser DOM for tests), `@testing-library/react`, `@testing-library/jest-dom` and `@testing-library/user-event` (render pages and interact like a user).
- Lint: `oxlint` instead of ESLint: one fast dependency with sensible defaults and no plugin set to maintain.
- Types: `@types/react`, `@types/react-dom` and `@types/node` (type definitions needed by TypeScript for React and the Vite/Vitest config files).
**Why:** The user approved the React + Vite + TypeScript + Tailwind + Vitest/Testing Library set on 2026-10-09, and the same day let agents pick free software when something is problematic; oxlint and the `@types/*` packages were chosen under that rule.
**Consequence:** From now on agents may add free, open-source dependencies without asking, recording each here (see `AGENTS.md`); anything paid or needing the user's accounts or secrets still needs the user.

## 2026-10-09: Session gate in the frontend (#63)

**Decision:** The session is one client call, `getSession()`, returning `anonymous`, `denied` (refused sign-in, with no user) or `signedIn` with the user; `getCurrentUser()` was removed so the user has one source. A `SessionGate` root route shows the sign-in, access-denied or session-error screen at the requested URL (no `/entrar` route) until a member is signed in. Club pages get a wrapped client that, on any 401, hides the page and loads the session again.
**Why:** Anonymous visitors should not learn which routes exist, and an expired or revoked session should land on the right screen instead of a generic error.
**Consequence:** The gate is cosmetic; the backend still refuses club data to anonymous, denied and revoked users (#4, #5, #7). #5 and #71 may change how a refused sign-in is reported (reversible) without changing the screens. No new dependencies.

## 2026-10-09: Biblioteca data and dates in the frontend (#64)

**Decision:** Biblioteca loads the whole catalogue with one `listBooks()` call and filters, sorts and groups it in the browser; the book page loads one `getBook(id)` that carries no ratings, reviews or meeting summaries. The view, filter and sort live in Spanish query parameters (`vista`, `estado`, `orden`), with defaults left out of the URL. Reading and due dates are calendar dates (`YYYY-MM-DD`) parsed and formatted as UTC, so they never shift with the machine's timezone; approximate dates are full dates with a `datesApproximate` flag and are shown as month and year with «(aprox.)».
**Why:** The catalogue is about 10–50 books (§5.1), and gated data must be absent from responses rather than hidden in components.
**Consequence:** Reversible: the backend issues (#17–#19) may move filtering server-side and #71 fixes the contract. No new dependencies.

## 2026-10-09: Reuniones and the meeting record gate in the frontend (#65)

**Decision:** Reuniones loads one `listMeetings()` call that returns `{ upcoming, past }`, split by the server's own clock (upcoming from `startsAt` on; upcoming soonest first, past most recent first; cancelled meetings stay where their date puts them). The frontend never compares dates with the browser clock. Both lists are flat across all books, with no pagination (about one meeting a week), and shown as lists, with no month grid. The meeting page loads one `getMeeting(id)`, whose `record` is a discriminated union: `visible` (published summary or `null`, published highlights) or locked (`lockedWeekNotRead` with the week number, or `lockedNoWeek`). Locked records carry no `summary` or `highlights` keys at all, and drafts are never returned. The mock decides the record at call time with one helper, `src/api/mock/meetingGate.ts`, that mirrors the backend gate (#29). Further assumptions:
- On member-facing pages the gate applies to the admin too, for both rules (weekly gate, and no-week meetings hidden until marked safe), although the spec only says no-week meetings are hidden "for non-admin members". The admin reads and edits every record in Administración (#70); #29 can revisit this.
- A locked record does not reveal whether a summary or highlights exist, so an upcoming meeting whose week is not read also shows the locked card.
- Cancelled meetings show no summary, highlights or attendance; upcoming meetings show no attendance. `attendance: null` means not recorded yet.
- Highlights carry a `quote`/`paraphrase` kind and zero or more speakers (§8, decision 77).
- Meeting dates in Reuniones and on the meeting page include the year (`formatMeetingDateWithYear`, `formatMeetingDay`); Inicio and the book page keep `formatMeetingDate`.
**Why:** Summaries and highlights must be absent from responses for a member who has not passed the gate (§5.3, §5.8), and the server is the only clock all members share.
**Consequence:** Reversible: the backend issues (#20, #26, #27, #29) implement the same split and gate, and #71 fixes the contract. No new dependencies.

## 2026-10-09: Votaciones in the frontend (#66)

**Decision:** Votaciones loads one `getVotes()` call that returns `{ curator, current, history }`; the vote page loads one `getVote(id)`; `setApproval(voteId, bookId, approved)` approves or withdraws one candidate for the signed-in user only and returns the updated vote. A closed vote's `outcome` is a discriminated union reported by the server: `winner` (the winning book and a plain-text `tieNote` or `null`) or `tiePending` (the tied book ids, no winner). Votes are public: every member gets the same data, and only `approvedByMe` depends on who asks. The mock answers 401 before 404 and 409, 404 for an unknown vote or a book that is not a candidate, and 409 for an approval on a draft or closed vote. While a change is saved, only its checkbox is disabled and shows the new state; a failure puts it back with an alert next to it, and a 409 shows a calm message and reloads the vote. The curator and admin controls are #91. Reversible assumptions (from the issue):
- At most one vote is draft or open at a time, and it is the "current" vote. Closed votes, including one whose tie is pending, are in the history.
- A draft vote's shortlist is visible read-only to every member; approvals start when it opens, so a draft shows no counts or voters.
- The server reports the outcome of a closed vote; the frontend never computes a winner, and nothing breaks a tie automatically.
- Candidates stay in shortlist order in every state; a closed vote marks the winner (or the tied books) in text instead of re-sorting.
- Totals refresh on load and after the user's own changes, with no polling.
- The `curator` mock session (`?mock-session=curator`) is the member assigned as curator, with the `member` role (§3).
- The vote page and the current vote on Votaciones are the same component (`VoteView`); the vote dates are shown as day with year in the club timezone (`formatLongDate`).
**Why:** Approval voting needs public live totals and one equal vote per member per candidate (§5.4), and only the server may decide a winner or a tie.
**Consequence:** Reversible: the backend issues (#31–#34) implement the same rules and #71 fixes the contract. No new dependencies.

## 2026-10-09: Vote management in the frontend (#91)

**Decision:** The vote data tells the frontend what the signed-in user may do: `VotesOverview.canCreateVote`, `Vote.canManage` and `Vote.canRecordTieWinner`, plus `Vote.curatedByMe` (like `approvedByMe`, it only says whether this user is the vote's curator, to show the curator a note about a pending tie). The client gains `createVote`, `addCandidate`, `removeCandidate`, `reorderCandidates`, `openVote`, `closeVote` and `recordTieWinner`, each returning the updated vote. The mock answers 401, then the simulated failure, then 403, 404 and 409/400, and a refused call changes nothing. The management section lives only on the vote page; Votaciones offers «Preparar una votación». The books to add come from `listBooks()`, filtered to «Propuesto» books that are not candidates. A refused change (409 or 403) shows a calm note and reloads the vote; any other failure shows an alert next to the control. The confirmation dialog is plain React (`ConfirmDialog`: `role="dialog"`, `aria-modal`, focus on «Cancelar», Tab trapped, Escape cancels); while its action runs both buttons are disabled and Escape does nothing, so a call that has been sent cannot look cancelled. The hint that the admin must assign a curator first uses the session role, like the Administración link. Reversible assumptions (from the issue):
- Candidates are catalogue books with status «Propuesto» that are not already in the shortlist. A book that lost an earlier vote stays «Propuesto» and can be nominated again. The curator cannot add books to the catalogue; the admin does that in #70.
- Removing a candidate from an open vote deletes its approvals; the history keeps the snapshot taken at closing, so a removed candidate is not in it. The curator or admin confirms first when the candidate has votes. An open vote keeps at least 2 candidates, and a draft needs at least 2 to open. Adding and reordering are allowed while draft or open.
- Only the admin records a tie-break (the first option in §11 item 11); no curator authorisation is added. The curator sees the pending tie and a note that the admin records the club's choice. The note is optional plain text of at most 1000 characters, trimmed, and empty is saved as none. A recorded winner is final here; corrections are §8's audited workflow (#50).
- The server decides the winner at closing (strictly highest count wins, otherwise a pending tie among every candidate at the top count, even at zero). The frontend never computes it. Closing or a tie-break never changes a book's status, its origin vote or the curator.
- The server sends the permission flags for the signed-in user; the frontend shows controls from them only, and the backend enforces every rule (#31–#33).
- A vote's curator is the current curator when it is created, even if the admin creates it. Only the current curator, or the admin, manages the current vote. Opening needs no confirmation; closing and removing a candidate with votes do.
**Why:** §3 and §5.4 give the shortlist and closing to the curator with an admin override, and keep tie resolution manual; the server must stay the only judge of permissions and outcomes.
**Consequence:** Reversible: the backend issues (#31–#33) implement the same rules and #71 fixes the contract. No new dependencies.

## 2026-10-10: Ratings and reviews in the frontend (#67)

**Decision:** The client gains four calls. `getBookRatings(bookId)` returns `{ book, ratable, finishedByMe, myReview, club }` for the signed-in user; `club` is a discriminated union decided by the server: `{ status: 'locked' }` with no other key at all (no count, mean, name, score or text), or `visible` with `reviewCount` (`n`), `overallMean`, `criterionMeans` and `reviews` (each with `member`, the five `scores`, `overall`, `text` and `isMine`). The user always gets their own `myReview`. `getRatingRubric()` returns the five criteria's 1–5 star anchors, each plain text or `null`, not gated. `setBookFinished(bookId, finished)` and `saveMyReview(bookId, { scores, text })` act for the signed-in user only and return the updated `getBookRatings` result. The mock decides `club` on every call with one pure helper, `src/api/mock/ratingGate.ts`, mirroring the backend gate (#38): visible only when the user has finished the book **and** submitted their own review; it has no role input, so the admin gets the same answer as a member. The maths live in `src/lib/ratings.ts` (pure, shared by the mock and the form's live mean): a review's overall is the unweighted mean of its five scores, never rounded to half-stars; the club mean is the mean of the overalls (computed from the sum of all scores with a single division, which is the same value with less floating-point error); criterion means use the same reviews. The mock answers 401, then the simulated failure, then 404, 409 and 400, and a refused call changes nothing. «Valoraciones» loads with its own call after the book, so its loading and error states stay inside the section. The criteria are `disfrute`, `estilo`, `personajes`, `trama`, `huella`, always in that order. Reversible assumptions (from the issue):
- Ratable books are those with status `leyendo`, `terminado` or `archivado`; `propuesto` and `elegido` books are not yet official club reads (409 on finishing or rating them).
- «He terminado el libro» can be undone only while the user has no review: rating requires it, and a rated book stays finished (409 on clearing it).
- The form lives on its own route, `/biblioteca/:bookId/valorar`, for a new rating and an edit. After saving it opens the book page with router state, so «Valoraciones» says «Tu valoración se ha guardado.» and takes focus.
- Display precision: one decimal with a decimal comma for overalls and means, rounding half up (with a tiny offset so floating-point error such as 4.05 → 4.0499… never shows); single scores show as in the control («4», «4,5»). The underlying values are never rounded.
- Review text: trimmed, at most 5000 characters, blank saved as `null`; shown as plain text with its line breaks.
- Reviews are listed own first, then by display name with Spanish collation; never ranked by score. On the page the user's own review is shown once, under «Tu valoración», and «Valoraciones de los miembros» lists the others; with `n` = 1 a sentence says only the user's rating is there for now.
- Half values show the neighbouring whole-star rubric descriptions (one anchor for a whole value, the ones below and above for a half value), because §5.5 says half-stars sit between anchors. Missing descriptions show nothing.
- The finished flag of other members is not shown.
- The star control is nine visually hidden native radio buttons per criterion (arrow keys move by half a star, one Tab stop per criterion) behind five decorative stars whose halves are 24 × 48 px pointer targets.
**Why:** §5.5 requires an independent rating before any other member's scores, texts or aggregates reach the user, for the admin too (§3), and exact ratings maths.
**Consequence:** Reversible: the backend issues (#23, #35–#39) implement the same calls, gate and maths, and #71 fixes the contract. The radar chart is #92. No new dependencies.

## 2026-10-10: Radar chart comparing a member with the club (#92)

**Decision:** «Valoraciones» gains «Comparación con el club» between «Media del club» and «Valoraciones de los miembros», only in the visible state. It is a hand-built inline SVG with no new dependency: five axes and two polygons need no chart library. The maths live in one pure module, `src/lib/radar.ts` (axis angles, vertices, `points` strings rounded to 3 decimals, ring pentagons and the chart's drawing box); values outside 1–5, `NaN` and `Infinity` throw. The component (`src/components/ClubComparison.tsx`) draws only `club.reviews` and `club.criterionMeans` of the visible `getBookRatings` result, has no role input and makes no call. Reversible assumptions (from the issue):
- The radial scale starts at 0 at the centre and ends at 5, so the distance is proportional to the value and a 1 sits visibly at one fifth of the radius. Guide rings are pentagons at 1–5, labelled «1»–«5» on the bisector between Huella and Disfrute, just outside each ring (`ringLabelPoint`), and drawn after the series with a `paper` halo (`paint-order: stroke`). Every vertex and marker lies on an axis, so none can fall under a label, and a polygon edge crossing one cannot hide it. (Round 1 placed them beside the Disfrute axis, where the usual Disfrute values of 4–5 covered «4» and «5».) Axes go clockwise from Disfrute at the top, 72° apart. Values are plotted unrounded (4.125 stays 4.125).
- Series styles: the selected member is a solid `forest` line 4 units wide with a light `forest` fill (10 %) and round `forest` markers; the club mean is a dashed `bark` line 2 units wide with no fill and hollow square `bark` markers, drawn on top. So where the shapes overlap or coincide both outlines and all markers stay visible. Both strokes are over 5:1 on `paper`.
- The selector is a native `<select>` labelled «Miembro», one option per review in the server's order, valued by member id; the own review reads «<nombre> (tú)» and is the default. The choice is not remembered: a reload of the ratings (a new result) returns to the own review.
- With n = 1 there is no selector, only «Por ahora solo está tu valoración, así que coincide con la media del club.»; the chart and the table are still shown, with both shapes on the same points.
- The comparison table is a separate table (criterion, the member's scores with `formatScore`, the club means with `formatMean`), so the #67 «Media del club» table stays as it is.
- The chart is `role="img"` with an `aria-label` that names the member and points to the table, which is the text equivalent. There is no tooltip, focusable element or animation in it.
**Why:** §5.5 and decision 47 require a radar comparing a selected member with the club means plus a plain numeric table; §4 and §7 require an accessible chart with a text alternative, enough contrast and no motion.
**Consequence:** Reversible: a library could replace the SVG later behind the same component, and the backend (#35–#39) serves the same visible data. No new dependencies.

## 2026-10-10: Estadísticas in the frontend (#68)

**Decision:** The client gains `getStatistics()`, for the signed-in user, returning `{ booksRead, meetingsHeld, thresholds, ratings }`. `ratings` is a discriminated union decided by the server: `{ status: 'empty' }` with no other key at all, or `available` with `bookCount`, `reviewCount`, `overallMean`, `criterionMeans`, `books` (each `{ book, reviewCount, overallMean, dispersion }`), `members` (each `{ member, isMe, reviewCount, overallMean }`) and `highlights` (`topRated`, `lowestRated`, `mostDivisive`, `mostGenerous`, `harshest`, whose entries are the same objects as in `books` and `members`). Like every club call it gives 401 when nobody is signed in. The gate comes first (§11 item 12): on every call the mock keeps only the reviews of books the **viewer** has unlocked with #67's `ratingGate` (finished and rated), in a separate step (`src/api/mock/statisticsGate.ts`), before any figure is computed. It has no role input, so the admin gets exactly what a member in the same situation gets. Locked books are absent, not hidden: no id, title, figure, locked or club-total field, and every count (`bookCount`, `reviewCount`, each entry's `reviewCount`) covers only counted ratings, so nothing reveals how much is hidden. The page shows the same empty copy whether the club has no ratings or the viewer has unlocked none. The maths live in one pure module, `src/lib/statistics.ts`, which reuses `reviewOverall`, `clubAggregates` and `CRITERIA`; values are never rounded in the data, only by `formatMean` on display. The bars are hand-built HTML/CSS (`src/components/BarChart.tsx`, geometry in `src/lib/bars.ts`), with no new dependency. Reversible assumptions (from the issue):
- Thresholds: a book needs ≥ 3 counted ratings for «Libro mejor/menos valorado» and «Libro que más divide», and a member ≥ 3 for «Puntuación más generosa/exigente» (`thresholds: { bookRatings: 3, memberRatings: 3 }`, sent so the page can explain them). Each highlight needs at least 2 qualifying entries. Books and members under the threshold are still in the charts and tables with their real `n`.
- Dispersion is the **population** standard deviation of a book's review overalls, labelled «desviación típica»; 0 with one review.
- A book's mean is the #67 club mean (the mean of its overalls). The overall and criterion means are over all counted ratings, each rating weighted equally. A member's mean is the plain mean of their counted overalls, not adjusted for which books they rated.
- Ties: values within 1e-9 are equal; every tied entry is named, by title or name with Spanish collation. Empty rules: «mejor/menos valorado» and «más generosa/exigente» are empty with fewer than 2 qualifying entries or when all of them have the same mean; «más divide» is empty with fewer than 2 qualifying books or when the highest deviation is 0. The page names the threshold in each empty item, and says so when the qualifying entries cannot be told apart.
- Ordering: `books` by mean, highest first, equal means by title; `members` the viewer first, then by display name, never by score. Only members with at least one counted rating are listed.
- «Libros leídos» (`booksRead`) counts catalogue books with status `terminado` or `archivado`; Inicio's count (#44) still counts only `terminado`. «Reuniones celebradas» (`meetingsHeld`) counts meetings that are not cancelled and start before the server's «now». Neither is gated.
- The three new fixture books (`b12`–`b14`) are `archivado`, so Inicio's figures stay as they are.
**Why:** §5.6 asks for these indicators with their denominators and an accessible alternative to each chart; §5.5 and §11 item 12 put the spoiler gate before any statistic, for the admin too.
**Consequence:** Reversible: the backend (#40, #42) implements the same gate, maths and shape, and #71 fixes the contract. Taste compatibility is #93. No new dependencies.
