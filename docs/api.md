# API contract

`openapi.yaml` is the OpenAPI 3.1 source of truth for the session and member API (#71). It describes future HTTP behaviour; the running frontend still uses the handwritten types and fictional in-memory mock. There is no backend yet, and schema tests do not prove HTTP authentication, database transactions or server spoiler enforcement. Administration is #102, generated central types/mock adoption is #103, and backend integration response validation is #72.

The current Home mock has a known contract-first discrepancy: `stats.reviews` uses a global fixture counter and activity only filters removed subjects, rather than applying spoiler predicates. PM resolved this in #71; focused runtime correction and regression coverage belongs to #104. Finish #71 → #104 → #102 → #103 before backend work. #71 preserves the existing runtime and 1,078-test baseline.

## Naming and representation

Stable unique operationIds match `ApiClient` method names; `discordCallback` is provider navigation with no client method. Paths use `/api`, opaque nonempty website string IDs and camelCase JSON fields. No member projection serializes internal mock state, Discord IDs, credentials, session control options or unrestricted dictionaries. Profiles use website-native identity; `CurrentUser.role` is only `member` or `admin` (curator is an assignment).

All objects are closed. Discriminated `oneOf` variants preserve **absent** keys: locked club ratings have only `status`, lockedNoWeek records only `status`, lockedWeekNotRead only `status/weekNumber`, and empty/insufficient rating/taste branches only `status`. A visible branch requires its fields, including explicit nulls. `null` means a known missing optional value (avatar, summary, date, text, current vote), not a locked value; a hidden count is absent, never zero/null. Empty collections are arrays, not null. Each schema and JSON operation includes fictional examples.

Instants are ISO 8601 with timezone offset. The server clock partitions and sorts meetings; the configured club timezone governs local display, never the browser clock. Calendar dates are `YYYY-MM-DD` without timezone; unknown dates are null. Historical best-known full dates remain paired with `datesApproximate` and display as approximate month/year. `publicationDate` is free text (e.g. `1884–1885`), never forced to a full date. Percentage/page ranges are independent manual facts, not converted from one another.

There is no pagination, cursor, server catalogue search, notification channel or second current-user endpoint. Catalogue is unsorted for local existing filters/sorts. Book schedule is week order and its meetings oldest first. Meeting lists are flat across books, upcoming soonest first (`startsAt >= now`), past newest first; cancellation does not change partition. Vote candidates stay shortlist order; history is latest closed first. Reviews are own first then Spanish display name; my reviews latest submitted/edited activity first then Spanish title. Directory/compatibility members use Spanish display-name order, never progress/score; book favourites retain user order and options use Spanish title order.

## Session, OAuth and CSRF

These reversible cookie/flow assumptions are implemented by backend #5. Browser and API are same-origin. `sessionid` is the server session cookie: HttpOnly, SameSite=Lax for OAuth navigation, Secure in HTTPS deployment. Local HTTP development does not claim Secure cookies work without HTTPS. Approved exact Discord IDs are checked server-side, revoked access is refused, and approval/revocation is rechecked on every club request.

`GET /api/session` always returns 200 `anonymous`, `denied` or `signedIn` and bootstraps a `csrftoken` cookie. Only signedIn contains `CurrentUser`; anonymous/denied require `demoSignInAvailable` and it is false in production. A CSRF token is not authentication. For unsafe JSON/multipart requests, including anonymous logout/demo, send the cookie value in `X-CSRFToken`; missing/wrong CSRF returns 403 `forbidden`. Cookie/header names are explicit assumptions, not frontend-only enforcement. Session responses/OAuth results never include access/refresh tokens, Discord ID, secret or password.

`startSignIn()` navigates the top-level browser to `GET /api/auth/discord/start` (302 to Discord). The provider navigates to `GET /api/auth/discord/callback` (302 to a validated same-origin return page/session gate). This is not a JSON sign-in promise. Only `identify` scope is requested; the server checks state, provider identity and exact allowlist. Missing/invalid state or denied/revoked account returns to the Spanish anonymous/denied screen without club data. Provider `code`, `state`, `error` parameters are not echoed or projected. OAuth start accepts optional `purpose=login|export` (default login); export reauthentication on these same routes is reserved for #102. The server holds purpose/return destination in state, with same-origin navigation only; there is no arbitrary external redirect parameter. No Discord requests are performed by contract validation.

`startDemoSignIn()` maps to CSRF-protected `POST /api/auth/demo`, 204 with a fictional session only when DEMO_MODE is enabled; otherwise generic 404. `signOut()` maps to idempotent CSRF-protected `POST /api/auth/logout`, 204 even without membership. All 204 responses have no content body. Other reads/result-returning writes are 200, except `createVote` is 201.

## Errors, permissions and identity

The single JSON error envelope is exactly `{ "code": "unauthenticated", "message": "Debes iniciar sesión." }`. Both keys are required; message is safe Spanish plain text without private payload/request echo. Status/code pairs are 400 `invalid_input`, 401 `unauthenticated`, 403 `forbidden` (including CSRF), 404 `not_found`, 409 `conflict` or future export `reauthentication_required`, 500 `internal_error`, 503 `service_unavailable`. #102 settles export-specific responses; no export placeholder operation exists here. Current local `ApiError(status,message)` remains an adapter concern for #103, not another wire format.

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

`PUT /api/me/profile` uses `multipart/form-data`: required `metadata` part is `application/json` with displayName, optional nullable bio/favouriteQuote, ordered favouriteBookIds and `avatarAction=keep|remove|replace`. `avatar` is a binary JPEG/PNG/WebP part required **only** for replace (nonempty, <=2,097,152 bytes inclusive); omit it for keep/remove. The backend sniffs content and may re-encode rather than trusting declared MIME. JSON File objects, local blob URLs and local `AvatarChange` are not wire structures; #103 adapts browser File to multipart. Admin cover adapters belong to #102.

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

All remaining ApiClient methods are **admin-only, deferred to #102**. The following inventory gives the current local request/result, with no placeholder route/schema presented as complete. #102 assigns their precise production paths/statuses/download conventions; private allowlist/export payloads are intentionally absent from #71 components. Catalogue covers and export download are local adapters pending that contract. These local mock signatures do not imply an HTTP File or ClubExport JSON wire response.

| Client method | Current local arguments | Current local result | Mapping / security |
|---|---|---|---|
| `getBackupInfo` | `none` | `BackupInfo` | #102; server membership + admin role, CSRF on writes | 
| `exportClubData` | `none` | `ClubExport` | #102; server membership + admin role, CSRF on writes | 
| `getAuditLog` | `none` | `AuditEvent[]` | #102; server membership + admin role, CSRF on writes | 
| `getRecycleBin` | `none` | `RecycleBinEntry[]` | #102; server membership + admin role, CSRF on writes | 
| `getDeletionPreview` | `type: 'book' | 'meeting' | 'quote', id: string` | `{ label: string; dependencies: string[] }` | #102; server membership + admin role, CSRF on writes | 
| `deleteBook` | `id: string` | `RecycleBinEntry[]` | #102; server membership + admin role, CSRF on writes | 
| `deleteMeeting` | `id: string` | `RecycleBinEntry[]` | #102; server membership + admin role, CSRF on writes | 
| `deleteLiteraryQuote` | `id: string` | `RecycleBinEntry[]` | #102; server membership + admin role, CSRF on writes | 
| `restoreDeleted` | `type: DeletedType, id: string` | `RecycleBinEntry[]` | #102; server membership + admin role, CSRF on writes | 
| `purgeDeleted` | `type: DeletedType, id: string` | `RecycleBinEntry[]` | #102; server membership + admin role, CSRF on writes | 
| `listAdminQuotes` | `none` | `AdminLiteraryQuote[]` | #102; server membership + admin role, CSRF on writes | 
| `addLiteraryQuote` | `input: LiteraryQuoteInput` | `AdminLiteraryQuote` | #102; server membership + admin role, CSRF on writes | 
| `updateLiteraryQuote` | `id: string, input: LiteraryQuoteInput` | `AdminLiteraryQuote` | #102; server membership + admin role, CSRF on writes | 
| `saveRatingRubric` | `input: RatingRubric` | `RatingRubric` | #102; server membership + admin role, CSRF on writes | 
| `getAdminMeetingRecord` | `meetingId: string` | `AdminMeetingRecord` | #102; server membership + admin role, CSRF on writes | 
| `saveMeetingSummary` | `meetingId: string, input: MeetingSummaryInput` | `AdminMeetingRecord` | #102; server membership + admin role, CSRF on writes | 
| `createMeetingHighlight` | `meetingId: string, input: MeetingHighlightInput` | `AdminMeetingRecord` | #102; server membership + admin role, CSRF on writes | 
| `updateMeetingHighlight` | `meetingId: string, highlightId: string, input: MeetingHighlightInput` | `AdminMeetingRecord` | #102; server membership + admin role, CSRF on writes | 
| `reorderMeetingHighlights` | `meetingId: string, ids: string[]` | `AdminMeetingRecord` | #102; server membership + admin role, CSRF on writes | 
| `removeMeetingHighlight` | `meetingId: string, highlightId: string` | `AdminMeetingRecord` | #102; server membership + admin role, CSRF on writes | 
| `setMeetingRecordSafe` | `meetingId: string, safe: boolean` | `AdminMeetingRecord` | #102; server membership + admin role, CSRF on writes | 
| `getAdminReadingPlan` | `bookId: string` | `AdminReadingPlan` | #102; server membership + admin role, CSRF on writes | 
| `createReadingWeek` | `bookId: string, input: ReadingWeekInput, acknowledged: boolean` | `AdminReadingPlan` | #102; server membership + admin role, CSRF on writes | 
| `updateReadingWeek` | `bookId: string, weekId: string, input: ReadingWeekInput, acknowledged: boolean` | `AdminReadingPlan` | #102; server membership + admin role, CSRF on writes | 
| `reorderReadingWeeks` | `bookId: string, ids: string[], acknowledged: boolean` | `AdminReadingPlan` | #102; server membership + admin role, CSRF on writes | 
| `removeReadingWeek` | `bookId: string, weekId: string` | `AdminReadingPlan` | #102; server membership + admin role, CSRF on writes | 
| `listAdminMeetings` | `none` | `AdminMeetingCalendar` | #102; server membership + admin role, CSRF on writes | 
| `getAdminMeeting` | `meetingId: string` | `AdminMeeting` | #102; server membership + admin role, CSRF on writes | 
| `createMeeting` | `input: MeetingInput` | `AdminMeeting` | #102; server membership + admin role, CSRF on writes | 
| `updateMeeting` | `meetingId: string, input: MeetingInput` | `AdminMeeting` | #102; server membership + admin role, CSRF on writes | 
| `setMeetingCancelled` | `meetingId: string, cancelled: boolean` | `AdminMeeting` | #102; server membership + admin role, CSRF on writes | 
| `setMeetingAttendance` | `meetingId: string, memberIds: string[]` | `AdminMeeting` | #102; server membership + admin role, CSRF on writes | 
| `listAdminBooks` | `none` | `AdminBook[]` | #102; server membership + admin role, CSRF on writes | 
| `getAdminBook` | `bookId: string` | `AdminBook` | #102; server membership + admin role, CSRF on writes | 
| `createBook` | `input: BookInput` | `AdminBook` | #102; server membership + admin role, CSRF on writes | 
| `updateBook` | `bookId: string, input: BookInput` | `AdminBook` | #102; server membership + admin role, CSRF on writes | 
| `searchBookMetadata` | `query: string` | `BookMetadataResult[]` | #102; server membership + admin role, CSRF on writes | 
| `getAdminMembers` | `none` | `AdminMembers` | #102; server membership + admin role, CSRF on writes | 
| `addMember` | `input: NewMember` | `AdminMembers` | #102; server membership + admin role, CSRF on writes | 
| `revokeMember` | `memberId: string` | `AdminMembers` | #102; server membership + admin role, CSRF on writes | 
| `restoreMember` | `memberId: string` | `AdminMembers` | #102; server membership + admin role, CSRF on writes | 
| `setCurator` | `memberId: string | null` | `AdminMembers` | #102; server membership + admin role, CSRF on writes | 

No client method is omitted; helpers such as `ApiError`, `SESSION_METHODS`, file selection/preview and injected failure options are local adapters, not routes. Every member method above corresponds to its stable operationId; navigation remains explicitly different from JSON transport. The method inventory is checked by the contract test suite.

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

Backend unit/integration and Docker Compose tests are deferred because no backend exists; permission, state/lifecycle predicates, transactionality, OAuth/image validation and response-contract checks need backend implementation/testing. #104 fixes the known Home mock privacy discrepancy; #102 adds the full administrative contract/export semantics; #103 generates types and adapts central mock/client without losing this contract; #72 validates actual backend responses. There are no paid services or accounts required for this contract tooling.
