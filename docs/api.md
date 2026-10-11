# API contract

`openapi.yaml` is the OpenAPI 3.1 source of truth for the session/member (#71) and administrative (#102) API. It describes future HTTP behaviour; the running frontend uses generated types and the fictional in-memory mock. There is no backend yet, and schema tests do not prove HTTP authentication, database transactions or server spoiler enforcement. Generated central types/mock adoption is #103; backend integration response validation remains #72.

The Home projection correction and regression coverage landed in #104. Finish #71 → #104 → #102 → #103 before backend work. #102 preserves the runtime and its current 1,102-test baseline.

## Naming and representation

Stable unique operationIds match `ApiClient` method names; `discordCallback` is provider navigation with no client method. Paths use `/api`, opaque nonempty website string IDs and camelCase JSON fields. No member projection serializes internal mock state, Discord IDs, credentials, session control options or unrestricted dictionaries. Profiles use website-native identity; `CurrentUser.role` is only `member` or `admin` (curator is an assignment).

All objects are closed. Discriminated `oneOf` variants preserve **absent** keys: locked club ratings have only `status`, lockedNoWeek records only `status`, lockedWeekNotRead only `status/weekNumber`, and empty/insufficient rating/taste branches only `status`. A visible branch requires its fields, including explicit nulls. `null` means a known missing optional value (avatar, summary, date, text, current vote), not a locked value; a hidden count is absent, never zero/null. Empty collections are arrays, not null. Each schema and JSON operation includes fictional examples.

Instants are ISO 8601 with timezone offset. The server clock partitions and sorts meetings; the configured club timezone governs local display, never the browser clock. Calendar dates are `YYYY-MM-DD` without timezone; unknown dates are null. Historical best-known full dates remain paired with `datesApproximate` and display as approximate month/year. `publicationDate` is free text (e.g. `1884–1885`), never forced to a full date. Percentage/page ranges are independent manual facts, not converted from one another.

There is no pagination, cursor, server catalogue search, notification channel or second current-user endpoint. Catalogue is unsorted for local existing filters/sorts. Book schedule is week order and its meetings oldest first. Meeting lists are flat across books, upcoming soonest first (`startsAt >= now`), past newest first; cancellation does not change partition. Vote candidates stay shortlist order; history is latest closed first. Reviews are own first then Spanish display name; my reviews latest submitted/edited activity first then Spanish title. Directory/compatibility members use Spanish display-name order, never progress/score; book favourites retain user order and options use Spanish title order.

## Session, OAuth and CSRF

These reversible cookie/flow assumptions are implemented by backend #5. Browser and API are same-origin. `sessionid` is the server session cookie: HttpOnly, SameSite=Lax for OAuth navigation, Secure in HTTPS deployment. Local HTTP development does not claim Secure cookies work without HTTPS. Approved exact Discord IDs are checked server-side, revoked access is refused, and approval/revocation is rechecked on every club request.

`GET /api/session` always returns 200 `anonymous`, `denied` or `signedIn` and bootstraps a `csrftoken` cookie. Only signedIn contains `CurrentUser`; anonymous/denied require `demoSignInAvailable` and it is false in production. A CSRF token is not authentication. For unsafe JSON/multipart requests, including anonymous logout/demo, send the cookie value in `X-CSRFToken`; missing/wrong CSRF returns 403 `forbidden`. Cookie/header names are explicit assumptions, not frontend-only enforcement. Session responses/OAuth results never include access/refresh tokens, Discord ID, secret or password.

`startSignIn()` navigates the top-level browser to `GET /api/auth/discord/start` (302 to Discord). The provider navigates to `GET /api/auth/discord/callback` (302 to a validated same-origin return page/session gate). This is not a JSON sign-in promise. Only `identify` scope is requested; the server checks state, provider identity and exact allowlist. Missing/invalid state or denied/revoked account returns to the Spanish anonymous/denied screen without club data. Provider `code`, `state`, `error` parameters are not echoed or projected. OAuth start accepts optional `purpose=login|export` (default login); export reauthentication uses these same routes as described below. The server holds purpose/return destination in state, with same-origin navigation only; there is no arbitrary external redirect parameter. No Discord requests are performed by contract validation.

`startDemoSignIn()` maps to CSRF-protected `POST /api/auth/demo`, 204 with a fictional session only when DEMO_MODE is enabled; otherwise generic 404. `signOut()` maps to idempotent CSRF-protected `POST /api/auth/logout`, 204 even without membership. All 204 responses have no content body. Other reads/result-returning writes are 200; creation operations createVote/createBook/createMeeting/createReadingWeek/createMeetingHighlight/addLiteraryQuote/addMember are 201. Soft removals return the canonical result, not 204.

## Errors, permissions and identity

The single JSON error envelope is exactly `{ "code": "unauthenticated", "message": "Debes iniciar sesión." }`. Both keys are required; message is safe Spanish plain text without private payload/request echo. Status/code pairs are 400 `invalid_input`, 401 `unauthenticated`, 403 `forbidden` (including CSRF), 404 `not_found`, 409 `conflict` or export `reauthentication_required`, 500 `internal_error`, 503 `service_unavailable`. Export has its strict 409 ReauthenticationError envelope below. Current local `ApiError(status,message)` remains an adapter concern for #103, not another wire format.

All club methods require server-validated membership; 401 precedes data lookup, permission and domain validation, including unknown/removed IDs. Generic auth/not-found messages reveal no club existence or private labels. Safe domain conflict messages may retain an already permitted active-book label. State/permission checks and all writes must be atomic; an invalid/refused call changes nothing. CSRF is also checked before unsafe actions. Frontend flags/guards are conveniences, never authority.

Own completion, approval, finished, review and profile actions derive identity solely from the session and accept no owner/member/user ID. Smuggled ownership keys yield 403 and are never used for ownership (also when the supplied value happens to match the session). Closed request schemas prevent arbitrary keys; backend must classify ownership injection as forbidden before ordinary validation. Profile mock currently only expressly checks foreign `id/memberId/userId`; the contract uniformly requires refusal, with generated/adoption/backend work handling the HTTP representation rather than enabling impersonation.

Operation-specific precedence after membership/CSRF is:

- Own weekly completion: ownership 403, missing/removed week 404, malformed input 400; completion remains independent from finished flag.
- Approval: ownership 403, missing vote/candidate 404, non-open vote 409, malformed input 400. Public progress/approvals remain visible to approved members.
- Vote management: current curator/admin permission 403 before lookup; tie winner is admin-only. Missing vote/book/candidate 404 then lifecycle 409, then malformed input 400. Reorder resolves all named books before closed/stale-set checks; a known nonexact/duplicate candidate order is 409. Create needs assigned curator and no draft/open (409); open requires draft and at least two candidates; open removal retains at least two. Removed-book votes are hidden whole (read 404, actions 409); no partial shortlist/history leaks.
- Tie winner: permission, vote/book lookup, pending tie/tied-candidate membership, then trimmed note <=1000. All top-count candidates (even zero) tie; outcome is server-computed or manually recorded, never automatically changes catalogue status, origin vote or curator.
- Finished flag: ownership, book 404, not ratable on finish or own review exists on clear 409, malformed input 400. Reviews: ownership, book 404, not ratable/not personally finished 409, scores/text 400.
- Own profile: ownership 403 before all validation; then 400 for any invalid metadata/image/favourite with no partial save. Revoked/unknown public member profile is the same generic 404.

Malformed transport structures may need safe parsing to establish the relevant lookup; no supplied identity is trusted even if validation is delayed. Future server failure responses are generic and cannot expose exceptions/private text. Mock injected failures are testing controls, not domain state or request fields.

## Gates and calculations: backend obligations

Rating access requires the viewer to have personally finished **and** submitted all five valid criteria for that book. Historical books and admin member views follow the same rule. Own review is always available; other reviews, counts, means and radar values are absent until unlocked. Only official `leyendo/terminado/archivado` books are ratable. Scores use exactly `disfrute`, `estilo`, `personajes`, `trama`, `huella`, each 1..5 in steps of 0.5. Overall is the unrounded unweighted mean of those five (5, 4.5, 3, 4, 2.5 → 3.8); club mean weights each submitted member equally. Criterion means and difference means are continuous, **not** half-star inputs. Rubric keys 1..5 are required but anchors nullable; prose is never invented.

Weekly meeting record access requires completion of its linked active week or an explicitly safe unlinked record. A cancelled meeting or removed linked week suppresses substantive content even if previously safe/completed. Admin gets the same member-view gate. Only actually published summary/highlights are returned; drafts/deleted highlights never appear. Upcoming/cancelled attendance is null; unrecorded attendance null; recorded empty attendance is `[]`.

Statistics first drop every viewer-locked rating book, then calculate means/counts/radars/highlights with their existing denominators. `booksRead` counts public terminado/archivado catalogue entries and `meetingsHeld` public noncancelled meetings before server now. Books/member highlights need 3 counted reviews; include all ties ordered by Spanish title/name. Book dispersion is population standard deviation (0 for one review). Compatibility counts only viewer-unlocked shared rated books; with <3 shared books it returns outer `sharedBookCount` plus insufficient status, no hidden book metadata, score or difference. Available comparison is mean absolute overall/criterion difference, 0..4, over the same permitted shared books. Neither statistics nor cards infer hidden candidates/book counts.

Home `stats.reviews` counts actual retained reviews on visible books the viewer finished AND rated, not global fixture `reviewCount`. `review_available` needs the same canonical visible-book predicate. `summary_published` needs a canonical visible noncancelled meeting, an actually published summary and the completed-active-week/explicit-safe-unlinked gate; removed linked weeks remain blocked. Missing/unverifiable provenance is omitted. Apply these predicates BEFORE constructing text, totals or projections. The #104 correction brings the existing mock into line; #71 only describes this future behaviour. Schema examples cannot prove a viewer predicate, publication check, canonical subject reference, sample threshold calculation or revocation enforcement; dedicated backend HTTP/body tests remain required.

Profiles/directory contain website-native public profile/progress only; favourites are deliberate public choices, not a route to scores/taste/Discord identity. Removed objects are filtered before every projection; retained history is not serialized as internal state.

## Multipart profile adapter

`PUT /api/me/profile` uses `multipart/form-data`: required `metadata` part is `application/json` with displayName, optional nullable bio/favouriteQuote, ordered favouriteBookIds and `avatarAction=keep|remove|replace`. `avatar` is a binary JPEG/PNG/WebP part required **only** for replace (nonempty, <=2,097,152 bytes inclusive); omit it for keep/remove. The backend sniffs content and may re-encode rather than trusting declared MIME. JSON File objects, local blob URLs and local `AvatarChange` are not wire structures; #103 adapts browser File to multipart. Admin cover transport is defined below; #103 owns local File adaptation.

Trim strings before length checks/save: displayName 1..40 chars in one line, reject control characters including Unicode separators; bio <=500, favouriteQuote <=300; absent/null/blank optional text becomes null. Exactly up to five distinct favourites in user order, all in allowed visible terminado/archivado options. Review optional plain text <=5000 and tie note <=1000 also checked after trimming; blank becomes null. These normalized constraints use descriptive `x-trimmed*Length` extensions because JSON Schema cannot perform string normalization. Byte size/MIME sniffing and cross-record eligibility are likewise server obligations. The structural schema checks types, closed keys, five scores, unique favourites and replace-only multipart presence. Validate everything before atomically storing any text/favourite/avatar.

Example metadata (avatar omitted for keep):

```json
{"displayName":"Lucía","bio":null,"favouriteQuote":null,"favouriteBookIds":[],"avatarAction":"keep"}
```

## Complete client inventory

All listed routes below are complete #71 operations. Path IDs are required opaque strings; there are no additional member query parameters. Request schemas are JSON unless ProfileMultipart; bodyless actions have no request body. Error columns include declared generic server failures; membership/CSRF rules above apply throughout.

| Client method / operationId | HTTP method and route | Request schema | Result | Success | Errors |
|---|---|---|---|---|---|
| `getSession` | `GET /api/session` | `—` | `Session` | 200 | 500,503 |
| `signOut` | `POST /api/auth/logout` | `—` | `void` | 204 | 403,500,503 |
| `startDemoSignIn` | `POST /api/auth/demo` | `—` | `void` | 204 | 403,404,500,503 |
| `getHome` | `GET /api/home` | `—` | `HomeData` | 200 | 401,500,503 |
| `setWeekCompleted` | `PUT /api/weeks/{weekId}/completion` | `WeekCompletionInput` | `void` | 204 | 400,401,403,404,500,503 |
| `listBooks` | `GET /api/books` | `—` | `LibraryBook[]` | 200 | 401,500,503 |
| `getBook` | `GET /api/books/{bookId}` | `—` | `BookDetail` | 200 | 401,404,500,503 |
| `listMeetings` | `GET /api/meetings` | `—` | `MeetingList` | 200 | 401,500,503 |
| `getMeeting` | `GET /api/meetings/{meetingId}` | `—` | `MeetingDetail` | 200 | 401,404,500,503 |
| `getVotes` | `GET /api/votes` | `—` | `VotesOverview` | 200 | 401,500,503 |
| `getVote` | `GET /api/votes/{voteId}` | `—` | `Vote` | 200 | 401,404,500,503 |
| `setApproval` | `PUT /api/votes/{voteId}/candidates/{bookId}/approval` | `ApprovalInput` | `Vote` | 200 | 400,401,403,404,409,500,503 |
| `createVote` | `POST /api/votes` | `—` | `Vote` | 201 | 401,403,409,500,503 |
| `addCandidate` | `POST /api/votes/{voteId}/candidates` | `CandidateInput` | `Vote` | 200 | 400,401,403,404,409,500,503 |
| `removeCandidate` | `DELETE /api/votes/{voteId}/candidates/{bookId}` | `—` | `Vote` | 200 | 401,403,404,409,500,503 |
| `reorderCandidates` | `PUT /api/votes/{voteId}/candidates/order` | `CandidateOrderInput` | `Vote` | 200 | 400,401,403,404,409,500,503 |
| `openVote` | `POST /api/votes/{voteId}/open` | `—` | `Vote` | 200 | 401,403,404,409,500,503 |
| `closeVote` | `POST /api/votes/{voteId}/close` | `—` | `Vote` | 200 | 401,403,404,409,500,503 |
| `recordTieWinner` | `POST /api/votes/{voteId}/tie-winner` | `TieWinnerInput` | `Vote` | 200 | 400,401,403,404,409,500,503 |
| `getBookRatings` | `GET /api/books/{bookId}/ratings` | `—` | `BookRatings` | 200 | 401,404,500,503 |
| `getRatingRubric` | `GET /api/rating-rubric` | `—` | `RatingRubric` | 200 | 401,500,503 |
| `setBookFinished` | `PUT /api/books/{bookId}/finished` | `FinishedInput` | `BookRatings` | 200 | 400,401,403,404,409,500,503 |
| `saveMyReview` | `PUT /api/books/{bookId}/my-review` | `ReviewInput` | `BookRatings` | 200 | 400,401,403,404,409,500,503 |
| `getStatistics` | `GET /api/statistics` | `—` | `Statistics` | 200 | 401,500,503 |
| `getTasteCompatibility` | `GET /api/statistics/compatibility` | `—` | `TasteCompatibility` | 200 | 401,500,503 |
| `listMembers` | `GET /api/members` | `—` | `MemberDirectory` | 200 | 401,500,503 |
| `getMemberProfile` | `GET /api/members/{memberId}` | `—` | `MemberProfile` | 200 | 401,404,500,503 |
| `getMyProfile` | `GET /api/me/profile` | `—` | `MyProfile` | 200 | 401,500,503 |
| `updateMyProfile` | `PUT /api/me/profile` | `ProfileMultipart` | `MyProfile` | 200 | 400,401,403,500,503 |
| `listMyReviews` | `GET /api/me/reviews` | `—` | `MyReviewEntry[]` | 200 | 401,500,503 |
| `startSignIn` | Navigation: `GET /api/auth/discord/start` | Optional query `purpose=login|export`; default login | 302 Location; local Promise<void> adapter | 302 | 500,503 |
| provider callback (`discordCallback`, no client method) | Navigation: `GET /api/auth/discord/callback` | Provider query `code`, `state`, `error`; valid state required server-side | 302 same-origin Location; no JSON | 302 | 500,503 |

Admin operations (all path parameters are required opaque ids; type is restricted to DeletedType, preview to book/meeting/quote; metadata search alone requires query):

| Client method / operationId | HTTP method and route | Request schema | Result | Success | Errors |
|---|---|---|---|---|---|
| `getBackupInfo` | `GET /api/admin/backups` | `â€”` | `BackupInfo` | 200 | 401,403,500,503 |
| `exportClubData` | `POST /api/admin/export` | `â€”` | `ZIP (ExportManifest + ClubBusinessExport + media)` | 200 | 401,403,409,500,503 |
| `getAuditLog` | `GET /api/admin/audit-log` | `â€”` | `AuditEvent[]` | 200 | 401,403,500,503 |
| `getRecycleBin` | `GET /api/admin/bin` | `â€”` | `RecycleBinEntry[]` | 200 | 401,403,500,503 |
| `getDeletionPreview` | `GET /api/admin/deletion-preview/{type}/{id}` | `â€”` | `DeletionPreview` | 200 | 401,403,400,404,500,503 |
| `restoreDeleted` | `POST /api/admin/bin/{type}/{id}/restore` | `â€”` | `RecycleBinEntry[]` | 200 | 401,403,400,404,409,500,503 |
| `purgeDeleted` | `DELETE /api/admin/bin/{type}/{id}` | `â€”` | `RecycleBinEntry[]` | 200 | 401,403,400,404,409,500,503 |
| `deleteBook` | `DELETE /api/admin/books/{id}` | `â€”` | `RecycleBinEntry[]` | 200 | 401,403,404,500,503 |
| `deleteMeeting` | `DELETE /api/admin/meetings/{id}` | `â€”` | `RecycleBinEntry[]` | 200 | 401,403,404,500,503 |
| `deleteLiteraryQuote` | `DELETE /api/admin/quotes/{id}` | `â€”` | `RecycleBinEntry[]` | 200 | 401,403,404,500,503 |
| `listAdminQuotes` | `GET /api/admin/quotes` | `â€”` | `AdminLiteraryQuote[]` | 200 | 401,403,500,503 |
| `addLiteraryQuote` | `POST /api/admin/quotes` | `LiteraryQuoteInput` | `AdminLiteraryQuote` | 201 | 401,403,400,409,500,503 |
| `updateLiteraryQuote` | `PUT /api/admin/quotes/{id}` | `LiteraryQuoteInput` | `AdminLiteraryQuote` | 200 | 401,403,400,404,409,500,503 |
| `saveRatingRubric` | `PUT /api/admin/rating-rubric` | `RatingRubricInput` | `RatingRubric` | 200 | 401,403,400,500,503 |
| `getAdminMeetingRecord` | `GET /api/admin/meetings/{meetingId}/record` | `â€”` | `AdminMeetingRecord` | 200 | 401,403,404,500,503 |
| `saveMeetingSummary` | `PUT /api/admin/meetings/{meetingId}/record/summary` | `MeetingSummaryInput` | `AdminMeetingRecord` | 200 | 401,403,400,404,500,503 |
| `createMeetingHighlight` | `POST /api/admin/meetings/{meetingId}/record/highlights` | `MeetingHighlightInput` | `AdminMeetingRecord` | 201 | 401,403,400,404,500,503 |
| `updateMeetingHighlight` | `PUT /api/admin/meetings/{meetingId}/record/highlights/{highlightId}` | `MeetingHighlightInput` | `AdminMeetingRecord` | 200 | 401,403,400,404,500,503 |
| `reorderMeetingHighlights` | `PUT /api/admin/meetings/{meetingId}/record/highlights/order` | `IdOrder` | `AdminMeetingRecord` | 200 | 401,403,400,404,500,503 |
| `removeMeetingHighlight` | `DELETE /api/admin/meetings/{meetingId}/record/highlights/{highlightId}` | `â€”` | `AdminMeetingRecord` | 200 | 401,403,404,500,503 |
| `setMeetingRecordSafe` | `PUT /api/admin/meetings/{meetingId}/record/safe` | `SafeInput` | `AdminMeetingRecord` | 200 | 401,403,400,404,409,500,503 |
| `getAdminReadingPlan` | `GET /api/admin/books/{bookId}/reading-plan` | `â€”` | `AdminReadingPlan` | 200 | 401,403,404,500,503 |
| `createReadingWeek` | `POST /api/admin/books/{bookId}/reading-plan/weeks` | `ReadingWeekWrite` | `AdminReadingPlan` | 201 | 401,403,400,404,409,500,503 |
| `updateReadingWeek` | `PUT /api/admin/books/{bookId}/reading-plan/weeks/{weekId}` | `ReadingWeekWrite` | `AdminReadingPlan` | 200 | 401,403,400,404,409,500,503 |
| `reorderReadingWeeks` | `PUT /api/admin/books/{bookId}/reading-plan/weeks/order` | `ReadingWeekOrder` | `AdminReadingPlan` | 200 | 401,403,400,404,500,503 |
| `removeReadingWeek` | `DELETE /api/admin/books/{bookId}/reading-plan/weeks/{weekId}` | `â€”` | `AdminReadingPlan` | 200 | 401,403,404,500,503 |
| `listAdminMeetings` | `GET /api/admin/meetings` | `â€”` | `AdminMeetingCalendar` | 200 | 401,403,500,503 |
| `getAdminMeeting` | `GET /api/admin/meetings/{meetingId}` | `â€”` | `AdminMeeting` | 200 | 401,403,404,500,503 |
| `createMeeting` | `POST /api/admin/meetings` | `MeetingInput` | `AdminMeeting` | 201 | 401,403,400,404,409,500,503 |
| `updateMeeting` | `PUT /api/admin/meetings/{meetingId}` | `MeetingInput` | `AdminMeeting` | 200 | 401,403,400,404,409,500,503 |
| `setMeetingCancelled` | `PUT /api/admin/meetings/{meetingId}/cancelled` | `CancelledInput` | `AdminMeeting` | 200 | 401,403,400,404,500,503 |
| `setMeetingAttendance` | `PUT /api/admin/meetings/{meetingId}/attendance` | `AttendanceInput` | `AdminMeeting` | 200 | 401,403,400,404,409,500,503 |
| `listAdminBooks` | `GET /api/admin/books` | `â€”` | `AdminBook[]` | 200 | 401,403,500,503 |
| `getAdminBook` | `GET /api/admin/books/{bookId}` | `â€”` | `AdminBook` | 200 | 401,403,404,500,503 |
| `createBook` | `POST /api/admin/books` | `BookMultipart` | `AdminBook` | 201 | 401,403,400,404,409,500,503 |
| `updateBook` | `PUT /api/admin/books/{bookId}` | `BookMultipart` | `AdminBook` | 200 | 401,403,400,404,409,500,503 |
| `searchBookMetadata` | `GET /api/admin/book-metadata` | `â€”` | `BookMetadataResult[]` | 200 | 401,403,400,500,503 |
| `getAdminMembers` | `GET /api/admin/members` | `â€”` | `AdminMembers` | 200 | 401,403,500,503 |
| `addMember` | `POST /api/admin/members` | `NewMember` | `AdminMembers` | 201 | 401,403,400,409,500,503 |
| `revokeMember` | `POST /api/admin/members/{memberId}/revoke` | `â€”` | `AdminMembers` | 200 | 401,403,404,409,500,503 |
| `restoreMember` | `POST /api/admin/members/{memberId}/restore` | `â€”` | `AdminMembers` | 200 | 401,403,404,409,500,503 |
| `setCurator` | `PUT /api/admin/curator` | `CuratorInput` | `AdminMembers` | 200 | 401,403,400,404,500,503 |

No client method is omitted; helpers such as `ApiError`, `SESSION_METHODS`, file selection/preview and injected failure options are local adapters, not routes. Every member method above corresponds to its stable operationId; navigation remains explicitly different from JSON transport. The method inventory is checked by the contract test suite.

## Administrative transactions and projections

All 42 admin operations require the same effective approved admin: 401 first, then admin 403 (including current curator), before resource lookup or payload validation. Unsafe requests also require CSRF before action. Allowlist actions resolve member 404, state 409, then input 400. Catalogue validates whole metadata/image before rechecking the single retained `leyendo` invariant immediately before commit; missing book 404, invalid/imported-cover input 400, second active book 409. No vote/date automatically changes status. Stable ids and server-owned origin links cannot be edited. Collection reads are unpaginated for this small club: catalogue unsorted, quotes insertion order, active allowlist before revoked in Spanish name order, weeks contiguous canonical order, highlights canonical order with removed slots retained, calendar upcoming ascending/past descending instants. Recycle bin is deletion instant descending, then type/id ascending; audit is instant descending then event id descending.

Catalogue/calendar responses carry operational metadata only, never ratings/reviews/counts or meeting text. Only allowlist views expose Discord identity/access status. Editor endpoints expressly expose draft summaries/highlights; member endpoints and own profile keep the same #71 identity/spoiler gates for the admin. Bin/preview/audit are separate strict safe metadata boundaries: generic Spanish quote/highlight labels, book titles/meeting dates or member names where permitted, and operational dependency descriptions/counts without substantive text. Existing local bin labels may contain quote/highlight text; #103 must explicitly adapt these to the safe production projection rather than serialize internal mock state. Allowlist/media/profile fields are forbidden in safe audit/bin schemas. Schema closure rejects additional sensitive keys; it cannot prove that a permitted label string was safely composed. Backend integration tests must test provenance.

Book create/update use `BookMultipart`: required application/json `metadata` part and `cover` bytes only for `coverAction=replace`. Actions keep/remove omit bytes and metadataResultId; metadata requires a known search result id and omits bytes. Nonempty JPEG/PNG/WebP, at most 2,097,152 bytes inclusive; backend sniffs/re-encodes content and applies metadata/image in one atomic transaction. Blank optional metadata normalizes null, blank author lines are omitted. Limits and independent planned/actual calendar date pairs are in the input schema; no arbitrary remote cover URL, browser File or blob/data URL is production input. Metadata search has one required trimmed query (1..200); selecting results is local, fills blank fields, and makes no write. #15 supplies actual lookup.

Meeting/week links are canonical, same-book and one-to-one. Unknown/removed selected resources 404; wrong-book selection 400; occupied retained reservation 409. Unrelated date edits preserve removed associations; deliberate unlink/relink releases them. Calendar changes never alter reading facts or completion. Attendance requires a noncancelled meeting strictly before server now (409 otherwise); distinct eligible ids replace active selections and retain recorded revoked ids. Invalid/new revoked selections 400. `null` means unrecorded; `[]` explicitly records no active attendance and is valid. There is no reset-to-null action. Cancel/uncancel changes status alone, preserving records; member projection hides cancelled content and future/cancelled attendance.

Reading plan percentages are finite nonnegative numbers (decimals and >100 allowed); pages positive safe integers, independent from percentages. Optional due dates and trimmed notes <=1000 remain stored beneath links. Every append/edit/reorder recomputes warnings on the proposed complete plan: reversed ranges, >100/known page count, backwards starts, overlapping normalized adjacent ranges (percentage boundaries may touch, inclusive pages may not), and page-derived percent discrepancies strictly greater than 10 points when positive page count is known. Exactly 10, gaps and date ordering add no warning. Explicit `acknowledged=true` is required only when current warnings exist; otherwise 400 `invalid_input`, no conversion/mutation. Acknowledgement resets after every client edit and cannot authorize different inputs. Reorder must be exactly the active ids once each: malformed/nonexact/unknown/foreign set 400, explicitly removed week or missing parent 404. Due dates do not reorder. Removal retains id/facts/completions/link and forces linked member content locked even when safe/completed.

Summary text is trimmed plain text <=10000; empty unpublished becomes null and empty published is 400. Highlights are trimmed nonblank <=2000, quote/paraphrase, distinct speakers, independent publication per item. New attribution permits active speakers only (invalid choices 400); unchanged revoked attribution can remain or be removed. Publication of summary does not publish highlights. Reorder is an exact active permutation; highlight soft removal preserves text/attribution/publication/original position. Safe marking rejects both true/false with 409 if any retained active/removed week links the meeting. Quote text 1..1000, nullable author/source <=200; duplicate keys collapse whitespace with Spanish lowercase regardless of active/removal status, excluding edited id (409). Rubric input replaces exactly five criteria × five whole anchors atomically; nullable trimmed prose <=500, blank normalizes null, no half-anchor/extra criterion or invented prose.

## Conservative removal and recovery

Bin variants expressly distinguish book, meeting, quote, week and highlight. Deadline is deletion instant + exactly 30 days; `expired` is server now >= deadline. Expired remains listed until explicit purge. Missing/nonremoved/already purged target is generic 404; expired restore 409. Restore clears only selected removal metadata: required book/meeting parent must be restored first, independently removed descendants stay removed. Week reinserts retained ordinal clamped to active length and renumbers; highlight retains canonical slots/relative order. Current deliberate link edits prevail. Restore validates one active book, normalized quote uniqueness and same-book one-to-one links atomically (409). A meeting with a still removed week may restore; its content remains locked, avoiding recovery deadlock.

Purge never cascades and is allowed before/after deadline only for explicitly removed eligible records. Books with retained weeks, meetings, reviews, finished/favourite marks, origin/candidate/outcome vote references refuse (409). Meetings with week reservations, nonempty attendance or any highlights refuse; weeks with completions or retained meeting links refuse. Independent quotes/highlights and eligible empty containers lose substantive payload; minimal type/id/actor/time tombstones retain auditable references. This declaration mirrors conservative mock domain rules, not disk/backup erasure. Eventual production erasure/retention/jobs are #12/#46/#47 and may refine this contract first; no automatic purge job is promised.

## Recent authorisation and production export

The three routes from #101 are fixed: GET `/api/admin/backups`, POST `/api/admin/export`, GET `/api/admin/audit-log`. BackupInfo policy remains pending with nullable last timestamp until #48 chooses actual deployment policy. No frequency, retention, storage or restoration promise is selected here. Audit whitelist is only id/action, safe target type/id/label, actor id/displayName and occurredAt. Export access/content is deliberately broader than safe audit and member views: the approved owner can export private reviews/drafts without changing their ordinary member gates.

Export POST accepts no request body and requires CSRF plus recent server-verified Discord authentication for that same approved admin. Normal confirmation, a request boolean or an old signed-in session is insufficient. Missing/stale recent authorisation returns 409 `ReauthenticationError`, e.g. `{"code":"reauthentication_required","message":"Vuelve a identificarte con Discord para exportar los datos."}`, with no download/data and without expiring the approved session. Reversible draft freshness is five minutes (300 seconds) by server time, fresh while age <300 seconds; a future timestamp is invalid. #49/#5 must implement and test boundary/identity/revocation checks.

On 409, #49 may navigate same-site to `/api/auth/discord/start?purpose=export`. Existing #71 start/callback routes bind server-held purpose, intended same-site return, OAuth state and originating approved admin identity. The server must require fresh provider authentication and verify state and returned exact identity, then recheck current approval/admin role before recording successful recent authentication in server session state. Wrong identity, denied/revoked account or failed callback never grants freshness. Return destinations remain same-site; no raw provider credentials/tokens/passwords appear in requests to export, responses or business records. Provider assurance details are implemented with the maintained OAuth library in #5; prior local confirmation cannot substitute for that check.

Successful 200 is an authenticated `application/zip` binary attachment, `Content-Disposition: attachment; filename="club-de-lectura.zip"` (safe fixed server name), `Cache-Control: no-store`. Errors are JSON, never mixed with ZIP bytes. Version 1 contains UTF-8 `manifest.json` (`ExportManifest`), UTF-8 `club.json` (`ClubBusinessExport`) and available website media. The closed JSON record schemas include active/revoked members and external allowlist identity, profiles, curator, catalogue, independent weeks/completions/finished flags, private reviews, votes/approvals/outcomes, summary/highlight drafts/publication, whole rubric, quotes, recoverable deletion metadata, minimal tombstones and safe audit. Empty arrays are valid. Preserve canonical ids/references, including revoked/recoverable history; include successful export audit once. Exclude sessions, OAuth credentials, tokens, secrets and all purged substantive data. Fields are explicitly whitelisted at every boundary, never unrestricted internal dictionaries.

Media use stable ids: member avatarMediaId and book coverMediaId refer to the manifest/club media list. Available JPEG/PNG/WebP bytes reside at safe `media/<id>.<extension>` paths; unavailable media has available=false/path=null. No traversal, external URL fetching or embedded data URLs; manifest and records media lists agree. Record/manifest schemaVersion changes require contract-first revision. This is an explicit reversible download-format assumption under spec §9/#49, not import/restoration or backup rotation/storage policy.

Adaptation boundary: local `ClubExport {filename,json}`, demo `club-de-lectura-demostracion.json` and in-memory media data URLs are illustrative mock results from #101, never production JSON wire response or a restorable snapshot. #103 owns generated types/local adapters while preserving current demo JSON download/tests; #49 owns real binary download and fresh-authorisation UI. File selection/previews, mock confirmation and JSON wrapping remain local-only mappings, not extra HTTP operations or real reauthentication. No normal member export is introduced.

## Offline validation and scope of evidence

After installing the pinned frontend dev dependencies, run from `frontend/`:

```sh
npm run validate:contract
npm run test:contract
npm test
npm run lint
npm run build
```

Validation checks OpenAPI 3.1 structure, unique operationIds, local references and every declared schema/media/parameter example against JSON Schema 2020-12 (including date/time formats). No remote references or network resolution are allowed. Focused tests cover fictional session/gated/available/empty/outcome/input examples and negative privacy/input mutations; disposable malformed-document, unresolved-reference and invalid-example mutations must fail the validator. It does not call nonexistent HTTP endpoints. CI performs clean `npm ci` before these contract checks and frontend regression checks. Preserve the active workspace/dev server/native DLLs: dependency changes for #71 are installed in a disposable clean copy; never workspace `npm ci`.

Backend unit/integration and Docker Compose tests are deferred because no backend exists; permission, state/lifecycle predicates, transactionality, OAuth/image validation and response-contract checks need backend implementation/testing. #104 corrected Home privacy; #102 defines administrative contract/export semantics; #103 generates types and adapts central mock/client without losing this contract; #72 validates actual backend responses. There are no paid services or accounts required for this contract tooling.

## Generated frontend ownership (#103)

Root `openapi.yaml` owns wire shapes; committed `frontend/src/api/generated.ts` must
never be edited by hand. `types.ts` keeps readable generated component aliases,
`client.ts` derives JSON success bodies from actual operation/status declarations
and scalar inputs from generated request schemas. Type-level coverage includes all
client methods and excludes only the provider callback. Internal mock state may
retain private facts, but public projections compile against generated boundaries.

From `frontend/`, run `npm run generate:api` after contract-first changes and commit
both files. `npm run check:api` compares deterministic regeneration bytes;
`npm run validate:contract` and `npm run test:contract` validate declarations/examples;
`npm run test:type-boundaries` mutates used request/response schemas in disposable
copies and requires errors at actual TypeScript boundaries. `npm test` includes
actual mock return-value conformance and forbidden-field mutation cases. CI runs
these after clean `npm ci` and before build. After installation all checks are offline;
remote references are refused before generation.

Pinned MIT openapi-typescript 6.7.6 avoids the 7.x TypeScript-5-only peer constraint
in this TS6 project. The documented object-input API generates from validated memory.
Redundant OAS discriminator lookup hints are removed only from the cloned generation
input because v6 incorrectly injects parent names into nullable union references.
Authoritative const/oneOf branches, absent/required fields and nullability remain
intact. Binary format generates Blob byte parts; no schema is widened afterward.

`adapters.ts` maps browser File actions to generated profile/cover multipart JSON
metadata plus optional bytes and FormData without sending HTTP. OAuth 302 handoff is
separate from JSON results. Local `ClubExport {filename,json}` uses illustrative mock
JSON and fictional data URLs; authenticated production ZIP/native media remain #102,
implemented by #49 with fresh authorisation. ApiError(status,message,code?) preserves
existing callers; explicit envelopes use generated {code,message} conventions.

Complete #71 -> #104 -> #102 -> #103 before backend work. Backend scaffold #1 and
feature/auth issues implement the contract; #72 verifies actual server responses.
Backend/integration/Compose checks remain deferred until those systems exist.
