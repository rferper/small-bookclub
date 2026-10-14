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

## 2026-10-10: Taste compatibility in Estadísticas (#93)

**Decision:** The client gains `getTasteCompatibility()`, for the signed-in user, returning `{ minSharedBooks, members }`. `members` has one entry per **other** club member (the viewer is never listed), each `{ member, sharedBookCount, comparison }`. `comparison` is a discriminated union decided by the server: `{ status: 'insufficient' }` with no other key at all (no difference, book or score), or `available` with `overallDifference`, `criterionDifferences` (the five criteria) and `books` (each `{ book, myOverall, theirOverall, difference }`). Like every club call it gives 401 when nobody is signed in. The gate comes first (§11 item 12): on every call the mock keeps only the reviews of books the viewer has unlocked, with #68's `countedReviews` (#67's `ratingGate`: finished **and** rated), both unchanged; a book is shared with a member only if that member has also rated it. A finished flag without a review never counts. It has no role input, so the admin gets exactly what a member in the same situation gets. Other books are absent, not hidden: there is no field for hidden, locked or total books, nor for the other member's number of ratings. The maths live in one pure module, `src/lib/compatibility.ts`, which reuses `reviewOverall` and `CRITERIA`; values are never rounded in the data, only by `formatMean` on display. «Gustos en común» is an `h2` section after «Media de cada miembro», with its own call, loading and error states. Reversible assumptions (from the issue):
- Pairs: the viewer is compared with **one other member** at a time, chosen with a native `<select>` «Comparar con» (first member by default, not remembered across reloads; changing it makes no call). Comparing two other members is out of scope. A shared book is one the viewer has rated, so it is always unlocked for them.
- Metric: the **mean absolute difference of overall scores** (#67's overall, unweighted mean of five) over the shared books, on a 0–4 scale, labelled «Diferencia media en la nota global». Criterion differences use the same metric per criterion; the overall difference comes from the overalls, not from the criterion differences. Pearson correlation is not used: with 3 to 10 shared books it would overstate.
- Threshold: **≥ 3 shared books** (`minSharedBooks: 3`, sent so the page can name it) before any difference is computed or sent. Below it the server sends only the count, and the page says «Aún no hay suficientes libros en común.».
- Who is listed: every other member, by name, including those with 0 shared books. The count covers only books the viewer has unlocked and both have rated, so it reveals nothing the viewer could not see on the book pages.
- Ordering: members by display name with Spanish collation, never by difference; shared books by title with Spanish collation.
- Empty ratings: the section is shown, and the call made, only when `getStatistics().ratings` is `available`; with `empty` every count would be 0.
- No chart and no interpretation bands: text and tables only, with no percentage, «muy afines», «más/menos afín» or ranking.
**Why:** §5.6 asks for compatibility on commonly rated books only, with the overlap count, a clearly labelled metric, a minimum shared sample and differences by criterion, never inferred from unfinished or absent reviews; §11 item 12 puts the spoiler gate first, for the admin too; §4 asks for low-pressure copy.
**Consequence:** Reversible: the backend (#41, #42) implements the same gate, maths and shape, and #71 fixes the contract. Richer compatibility charts are a later extension (§2). No new dependencies.

## 2026-10-10: Miembros and member profiles in the frontend (#69)

**Decision:** The client gains two calls for the signed-in user; like every club call they give 401 when nobody is signed in. `listMembers()` returns `{ currentWeekNumber, members }`: `currentWeekNumber` is the club's current reading week or `null`, and `members` has one `{ member, isMe, completedCurrentWeek }` per **active** member, the viewer included (shown «(tú)»), ordered by display name with Spanish collation, never by progress; `completedCurrentWeek` is `null` exactly when there is no current week. `getMemberProfile(id)` returns `{ member, isMe, bio, favouriteQuote, favouriteBooks, currentWeek }`, with `currentWeek` `{ weekNumber, completed }` or `null`. Neither response has a role, Discord id, revocation or approval field, nor any review, rating, score, mean or count, and neither has a role input, so the admin gets what a member gets. The weekly status comes from the same mock state and the same current-week rule as Inicio's `memberProgress` (`currentReadingWeek()` in the mock), so the two always agree. The mock keeps revoked members in a separate `revokedMembers` list that no other call reads, so the fictional revoked member (Tomás, `m8`) changes no other screen or figure; `getMemberProfile` gives the same 404 (same status and message) for a revoked id and an unknown one, and the page shows one not-found state for both. The bio and quote are rendered as plain text by React, one paragraph per line for the bio and `white-space: pre-line` inside the quote's `blockquote`; a blank text shows the section's empty state. Reversible assumptions (from the issue):
- **No ratings on profiles.** Profiles carry no rating, review or taste data, not even for books the viewer has unlocked; «tastes» in §4 are the favourite books plus a link to Estadísticas' «Gustos en común» (#93) on other members' profiles, with no pre-selection. `ratingGate` and `countedReviews` are unchanged. The viewer's own profile links to «Editar mi perfil» (`/mi-perfil`, #94) instead.
- **Favourites are a public profile choice, not a rating:** not gated and without score, status or date. They are only books the club has read (`terminado` or `archivado`), at most 5 (#94 enforces it when editing), in the member's order.
- **No favourite genres:** §8 and #2/#9 have only books; genres can be a new issue.
- **Revoked members are absent** from both calls and give the same 404 as an unknown id. How their past votes and reviews are named elsewhere is left to #7.
- **The bio and quote are plain text;** the quote has no separate author field (§8's `favourite_quote`).
- **The directory lists the viewer too**, marked «(tú)», and orders by name, never by progress. With only the viewer, the page shows a calm empty state below the list.
**Why:** §3 asks for website-native profiles and that revoked members lose access; §4 for Miembros with the public weekly status in low-pressure copy; §5.5 and §5.6 forbid any rating reaching a viewer who has not unlocked it, which is simplest to guarantee by sending none; §12 decision 55 makes weekly completion public among members.
**Consequence:** Reversible: the backend (#2, #7, #9, #10) implements the same shapes and rules, and #71 fixes the contract. Editing the profile is #94. No new dependencies.

## 2026-10-10: Mi perfil in the frontend (#94)

**Decision:** The client gains three calls, none of which takes a member id: they act for the signed-in user only, the admin included, like `saveMyReview`. `getMyProfile()` returns `{ member, bio, favouriteQuote, favouriteBooks, favouriteOptions }`: `member` is a `MemberSummary`, `bio` and `favouriteQuote` are plain text or `null`, `favouriteBooks` is in the member's order, and `favouriteOptions` is every book that may be a favourite, by title with Spanish collation. `updateMyProfile({ displayName, bio, favouriteQuote, favouriteBookIds, avatar })` saves the whole profile in **one atomic call** and returns the new `getMyProfile` result; `avatar` is `{ action: 'keep' }`, `{ action: 'remove' }` or `{ action: 'replace', file }`. If anything is invalid nothing changes, the avatar included. `listMyReviews()` returns the user's own reviews as `{ book, scores, overall, text, submittedAt, editedAt }` (the meanings of #67's `myReview`), with no other member and no club data; it is not gated (§5.5). Like every club call they give 401 when nobody is signed in. The mock checks `updateMyProfile` in this order: 401, the simulated failure, 403, 400; it validates the whole input (and reads the image) before changing anything. The mock keeps one member record, so the new name and avatar reach every call that returns the member. The limits and checks live in one pure module, `src/lib/profile.ts`, shared by the mock and the form. The form previews the image with `FileReader` (a data URL, so no object URL to revoke), and the favourites use the #91 «Subir»/«Bajar»/«Quitar» pattern with focus kept on the moved book. Reversible assumptions (from the issue):
- **Limits:** display name 1–40 characters after trimming, on one line (no line break or other control character); bio at most 500 and quote at most 300 characters after trimming, line breaks kept. A blank bio or quote is saved as `null`. The form checks the same limits before sending and makes no call when one fails.
- **Avatar:** JPEG, PNG or WebP only (no SVG, because it can carry scripts; no GIF), not empty, at most 2 MB (2 097 152 bytes, inclusive), checked on the declared MIME type and size. The mock keeps it in memory as a data URL; nothing is uploaded. The backend checks again and may re-encode (#9).
- **Display names are not unique;** two members may share a name.
- **Favourites:** only `terminado` or `archivado` books, at most 5, distinct, ordered, picked from a list (never free text). The options come from the server (`favouriteOptions`), so the rule lives in one place.
- **One atomic save** for the whole profile, avatar included, with a single «Guardar cambios». Avatar changes are previewed and sent only on save.
- **«Mis valoraciones»** is ordered newest activity first (the latest of submitted and edited), then by title, and shows only the user's own data.
- **The 403 is a mock check** for an `id`, `memberId` or `userId` key naming another member, which can only come from bypassing the types. The real guarantee is that the backend ignores any id and uses the session (#9).
**Why:** §3 asks for website-native profiles that every role edits only for itself; §9 for ownership from the session, validated uploads and no script injection; §5.5 for own reviews always visible and editable.
**Consequence:** Reversible: the backend (#2, #9; reviews #36–#38) implements the same calls and rules, and #71 fixes the contract. No new dependencies.

## 2026-10-10: Administración, members and curator in the frontend (#70)

**Decision:** The client gains `getAdminMembers()`, `addMember({ discordId, displayName })`, `revokeMember(memberId)`, `restoreMember(memberId)` and `setCurator(memberId | null)`. Every call returns `AdminMembers`: `{ members, curator }`, where `curator` is a `MemberSummary` or `null`, and each member entry is `{ member, discordId, role, status, addedAt, revokedAt, isMe, isCurator }`. Active entries precede revoked ones, each group ordered by display name with Spanish collation. These admin-only shapes contain no ratings, reviews, profile text or favourites; member-facing responses never carry Discord IDs, roles or access fields. The reusable `AdminGuard` covers `/administracion` and its subroutes and handles 403 with the same calm message. It is cosmetic, based on the session role: the backend enforces admin access (#11). All five calls use the existing unauthorized handler and configurable mock failures. Reversible assumptions:

- Adding an exact Discord ID approves it immediately, with the member role, no avatar and an empty profile. Restoring a revoked member also counts as approval. IDs are trimmed strings of 17–20 ASCII digits; display names reuse #94's validation.
- Revocation invalidates access in the real backend (#7); the mock only previews the allowlist change. Revoked members disappear from the directory, profiles, home progress and taste comparison choices, while their recorded approvals (including open votes), reviews, attendance, highlight speakers and statistics remain unchanged under their name. Restoring preserves their profile.
- The admin cannot revoke themself, and no web action grants or changes the admin role (#6).
- Revoking the current curator clears the assignment. Changing or clearing the curator is allowed at any time; existing votes retain their recorded curator, while the new curator manages the current vote under #91's rules. Curator is an assignment with no admin powers.

**Why:** §3 requires an exact Discord-ID allowlist and admin-managed curator assignment, while §5.4 and §9 preserve history without destructive cascades. Administration must not leak gated ratings into operational views.

**Consequence:** Reversible: backend enforcement remains in #8 (allowlist), #7 (revocation/session invalidation), #30 (curator), #11 (permissions), #6 (first admin) and #5 (sign-in). #71 defines the OpenAPI entries; mock types remain the draft contract. The remaining admin screens are #95 (books and metadata), #96 (meetings and attendance), #97 (reading plans), #98 (summaries and highlights), #99 (quotes and rubric), #100 (recycle bin) and #101 (exports, backups and audit log). No new dependencies.

## 2026-10-10: Own weekly completion on book details (#90)

**Decision:** `getBook(bookId).schedule` adds `completedByMe`, derived from the same mock `completions` state as Inicio and the central meeting spoiler gate. Each schedule row uses the existing `setWeekCompleted(weekId, completed)` operation, which acts only for the signed-in user and stays idempotent. The row keeps its confirmed state until saving succeeds, disables only its own control while saving, guards duplicate in-flight activations and shows a local Spanish alert on failure. The existing book-id page key discards row state on navigation. Meeting records and home progress refresh on their next page load; no polling or cross-tab synchronization is added.

**Why:** §5.2 allows members to finish late and independently toggle each assignment. The explicit reversible assumption in #90 permits every existing assignment, including future assignments and assignments on finished or archived books, with no date cutoff or automatic changes. Weekly completion leaves the personal book-finished flag and ratings gate independent. The control names its week and exposes its confirmed selected state with `aria-pressed`.

**Consequence:** The draft TypeScript types remain the contract until #71 defines OpenAPI. Backend completion/ownership enforcement remains #22 and permission/spoiler enforcement remains the existing backend issues. No endpoint, client method or dependency is added; state persists for the mock-client lifetime only.

## 2026-10-10: Admin catalogue and fictional metadata search (#95)

**Decision:** Five admin-only client methods (`listAdminBooks`, `getAdminBook`, `createBook`, `updateBook`, `searchBookMetadata`) expose catalogue metadata only. `AdminBook` omits schedules and meetings; `BookInput` takes the whole editable metadata plus a cover action (`keep`, `remove`, `replace` with a file, or `metadata` with a known fixture result id). The mock explicitly projects responses and accepted fields, preserves id/origin vote and every linked record, and commits only after all validation and image reading succeeds. Permission checks precede lookup: 401 for anonymous/denied, 403 for members including curators. Only `leyendo` is unique; the conflict is checked immediately before committing, after any asynchronous image reading, with the active book named in the 409. No status changes follow dates or votes.

**Reversible assumptions:** Shared validation in `src/lib/catalogue.ts` limits trimmed title to 200 characters, each author to 120 (at most 20, one per line), description to 5000, publication date/ISBN to 100 each, publisher/search query to 200. Publication and ISBN are free text. A page count is a positive safe integer or null. Blank optional fields are null and blank author lines are omitted. Planned and actual dates are separate optional `YYYY-MM-DD` pairs, each end validated against its own start with UTC calendar round trips; year 0000 is refused. Dates are not required for any status and the pairs need not agree. Planned dates join BookDetail metadata; actual dates keep their existing timeline meaning and approximate display.

Search explicitly submits a nonblank query against fixed fictional title/author fixtures, with no network. Selection fills only blank metadata fields, preserving dates, status and explicit cover choices. Every imported field is editable, and the known result id supplies the imported cover rather than trusting an arbitrary URL. Image helpers and JPEG/PNG/WebP limits (nonempty, at most 2,097,152 bytes inclusive) are reused from #94; previews/uploads are data URLs in memory. An invalid file prevents saving until corrected or discarded. Saving navigates to the saved book page; subsequent navigation reads the same canonical catalogue record, including vote nomination choices. No polling or persistence.

**Why:** §5.1 and §8 require manual corrections, historical entries and one active book, while §3/§9 keep catalogue operations admin-only and §11 item 5 requires a manual fallback. Atomic edits protect covers and preserve voting/reading history without exposing spoilers.

**Consequence:** No new dependency, HTTP endpoint or OpenAPI change. Backend enforcement and real lookup remain #13–#16, contract generation #71, and deletion/reading-plan/meeting editors stay in their own issues. The user explicitly authorized sequential issues, so AGENTS.md now says one issue at a time rather than one per session.

## 2026-10-10: Admin meeting calendar and attendance (#96)

**Decision:** Six admin-only mock operations expose explicit operational calendar
projections, catalogue/week choices and attendance eligibility without substantive
records, ratings or visibility controls. Authorization precedes lookup and input
validation. Date, book and week edits validate completely before a synchronous
commit. `MockWeek.meetingId` remains the single canonical association; an occupied
week returns 409 instead of silently moving. All catalogue statuses are selectable.
No reading range, due date, note, completion or book lifecycle changes with a meeting.

**Reversible assumptions:** With no duration model, attendance becomes editable
strictly after `startsAt` under `state.now`, for non-cancelled meetings only. Saving
attendance replaces active selections, retains recorded revoked ids and distinguishes
unrecorded `null` from recorded empty `[]`; there is no erase-to-null control. Access
restoration makes a member selectable again. Cancellation toggles status only and
restoration exposes preserved records under the unchanged central weekly gate.
Member reads suppress attendance for future/cancelled meetings and substantive
records for cancelled meetings, with no destructive changes to stored history.

**Time handling:** Native `Intl.DateTimeFormat` supplies configured-zone wall times
and offset candidates independently of browser timezone. Zero or two matching
instants yield specific Spanish gap/fold guidance instead of choosing an offset.
Sorting and Inicio compare parsed instants, including differing offsets across DST.
An unchanged local time preserves the stored instant (including seconds).

**Consequence:** No new dependency, HTTP endpoint or OpenAPI change. Draft mock
types remain the frontend contract; backend/real contract work stays in #71, #20,
#21 and #27. Reading-plan and summary editors remain #97/#98. State is refreshed
after successful admin mutations and on the next member page load, without polling.

## 2026-10-10: Manual reading plans and retained weekly history (#97)

**Decision:** Five admin-only mock operations read, append, edit, reorder and
soft-remove weeks. Catalogue choices reuse `listAdminBooks`. Explicit projections
contain operational facts and distinct stored completion counts only. Authorization
precedes lookup; structural validation, link conflicts and warnings are assessed
before any synchronous commit. Stable ids keep completions attached through edits
and contiguous active 1..N ordering. Dates never reorder anything.

**Reversible assumptions:** Percentages are finite and nonnegative (decimals and
values above 100 remain possible); pages are positive safe integers. Optional
calendar due dates use UTC round-trip validation; optional plain notes trim to
null when blank and allow up to 1000 trimmed characters. Percent and page facts
are independent, never converted. Due dates remain stored under meeting links.
Warnings cover reversed endpoints, endpoints beyond 100/known page count,
backwards starts and overlapping normalized adjacent intervals (percentage
boundaries may touch; page endpoints are inclusive). Known positive page count
also warns when either page-derived endpoint differs from its percentage by
strictly more than 10 percentage points; exactly 10 is accepted. Gaps and date
ordering add no warning. The form resets acknowledgement after every input
change; every write recomputes warnings and requires explicit acknowledgement.

**Removal:** Confirmation names the book/week and distinct completion count,
including revoked history. The week retains its original facts, id, canonical
`meetingId` and completions, with `deletedAt`, `deletedBy` and `purgeDueAt`
(exactly 30 days after the mock clock). Repeated removal is 404. Member active
projections and admin choices omit removed weeks; the central gate forces a
retained linked record to `lockedNoWeek`, even when completed or marked safe.
Calendar date-only edits preserve the read-only removed association; deliberate
unlink/relink releases its reservation. Stored meeting records are untouched.
Recovery/purge UI and conflict handling remain #100; no restore action is added.

**Consequence:** No dependency, backend, endpoint or OpenAPI change. Client types
remain the draft contract for #71; backend enforcement remains #21/#22/#29.
Successful writes return the canonical updated plan; member pages read it on
their next navigation, using the existing next-meeting current-week rule.

## 2026-10-11: Manual meeting records and independent publication (#98)

**Decision:** Seven admin-only typed mock operations read records, save summaries,
append/edit/reorder/remove highlights and explicitly toggle safe unlinked records.
Authorization precedes lookup and validation; each write validates before committing
and returns a fresh explicit editor projection. Member reads use the existing central
weekly gate and expose only independently published, nonremoved items. Admin member
views use the same gate; draft previews belong to Administration only.

**Reversible assumptions:** Summary text trims outer whitespace and allows 10,000
characters; an empty unpublished summary is null and a blank published summary is
invalid. Highlights trim outer whitespace, allow 2,000 characters, keep stable ids,
quote/paraphrase kind, distinct speaker ids and their own publication flag. Internal
line breaks and HTML/Markdown-like text remain literal in editor and member views.
New attribution permits active members only; unchanged revoked attribution can be
retained or removed and restoration makes the member selectable again.

**Ordering and removal:** The stored highlight array is canonical order. Reordering
requires every active id exactly once and preserves removed array slots. Soft removal
retains all content, attribution, publication and original position (`removedPosition`)
with actor/time and a purge deadline exactly 30 days after the mock clock. Confirmation
names the text and recovery period. Restoration and purge actions remain #100.

**Visibility:** Safe controls exist only when no retained assignment links the meeting.
Both safe states reject active or removed links with 409. Removed weeks and cancelled
meetings suppress substantive member records without destroying drafts or publication
flags. Successful mutations refresh from returned canonical data; subsequent member
navigation sees those writes without reloading. No polling or reload persistence.

**Consequence:** No dependency, backend, HTTP endpoint or OpenAPI change. TypeScript
mock shapes remain the draft contract until #71, and backend record enforcement stays
in #28/#29. No AI controls, word counts, highlight categories or count limits.

## 2026-10-11: Literary quotes and whole rating rubric (#99)

**Decision:** Four central admin-only mock operations list quotes, add/edit a
quote and save the complete five-criterion rubric. Readable rubric descriptions
reuse `getRatingRubric`; neither read carries ratings or reviews. All admin calls
check session, configured failure and role before lookup/duplicate/validation.
New guarded Administration routes provide labelled plain-text editors without
deletion or automatic rights verification.

**Reversible assumptions:** Quote text trims outer whitespace and permits 1–1,000
characters; author/source permit 200 each and blank becomes null. Duplicate keys
collapse whitespace and use Spanish lowercase regardless of attribution or active
state, excluding the edited id. Stable ids and array insertion order survive edits.
The form defaults new quotes to active. Rubric saves require exactly the five
criteria and 1–5 whole-star anchors, each nullable or trimmed text of at most 500
characters. Validation finishes before any of the 25 anchors changes.

**Visibility:** Inicio chooses only active quotes on each new page load and projects
text/author/source, never admin ids or flags. Existing fictional corpus attribution
is preserved. Member rating descriptions retain line breaks and literal markup,
and half stars keep the existing neighboring-anchor behavior. Subsequent navigation
in the same mounted client sees saved changes; reload/cross-tab persistence is absent.
Default rubric fixtures stay null; existing explicitly marked example fixtures stay
unchanged. Missing descriptions remain blank.

**Consequence:** No new dependency, backend, HTTP endpoint or OpenAPI change. Draft
client operations remain planning input to #71; backend management/enforcement stays
in #35/#43/#11 and quote recovery/deletion stays in #100. Failed saves retain input,
announce actionable Spanish errors and never update saved views. Immediate submit
locks protect one whole transaction per form.

## 2026-10-11: Canonical mock recovery and conservative purge (#100)

**Decision:** The central typed client exposes deletion previews, book/meeting/quote
removal and an admin-only recovery list with restore/purge operations. Existing
week/highlight removal feeds that same list. Canonical arrays and optional deletion
metadata own recoverable state; no parallel content snapshots are introduced.
Central visibility filters suppress removed items and descendants before projection,
including activity events whose fixtures now carry canonical subject references.
The admin preview projects identifying labels and dependency counts without reading
reviews or unrelated editor payloads. The guarded Papelera reuses ConfirmDialog
for terminal purge and active editors reuse it for recoverable removal.

**Reversible assumptions:** Bin order is newest deletion first with deterministic
type/id ties. Recovery expires exactly 30 days after the mock clock; expired entries
stay listed until an explicit purge, without a browser timer or background job.
Restoration clears only the selected target's removal metadata. Required parents
must be restored first, while independently removed descendants stay removed.
Week ordering reinserts the retained ordinal clamped to active length and renumbers;
highlights retain canonical array slots and surviving relative order. Current
deliberate week/meeting link edits prevail over old removal facts. A removed meeting
reservation remains a read-only Spanish association during unrelated week edits,
and explicit unlink/relink releases it. Restoring a meeting whose linked week remains
removed is allowed so recovery cannot deadlock; the existing lockedNoWeek gate
continues to suppress its records.

Votes containing a removed book are hidden whole and their actions are frozen with
409, preserving candidates, approvals and closed outcomes unchanged for recovery.
Restore conflicts are atomic, including the single Leyendo invariant, required
parents, canonical same-book/one-to-one links and normalized quote uniqueness.
Recoverable quotes retain their original active flag, insertion position and text
uniqueness reservation until purge.

**Purge:** Confirmation explicitly ends recovery without deleting dependent history
in cascade. Books with retained weeks, meetings, reviews, finished/favourite marks
or vote references refuse purge; meetings with week reservations, attendance or
highlights refuse; weeks with completions or a retained meeting link refuse. An
independent quote/highlight or empty eligible container loses its substantive
payload, leaving at most type/id and purge actor/time in a minimal tombstone.
This is simulated in-memory removal, not real disk or backup erasure.

**Consequence:** Successful writes refresh canonical admin data and subsequent
navigation in the mounted client sees their effects through existing permission and
spoiler gates. No polling, reload persistence, new dependency, HTTP/OpenAPI change
or automatic status/date transition. Types remain the draft contract for #71;
backend archival/erasure/jobs and backups stay in #12/#46/#47/#48.


## 2026-10-11: Fictional export, pending backups and safe operational audit (#101)

**Decision:** Three central admin-only mock calls expose backup information,
a fictional full-club JSON export and read-only audit metadata. Session and role
checks precede reads and injected failures for all three. The guarded routes are
`/administracion/copias` and `/administracion/registro`. The confirmation simulates
admin authorisation only; an explicit mock option returns the distinct 409 without
expiring the session or claiming real reauthentication.

**Export projection:** Schema version 1 and fixed mock creation time accompany
active/revoked members, allowlist, profiles, curator assignment, books, weeks,
meetings and their draft/published records, completions, finished flags, reviews,
votes/approvals/outcomes, all five rubric criteria, quotes, deletion metadata,
minimal purge tombstones and safe audit events. Each object boundary whitelists
its fields. The projection reads canonical current state, includes recoverable
removed data and excludes purged substantive records, session/current-user control
state, failure options and credentials/tokens. Existing media references (including
in-memory mock upload data URLs) are copied; no media files are fetched or bundled.
The stable UTF-8 filename is `club-de-lectura-demostracion.json`; this illustrative
JSON is not a restorable database/media backup. Empty business collections remain
valid. The export success event is committed after projection serialization succeeds
and is included in that download.

**Audit:** A small shared helper observes only safe scalar transitions around
successful critical writes; it never snapshots raw requests or substantive payloads.
It serializes those mock writes (including export) so overlapping promises cannot
duplicate events or attribute another transaction's changes. It records actual
member access/curator/status/publication/recovery/vote changes, not ordinary edits,
reads, no-ops or refused/failed operations. Metadata contains event id/action,
target type/id/safe label, actor id/display name and fixed timestamp. Quote and
highlight targets use generic Spanish labels; book/member/date labels are immutable
safe snapshots, surviving purge. Reads/export copy each metadata field explicitly,
newest instant first, with descending event-id ties. Curator vote closure retains
the curator actor without granting audit access. This in-memory log is neither
persistent nor tamper resistant.

**Policy:** The default is pending, with no invented frequency/destination/rotation,
retention or last successful backup. An explicitly supplied last-backup timestamp
is labelled simulated. UI separates the 30-day recycle bin and explains bounded
rotation, backup expiry and tested consistent DB/media recovery at deployment.

**Consequence:** No new dependency, backend, HTTP endpoint or OpenAPI change.
Draft #71 routes: admin-only `GET /api/admin/backups`, `POST /api/admin/export`,
`GET /api/admin/audit-log`; #71 settles real response/download/auth details before
backend work. Real export/recent authorisation is #49; backup policy/restoration
is #48; persistent audit is #50. No reload persistence or import controls.

## 2026-10-11: Member contract foundation and offline validation (#71)

**Decision:** Root `openapi.yaml` defines OpenAPI 3.1 session/member operations
with method-name operationIds, opaque string IDs, closed JSON Schema objects and
discriminated absent/null variants. `docs/api.md` inventories every central client
method; admin-only HTTP schemas are #102 and type generation/adoption is #103.
Member reads/result-returning writes use 200, createVote 201, void completion,
logout and demo 204 without bodies. Own flags/approval/review/profile replacements
use PUT; action/create calls use POST; candidate removal DELETE. Lists remain
unpaginated with the established ordering. No new product permission is granted.

**Reversible flow assumptions:** Same-site `sessionid` HttpOnly/SameSite=Lax cookie,
Secure under HTTPS deployment (local HTTP does not assert Secure-cookie support).
GET session bootstraps `csrftoken`; unsafe JSON/multipart/logout/demo send
`X-CSRFToken` (not an auth credential). Backend #5 may refine names/flow through
the contract first. Discord entry/callback are 302 navigation with identify-only
scope, exact allowlist/state checks and same-origin return. Optional `purpose=export`
reserves #102 reauthentication on those same routes; no arbitrary redirect input.
JSON errors are exactly required `{code,message}` with safe Spanish text and
documented status codes, not the local ApiError adapter.

**Multipart:** Profile metadata is an application/json part with avatarAction;
replacement alone requires the binary JPEG/PNG/WebP avatar part <=2 MiB. Browser
File/local AvatarChange are adapters, not JSON. Normalized text limits are after
trim (`x-trimmed*Length` documents server obligations), retaining acceptance of
leading/trailing whitespace. Optional blank text becomes null. Server content
sniffing, canonical eligibility, atomicity and permission/gate predicates remain
backend work, not claims made by schema tests. Output means/differences use distinct
continuous schemas rather than half-star score constraints.

**Home clarification:** PM confirmed the current global fixture review counter
and ungated activity filter disagree with spec privacy. The contract requires
actual retained viewer-unlocked review counts and canonical gated/published
activity, omitting unverifiable subjects. #71 leaves runtime unchanged; #104
corrects/tests this focused discrepancy before #102/#103. Order is #71 → #104 →
#102 → #103 → backend. No privacy exception or change hidden in type generation.

**Free OSS dev dependencies, pinned:** `@apidevtools/swagger-parser` 13.1.0
checks the bundled OpenAPI 3.1 structural schema and resolves local references;
`ajv` 8.20.0 validates JSON Schema 2020-12 examples; `ajv-formats` 3.0.1 checks
dates/instants; `yaml` 2.8.3 parses YAML and rejects duplicate keys. The validator
explicitly refuses remote refs so it runs offline after dependency installation.
Its structural OAS3.1 support is verified against the actual bundled validator,
since the public parser API documentation still describes earlier OAS versions.
See [parser validator source](https://github.com/APIDevTools/swagger-parser/blob/main/lib/validators/schema.js)
and [Ajv JSON Schema support](https://ajv.js.org/json-schema.html).

**Why:** Separate structural validation/reference resolution from executable
schema/example assertions; no backend scaffold or runtime dependency is needed.
Node's built-in test runner exercises disposable malformed/ref/example mutations
without interacting with Vite's native DLLs. The existing frontend CI retains
clean npm ci, then runs `validate:contract` and `test:contract`. Tooling was installed
in a disposable clean copy and only manifest/lock changes copied, preserving the
running port 5173 app and existing workspace node_modules.

**Consequence:** No central client/type/mock output change in #71. Contract tests
validate declared shapes/examples, not live HTTP/server security. Backend response
validation is #72; backend/Compose checks are deferred until those systems exist.

## 2026-10-11: Home spoiler privacy correction (#104)

**Decision:** Inicio counts actual retained reviews on visible books through the
same central `countedReviews` predicate as statistics: the viewer must have
finished and submitted a rating for each counted book. The fictional global
counter is not used. Revoked historical contributions still count only on those
unlocked books; admin, member and curator follow the same rule. The Spanish label
is now «valoraciones visibles».

**Activity:** Existing deletion filters compose with canonical spoiler access
before projecting any event id/type/time/text. Review events require a visible
book unlocked by that same predicate. Summary events require a visible meeting,
an actually published summary and the existing member `toMeetingRecord` gate,
which handles cancellation, linked-week completion/removal and explicitly safe
unlinked meetings. Missing or unknown subjects are omitted rather than inferred
from text. Current publication/access state governs retained history; no new
events are produced. Ordinary activity, public progress and approvals are unchanged.

**Consequence:** No dependency or wire shape change; #71 already declares these
predicates. The mock and documentation now agree. Backend Home/activity enforcement
remains #44/#45, and no frontend filtering is claimed as server enforcement.

## 2026-10-11: Complete administrative production contract (#102)

**Decision:** Extend OpenAPI 3.1 with all 42 administrative methods, closed explicit
operational/editor/allowlist/bin/audit schemas, inputs and production download
declarations. All 73 central client methods now have unique operationIds plus the
provider callback; docs inventory/negative fixtures enforce completeness. Admin
requires current approved identity/role (401 then 403 before lookup/validation);
curator stays limited to voting. Catalogue/calendar never contain ratings or
substantive records; drafts belong to editor endpoints, while admin member views
retain #71 gates. Safe bin/preview use generic quote/highlight labels and operational
dependencies, intentionally narrower than local mock labels; #103 owns adapters.

**Reversible transport assumptions:** Resource creation is 201; result-returning
updates/soft removals are 200. Cover edits use atomic multipart JSON metadata plus
replace-only sniffed JPEG/PNG/WebP bytes <=2,097,152; metadata result id is the sole
imported-cover reference. Stable/canonical links, independent ranges/publication,
warning acknowledgement (400 when absent), null versus empty attendance, five whole
rubric criteria and conservative noncascade recovery/purge preserve existing rules.
No automatic job or backend enforcement is implemented. #12/#46/#47 may refine
production erasure before implementation.

**Export:** Fix GET /api/admin/backups, POST /api/admin/export and GET
/api/admin/audit-log. Backup policy stays pending with nullable last timestamp (#48).
Export requires CSRF and successful fresh server-verified Discord authentication
for the same still approved admin via existing purpose=export OAuth start/callback.
Freshness is five minutes by server time, age <300 seconds; future timestamp invalid.
Missing/stale authorisation is strict 409 reauthentication_required without download
or session expiry; confirmation/request boolean insufficient. Implement/test #49/#5.

Successful export is authenticated application/zip attachment, fixed safe server
filename club-de-lectura.zip and Cache-Control no-store. Version 1 UTF-8 manifest.json
and club.json contain whitelisted business records including private reviews,
drafts, revoked/recoverable history, deletion metadata, minimal tombstones and safe
audit. Stable native media ids refer to available bytes under safe media paths;
unavailable media is explicit, with no external fetch/data URL. Sessions/OAuth
credentials/secrets/purged substantive payloads are excluded. This explicit draft
format under spec §9/#49 promises neither import/restoration nor backup retention.
Change schemaVersion/contract first if later implementation needs another format.

**Boundary and evidence:** Local ClubExport filename/json and fictional data URLs
remain illustrative mock JSON, never production wire or restorable snapshot. #103
owns generated types/local adapters preserving demo download/tests; #49 owns ZIP
download/fresh authorisation UI; #50 owns persistent audit; #72 validates backend
responses. Existing OSS validator/CI checks the whole extension and sensitive-field
mutations offline; these are schema/declaration tests, not HTTP security evidence.
No new dependency, account, service, UI or runtime change.

## 2026-10-11: Generated operation boundaries and local adapters (#103)

**Decision:** Pin free MIT openapi-typescript 7.13.0 and commit deterministic generated.ts.
Central JSON results derive from operations, public data from components, scalar inputs
from request properties. File metadata derives from generated schemas; explicit multipart
helpers produce JSON plus Blob parts. OAuth navigation and illustrative mock JSON export
are separate adapters. Existing UI/mock rules remain intact.

**Compatibility:** Generator 7.13.0 advertises TypeScript ^5 as peer, while this app uses TS6.
Targeted npm override `openapi-typescript.typescript=$typescript` selects existing TS6,
without force/legacy-peer-deps or compiler downgrades. The actual AST API is verified by
clean npm ci, deterministic generation, full build, actual conformance and regenerated
request/response mutations at real mock boundaries. An older generator trial introduced
six high dev audit findings; the final installation has zero audit findings. No old
generator workaround remains in generation.

**Why:** The contract must control actual boundaries. The documented
[Node AST API](https://openapi-ts.dev/node) works from validated memory offline.
Original discriminator/const/oneOf/null/required semantics are preserved. Binary format
uses TypeScript factory Blob nodes. External refs are rejected before generation.

**Evidence:** Byte freshness, actual mock conformance and sensitive-field rejection
complement behavior tests. Regenerated schema mutations must fail at actual mock/client
compilation, without handwritten wire schemas or broad casts. Existing ApiError accepts
optional generated code; explicit envelopes preserve callers. Generated LF is stable
across Windows/Linux checkouts.

**Consequence:** CI clean npm ci uses the recorded override then validates contract,
freshness and boundaries before build. Dependencies were installed in a disposable copy;
reviewed manifest/lock copied to preserve localhost 5173/native DLLs. Backend HTTP/auth/ZIP
enforcement remains scoped; #72 must validate actual server responses.


## 2026-10-11: Migration-free health backend foundation (#1)

**Decision:** Python 3.13 and Django 5.2 LTS are a supported pair per the
[official Django 5.2 compatibility documentation](https://docs.djangoproject.com/en/5.2/releases/5.2/).
uv records direct dependencies and exact transitive resolutions. No auth/admin/contenttypes/session
applications or club models are installed; #2 sets the custom user before their initial migrations.
Health is a real Ninja route with an independent closed `Literal["ok"]` response schema, public security
and no DB/provider probes. Interactive docs/schema HTTP routes are disabled; local generation remains
available for drift checking. No private club operations or server gating are claimed.

**Free OSS dependencies:** `django` (BSD, framework), `django-ninja` (MIT, typed JSON API/schema),
`pydantic` (MIT, explicit closed schema configuration), `pyyaml` (MIT, offline root contract parsing),
`jsonschema` (MIT, actual HTTP response validation in tests), `tzdata` (Apache/BSD, consistent IANA data
on Windows and clean CI). Dev: `pytest` (MIT, test runner), `pytest-django` (BSD, real Django HTTP stack
without production database access), `ruff` (MIT, lint/format). Installed through `uv add`; lockfile
commits reproducible versions. No account, service, payment or credentials needed.

**Environment:** Explicit development/test/demo/production selector, strict true/false DEBUG,
SQLite path, Spanish and aware datetimes; default club timezone UTC, never machine-derived.
Production refuses missing explicit secret/hosts and DEBUG=true, and sets secure session/CSRF
cookies. Local development fallback key is deliberately public, not a credential. Demo config alone
provides no authentication. Shell variables are read directly; .env.example is documentation,
not a hidden dotenv loader. Relative DB paths resolve inside backend, memory supported. Secrets and
all SQLite artifacts are ignored. Full deployment security remains the relevant deployment issues.

**Drift boundary:** The executable checker generates actual Ninja OpenAPI and inventories every
registered route, including accidentally hidden routes, using a small tested adapter to the locked
Ninja registry. All registered/generated operations must match path/method and handwritten operationId,
effective security, response statuses/media/headers, request requiredness/media/schema and parameters.
Every future real route automatically enters the subset. Health is mandatory; future contract operations
are not demanded, copied into implementation or claimed as implemented. Local refs resolve offline;
cyclic/remote refs are refused. Schema annotations may be omitted, but property names and behavioural
constraints (including required, closedness, literal values and request encoding) remain. Independent
negative mutations test both schema sides and registered/generated inventory. #72 retains full workflow
integration and permissions/spoiler coverage.

**Frontend:** getHealth is an explicit non-UI inventory exception alongside provider-owned
discordCallback. Generated types are refreshed, but ApiClient/runtime/mock selection stays unchanged;
#105 owns HTTP transport. Disposable frontend copies preserve the active workspace DLLs/port 5173.

## 2026-10-11: Custom identity and native profile foundation (#2)

**Decision:** Use Django's `AbstractBaseUser` and a migration-serialized `BaseUserManager`
in the dedicated `users` app. Set `AUTH_USER_MODEL=users.User` with auth/contenttypes
installed before their first migrations. `users.0001_initial` owns the custom table;
the default `auth_user` table never exists. An independent BigAutoField identifies
website records; `discord_user_id` is the unique login identifier, an exact string
of 17–20 ASCII digits. Anchored validation and SQL checks reject Unicode digits,
trailing newlines and malformed values; uniqueness continues across revocation.
No username, email, permission mixin, staff/superuser flag or Django-admin UI is added.
This follows the [Django custom-user guidance](https://docs.djangoproject.com/en/5.2/topics/auth/customizing/).

**Membership:** Pending, approved and revoked allowlist rows share this identity.
Default membership is unapproved with no revocation timestamp and member role;
admin role alone cannot approve it. Only approved rows without revocation derive
`is_active=True`, including on unsaved objects. There is no editable active column.
Model validation and SQL reject approval with revocation, and roles other than
member/admin. Curator remains a later assignment. Aware created/updated timestamps
and inherited `last_login` preserve future allowlist/authentication needs.

**Native profile:** Required display names trim to 1–40 characters and reject control
characters, Unicode formatting controls and line separators. Optional bio/quote trim
to null when absent/empty, with explicit validators for the 500/300 character limits
(TextField's max_length alone is insufficient for model validation). Plain text is
preserved; HTML escaping belongs to rendering, with no Discord profile import.
Avatar storage is an empty path by default. No upload or favourite-book relation exists.

**Supported writes:** `create_user` validates before saving, never supplies approval
or elevated role defaults, and rejects every non-null password argument. New model
instances default to an unusable password; sync/async password setters reject local
passwords. `full_clean` also rejects usable password storage and naive revocation.
Raw ORM/bulk writes intentionally bypass Django validation and must not be used by
future profile/account workflows without validation; identity/role/membership SQL
constraints still apply. Local `create_superuser` always rejects, reserving first-admin
authorization for #6. No provisioning, session or HTTP authorization is claimed.

**Evidence:** Pure validation/eligibility tests use no database. Persistence, queryset
constraint bypass, identity uniqueness after revocation, timestamp updates and fresh
subprocess migration checks are integration tests. README documents disposable SQLite
verification; it never migrates/resets the owner's development database. No dependency,
endpoint, contract, frontend selection or localhost behavior changes.

## 2026-10-11: Backend default membership and CSRF boundary (#4)

**Decision:** Install Django database sessions against the existing custom user, with
explicit sessionid/csrftoken cookie names. Middleware order is Security, Session,
Authentication, Membership, Common, RequiredCsrf. The shared pure membership helper
requires authentication, persisted identity, approval and no revocation; role is
irrelevant. The guard rechecks the database row on each private request and replaces
request.user with it. Failed sessions containing an auth identity are logged out
and their server session deleted; reapproval cannot revive an old cookie.

**Boundary:** Only the six exact method/path pairs in users/access.py waive
membership: GET health/session/OAuth start/OAuth callback and POST logout/demo.
Unknown paths and future routes are private by default, before redirects, parsing
or lookup. Public health remains database-independent and cookie-free by leaving
authentication/session state lazy. No static/media/docs/admin prefix is public.
No new production operations or authentication provider library are added.

**CSRF:** RequiredCsrfMiddleware wraps the callback passed to Django's standard
CSRF process_view, removing the effect of Ninja's generated csrf_exempt flag.
This retains normal token/origin checks on every unsafe backend handler, including
anonymous public logout/demo probes. Membership refusal returns safe JSON 401 first;
CSRF_FAILURE_VIEW returns closed safe Spanish JSON 403 without reasons or input.
Test-only URLconf Django/Ninja sentinel handlers prove this ordering without
inventing production club APIs. Full authorization/spoiler rules remain #11,
OAuth/session/logout #5, demo #75, and frontend HTTP adoption #105. This protects
backend data only; Vite and the current mock client remain unchanged.

**Verification:** Pure boundary/membership tests and real-session integration tests
cover approval, admin ineligibility, next-request revocation/deletion, cookie replay,
unknown/private paths, exact public exceptions and CSRF. The fresh disposable
migration test includes the sessions table. No new dependency is required.

## 2026-10-11: Explicit HTTP adoption boundary (#105)

**Decision:** Startup selects exact mock/http, defaulting only omitted mode to mock.
Invalid/empty explicit configuration fails visibly before requests. Every HTTP
ApiClient entry explicitly refuses 503 until its feature issue enables an adapter;
HTTP ignores mock query controls. #5 enables only its session/OAuth/logout entries,
#75 demo, #49 ZIP. No endpoint or dependency is added.

**Transport:** Native fetch/Headers/URLSearchParams/FormData with generated operation
path/query/body/results and explicit adapter method/path/status. Fixed same-origin
/api/ boundary, redirect:error, same-origin credentials, current per-request CSRF
and isolated JSON/multipart snapshots. Dot segments/separators/percent/control path
values fail closed against ambiguous decoding. A shell-only development-only exact
backend origin can proxy /api/ without altering browser URLs.

**Errors:** Trust only closed generated error envelopes with nonblank plain text;
otherwise retain HTTP status with fixed Spanish fallback. Network/abort => 503
service_unavailable; malformed successes/protocol/unsafe URL construction => 500
internal_error. No retry or session expiration for these failures. 204 returns void;
JSON success types derive from the contract without a new runtime schema validator.
Transport fake HTTP proves construction/handling, never backend OAuth or gating.
Disposable browser copies/servers use strict separate ports and existing disposable
dependencies, preserving localhost:5173/native DLLs/the owner's development DB.

## 2026-10-11: Finite native Discord authentication (#5)

**Decision:** Add free MIT django-allauth[socialaccount] through uv, locked at 65.19.7.
Its extra brings requests (Apache-2.0, provider HTTP), oauthlib (BSD, OAuth), PyJWT
(MIT, provider support) and cryptography (Apache/BSD, provider crypto), with locked
transitives; no external app, service/account or credentials were provisioned.
Use actual maintained OAuth2 callback/state/code exchange with identify only and
S256 PKCE. Narrow native adapters validate raw ASCII Discord ID strings and terminate
allauth before signup/connection/account/token persistence. Provider profiles/email
are discarded, and no account-management routes are mounted. See official
[allauth adapters](https://docs.allauth.org/en/dev/socialaccount/adapter.html) and
[OAuth2 settings](https://docs.allauth.org/en/dev/socialaccount/providers/oauth2.html).

**Reversible flow choices:** Single outstanding server-held intent/state per browser,
valid server age [0,600) seconds; consume/clear all state on callback. Ignore supplied
scope/auth_params/process/next, fixed login destination / and eligible export destination
/administracion. All auth responses are no-store. Native login rotates even an existing
same-user key and clears denial/export freshness; failed ordinary login flushes and
sets denial. Session re-reads membership, bootstraps CSRF and never exposes Discord
identity. Library-required email settings are inert: no email/password route exists.

**Export handoff:** Bind native/Discord admin identity in server intent, require fresh
provider code exchange, recheck approval/admin role and retain timestamp only in that
server session. Consent prompt does not guarantee provider password entry. Freshness
requires nonfuture finite age <300 seconds for that same current approved admin.
Failures/replays clear freshness while preserving eligible sessions. Retained server
last-purpose marker safely identifies export replays without retaining reusable state.
Logout flushes every marker. #49 owns actual export endpoint/archive/UI.

**Frontend/evidence:** Only central getSession/startSignIn/signOut adapters are enabled;
navigation uses location.assign, reads/logout use existing transport. All other methods
retain explicit request-free 503. Default mock remains unchanged. Offline mounted
allauth HTTP tests mock only provider HTTP and check DB/session/state/native profiles,
CSRF and contracts; fake frontend tests independently prove adapter/gate behavior.
Clean entire-HEAD temporary archives protect the owner's port5173/DLLs/database.
No real Discord smoke test is claimed.

## 2026-10-11: Export freshness retains verified provider identity (#5 QA round 1)

**Correction:** The callback freshness record retains the verified native ID and exact
Discord ID as well as server timestamp inside the existing DB session. The shared
check compares both against the current approved admin row. Replacing Discord ID on
the same native row invalidates and removes freshness while preserving an eligible
session. Older records without provider identity fail closed. No wire/API/model change.
Mounted allauth regression reproduces replacement after actual login/export exchange;
pure tests cover exact identity and missing binding independently of age/role checks.

## 2026-10-11: Finite explicit native owner bootstrap (#6)

**Decision:** Only the local `bootstrap_admin` management command consumes
`INITIAL_ADMIN_DISCORD_ID`, using the existing exact ASCII string validator. It runs
atomically on an already migrated intended database and creates the native placeholder
`Administrador` or promotes/reapproves an existing target without changing its profile,
password, identity or creation/login history. An already configured rerun performs no
write. Stored malformed or unnormalized rows fail rather than being repaired.

**Owner assumption:** Any different admin-role row blocks provisioning, including
pending/revoked admins. This implements the spec's one owner and deliberately refuses
implicit rotation or a second admin; owner recovery/rotation needs separately scoped
work. Reapproving this exact target requires explicit command execution.

**Boundary:** No startup/post-migrate hook, HTTP operation, schema migration, frontend
change, provider/account provisioning or new dependency. Spanish command output reports
only the outcome and suppresses identity/profile/storage errors. Test subprocesses use
new disposable SQLite databases; mounted allauth tests mock only provider HTTP and
prove deny-before/approved-admin-after execution and inert browser/environment claims.

## 2026-10-12: Atomic native member revocation (#7)

**Decision:** Add bodyless mounted `revokeMember` using the existing current-identity
recheck and a pure approved-admin refusal decision. Only a current approved admin
may revoke an approved target; own/pending/already revoked targets return safe 409,
missing or nonnumeric/out-of-range native keys safe 404. Browser claims are inert.
The existing membership/CSRF middleware and public-operation boundary are unchanged.

**Sessions and atomicity:** Update only approval, aware server revocation time and
mutation time; scan signed Django database sessions and delete every matching native
auth identity, including idle/expired sessions, in the same transaction. No profile,
role, password, Discord identity or creation/login-history rewrite. Invalidation or
storage failure rolls back before a closed Spanish 500 is returned. A scan is finite
and suitable for this 6–10-member club; no session index/model or dependency is added.
Django's database transaction supplies rollback on SQLite; `select_for_update` also
locks the target on engines that support it, without claiming SQLite row locks.
See [Django sessions](https://docs.djangoproject.com/en/5.2/topics/http/sessions/)
and [SQLite boundaries](https://docs.djangoproject.com/en/5.2/ref/databases/#sqlite-notes).

**Projection assumptions:** Closed explicit native projections include only approved
active rows and revoked rows, omit pending rows, and expose exact Discord ID only to
the approved admin. Sort active before revoked, then a pure Unicode Spanish key:
case/diacritic-insensitive primary order with ñ between n and o; folded/original name
and native key break ties deterministically. This avoids mutable process-global OS
locale and another dependency. Until #30 persists assignments, curator is null and
isCurator false. #30 must reuse this operation and integrate curator clearing into its
transaction; retained future domain records and audit remain #31/#50. No frontend
HTTP adapter, mock/default preview, database migration or owner database is changed.

**Evidence boundary:** Pure authorization and mounted real-user/session/CSRF tests
prove multi-browser deletion, cookie nonrevival after test-only reapproval, safe
rollback and exact response contracts. Real mounted allauth exchange with only
provider HTTP mocked proves denied login while revoked and fresh login after
reapproval. No real provider credentials or live Discord smoke test is claimed.

## 2026-10-12: Immediately approved allowlist and staged curator control (#8)

**Decision:** The existing native user row is the allowlist record. Adding an exact
Discord ID creates an approved ordinary member without importing a Discord profile;
restoring a revoked row reuses its identity and website profile, deletes stale sessions,
and requires fresh OAuth sign-in. Duplicate IDs conflict even when other submitted
fields are invalid. The live HTTP members page uses the central transport for list,
add, restore and revoke. It shows the null curator state without an assignment form
until #30 persists that assignment; mock-backed assignment remains available.

**Why:** This follows the groomed contract while keeping the administrator's live
controls honest about persisted capabilities. No model, migration or dependency is
needed. #30 owns atomic clearing of its future assignment during revoke.
## 2026-10-12: Private native avatars and profile transport (#9)

**Decision:** Accept the existing multipart profile contract, validate uploads with Pillow, and re-encode accepted JPEG/PNG/WebP bytes to a private WebP file named by an opaque random identifier. A guarded API route serves the image only while its owning member is active. Profile updates derive the owner from the current session and reject ownership keys; all metadata and image validation precedes persistence. Pillow is a free, open-source image library used for content validation and re-encoding. Until a book catalogue exists, favourite lists in the profile result are empty and nonempty submitted favourite IDs are invalid.
**Why:** Browser MIME and filename are untrusted, and a static media mount would bypass club membership. The profile screen and contract already require a single atomic save with a private avatar.
**Consequence:** `MEDIA_ROOT` contains private uploaded avatars and must be included in future backup work. Catalogue and review persistence remain their separate issues.


## 2026-10-12: Native private member directory (#10)

**Decision:** Reuse current session identity and the existing Spanish name ordering for the active directory. Return closed native profile projections only. Pending, revoked and unknown targets share generic 404 after viewer membership is checked. Directory and profile progress remain null, and favourite books empty, until the assignment/catalogue issues persist those features. Existing React pages use central HTTP adapters without layout changes or new dependencies.

## 2026-10-12: Central permission policy (#11)

**Decision:** Keep pure membership, admin, ownership, assigned-curator and spoiler decisions in users/access.py, with a tuple-returning decorator for Django Ninja service functions. Context must be loaded from server state, never request authority claims. Membership and admin-only refusals precede context/resource lookups. Mutations retain transaction-level rechecks and domain validation. All roles need personally-finished plus their own submitted review to see other ratings; admin has no foreign-profile/review edit override. Current contract tie resolution is admin-only; delegated tie authority would require explicitly scoped contract and audit work. No persisted curator, completion or review model is introduced here.

## 2026-10-12: Reusable 30-day soft deletion (#12)

**Decision:** Content models inherit a core abstract model with active-only default and unfiltered base managers. Transactional removal/restoration reload current admin authority and content state, preserve repeated deletion's original deadline and reject restoration at/after exactly 30 elapsed days. SQL constraints require either entirely empty removal metadata or actor/time/deadline together with the exact retention interval. PROTECT retains the deletion actor reference. Ordinary delete() is refused; permanent deletion has an explicit low-level hard_delete primitive for future authorized purge services. Restoration is row-local with a domain-validation hook; relationships through the base manager need explicit parent visibility checks. No production content table or new dependency is added.

## 2026-10-12: Persisted manual catalogue and one reading book (#13)

**Decision:** Book inherits shared soft deletion and stores contract-native metadata with manual Spanish lifecycle status, independent optional actual/planned dates and approximate publication text. SQLite partial uniqueness on nonremoved leyendo rows enforces one active reading book even for bulk writes; status/page/date checks constrain storage. The transactional status service refreshes approved admin authority before lookup and reports conflict without demoting the existing reading book or changing dates. Soft removal frees the active slot; restoration obeys the same SQL constraint. External identifier metadata is server-owned; origin-vote FK waits for voting persistence. No API/UI/upload feature or dependency is added; the generated initial migration is verified only on disposable databases here.

## 2026-10-12: Atomic manual catalogue and private covers (#14)

**Decision:** Existing admin catalogue forms use HTTP list/read and multipart create/update adapters. Native metadata and re-encoded covers commit together after refreshing admin authority and the single-reading rule. Preserve server external IDs on whole edits; origin vote stays null until voting persistence. A contract-defined guarded WebP resource serves covers only to approved members while its book is retained and nonremoved. Share avatar/cover content validation in core/images.py; no dependency or layout changes. Search-result covers return 404 until #15 persists known results. Default private media remains ignored by Git. POST multipart reuses Django's cached parts because CSRF may already parse them; PUT parses its stream explicitly.

## 2026-10-12: Bounded Open Library search and import receipts (#15)

**Decision:** Use Python's standard-library HTTPS transport (no new dependency), fixed Open Library search/cover hosts, project-identifying User-Agent, five-second socket timeout, bounded bytes/results, refused redirects and one outbound request start per second per process. Cache a repeated admin-session query for five minutes. Search summaries expose only validated work title/authors/first-publication year/cover reference; unsupported edition/description facts remain null rather than conflating editions. Local form choices remain editable. Opaque receipts last fifteen minutes and bind cover imports to that admin session; fetched cover bytes pass shared validation/reencoding and existing post-image authority/conflict checks before atomic persistence. Unknown receipts are 404; provider failures safe 503 while manual save stays offline-capable. Open Library uses no club identities or credentials. Sources: https://openlibrary.org/dev/docs/api/search , https://openlibrary.org/dev/docs/api/covers , https://openlibrary.org/developers/api .

## 2026-10-12: Explicit manual book lifecycle confirmation (#16)

**Decision:** Reuse the whole-book update contract and existing accessible ConfirmDialog for changed status (or nondefault status at creation). Cancel/Escape keeps the draft, restores save-button focus and makes no API call. Confirm submits the reviewed snapshot once; busy state prevents duplicate actions, and safe backend conflicts retain the draft in the dialog. Existing SQL/service constraints remain authoritative; no new status endpoint or automatic date/vote transition is added.

## 2026-10-12: Private member catalogue transport (#17)

**Decision:** GET /api/books returns a closed retained-book metadata projection shared by existing bookshelf/timeline UI. Local view/filter/sort state remains in the browser URL and is never an authority or extra network query. Removed rows, operational metadata and review/count/mean data are absent; private cover reads reuse the guarded resource. No new schema shape, dependency or layout change. Book detail persistence is #19.

## 2026-10-12: Timeline reuses native catalogue (#18)

**Decision:** Keep the existing chronological LibraryPage presentation over the same GET /api/books payload as the bookshelf. Reading start/end fallback, approximate-year grouping and the final Fecha desconocida group are local presentation logic; filter/view state stays in the URL. No second API, schema, dependency or layout is needed after #17. Existing timeline and sorting tests verify this adoption; detail persistence follows in #19.

## 2026-10-12: Native member book-detail skeleton (#19)

**Decision:** Connect the existing member detail contract to native retained metadata with generic removed/unknown 404 after membership checks. Schedule and meeting arrays and originating vote remain empty/null until their persistence issues. No ratings or substantive meeting content enters this endpoint. Live BookPage stages an honest ratings placeholder using the same explicit VITE_API_MODE pattern already used for curator controls; #39 will enable its existing ratings section when that endpoint is real. No new dependency, endpoint shape or database migration.

## 2026-10-12: Native admin calendar and retained meeting deletion (#20)

**Decision:** Persist soft-deletable calendar records with optional protected book links, aware instants, independent cancellation, private summary/publication/safe flags and retained attendance storage. Admin operations refresh authority inside transactions, lock actor before target where supported, and update calendar/cancellation fields only. Unrelated date edits retain removed book associations; new removed/missing links fail. Upcoming includes exact server now; attendance eligibility requires strictly before now and no cancellation, matching the existing mock clock. Weekly reservations and attendance writes remain #21/#27. Shared deletion preview and meeting removal project safe labels/counts, preserve records and return current native book/meeting bin metadata without implementing restore/purge. Summary/highlight publishing remains #28.

**Contract:** Unified deletion's meetingId parameter with read/edit to avoid competing Django routes for the same path. Calendar includes authoritative server clubTimezone; editor display/local input uses it rather than assuming the frontend timezone. Closed TypedDict expresses optional nonnullable removedWeekNumber without extra defaults. Disjoint closed bin literal variants use an explicit oneOf JSON Schema hook to preserve the independent contract. No new dependency; migrations execute only in disposable tests.

## 2026-10-12: Native independent reading plans and canonical reservations (#21)

**Decision:** Store soft-deletable ReadingAssignment rows in the meetings app. The assignment owns the sole nullable protected one-to-one meeting FK, including removed reservations; SQL also constrains active book ordinals, positive safe page bounds and finite nonnegative percentages. Admin services refresh authority before lookup, serialize plan writes in transactions, validate same-book links and retained reservations, and recompute diagnostics on the entire proposed plan. Ordinal changes use temporary unique slots before the final contiguous order. Percentage/page facts are never converted; exact decimal diagnostic comparison preserves the strict greater-than-ten threshold. Rescheduling only changes calendar fields and the deliberate canonical link, leaving facts/due dates/notes intact.

**Contract and UI:** Member schedule bounds now match accepted admin percentages above 100 and positive safe pages. Existing plan forms use central HTTP adapters. Book detail projects active schedule facts with no summary/publication/attendance payload; removed meetings are omitted from the schedule link, while the admin retains a removed-link marker. Safe bin dependencies include retained weeks. Weekly completion storage/writes are #22, so current counts are zero, member completion is false and the HTTP toggle is staged until that issue. Restore/purge ordering remains #46/#47. No dependency was added; migrations and SQL verification use disposable test databases.

## 2026-10-13: Native session-owned weekly completion (#22)

**Decision:** Persist one protected assignment/member pair with a nullable server completion timestamp. The CSRF-protected PUT refreshes current approval inside its transaction, rejects ownership fields before lookup, validates active assignment and parent before ordinary input, and accepts only the exact boolean payload. Repeating a flag preserves its timestamp; clearing retains history. Native member schedules expose only the viewer's flag, admin plans count marked rows including retained revoked-member history, and safe deletion previews count retained records. Calendar dates and manual book status never drive flags. No dependency or contract change is needed; current-week social projections remain #24/#25 and personal book completion remains #23.

## 2026-10-13: Independent native personal book completion (#23)

**Decision:** Store protected unique book/member pairs with nullable server completion time. The existing finished route requires current session ownership, refreshes approval in its transaction, checks retained book state, allows finishing only official reading/finished/archived books, and preserves timestamps on repeated flags. Clearing retains history. Weekly marks and manual book lifecycle remain unchanged. The ratings envelope read route returns only native book metadata, the viewer's flag and ratability; own review is null and club ratings locked until review persistence/gating in #36-#39. Existing RatingsSection stages review links using a reviewsAvailable prop while enabling its completion checkbox through central HTTP adapters. #36 must integrate refusal to clear submitted reviews when storage exists. No dependency or wire-shape change; migrations run only on disposable test databases.

## 2026-10-13: Native homepage current book and reading target (#24)

**Decision:** Use one shared server-owned selector: retained leyendo book plus earliest noncancelled retained meeting at/after server now, excluding removed parent books and sorting equal instants by native ID. The current assignment must be active and linked to that meeting and active book. Do not skip an unassigned earlier meeting or use due-date fallbacks. Project exact manual ranges and only the viewer's #22 flag through existing GET /api/home; no notes, summary, attendance or operational identities. Required safe counts use native terminado books/active members and zero reviews while none exist. Next meeting/social projections remain null/empty until #25 with explicit Spanish live placeholders; activity and quote remain their future issues. No new dependency or contract change.

## 2026-10-13: Native next meeting and shared member progress (#25)

**Decision:** Extend the shared homepage projection with the earliest retained upcoming noncancelled meeting's safe date/book/manual assignment. Only a same-book active assignment with a retained parent is projected. Social completion lists active members including the viewer, ordered by the existing Spanish name key rather than progress; retained revoked histories never supply visible identities. Directory and member-profile weekly states use the same current-reading selector as Home, fulfilling their earlier staged handoff. No current target means null directory/profile flags and an empty Home progress list. MeetingAssignment contract now matches accepted native ranges (nonnegative percentages without a 100 ceiling; positive safe pages), changed and regenerated before implementation. Summary/highlight/attendance content and review/identity administration remain absent. No dependency or migration.

## 2026-10-13: Native member calendar and book meeting references (#26)

**Decision:** Project retained meetings only while any linked book is retained. Server now partitions upcoming/past at an inclusive boundary, preserving cancelled entries and ordering ascending upcoming/descending past with native-ID tiebreakers. Calendar rows explicitly contain only date/cancellation/book/manual active same-book assignment metadata; no summary, highlight or attendance. Book detail now fills its staged meeting references from the same retained rows with active week ordinal or null. Public schedule notes keep their existing book-detail contract; calendar summaries/notes remain absent. Existing React list and central HTTP adapter need no layout or contract change. No dependency or migration; detail/record/attendance APIs remain their subsequent issues.

## 2026-10-13: Native meeting detail and retained attendance (#27)

**Decision:** Replace the implicit attendees relation with explicit protected unique MeetingAttendance pairs by creating/copying before removing the old relation. Reverse migration recreates/copies the old relation before dropping the new table; disposable migration tests prove both directions. Admin saves refresh approved authority transactionally, require strictly past/noncancelled meetings, validate distinct active native IDs and preserve already recorded revoked history. Member detail returns safe date/book/range and read-only historical attendance, null while upcoming/cancelled/unrecorded. Record payload remains conservatively locked with an honest Spanish HTTP placeholder until #28/#29. No dependency or wire change; owner database is never migrated by verification. Existing admin form and central HTTP adapters now operate natively.

## 2026-10-13: Native retained admin meeting records (#28)

**Decision:** Persist soft-deletable ordered MeetingHighlight rows with independent publication and speaker relations, protected parent, active-position uniqueness and bounded kind/text/position SQL checks. Summary remains the existing native fields. Seven existing admin record routes use refreshed authority inside transactions, closed strict inputs, trimmed plain text and exact reorder permutations. Removed positions remain reserved during append/reorder. Existing revoked attribution may be kept on edit; new revoked/pending attribution is refused. Safe visibility changes refuse any retained week reservation. Text is never interpreted as HTML, matching React's existing escaped rendering; reject NUL/lone Unicode surrogates. Separate invalid-input exceptions from storage failures so partial reorder writes always roll back. Safe bin/dependency labels contain no substantive text. Member records stay locked until #29. No dependency or contract shape change; migrations/tests use disposable databases.

## 2026-10-13: Central native weekly meeting spoiler gate (#29)

**Decision:** One pure policy in users/access.py requires current approved membership, noncancelled meeting and valid retained assignment context. Only the viewer's exact completed assignment permits a linked record; an unlinked record needs explicit safe visibility. Removed/invalid reservations stay locked even when completion/safe flags exist, and admin member views share the rule. Detail projects published active highlights in retained position order and published summary only; locked variants expose no existence/count/content. Admin editor remains the exclusive draft preview. Existing HTTP presentation now uses the record union rather than the staged placeholder. Metadata list/book/home remain unchanged. No dependency, migration or contract shape change.

## 2026-10-13: Retained native curator cycles (#30)

**Decision:** CuratorAssignment persists protected member identity and assigned/ended server times, with SQL one-current, current/end consistency and chronological constraints. Its retained primary key identifies the cycle; #31 must link future native vote snapshots to that cycle/curator. Current admin assignment uses strict nullable native-member input, active target checks, actor/target locks and unchanged account roles. Repeating the current choice preserves its original date and creates no cycle; replacement/clear retains ended history. AdminMembers projections report only an active approved current curator. Revoke refreshes/locks actor, ends current assignment and invalidates sessions in the same transaction; restore does not reassign. Existing curator form and central HTTP adapter now work natively. No dependency or contract shape change; migrations run only in test databases.

## 2026-10-13: Native vote and shortlist creation (#31)

New `votes` app. `Vote` links to the retained `CuratorAssignment` cycle row (PROTECT), never to the mutable current assignment, so replacing or clearing the curator cannot rewrite a vote's curator. A partial SQL constraint allows one draft/open vote, and status/date/winner consistency is constrained. Management (create, add/remove/reorder candidates, open) uses the central `nominate_books` policy against the *current* assignment or admin, before any lookup. A vote naming a soft-deleted book is hidden whole (reads 404, actions 409). Malformed bodies are checked after vote lookup, then book 404, then lifecycle 409. `approvals` are empty and `history` is `[]` until approvals/closing (#32 onward) add their rows; removing a candidate there must delete its approvals. No new dependency.

## 2026-10-13: Native public approval voting (#32)

`VoteApproval` rows reference the `VoteCandidate` (unique per vote and book) and the member, both PROTECT, with an SQL unique (candidate, member) constraint, which is the spec's unique (vote, book, user). `PUT /api/votes/{voteId}/candidates/{bookId}/approval` uses the central `cast_own_vote` policy with the owner taken only from the session and the member row locked; smuggled owner keys return 403 before lookup, then unknown vote/candidate 404, hidden or non-open vote 409, malformed body 400. Adding or withdrawing is idempotent while the vote is locked. Any approved member votes, including admin and curator; approvals of later-revoked members stay in the public list as history. Voters are listed in approval order with live totals for every approved member, before and after closing. Removing a candidate deletes its approvals explicitly in the same transaction. The frontend's existing voting screen now uses the HTTP adapter. No new dependency.
## 2026-10-13: Manual vote closure and admin tie resolution (#33)

**Decision:** Implement the existing close/tie contract without changing schemas or UI layout. Current curator or admin closes an open vote under a transaction; authority is refreshed from persisted rows. A sole highest approval total records the winner, while all tied leaders (including all candidates at zero approvals) await an admin-only choice. Trim notes before the 1000-character limit; blank notes remain null, as settled in the contract. Closed approvals and shortlist remain immutable; resolution cannot be repeated. No book status, dates, origin-vote field or curator assignment is changed. Historical overview is reserved for #34. No new dependency.

## 2026-10-13: Retained voting history and stable book origins (#34)

**Decision:** Return visible closed elections newest first (closure timestamp, then ID), including pending ties. Existing direct detail retains all candidates and public approvals, even after curator/voter revocation. Add a protected nullable Book-to-Vote origin reference assigned only at the first recorded win, in the same closure/tie transaction; later wins and whole catalogue edits preserve it. Backfill preexisting winners by earliest closure then ID, including removed books. A removed candidate hides the entire historical election and its origin link until restored. Existing React views and central HTTP reads already support these projections; clarify the origin contract and regenerate types without UI changes or new dependencies. Test migrations only against disposable/test databases.

## 2026-10-14: Native owner-authored rating rubric (#35)

**Decision:** Create the reviews app with 25 unique criterion/integer-star anchors seeded with null descriptions. SQL checks enforce the known five criteria, stars 1–5 and 500-character storage limit. Approved members read only anchor prose; whole admin saves refresh persisted authority and validate every input before transactionally updating rows. Reject unknown/missing keys, nontext, oversized strings, NUL and lone surrogates; trim blanks to null and render as literal text through existing React UI. Central HTTP adapters replace rubric placeholders. Expand local nested input-schema references for Ninja request documentation so the existing contract comparison resolves them correctly. No dependency or UI layout change.

## 2026-10-13: Retained review scores and exact averages (#36)

**Decision:** Store one protected Review per book/member with five required one-decimal scores, optional trimmed plain text and server submission/edit times. SQL membership in the nine half-star values enforces both range and step even for queryset updates, plus uniqueness, text length and chronological edits. Pure calculations validate complete numeric inputs, use decimal arithmetic and return equal-weight numeric means; no reviews yields no aggregate rather than zero. Persisted own reviews now prevent clearing personal book completion through the existing contract 409; another member's review cannot affect it. Submission and own-review projections remain #37, shared club exposure #38. No dependency or UI change; migration verified only on test/disposable databases.

## 2026-10-14: Current-session native review submission and editing (#37)

**Decision:** Implement the existing own-review PUT and central HTTP adapter. Refresh/lock actor, book and completion inside the transaction; reject forged ownership before book lookup, nonofficial/unfinished targets before payload validation, then strict five numeric scores and optional trimmed text. Preserve submittedAt, set editedAt only on replacement and derive overall from stored scores. Trim before the 5000-character limit and reject NUL/surrogates. Native ratings envelopes now return only the actor's own review; club stays locked until #38. Existing accessible form and rubric UI are reused unchanged; book-section staging remains #39. No dependency or contract shape change.

## 2026-10-14: Native per-book review spoiler gate (#38)

**Decision:** Reuse the central can_view_reviews policy with persisted personal completion and own submitted Review for all native ratings envelopes. Do not query foreign reviews until both flags pass, including admin and curator member views. Locked variants expose no foreign identities, text, counts or means; own review remains available independently. Entitled views return retained attributed reviews, equal-weight overall/criterion means, count and isMine flags. Submission unlocks immediately and edits recalculate aggregates. Removed books remain hidden and existing metadata surfaces contain no review projections. Future statistics/feed must apply the same gate before calculating any figure. No new dependency, schema or UI change.

## 2026-10-14: Native book ratings interface (#39)

**Decision:** Book pages offer rating submission after personal completion in both mock and HTTP modes, now that #35–#38 implement the rubric, submission and spoiler-gated ratings endpoints. Remove the temporary HTTP availability prop and copy. Reuse the accepted accessible SVG radar and equivalent numeric table (#92), as specified by the design system, rather than adding the stale issue's Chart.js dependency. The central API client supplies the server's locked/visible union; roles never determine foreign-rating visibility in components. Existing contract, components and dependencies remain sufficient.

## 2026-10-14: Pure native statistics calculations (#40)

**Decision:** Keep statistics in reviews/statistics.py with plain already-permitted inputs, no ORM or role inference. Reuse validated decimal score averages and compute population spread over review overalls without rounding. Ignore unknown book/member references before validation and counting. Preserve the accepted three-review thresholds, two-qualifier highlights, all ties within 1e-9, Spanish ordering and viewer-first member rows. Use local Unicode primary collation matching the directory's Spanish order without importing its ORM; deep-copy summary inputs. Activity counts accept retained plain rows and an explicit aware clock, counting terminado/archivado books and strictly past noncancelled meetings independently of reviews. #42 must gate before collecting inputs. No dependency, endpoint or contract change.

## 2026-10-14: Native viewer taste comparisons (#41)

**Decision:** Implement the existing compatibility contract with pure decimal mean absolute overall/criterion differences, returning only overlap counts and insufficient status below three shared books. Compare the session viewer to active approved members, in Spanish name order, with permitted shared books in title order. Collect only the actor's completion and own-review IDs first; call can_view_reviews before any foreign-score query, and restrict that query to retained permitted parents. Query no review prose. Revoked attribution stays in stored history but leaves comparison choices. Recalculate each request; browser viewer IDs cannot choose ownership. Reuse existing Spanish UI and central HTTP adapter. No dependency, migration or contract shape change; #42 adds the overall statistics endpoint.

## 2026-10-14: Native club statistics projection (#42)

**Decision:** Feed the #40 pure calculations from #41's centrally gated input collector for GET /api/statistics. Include retained revoked review attribution in means and member rows, while compatibility choices stay active-only. Return the existing closed empty/available union with permitted denominators, thresholds, dispersion and tied highlights. Independent activity counts use retained terminado/archivado books and retained strictly past noncancelled meetings, excluding removed parent books, on the server clock. The existing responsive Spanish page, charts and table alternatives work through the central HTTP adapter; no UI, dependency, migration or contract shape change.

## 2026-10-14: Native retained literary quote collection (#43)

**Decision:** Persist LiteraryQuote in core with reusable soft deletion, SQL text/attribution length checks and a stored whitespace-collapsed lowercase unique text key across retained rows. Strict literal inputs trim before limits, blank attribution becomes null, and native primary keys preserve insertion order. Admin writes refresh/lock authority and use transactions; quote deletion/preview/bin expose generic labels. Home chooses uniformly among active retained rows on each request, returning null when empty. Seed two brief original-language Cervantes excerpts once through a data migration, with published chapter evidence in docs/literary-quotes.md; retain `vee` spelling and make no automatic rights claim for user input. Disabled/edited/removed seeds are not re-created by runtime. Reuse existing UI and central adapters; recovery/purge remain #46/#47. No dependency or contract shape change; migrations verified only in test databases.

## 2026-10-14: Native visible-review Home count (#44)

**Decision:** Extract the shared permitted-book selector from the statistics input collector so Home can count reviews with SQL COUNT after the same central completion-plus-own-submission gate, without loading scores or prose. Preserve retained revoked contributions on unlocked books, suppress removed parents and recalculate each request for every role. Existing Home counts/labels remain the accepted contract: terminado-only books, active approved members and valoraciones visibles; Estadísticas separately counts terminado plus archivado. Reuse the existing central HTTP Home adapter and UI. No dependency, migration or contract shape change.



## 2026-10-14: Native retained spoiler-aware Home activity (#45)

**Decision:** Persist UUID activity rows with protected typed book/vote/meeting and actor references, server occurrence times, and an SQL-enforced empty JSON payload. Record only first official book selection, nomination, vote opening/closure, summary publication false-to-true and first review submission inside their existing business transactions; no history backfill. Re-selection is checked against retained selection history. Project generic Spanish text only after current retained-subject checks, whole-vote visibility, central permitted review books and the shared meeting-record eligibility policy. The feed never loads review scores/prose or summary/highlight content for eligibility. Order by descending server time and UUID to break ties, then limit to ten visible rows. Revoked attribution stays protected in storage and never enters the closed wire keys. No dependency or contract shape/UI change; migrations and real workflow verification use fictional test databases, never the owner's database. Missing Compose/CI infrastructure belongs to #73/#74; local standard checks provide this issue's verification evidence.

## 2026-10-14: Native canonical recovery and conservative erasure (#46)

**Decision:** Implement existing bin/delete/restore/purge operations through the central client and reuse Papelera unchanged. Refresh approved-admin authority before lookup/type handling; preserve exact 30-day expiry, required parents, independently removed descendants, same-book links, one Leyendo and highlight position uniqueness. Restore weeks by reinserting their retained ordinal clamped to active length and transactionally renumbering while preserving completions. Safe dependency warnings count retained reviews, votes, completions, origins and activity without substantive content. Refuse purge for every retained protected history/link, including new activity references; independent highlights explicitly clear their own speaker joins. Eligible rows are physically erased and leave only type/native ID, actor and server time in PurgeRecord. Validated private covers use the existing after-commit cleanup helper; scheduling, filesystem cleanup retries and backup expiry remain #47/#48. Consolidate DELETE into the existing bookId contract path (same public URL) to avoid duplicate Django URL shadowing. No dependency or UI change; migrations/tests operate only on disposable databases.

## 2026-10-14: Explicit automatic purge and durable cover cleanup (#47)

**Decision:** Schedule a finite Django management command externally, with an explicitly configured current approved admin native ID rechecked before each row. Use the run's aware server cutoff and stored deadlines, descend before parents and reuse conservative erasure without destroying retained history. Dry-run is read-only current-snapshot eligibility. Queue validated opaque cover keys transactionally and unlink only after commit; filesystem failure keeps the queue for retry and retained shared references prevent unlinking. Minimal purge tombstones remain unchanged. Document daily cron/Task Scheduler operation and failure handling in docs/purge.md; install no owner's schedule and touch no owner's database. No new dependency, endpoint, API schema or frontend change; backup rotation stays #48.

## 2026-10-14: Native privileged business ZIP export (#49)

**Decision:** Implement the settled version-1 ZIP manifest/business-record contract using explicit field projections inside a transaction with current locked admin authority and existing same-admin Discord freshness (<300 server seconds). Include private/draft/recoverable/revoked business data and only validated native cover/avatar files; missing, unsupported or symlinked media is not fetched and no external URL enters the archive. Keep static safe ZIP member names, noncached attachment headers, no sessions/tokens/passwords/purged content, and no restore/import promise. Native profile favourites remain empty because no native selection is persisted. Store a minimal ExportEvent with protected actor, display-name snapshot and server time transactionally; include each export once in its safe audit projection, rolling it back on export failure. Other critical audit actions and the audit endpoint remain #50. Central transport now has explicit JSON and ZIP download variants; HTTP UI offers purpose=export OAuth handoff while preserving illustrative mock JSON. No new dependency; only disposable databases/media and fictional browser fixtures are used for verification. Automated backup policy stays pending until #48.

## 2026-10-14: Native immutable critical-action audit (#50)

**Decision:** Rename/extend the existing export-event table, preserving UUIDs, actor snapshots and timestamps. Central recording requires the surrounding business transaction and refreshes current actor authority (including current curator for vote closure). Store only controlled action, native subject type/ID, SQL-enforced generic label and protected actor/name/time; no live subject FK, arbitrary JSON, prose, scores, profiles, Discord IDs or media. Record successful meaningful membership/curator/status/publication/vote/removal/recovery/purge/export transitions only, including scheduled purge, and roll back audit with failed business writes. Preserve records through subject erasure and later actor rename/revocation. Admin GET and privileged ZIP share explicit safe newest-time/descending-UUID projection. Native UI is read-only; no backfill of unrecorded historical actions, update/delete API or new dependency. Migrations and retention verification use disposable test databases only.

## 2026-10-14: Session-owned native profile review list (#106)

**Decision:** Finish #9's review projection deferral using the existing contract and UI. Filter persisted reviews by the fresh session user and active retained parent book before projection; never select foreign reviews or accept a supplied identity. Own scores/text remain accessible independently of current personal completion or foreign-review gates. Order by latest edit/submission then Spanish title and native book ID, reusing existing safe book-summary and decimal calculations. Central HTTP adapter activates the existing independently loading profile review section. No new dependency, model, migration or UI design; catalogue favourite persistence remains separately tracked in #107.

## 2026-10-14: Ranked native favourite club books (#107)

**Decision:** Finish #9's catalogue deferral with zero to five distinct active completed/archived book IDs, matching the established contract/selector limit and club-read eligibility. Store protected member/book links and rank with SQL unique-book/unique-rank and 1–5 constraints. Refresh owner membership and lock selected eligible active parents inside the profile/avatar write transaction; invalid IDs, missing/removed parents and storage failure preserve all prior state. Own/member views use only active book summaries, never descriptions/reviews/scores. Keep existing preferences through parent status changes and soft removal/restoration; protected retained links block purge with a generic count warning, and explicit profile selection replacement can clear them. Privileged export preserves actual ranked retained IDs, including recoverable parents. Reuse existing Spanish selector and safe DTO helpers (runtime import avoids service import cycles); no new dependency, UI design or historical preference backfill. All verification/migrations operate on disposable data; owner's database/preview untouched.

## 2026-10-14 — Page recovery polish (#52)
Keep established Spanish empty states and document the route review in `docs/page-states.md`. Failed-load retries enter loading; successful mutation refreshes retain confirmed data/focus. A root React Router error element renders a standalone, detail-free Spanish recovery page with a document link that restarts session checking. This uses existing dependencies and leaves backend JSON error contracts and enforcement unchanged. Discarding an unsaved avatar without an existing saved photo is a local reset, not a pending deletion.

## 2026-10-14 — Automated accessibility regression checks (#53)
Add free/open-source development dependencies `@playwright/test` (Apache-2.0, 1.64.1) and `@axe-core/playwright` (MPL-2.0, 4.13.0), locked by npm. They run keyboard/layout/reduced-motion and axe checks on existing fictional mock screens at desktop/mobile widths, in frontend CI. Playwright owns a dedicated port 5180 Vite process with `reuseExistingServer: false` and explicit mock mode; no backend database or owner preview is used. Vitest includes only `src/**/*.test.{ts,tsx}` to keep browser specs separate. Follow the official accessibility/web-server guidance: https://playwright.dev/docs/accessibility-testing and https://playwright.dev/docs/test-webserver . Keep screenshots/reports ignored. Strengthen interactive field borders to solid bark; optional decorative avatar alt text is used beside directory names. Fixed-layout statistics tables with wrapping and wider title columns prevent intrinsic table overflow. These checks cover WCAG-oriented basics, not a conformance certification.

## 2026-10-14 — Consistent bounded operator backups (#48)
Use Python's standard-library SQLite online backup API, a separate write-reservation connection, ZIP/JSON/SHA-256 and fresh-location restoration; no dependency or endpoint. Freeze database commits while capturing DB/media, include committed WAL data and verify SQLite integrity/foreign keys. Private controlled-path archives are synced and atomically published before bounded rotation of recognized backups; required `--keep` accepts 1–30, with no chosen production schedule. Restore validates the closed member set/hashes and refuses existing destinations. Persist only timezone/language runtime hints; protect deployment secrets separately. Archive encryption, private Windows ACLs, off-device copies, cadence and scheduler remain deployment decisions documented in `docs/backups.md`. Automated verification only uses fictional disposable files, including an actually migrated Django schema.
