/** Generated from root openapi.yaml. DO NOT EDIT. Run npm run generate:api. */

/** WithRequired type helpers */
type WithRequired<T, K extends keyof T> = T & { [P in K]-?: T[P] };

/** OneOf type helpers */
type Without<T, U> = { [P in Exclude<keyof T, keyof U>]?: never };
type XOR<T, U> = (T | U) extends object ? (Without<T, U> & U) | (Without<U, T> & T) : T | U;
type OneOf<T extends any[]> = T extends [infer Only] ? Only : T extends [infer A, infer B, ...infer Rest] ? OneOf<[XOR<A, B>, ...Rest]> : never;

export interface paths {
  "/api/session": {
    /**
     * getSession
     * @description Always 200 anonymous/denied/signedIn; bootstraps csrftoken cookie. Recheck allowlist/revocation server-side. No second current-user endpoint.
     */
    get: operations["getSession"];
  };
  "/api/auth/logout": {
    /**
     * signOut
     * @description Idempotent logout even without authenticated membership. CSRF required; invalidate session cookie.
     */
    post: operations["signOut"];
  };
  "/api/auth/demo": {
    /**
     * startDemoSignIn
     * @description CSRF required. DEMO_MODE only, establishes fictional session; otherwise generic 404. Never available on real club instance.
     */
    post: operations["startDemoSignIn"];
  };
  "/api/home": {
    /**
     * getHome
     * @description Home is gated server-side before activity text and review totals are composed; ratings/records cannot leak via card/feed counts.
     */
    get: operations["getHome"];
  };
  "/api/weeks/{weekId}/completion": {
    /**
     * setWeekCompleted
     * @description Own session identity only; 403 smuggled ownership, 401 before lookup, unknown/removed week 404 before invalid input. Independent from finished flag; idempotent.
     */
    put: operations["setWeekCompleted"];
  };
  "/api/books": {
    /**
     * listBooks
     * @description Approved membership rechecked before data lookup. See docs/api.md for server obligations and error precedence.
     */
    get: operations["listBooks"];
  };
  "/api/books/{bookId}": {
    /**
     * getBook
     * @description Approved membership rechecked before data lookup. See docs/api.md for server obligations and error precedence.
     */
    get: operations["getBook"];
  };
  "/api/meetings": {
    /**
     * listMeetings
     * @description Approved membership rechecked before data lookup. See docs/api.md for server obligations and error precedence.
     */
    get: operations["listMeetings"];
  };
  "/api/meetings/{meetingId}": {
    /**
     * getMeeting
     * @description Central MeetingRecord gate includes admin member views; published content only; cancelled/removed linked week suppress substantive records.
     */
    get: operations["getMeeting"];
  };
  "/api/votes": {
    /**
     * getVotes
     * @description Approved membership rechecked before data lookup. See docs/api.md for server obligations and error precedence.
     */
    get: operations["getVotes"];
    /**
     * createVote
     * @description 401 then effective current curator/admin permission 403; missing curator or existing draft/open 409. Empty draft shortlist belongs to current curator even when admin creates. No request body.
     */
    post: operations["createVote"];
  };
  "/api/votes/{voteId}": {
    /**
     * getVote
     * @description Approved membership rechecked before data lookup. See docs/api.md for server obligations and error precedence.
     */
    get: operations["getVote"];
  };
  "/api/votes/{voteId}/candidates/{bookId}/approval": {
    /**
     * setApproval
     * @description Own identity from session. 401 then unknown vote/candidate 404, state not open 409, invalid input 400; ownership keys 403. Public approvals; no automatic book transitions.
     */
    put: operations["setApproval"];
  };
  "/api/votes/{voteId}/candidates": {
    /**
     * addCandidate
     * @description 401 then current curator/admin 403 before lookup, vote/book 404 then closed/duplicate/non-propuesto book 409, invalid input 400. Append candidate.
     */
    post: operations["addCandidate"];
  };
  "/api/votes/{voteId}/candidates/{bookId}": {
    /**
     * removeCandidate
     * @description 401 then current curator/admin 403, unknown vote/candidate 404, closed or open shortlist <=2 409. Remove all approvals atomically.
     */
    delete: operations["removeCandidate"];
  };
  "/api/votes/{voteId}/candidates/order": {
    /**
     * reorderCandidates
     * @description 401 then permission 403, vote/any book lookup 404, closed or stale/non-exact candidate set 409, malformed input 400.
     */
    put: operations["reorderCandidates"];
  };
  "/api/votes/{voteId}/open": {
    /**
     * openVote
     * @description 401 then permission 403, vote lookup 404, non-draft or <2 candidates 409. No body.
     */
    post: operations["openVote"];
  };
  "/api/votes/{voteId}/close": {
    /**
     * closeVote
     * @description 401 then permission 403, lookup 404, non-open 409. Server computes winner/tie. No body or automatic catalogue/curator changes.
     */
    post: operations["closeVote"];
  };
  "/api/votes/{voteId}/tie-winner": {
    /**
     * recordTieWinner
     * @description 401 then admin-only 403, vote/book lookup 404, not pending tie/not tied book 409, trimmed note >1000 400. Manual outcome, never book transitions.
     */
    post: operations["recordTieWinner"];
  };
  "/api/books/{bookId}/ratings": {
    /**
     * getBookRatings
     * @description 401 before book lookup. Ratings gate finished AND own complete review, including historical/admin member views. Own review always returned.
     */
    get: operations["getBookRatings"];
  };
  "/api/rating-rubric": {
    /**
     * getRatingRubric
     * @description Approved membership rechecked before data lookup. See docs/api.md for server obligations and error precedence.
     */
    get: operations["getRatingRubric"];
  };
  "/api/books/{bookId}/finished": {
    /**
     * setBookFinished
     * @description Session identity only. 401, ownership 403, book lookup 404, not ratable when finishing or existing review when clearing 409, invalid 400. Independent from weekly completion.
     */
    put: operations["setBookFinished"];
  };
  "/api/books/{bookId}/my-review": {
    /**
     * saveMyReview
     * @description Session identity only. 401, smuggled ownership 403, book lookup 404, not ratable/not finished 409, scores/text 400. Atomic create/replace; exactly five half-star scores; text <=5000 AFTER trim, blank->null.
     */
    put: operations["saveMyReview"];
  };
  "/api/statistics": {
    /**
     * getStatistics
     * @description Drop viewer-locked books BEFORE all means/counts/radars/highlights, with thresholds/denominators unchanged. No hidden book count.
     */
    get: operations["getStatistics"];
  };
  "/api/statistics/compatibility": {
    /**
     * getTasteCompatibility
     * @description Only viewer-unlocked shared ratings. Three shared books minimum before differences/metadata. Insufficient status has no scores/books; permitted sharedBookCount remains at outer member level.
     */
    get: operations["getTasteCompatibility"];
  };
  "/api/members": {
    /**
     * listMembers
     * @description Approved membership rechecked before data lookup. See docs/api.md for server obligations and error precedence.
     */
    get: operations["listMembers"];
  };
  "/api/members/{memberId}": {
    /**
     * getMemberProfile
     * @description 401 before lookup; revoked and unknown IDs indistinguishable generic 404. Public website-native profile/progress only, never ratings/taste/Discord identity.
     */
    get: operations["getMemberProfile"];
  };
  "/api/me/profile": {
    /**
     * getMyProfile
     * @description Approved membership rechecked before data lookup. See docs/api.md for server obligations and error precedence.
     */
    get: operations["getMyProfile"];
    /**
     * updateMyProfile
     * @description 401 before validation, any smuggled owner/member/id key 403 and never used for identity. JSON metadata+optional avatar image multipart parts. Normalize trim before lengths, blank optional text null, allowed ordered distinct <=5 favourites. Replace requires valid image <=2 MiB; all validation before atomic profile/avatar save.
     */
    put: operations["updateMyProfile"];
  };
  "/api/me/reviews": {
    /**
     * listMyReviews
     * @description Approved membership rechecked before data lookup. See docs/api.md for server obligations and error precedence.
     */
    get: operations["listMyReviews"];
  };
  "/api/auth/discord/start": {
    /**
     * Same-site OAuth navigation
     * @description Top-level navigation, not JSON sign-in. Discord identify scope only; approved exact IDs, revoke check, state and identity checked server-side. Server-held same-origin return navigation; deny missing/invalid state without club payload. No access/refresh tokens exposed. Export purpose performs admin reauthentication (#102). For purpose=export require existing approved admin and bind server OAuth state to that same identity; require a fresh provider authentication, not reuse of prior local confirmation. Callback records server recent-auth time only after state, identity and current allowlist/admin checks; wrong identity never authorises export. Safe same-site return only.
     */
    get: operations["startSignIn"];
  };
  "/api/auth/discord/callback": {
    /**
     * Same-site OAuth navigation
     * @description Top-level navigation, not JSON sign-in. Discord identify scope only; approved exact IDs, revoke check, state and identity checked server-side. Server-held same-origin return navigation; deny missing/invalid state without club payload. No access/refresh tokens exposed. Export purpose performs admin reauthentication (#102). For server-held export purpose, successful fresh provider authentication must match original approved admin identity and rechecked allowlist/admin role before server stores recent-auth timestamp. Absent/stale authorisation later yields export 409 without expiring approved session. No tokens exposed.
     */
    get: operations["discordCallback"];
  };
  "/api/admin/backups": {
    /**
     * getBackupInfo
     * @description Effective approved admin only; recheck allowlist and role on server. 401 before 403; both before lookup/payload validation. Curator alone is denied. CSRF on unsafe methods. Atomic refusal changes nothing; member/own-profile gates apply to admin outside these endpoints.
     */
    get: operations["getBackupInfo"];
  };
  "/api/admin/export": {
    /**
     * exportClubData
     * @description Effective approved admin only; recheck allowlist and role on server. 401 before 403; both before lookup/payload validation. Curator alone is denied. CSRF on unsafe methods. Atomic refusal changes nothing; member/own-profile gates apply to admin outside these endpoints. Requires recent same-approved-admin Discord OAuth reauthentication after verified identity/allowlist checks. Five minutes by server clock, recorded server-side (#49/#5). Confirmation/request boolean insufficient; no body accepted. Include UTF-8 manifest.json + club.json and available website media. Authenticated noncached attachment; sessions/secrets excluded. Export event included once in safe audit.
     */
    post: operations["exportClubData"];
  };
  "/api/admin/audit-log": {
    /**
     * getAuditLog
     * @description Effective approved admin only; recheck allowlist and role on server. 401 before 403; both before lookup/payload validation. Curator alone is denied. CSRF on unsafe methods. Atomic refusal changes nothing; member/own-profile gates apply to admin outside these endpoints.
     */
    get: operations["getAuditLog"];
  };
  "/api/admin/bin": {
    /**
     * getRecycleBin
     * @description Effective approved admin only; recheck allowlist and role on server. 401 before 403; both before lookup/payload validation. Curator alone is denied. CSRF on unsafe methods. Atomic refusal changes nothing; member/own-profile gates apply to admin outside these endpoints.
     */
    get: operations["getRecycleBin"];
  };
  "/api/admin/deletion-preview/{type}/{id}": {
    /**
     * getDeletionPreview
     * @description Effective approved admin only; recheck allowlist and role on server. 401 before 403; both before lookup/payload validation. Curator alone is denied. CSRF on unsafe methods. Atomic refusal changes nothing; member/own-profile gates apply to admin outside these endpoints. Only book/meeting/quote preview types; safe operational dependencies.
     */
    get: operations["getDeletionPreview"];
  };
  "/api/admin/bin/{type}/{id}/restore": {
    /**
     * restoreDeleted
     * @description Effective approved admin only; recheck allowlist and role on server. 401 before 403; both before lookup/payload validation. Curator alone is denied. CSRF on unsafe methods. Atomic refusal changes nothing; member/own-profile gates apply to admin outside these endpoints. Missing/nonremoved/purged target 404. Expired restore 409. Restore selected metadata only, not independently removed descendants; required parent first. One leyendo, quote uniqueness and canonical same-book/one-to-one link checks 409. Meeting restoration allowed with removed linked week (gate remains locked). Purge is dependency-blocked 409, never cascades: book weeks/meetings/reviews/finished/favourites/votes; meeting reservations/attendance/highlights; week completions/links. Quote/highlight eligible independently. 30-day deadline does not promise automatic job. #12/#46/#47 refine production erasure first.
     */
    post: operations["restoreDeleted"];
  };
  "/api/admin/bin/{type}/{id}": {
    /**
     * purgeDeleted
     * @description Effective approved admin only; recheck allowlist and role on server. 401 before 403; both before lookup/payload validation. Curator alone is denied. CSRF on unsafe methods. Atomic refusal changes nothing; member/own-profile gates apply to admin outside these endpoints. Missing/nonremoved/purged target 404. Expired restore 409. Restore selected metadata only, not independently removed descendants; required parent first. One leyendo, quote uniqueness and canonical same-book/one-to-one link checks 409. Meeting restoration allowed with removed linked week (gate remains locked). Purge is dependency-blocked 409, never cascades: book weeks/meetings/reviews/finished/favourites/votes; meeting reservations/attendance/highlights; week completions/links. Quote/highlight eligible independently. 30-day deadline does not promise automatic job. #12/#46/#47 refine production erasure first.
     */
    delete: operations["purgeDeleted"];
  };
  "/api/admin/books/{id}": {
    /**
     * deleteBook
     * @description Effective approved admin only; recheck allowlist and role on server. 401 before 403; both before lookup/payload validation. Curator alone is denied. CSRF on unsafe methods. Atomic refusal changes nothing; member/own-profile gates apply to admin outside these endpoints. Soft removal retains linked business history and metadata for exactly 30 days; repeated/missing target 404. Never cascade purge; member projections suppress removed targets/dependent content.
     */
    delete: operations["deleteBook"];
  };
  "/api/admin/meetings/{id}": {
    /**
     * deleteMeeting
     * @description Effective approved admin only; recheck allowlist and role on server. 401 before 403; both before lookup/payload validation. Curator alone is denied. CSRF on unsafe methods. Atomic refusal changes nothing; member/own-profile gates apply to admin outside these endpoints. Soft removal retains linked business history and metadata for exactly 30 days; repeated/missing target 404. Never cascade purge; member projections suppress removed targets/dependent content.
     */
    delete: operations["deleteMeeting"];
  };
  "/api/admin/quotes/{id}": {
    /**
     * updateLiteraryQuote
     * @description Effective approved admin only; recheck allowlist and role on server. 401 before 403; both before lookup/payload validation. Curator alone is denied. CSRF on unsafe methods. Atomic refusal changes nothing; member/own-profile gates apply to admin outside these endpoints. Stable id/order, normalized duplicates 409.
     */
    put: operations["updateLiteraryQuote"];
    /**
     * deleteLiteraryQuote
     * @description Effective approved admin only; recheck allowlist and role on server. 401 before 403; both before lookup/payload validation. Curator alone is denied. CSRF on unsafe methods. Atomic refusal changes nothing; member/own-profile gates apply to admin outside these endpoints. Soft removal retains linked business history and metadata for exactly 30 days; repeated/missing target 404. Never cascade purge; member projections suppress removed targets/dependent content.
     */
    delete: operations["deleteLiteraryQuote"];
  };
  "/api/admin/quotes": {
    /**
     * listAdminQuotes
     * @description Effective approved admin only; recheck allowlist and role on server. 401 before 403; both before lookup/payload validation. Curator alone is denied. CSRF on unsafe methods. Atomic refusal changes nothing; member/own-profile gates apply to admin outside these endpoints.
     */
    get: operations["listAdminQuotes"];
    /**
     * addLiteraryQuote
     * @description Effective approved admin only; recheck allowlist and role on server. 401 before 403; both before lookup/payload validation. Curator alone is denied. CSRF on unsafe methods. Atomic refusal changes nothing; member/own-profile gates apply to admin outside these endpoints. Normalized duplicate 409, including recoverable quotes.
     */
    post: operations["addLiteraryQuote"];
  };
  "/api/admin/rating-rubric": {
    /**
     * saveRatingRubric
     * @description Effective approved admin only; recheck allowlist and role on server. 401 before 403; both before lookup/payload validation. Curator alone is denied. CSRF on unsafe methods. Atomic refusal changes nothing; member/own-profile gates apply to admin outside these endpoints. Validate all 25 anchors before commit.
     */
    put: operations["saveRatingRubric"];
  };
  "/api/admin/meetings/{meetingId}/record": {
    /**
     * getAdminMeetingRecord
     * @description Effective approved admin only; recheck allowlist and role on server. 401 before 403; both before lookup/payload validation. Curator alone is denied. CSRF on unsafe methods. Atomic refusal changes nothing; member/own-profile gates apply to admin outside these endpoints. Draft editor only.
     */
    get: operations["getAdminMeetingRecord"];
  };
  "/api/admin/meetings/{meetingId}/record/summary": {
    /**
     * saveMeetingSummary
     * @description Effective approved admin only; recheck allowlist and role on server. 401 before 403; both before lookup/payload validation. Curator alone is denied. CSRF on unsafe methods. Atomic refusal changes nothing; member/own-profile gates apply to admin outside these endpoints. Independent publication, blank published 400.
     */
    put: operations["saveMeetingSummary"];
  };
  "/api/admin/meetings/{meetingId}/record/highlights": {
    /**
     * createMeetingHighlight
     * @description Effective approved admin only; recheck allowlist and role on server. 401 before 403; both before lookup/payload validation. Curator alone is denied. CSRF on unsafe methods. Atomic refusal changes nothing; member/own-profile gates apply to admin outside these endpoints. Active speakers only on creation.
     */
    post: operations["createMeetingHighlight"];
  };
  "/api/admin/meetings/{meetingId}/record/highlights/{highlightId}": {
    /**
     * updateMeetingHighlight
     * @description Effective approved admin only; recheck allowlist and role on server. 401 before 403; both before lookup/payload validation. Curator alone is denied. CSRF on unsafe methods. Atomic refusal changes nothing; member/own-profile gates apply to admin outside these endpoints. Retain/remove unchanged revoked attribution; new revoked/unknown speaker choices 400.
     */
    put: operations["updateMeetingHighlight"];
    /**
     * removeMeetingHighlight
     * @description Effective approved admin only; recheck allowlist and role on server. 401 before 403; both before lookup/payload validation. Curator alone is denied. CSRF on unsafe methods. Atomic refusal changes nothing; member/own-profile gates apply to admin outside these endpoints. Soft removal keeps publication/content/attribution and original position with 30-day metadata.
     */
    delete: operations["removeMeetingHighlight"];
  };
  "/api/admin/meetings/{meetingId}/record/highlights/order": {
    /**
     * reorderMeetingHighlights
     * @description Effective approved admin only; recheck allowlist and role on server. 401 before 403; both before lookup/payload validation. Curator alone is denied. CSRF on unsafe methods. Atomic refusal changes nothing; member/own-profile gates apply to admin outside these endpoints. Exact active permutation; keep removed slots.
     */
    put: operations["reorderMeetingHighlights"];
  };
  "/api/admin/meetings/{meetingId}/record/safe": {
    /**
     * setMeetingRecordSafe
     * @description Effective approved admin only; recheck allowlist and role on server. 401 before 403; both before lookup/payload validation. Curator alone is denied. CSRF on unsafe methods. Atomic refusal changes nothing; member/own-profile gates apply to admin outside these endpoints. Both safe values conflict 409 when any active/removed week link exists.
     */
    put: operations["setMeetingRecordSafe"];
  };
  "/api/admin/books/{bookId}/reading-plan": {
    /**
     * getAdminReadingPlan
     * @description Effective approved admin only; recheck allowlist and role on server. 401 before 403; both before lookup/payload validation. Curator alone is denied. CSRF on unsafe methods. Atomic refusal changes nothing; member/own-profile gates apply to admin outside these endpoints. Active operational plan.
     */
    get: operations["getAdminReadingPlan"];
  };
  "/api/admin/books/{bookId}/reading-plan/weeks": {
    /**
     * createReadingWeek
     * @description Effective approved admin only; recheck allowlist and role on server. 401 before 403; both before lookup/payload validation. Curator alone is denied. CSRF on unsafe methods. Atomic refusal changes nothing; member/own-profile gates apply to admin outside these endpoints. Canonical links and recomputed warning acknowledgement required; refusal atomic. Unacknowledged recomputed warnings are 400 invalid_input (not conversion); occupied link is 409 conflict.
     */
    post: operations["createReadingWeek"];
  };
  "/api/admin/books/{bookId}/reading-plan/weeks/{weekId}": {
    /**
     * updateReadingWeek
     * @description Effective approved admin only; recheck allowlist and role on server. 401 before 403; both before lookup/payload validation. Curator alone is denied. CSRF on unsafe methods. Atomic refusal changes nothing; member/own-profile gates apply to admin outside these endpoints. Stable id retains completions; canonical links and recomputed warning acknowledgement. Unacknowledged recomputed warnings are 400 invalid_input (not conversion); occupied link is 409 conflict.
     */
    put: operations["updateReadingWeek"];
    /**
     * removeReadingWeek
     * @description Effective approved admin only; recheck allowlist and role on server. 401 before 403; both before lookup/payload validation. Curator alone is denied. CSRF on unsafe methods. Atomic refusal changes nothing; member/own-profile gates apply to admin outside these endpoints. Retain facts/completions/canonical meeting link, 30-day removal metadata; linked member record locked even if safe.
     */
    delete: operations["removeReadingWeek"];
  };
  "/api/admin/books/{bookId}/reading-plan/weeks/order": {
    /**
     * reorderReadingWeeks
     * @description Effective approved admin only; recheck allowlist and role on server. 401 before 403; both before lookup/payload validation. Curator alone is denied. CSRF on unsafe methods. Atomic refusal changes nothing; member/own-profile gates apply to admin outside these endpoints. Exact active permutation then full-plan warnings recomputed. Unacknowledged recomputed warnings are 400 invalid_input (not conversion); occupied link is 409 conflict.
     */
    put: operations["reorderReadingWeeks"];
  };
  "/api/admin/meetings": {
    /**
     * listAdminMeetings
     * @description Effective approved admin only; recheck allowlist and role on server. 401 before 403; both before lookup/payload validation. Curator alone is denied. CSRF on unsafe methods. Atomic refusal changes nothing; member/own-profile gates apply to admin outside these endpoints.
     */
    get: operations["listAdminMeetings"];
    /**
     * createMeeting
     * @description Effective approved admin only; recheck allowlist and role on server. 401 before 403; both before lookup/payload validation. Curator alone is denied. CSRF on unsafe methods. Atomic refusal changes nothing; member/own-profile gates apply to admin outside these endpoints. Canonical book/week links validated; occupied reservation 409.
     */
    post: operations["createMeeting"];
  };
  "/api/admin/meetings/{meetingId}": {
    /**
     * getAdminMeeting
     * @description Effective approved admin only; recheck allowlist and role on server. 401 before 403; both before lookup/payload validation. Curator alone is denied. CSRF on unsafe methods. Atomic refusal changes nothing; member/own-profile gates apply to admin outside these endpoints. Operational attendance editor.
     */
    get: operations["getAdminMeeting"];
    /**
     * updateMeeting
     * @description Effective approved admin only; recheck allowlist and role on server. 401 before 403; both before lookup/payload validation. Curator alone is denied. CSRF on unsafe methods. Atomic refusal changes nothing; member/own-profile gates apply to admin outside these endpoints. Unchanged removed association retained; deliberate unlink/relink releases it. No reading facts change.
     */
    put: operations["updateMeeting"];
  };
  "/api/admin/meetings/{meetingId}/cancelled": {
    /**
     * setMeetingCancelled
     * @description Effective approved admin only; recheck allowlist and role on server. 401 before 403; both before lookup/payload validation. Curator alone is denied. CSRF on unsafe methods. Atomic refusal changes nothing; member/own-profile gates apply to admin outside these endpoints. Preserve records/attendance; member projection suppresses them while cancelled.
     */
    put: operations["setMeetingCancelled"];
  };
  "/api/admin/meetings/{meetingId}/attendance": {
    /**
     * setMeetingAttendance
     * @description Effective approved admin only; recheck allowlist and role on server. 401 before 403; both before lookup/payload validation. Curator alone is denied. CSRF on unsafe methods. Atomic refusal changes nothing; member/own-profile gates apply to admin outside these endpoints. Strictly past and not cancelled; active selections replace while revoked recorded history retained.
     */
    put: operations["setMeetingAttendance"];
  };
  "/api/admin/books": {
    /**
     * listAdminBooks
     * @description Effective approved admin only; recheck allowlist and role on server. 401 before 403; both before lookup/payload validation. Curator alone is denied. CSRF on unsafe methods. Atomic refusal changes nothing; member/own-profile gates apply to admin outside these endpoints.
     */
    get: operations["listAdminBooks"];
    /**
     * createBook
     * @description Effective approved admin only; recheck allowlist and role on server. 401 before 403; both before lookup/payload validation. Curator alone is denied. CSRF on unsafe methods. Atomic refusal changes nothing; member/own-profile gates apply to admin outside these endpoints. Single leyendo rechecked after async image processing immediately before commit, 409 with safe current-book label.
     */
    post: operations["createBook"];
  };
  "/api/admin/books/{bookId}": {
    /**
     * getAdminBook
     * @description Effective approved admin only; recheck allowlist and role on server. 401 before 403; both before lookup/payload validation. Curator alone is denied. CSRF on unsafe methods. Atomic refusal changes nothing; member/own-profile gates apply to admin outside these endpoints. Metadata only.
     */
    get: operations["getAdminBook"];
    /**
     * updateBook
     * @description Effective approved admin only; recheck allowlist and role on server. 401 before 403; both before lookup/payload validation. Curator alone is denied. CSRF on unsafe methods. Atomic refusal changes nothing; member/own-profile gates apply to admin outside these endpoints. Stable id/originVote preserved; same atomic whole edit and single leyendo invariant.
     */
    put: operations["updateBook"];
  };
  "/api/admin/book-metadata": {
    /**
     * searchBookMetadata
     * @description Effective approved admin only; recheck allowlist and role on server. 401 before 403; both before lookup/payload validation. Curator alone is denied. CSRF on unsafe methods. Atomic refusal changes nothing; member/own-profile gates apply to admin outside these endpoints. Explicit trimmed title/author query, blank/overlong 400. No write from search/local selection; actual free provider lookup #15.
     */
    get: operations["searchBookMetadata"];
  };
  "/api/admin/members": {
    /**
     * getAdminMembers
     * @description Effective approved admin only; recheck allowlist and role on server. 401 before 403; both before lookup/payload validation. Curator alone is denied. CSRF on unsafe methods. Atomic refusal changes nothing; member/own-profile gates apply to admin outside these endpoints.
     */
    get: operations["getAdminMembers"];
    /**
     * addMember
     * @description Effective approved admin only; recheck allowlist and role on server. 401 before 403; both before lookup/payload validation. Curator alone is denied. CSRF on unsafe methods. Atomic refusal changes nothing; member/own-profile gates apply to admin outside these endpoints. Existing active/revoked Discord id 409 before invalid input 400.
     */
    post: operations["addMember"];
  };
  "/api/admin/members/{memberId}/revoke": {
    /**
     * revokeMember
     * @description Effective approved admin only; recheck allowlist and role on server. 401 before 403; both before lookup/payload validation. Curator alone is denied. CSRF on unsafe methods. Atomic refusal changes nothing; member/own-profile gates apply to admin outside these endpoints. Missing 404, signed-in admin/already revoked 409; clear curator if needed, retain contributions.
     */
    post: operations["revokeMember"];
  };
  "/api/admin/members/{memberId}/restore": {
    /**
     * restoreMember
     * @description Effective approved admin only; recheck allowlist and role on server. 401 before 403; both before lookup/payload validation. Curator alone is denied. CSRF on unsafe methods. Atomic refusal changes nothing; member/own-profile gates apply to admin outside these endpoints. Missing 404, already active 409; preserved own profile.
     */
    post: operations["restoreMember"];
  };
  "/api/admin/curator": {
    /**
     * setCurator
     * @description Effective approved admin only; recheck allowlist and role on server. 401 before 403; both before lookup/payload validation. Curator alone is denied. CSRF on unsafe methods. Atomic refusal changes nothing; member/own-profile gates apply to admin outside these endpoints. Unknown/revoked member 404, null clears; existing votes retain recorded curator; no role changes.
     */
    put: operations["setCurator"];
  };
}

export type webhooks = Record<string, never>;

export interface components {
  schemas: {
    /** @description Opaque website identifier, not necessarily UUID; never a Discord identity. */
    Id: string;
    /**
     * Format: date-time
     * @description ISO 8601 instant with offset; server clock and configured club timezone govern ordering.
     */
    Instant: string;
    /**
     * Format: date
     * @description Calendar date YYYY-MM-DD without a timezone. Approximate historical dates use this best-known date plus datesApproximate; unknown dates are null.
     */
    CalendarDate: string;
    MemberSummary: {
      id: components["schemas"]["Id"];
      displayName: string;
      avatarUrl: string | null;
    };
    CurrentUser: {
      id: components["schemas"]["Id"];
      displayName: string;
      /** @enum {string} */
      role: "admin" | "member";
      avatarUrl: string | null;
    };
    SessionAnonymous: {
      /** @constant */
      status: "anonymous";
      demoSignInAvailable: boolean;
    };
    SessionDenied: {
      /** @constant */
      status: "denied";
      demoSignInAvailable: boolean;
    };
    SessionSignedIn: {
      /** @constant */
      status: "signedIn";
      user: components["schemas"]["CurrentUser"];
    };
    /** @description Only signedIn carries a website user. Anonymous/denied carry no club information. Demo availability is false in production; no tokens, Discord IDs, secrets or passwords are exposed. Revoked sessions are refused. */
    Session: components["schemas"]["SessionAnonymous"] | components["schemas"]["SessionDenied"] | components["schemas"]["SessionSignedIn"];
    BookSummary: {
      id: components["schemas"]["Id"];
      title: string;
      authors: string[];
      coverUrl: string | null;
    };
    MeetingAssignment: {
      weekNumber: number;
      percentStart: number;
      percentEnd: number;
      pageStart: number;
      pageEnd: number;
    };
    ReadingWeek: {
      id: components["schemas"]["Id"];
      weekNumber: number;
      percentStart: number;
      percentEnd: number;
      pageStart: number;
      pageEnd: number;
      meetingStartsAt: components["schemas"]["Instant"] | null;
      completedByMe: boolean;
    };
    NextMeeting: {
      id: components["schemas"]["Id"];
      startsAt: components["schemas"]["Instant"];
      book: components["schemas"]["BookSummary"] | null;
      assignment: components["schemas"]["MeetingAssignment"] | null;
    };
    MemberProgress: {
      member: components["schemas"]["MemberSummary"];
      completed: boolean;
    };
    /** @description Spanish plain text composed server-side AFTER gates. review_available requires a canonical visible book the viewer finished AND fully rated. summary_published requires a canonical visible noncancelled meeting with an actually published summary and the existing completed-active-week or explicitly-safe-unlinked record gate. Removed linked weeks stay blocked. Omit unverifiable subject references. No hidden content or inference via labels. */
    ActivityEvent: {
      id: components["schemas"]["Id"];
      /** @enum {string} */
      type: "book_selected" | "vote_opened" | "vote_closed" | "nomination_added" | "summary_published" | "review_available";
      occurredAt: components["schemas"]["Instant"];
      text: string;
    };
    /** @description Books with terminado status and active member count are public to members. reviews counts only reviews for viewer-unlocked books (finished AND full own rating), never a hidden global total. */
    ClubStats: {
      booksCompleted: number;
      reviews: number;
      members: number;
    };
    LiteraryQuote: {
      text: string;
      author: string | null;
      source: string | null;
    };
    HomeData: {
      currentBook: components["schemas"]["BookSummary"] | null;
      currentWeek: components["schemas"]["ReadingWeek"] | null;
      nextMeeting: components["schemas"]["NextMeeting"] | null;
      memberProgress: components["schemas"]["MemberProgress"][];
      recentActivity: components["schemas"]["ActivityEvent"][];
      stats: components["schemas"]["ClubStats"];
      quote: components["schemas"]["LiteraryQuote"] | null;
    };
    /** @description Catalogue metadata only; no review/count/mean/meeting record keys. Unsorted list; client applies existing local filters/sorts. */
    LibraryBook: {
      id: components["schemas"]["Id"];
      title: string;
      authors: string[];
      coverUrl: string | null;
      /** @enum {string} */
      status: "propuesto" | "elegido" | "leyendo" | "terminado" | "archivado";
      readingStartDate: components["schemas"]["CalendarDate"] | null;
      readingEndDate: components["schemas"]["CalendarDate"] | null;
      datesApproximate: boolean;
    };
    ScheduleMeeting: {
      id: components["schemas"]["Id"];
      startsAt: components["schemas"]["Instant"];
    };
    ScheduleWeek: {
      id: components["schemas"]["Id"];
      completedByMe: boolean;
      weekNumber: number;
      percentStart: number;
      percentEnd: number;
      pageStart: number;
      pageEnd: number;
      dueDate: components["schemas"]["CalendarDate"] | null;
      meeting: components["schemas"]["ScheduleMeeting"] | null;
      notes: string | null;
    };
    BookMeeting: {
      id: components["schemas"]["Id"];
      startsAt: components["schemas"]["Instant"];
      cancelled: boolean;
      weekNumber: number | null;
    };
    OriginVote: {
      id: components["schemas"]["Id"];
      label: string;
    };
    /** @description publicationDate is free text, e.g. 1884–1885, not forced to ISO date. Schedule by weekNumber; meetings ascending startsAt. No ratings or substantive meeting records. */
    BookDetail: {
      id: components["schemas"]["Id"];
      title: string;
      authors: string[];
      coverUrl: string | null;
      /** @enum {string} */
      status: "propuesto" | "elegido" | "leyendo" | "terminado" | "archivado";
      readingStartDate: components["schemas"]["CalendarDate"] | null;
      readingEndDate: components["schemas"]["CalendarDate"] | null;
      datesApproximate: boolean;
      plannedStartDate: components["schemas"]["CalendarDate"] | null;
      plannedEndDate: components["schemas"]["CalendarDate"] | null;
      description: string | null;
      publicationDate: string | null;
      publisher: string | null;
      isbn: string | null;
      pageCount: number | null;
      schedule: components["schemas"]["ScheduleWeek"][];
      meetings: components["schemas"]["BookMeeting"][];
      originVote: components["schemas"]["OriginVote"] | null;
    };
    MeetingListItem: {
      id: components["schemas"]["Id"];
      startsAt: components["schemas"]["Instant"];
      cancelled: boolean;
      book: components["schemas"]["BookSummary"] | null;
      assignment: components["schemas"]["MeetingAssignment"] | null;
    };
    /** @description Server partitions at startsAt >= now: upcoming soonest first, past newest first. Cancelled entries stay in date partition. No pagination or substantive records. */
    MeetingList: {
      upcoming: components["schemas"]["MeetingListItem"][];
      past: components["schemas"]["MeetingListItem"][];
    };
    MeetingHighlight: {
      id: components["schemas"]["Id"];
      text: string;
      /** @enum {string} */
      kind: "quote" | "paraphrase";
      speakers: components["schemas"]["MemberSummary"][];
    };
    MeetingRecordVisible: {
      /** @constant */
      status: "visible";
      summary: string | null;
      highlights: components["schemas"]["MeetingHighlight"][];
    };
    MeetingRecordLockedWeekNotRead: {
      /** @constant */
      status: "lockedWeekNotRead";
      weekNumber: number;
    };
    MeetingRecordLockedNoWeek: {
      /** @constant */
      status: "lockedNoWeek";
    };
    /** @description Central server gate for admin and member views: completed linked active week OR explicitly safe unlinked record. Cancelled meeting or removed linked week always lockedNoWeek, even when previously safe/completed. Visible returns published summary/highlights only; drafts and deleted highlights absent. Locked records reveal no existence/count/content of records. */
    MeetingRecord: components["schemas"]["MeetingRecordVisible"] | components["schemas"]["MeetingRecordLockedWeekNotRead"] | components["schemas"]["MeetingRecordLockedNoWeek"];
    /** @description Attendance null when upcoming/cancelled or not recorded; otherwise list (possibly empty). */
    MeetingDetail: {
      id: components["schemas"]["Id"];
      startsAt: components["schemas"]["Instant"];
      cancelled: boolean;
      book: components["schemas"]["BookSummary"] | null;
      assignment: components["schemas"]["MeetingAssignment"] | null;
      upcoming: boolean;
      attendance: components["schemas"]["MemberSummary"][] | null;
      record: components["schemas"]["MeetingRecord"];
    };
    VoteCandidateBook: {
      id: components["schemas"]["Id"];
      title: string;
      authors: string[];
      coverUrl: string | null;
      publicationDate: string | null;
      pageCount: number | null;
    };
    /** @description Public approvals; one per candidate/member, empty and approvedByMe false in draft. */
    VoteCandidate: {
      book: components["schemas"]["VoteCandidateBook"];
      approvals: components["schemas"]["MemberSummary"][];
      approvedByMe: boolean;
    };
    VoteOutcomeWinner: {
      /** @constant */
      status: "winner";
      winner: components["schemas"]["BookSummary"];
      tieNote: string | null;
    };
    VoteOutcomeTiePending: {
      /** @constant */
      status: "tiePending";
      tiedBookIds: components["schemas"]["Id"][];
    };
    /** @description Server chooses strictly highest approvals at close, otherwise every tied highest candidate (including zero) remains pending. Only admin records manual tie winner; never automatically changes book status, origin vote or curator. */
    VoteOutcome: components["schemas"]["VoteOutcomeWinner"] | components["schemas"]["VoteOutcomeTiePending"];
    /** @description Candidates remain in shortlist order. At most one draft/open. Draft has null openedAt/closedAt/outcome; open has openedAt but null closedAt/outcome; closed has both instants and outcome. Flags computed by server; management current curator/admin, tie winner admin only. No automatic role or lifecycle changes. */
    Vote: {
      id: components["schemas"]["Id"];
      /** @enum {string} */
      status: "draft" | "open" | "closed";
      curator: components["schemas"]["MemberSummary"];
      openedAt: components["schemas"]["Instant"] | null;
      closedAt: components["schemas"]["Instant"] | null;
      candidates: components["schemas"]["VoteCandidate"][];
      outcome: components["schemas"]["VoteOutcome"] | null;
      canManage: boolean;
      canRecordTieWinner: boolean;
      curatedByMe: boolean;
    };
    VoteHistoryItem: {
      id: components["schemas"]["Id"];
      curator: components["schemas"]["MemberSummary"];
      openedAt: components["schemas"]["Instant"];
      closedAt: components["schemas"]["Instant"];
      outcome: components["schemas"]["VoteOutcome"];
      candidateCount: number;
    };
    /** @description History newest closedAt first, including pending ties. Current null without draft/open; may create only current curator/admin with curator assigned and no draft/open. */
    VotesOverview: {
      curator: components["schemas"]["MemberSummary"] | null;
      current: components["schemas"]["Vote"] | null;
      history: components["schemas"]["VoteHistoryItem"][];
      canCreateVote: boolean;
    };
    /** @description Exactly five scores, 1..5 in half-star steps. Disfrute/Estilo/Personajes/Trama/Huella Spanish labels use these lowercase code keys. */
    CriterionScores: {
      disfrute: number;
      estilo: number;
      personajes: number;
      trama: number;
      huella: number;
    };
    /** @description Unrounded means, not constrained to half-star steps. */
    CriterionMeans: {
      disfrute: number;
      estilo: number;
      personajes: number;
      trama: number;
      huella: number;
    };
    /** @description Mean absolute differences 0..4, not star scores or half-star constrained. */
    CriterionDifferences: {
      disfrute: number;
      estilo: number;
      personajes: number;
      trama: number;
      huella: number;
    };
    /** @description Own review always returned. Overall unweighted mean of five scores; edit retains submittedAt. */
    MyReview: {
      scores: components["schemas"]["CriterionScores"];
      overall: number;
      text: string | null;
      submittedAt: components["schemas"]["Instant"];
      editedAt: components["schemas"]["Instant"] | null;
    };
    ClubReview: {
      member: components["schemas"]["MemberSummary"];
      scores: components["schemas"]["CriterionScores"];
      overall: number;
      text: string | null;
      isMine: boolean;
    };
    ClubRatingsLocked: {
      /** @constant */
      status: "locked";
    };
    ClubRatingsVisible: {
      /** @constant */
      status: "visible";
      reviewCount: number;
      overallMean: number;
      criterionMeans: components["schemas"]["CriterionMeans"];
      reviews: components["schemas"]["ClubReview"][];
    };
    /** @description Viewer finished AND submitted all five scores before ANY other rating/count/aggregate is returned. Same gate for historical books and admin member views. Own review first, others by Spanish display name, never score. Mean of member overall means equally weighted; reviewCount denominator explicit. */
    ClubRatings: components["schemas"]["ClubRatingsLocked"] | components["schemas"]["ClubRatingsVisible"];
    /** @description Only leyendo/terminado/archivado official books ratable. finishedByMe independent of all weekly completions. */
    BookRatings: {
      book: components["schemas"]["BookSummary"];
      ratable: boolean;
      finishedByMe: boolean;
      myReview: components["schemas"]["MyReview"] | null;
      club: components["schemas"]["ClubRatings"];
    };
    RubricAnchors: {
      1: string | null;
      2: string | null;
      3: string | null;
      4: string | null;
      5: string | null;
    };
    /** @description Admin-written anchors can all be null; no invented canonical prose. */
    RatingRubric: {
      disfrute: components["schemas"]["RubricAnchors"];
      estilo: components["schemas"]["RubricAnchors"];
      personajes: components["schemas"]["RubricAnchors"];
      trama: components["schemas"]["RubricAnchors"];
      huella: components["schemas"]["RubricAnchors"];
    };
    ReviewInput: {
      scores: components["schemas"]["CriterionScores"];
      text?: string | null;
    };
    StatisticsThresholds: {
      bookRatings: number;
      memberRatings: number;
    };
    /** @description Population standard deviation of overall scores; 0 with one review. Not rounded. */
    BookStatistics: {
      book: components["schemas"]["BookSummary"];
      reviewCount: number;
      overallMean: number;
      dispersion: number;
    };
    MemberStatistics: {
      member: components["schemas"]["MemberSummary"];
      isMe: boolean;
      reviewCount: number;
      overallMean: number;
    };
    /** @description Threshold 3 counted ratings per book/member. Empty below threshold; include all ties sorted Spanish title/name. */
    StatisticsHighlights: {
      topRated: components["schemas"]["BookStatistics"][];
      lowestRated: components["schemas"]["BookStatistics"][];
      mostDivisive: components["schemas"]["BookStatistics"][];
      mostGenerous: components["schemas"]["MemberStatistics"][];
      harshest: components["schemas"]["MemberStatistics"][];
    };
    RatingStatisticsEmpty: {
      /** @constant */
      status: "empty";
    };
    RatingStatisticsAvailable: {
      /** @constant */
      status: "available";
      bookCount: number;
      reviewCount: number;
      overallMean: number;
      criterionMeans: components["schemas"]["CriterionMeans"];
      books: components["schemas"]["BookStatistics"][];
      members: components["schemas"]["MemberStatistics"][];
      highlights: components["schemas"]["StatisticsHighlights"];
    };
    /** @description Only viewer-unlocked books before any aggregation; no hidden book/count/candidate inference. Each counted review equally weighted. Books highest mean first then Spanish title; viewer first then display name. Empty branch contains only status. */
    RatingStatistics: components["schemas"]["RatingStatisticsEmpty"] | components["schemas"]["RatingStatisticsAvailable"];
    /** @description Public catalogue counts terminado/archivado; meetingsHeld noncancelled before server now. Rating totals/radars/highlights gated independently. */
    Statistics: {
      booksRead: number;
      meetingsHeld: number;
      thresholds: components["schemas"]["StatisticsThresholds"];
      ratings: components["schemas"]["RatingStatistics"];
    };
    SharedBook: {
      book: components["schemas"]["BookSummary"];
      myOverall: number;
      theirOverall: number;
      difference: number;
    };
    TasteComparisonInsufficient: {
      /** @constant */
      status: "insufficient";
    };
    TasteComparisonAvailable: {
      /** @constant */
      status: "available";
      overallDifference: number;
      criterionDifferences: components["schemas"]["CriterionDifferences"];
      books: components["schemas"]["SharedBook"][];
    };
    /** @description Only shared books viewer finished/rated AND other member rated. At least minSharedBooks (currently 3) before differences/book metadata; insufficient carries status only. Difference unrounded mean absolute overall/criterion difference, 0..4. Books Spanish title order. */
    TasteComparison: components["schemas"]["TasteComparisonInsufficient"] | components["schemas"]["TasteComparisonAvailable"];
    /** @description Count only permitted shared books, never hidden overlap. Insufficient retains this explicit count but no books/scores. */
    MemberCompatibility: {
      member: components["schemas"]["MemberSummary"];
      sharedBookCount: number;
      comparison: components["schemas"]["TasteComparison"];
    };
    /** @description Every other active member by Spanish display name, never difference; viewer omitted. Empty club members list valid. */
    TasteCompatibility: {
      minSharedBooks: number;
      members: components["schemas"]["MemberCompatibility"][];
    };
    MemberDirectoryEntry: {
      member: components["schemas"]["MemberSummary"];
      isMe: boolean;
      completedCurrentWeek: boolean | null;
    };
    /** @description Active members only incl viewer by Spanish name. Public progress null exactly with no current week; no ratings/taste/Discord IDs. */
    MemberDirectory: {
      currentWeekNumber: number | null;
      members: components["schemas"]["MemberDirectoryEntry"][];
    };
    MemberWeekStatus: {
      weekNumber: number;
      completed: boolean;
    };
    /** @description Website-native profile/public reading progress only. Favourite books are intentional public choices, metadata summaries without ratings. Revoked/unknown profile same generic 404. */
    MemberProfile: {
      member: components["schemas"]["MemberSummary"];
      bio: string | null;
      favouriteQuote: string | null;
      favouriteBooks: components["schemas"]["BookSummary"][];
      isMe: boolean;
      currentWeek: components["schemas"]["MemberWeekStatus"] | null;
    };
    /** @description Allowed favourites: terminado/archivado visible catalogue books, Spanish title order; selected books in chosen order. */
    MyProfile: {
      member: components["schemas"]["MemberSummary"];
      bio: string | null;
      favouriteQuote: string | null;
      favouriteBooks: components["schemas"]["BookSummary"][];
      favouriteOptions: components["schemas"]["BookSummary"][];
    };
    /** @description JSON metadata multipart part. Optional text missing/null/trimmed blank becomes null. Max lengths AFTER trim, server obligation. Favourites ordered distinct allowed IDs; reject whole transaction for any invalid value. Smuggled ownership keys 403, never used for ownership. */
    ProfileMetadata: {
      /** @description Trim, then 1..40 chars single line. Reject control characters incl U+2028/U+2029. */
      displayName: string;
      bio?: string | null;
      favouriteQuote?: string | null;
      favouriteBookIds: components["schemas"]["Id"][];
      /** @enum {string} */
      avatarAction: "keep" | "remove" | "replace";
    };
    /** @description Multipart adapter: metadata application/json part; avatar binary image part for replace. Browser File/AvatarChange never JSON objects. */
    ProfileMultipart: WithRequired<{
      metadata: components["schemas"]["ProfileMetadata"];
      /**
       * Format: binary
       * @description JPEG/PNG/WebP bytes, >0 and <=2097152 bytes; required ONLY for replace. Server sniffs/validates content before atomic save.
       */
      avatar?: Blob;
    }, "metadata">;
    /** @description Only own review, latest max(submittedAt, editedAt) first then Spanish title, no club totals. Removed books omitted. */
    MyReviewEntry: {
      book: components["schemas"]["BookSummary"];
      scores: components["schemas"]["CriterionScores"];
      overall: number;
      text: string | null;
      submittedAt: components["schemas"]["Instant"];
      editedAt: components["schemas"]["Instant"] | null;
    };
    WeekCompletionInput: {
      completed: boolean;
    };
    ApprovalInput: {
      approved: boolean;
    };
    FinishedInput: {
      finished: boolean;
    };
    CandidateInput: {
      bookId: components["schemas"]["Id"];
    };
    /** @description Exactly current candidates in requested order; known but stale/different set 409, unknown book 404. */
    CandidateOrderInput: {
      bookIds: components["schemas"]["Id"][];
    };
    /** @description Note trimmed before limit; blank becomes null; tied candidate only, admin only. */
    TieWinnerInput: {
      bookId: components["schemas"]["Id"];
      note: string;
    };
    /** @description Central JSON error; Spanish safe plain text, no request echo/private payload. Local ApiError(status,message) adapter deferred #103. */
    Error: {
      /** @enum {string} */
      code: "invalid_input" | "unauthenticated" | "forbidden" | "not_found" | "conflict" | "reauthentication_required" | "internal_error" | "service_unavailable";
      message: string;
    };
    /** @description Explicit catalogue metadata only; no schedule, ratings, review counts or substantive meeting records. Stable id and originVote are server-owned. Only one retained active book may be leyendo (409). Dates/status never change automatically. */
    AdminBook: {
      id: components["schemas"]["Id"];
      title: string;
      authors: string[];
      coverUrl: string | null;
      /** @enum {string} */
      status: "propuesto" | "elegido" | "leyendo" | "terminado" | "archivado";
      readingStartDate: components["schemas"]["CalendarDate"] | null;
      readingEndDate: components["schemas"]["CalendarDate"] | null;
      datesApproximate: boolean;
      plannedStartDate: components["schemas"]["CalendarDate"] | null;
      plannedEndDate: components["schemas"]["CalendarDate"] | null;
      description: string | null;
      publicationDate: string | null;
      publisher: string | null;
      isbn: string | null;
      pageCount: number | null;
      originVote: components["schemas"]["OriginVote"] | null;
    };
    /** @description Trim first; optional blank text becomes null, omit blank author lines. Validate each planned/actual date pair independently, reject year 0000/end before own start. No required dates or forced date agreement. metadataResultId required only for metadata cover action, server checks known search result; no arbitrary cover URLs accepted. */
    BookMetadataInput: WithRequired<{
      title: string;
      authors: string[];
      /** @enum {string} */
      status: "propuesto" | "elegido" | "leyendo" | "terminado" | "archivado";
      readingStartDate: components["schemas"]["CalendarDate"] | null;
      readingEndDate: components["schemas"]["CalendarDate"] | null;
      datesApproximate: boolean;
      plannedStartDate: components["schemas"]["CalendarDate"] | null;
      plannedEndDate: components["schemas"]["CalendarDate"] | null;
      description: string | null;
      publicationDate: string | null;
      publisher: string | null;
      isbn: string | null;
      pageCount: number | null;
      /** @enum {string} */
      coverAction: "keep" | "remove" | "replace" | "metadata";
      metadataResultId?: components["schemas"]["Id"];
    }, "title" | "authors" | "status" | "readingStartDate" | "readingEndDate" | "datesApproximate" | "plannedStartDate" | "plannedEndDate" | "description" | "publicationDate" | "publisher" | "isbn" | "pageCount" | "coverAction">;
    /** @description Atomic metadata/cover transaction: JSON metadata part, optional binary cover. Sniff content; nonempty JPEG/PNG/WebP <=2097152 bytes inclusive. No File/blob/data URL JSON. Validate before any change. */
    BookMultipart: WithRequired<{
      metadata: components["schemas"]["BookMetadataInput"];
      /** Format: binary */
      cover?: Blob;
    }, "metadata">;
    /** @description Search result id is the sole imported-cover reference; local selection fills blank fields only, not a server write. Real external lookup belongs to #15. */
    BookMetadataResult: {
      id: components["schemas"]["Id"];
      title: string;
      authors: string[];
      description: string | null;
      publicationDate: string | null;
      publisher: string | null;
      isbn: string | null;
      pageCount: number | null;
      coverUrl: string | null;
    };
    /** @description Trim both fields. Name is one line without controls/Unicode separators. Approve with member role and empty profile; no role input. Duplicate Discord id active/revoked is 409. */
    NewMember: {
      discordId: string;
      displayName: string;
    };
    AdminMember: {
      member: components["schemas"]["MemberSummary"];
      discordId: string;
      /** @enum {string} */
      role: "member" | "admin";
      /** @enum {string} */
      status: "active" | "revoked";
      addedAt: components["schemas"]["Instant"];
      revokedAt: components["schemas"]["Instant"] | null;
      isMe: boolean;
      isCurator: boolean;
    };
    /** @description Allowlist alone includes Discord identities/access status. Active first, then revoked, Spanish name order. No profile prose/ratings. Revoking curator clears assignment, preserves contributions; never change role. */
    AdminMembers: {
      members: components["schemas"]["AdminMember"][];
      curator: components["schemas"]["MemberSummary"] | null;
    };
    CuratorInput: {
      memberId: components["schemas"]["Id"] | null;
    };
    /** @description Week must be active and belong to selected book; canonical one-to-one week.meetingId reservation, occupied week 409. No range/due-date/status mutation. Instants require offset; reject ambiguous/gap local time rather than select silently. */
    MeetingInput: {
      startsAt: components["schemas"]["Instant"];
      bookId: components["schemas"]["Id"] | null;
      weekId: components["schemas"]["Id"] | null;
    };
    /** @description Operational calendar only. Removed link retained read-only until deliberate unlink/relink. Admin editor may retain historical attendance; member views suppress future/cancelled attendance. null is unrecorded, [] is explicitly empty; no erase-to-null action. */
    AdminMeeting: {
      startsAt: components["schemas"]["Instant"];
      bookId: components["schemas"]["Id"] | null;
      weekId: components["schemas"]["Id"] | null;
      id: components["schemas"]["Id"];
      cancelled: boolean;
      upcoming: boolean;
      attendance: components["schemas"]["MemberSummary"][] | null;
      attendanceEligible: boolean;
      removedWeekNumber?: number;
    };
    /** @description Upcoming earliest first/past newest first by server time; cancellation does not change partition. Choices omit removed books/weeks and revoked members. No summary/highlight/rating content. */
    AdminMeetingCalendar: {
      upcoming: components["schemas"]["AdminMeeting"][];
      past: components["schemas"]["AdminMeeting"][];
      books: {
          id: components["schemas"]["Id"];
          title: string;
        }[];
      weeks: ({
          id: components["schemas"]["Id"];
          bookId: components["schemas"]["Id"];
          weekNumber: number;
          meetingId: components["schemas"]["Id"] | null;
        })[];
      activeMembers: components["schemas"]["MemberSummary"][];
    };
    CancelledInput: {
      cancelled: boolean;
    };
    /** @description Only noncancelled meetings strictly before server now (otherwise 409). Replace active selections; preserve recorded revoked attendance ids. New revoked/unknown choices 400. Distinct ids required; [] records empty attendance, null invalid. */
    AttendanceInput: {
      memberIds: components["schemas"]["Id"][];
    };
    /** @description Independent manual percentages/pages; decimals and >100 percentages allowed. No silent conversion. Due date preserved under links; finite numbers, positive safe-integer pages. Notes trim to null. Same-book one-to-one retained links checked atomically. */
    ReadingWeekInput: {
      percentStart: number;
      percentEnd: number;
      pageStart: number;
      pageEnd: number;
      dueDate: components["schemas"]["CalendarDate"] | null;
      notes: string | null;
      meetingId: components["schemas"]["Id"] | null;
    };
    /** @description Server recomputes warnings against the proposed complete plan on every write; acknowledgement applies only to submitted inputs. Required explicit true when warnings exist; false yields 400 without mutation. Client resets after any edit. */
    ReadingWeekWrite: {
      input: components["schemas"]["ReadingWeekInput"];
      acknowledged: boolean;
    };
    /** @description Exact permutation of active ids once each; no missing/unknown/duplicate/foreign ids. Nonexact order 400, unknown/foreign active ids 400 (missing parent 404); preserves stable ids and removed highlight slots. */
    IdOrder: {
      ids: components["schemas"]["Id"][];
    };
    /** @description Exact active-week permutation; dates never sort weeks. Recompute full-plan advisory warnings and require explicit acknowledgement, otherwise 400. No pages/percent conversion. */
    ReadingWeekOrder: {
      ids: components["schemas"]["Id"][];
      acknowledged: boolean;
    };
    AdminReadingWeek: {
      percentStart: number;
      percentEnd: number;
      pageStart: number;
      pageEnd: number;
      dueDate: components["schemas"]["CalendarDate"] | null;
      notes: string | null;
      meetingId: components["schemas"]["Id"] | null;
      id: components["schemas"]["Id"];
      weekNumber: number;
      completionCount: number;
      removedMeeting?: boolean;
    };
    /** @description Active weeks contiguous 1..N canonical order; distinct completions include revoked history. Removed meeting link read-only until explicit release. Meeting choices operational only. */
    AdminReadingPlan: {
      book: {
        id: components["schemas"]["Id"];
        title: string;
        pageCount: number | null;
      };
      weeks: components["schemas"]["AdminReadingWeek"][];
      meetings: {
          id: components["schemas"]["Id"];
          startsAt: components["schemas"]["Instant"];
          cancelled: boolean;
        }[];
    };
    /** @description Trim plain text; blank unpublished becomes null summary. Published requires nonblank text. Summary publication is independent of every highlight. */
    MeetingSummaryInput: WithRequired<{
      text: string;
      published: boolean;
    }, "text" | "published">;
    /** @description Trim nonblank plain text; literal line breaks/markup. New speakers must be active; existing revoked attribution may remain unchanged or be removed; no invented attribution. Each publication flag independent. */
    MeetingHighlightInput: {
      text: string;
      published: boolean;
      /** @enum {string} */
      kind: "quote" | "paraphrase";
      speakerIds: components["schemas"]["Id"][];
    };
    AdminMeetingHighlight: {
      text: string;
      published: boolean;
      /** @enum {string} */
      kind: "quote" | "paraphrase";
      speakerIds: components["schemas"]["Id"][];
      id: components["schemas"]["Id"];
      speakers: components["schemas"]["MemberSummary"][];
    };
    /** @description Editor-only drafts; active highlights in canonical order, speaker choices active only but retained attribution may be revoked. Safe marking rejects BOTH states if ANY retained active/removed week links meeting (409); cancellation/removed week always suppresses member content even for admin. */
    AdminMeetingRecord: {
      id: components["schemas"]["Id"];
      startsAt: components["schemas"]["Instant"];
      cancelled: boolean;
      book: components["schemas"]["BookSummary"] | null;
      week: {
        id: components["schemas"]["Id"];
        weekNumber: number;
        removed: boolean;
      } | null;
      markedSafe: boolean;
      summary: components["schemas"]["MeetingSummaryInput"] | null;
      highlights: components["schemas"]["AdminMeetingHighlight"][];
      speakerOptions: components["schemas"]["MemberSummary"][];
    };
    SafeInput: {
      safe: boolean;
    };
    /** @description Trim nonblank text; optional blank author/source becomes null. Duplicate key collapses whitespace and Spanish lowercase across active/inactive/recoverable quotes excluding edited id (409). Stable ids/insertion order; no rights-verification claim. */
    LiteraryQuoteInput: {
      text: string;
      author: string | null;
      source: string | null;
      active: boolean;
    };
    AdminLiteraryQuote: {
      id: components["schemas"]["Id"];
      text: string;
      author: string | null;
      source: string | null;
      active: boolean;
    };
    /** @description Whole atomic replacement; exactly five criteria and exactly 1..5 whole-star anchors; nullable trimmed text <=500, blank normalizes null. No sixth criterion/half anchor. No invented default prose. */
    RatingRubricInput: {
      disfrute: {
        1: string | null;
        2: string | null;
        3: string | null;
        4: string | null;
        5: string | null;
      };
      estilo: {
        1: string | null;
        2: string | null;
        3: string | null;
        4: string | null;
        5: string | null;
      };
      personajes: {
        1: string | null;
        2: string | null;
        3: string | null;
        4: string | null;
        5: string | null;
      };
      trama: {
        1: string | null;
        2: string | null;
        3: string | null;
        4: string | null;
        5: string | null;
      };
      huella: {
        1: string | null;
        2: string | null;
        3: string | null;
        4: string | null;
        5: string | null;
      };
    };
    /** @enum {string} */
    DeletedType: "book" | "meeting" | "quote" | "week" | "highlight";
    /** @description Safe operational label and dependency descriptions/counts only; no deleted text, profiles, review/rating, media or Discord fields. Deadline exactly 30 days; expired at server now >= purgeDueAt; expired remains listed until explicit purge. */
    BinBook: {
      /** @constant */
      type: "book";
      id: components["schemas"]["Id"];
      label: string;
      deletedAt: components["schemas"]["Instant"];
      deletedByName: string;
      purgeDueAt: components["schemas"]["Instant"];
      expired: boolean;
      dependencies: string[];
    };
    /** @description Safe operational label and dependency descriptions/counts only; no deleted text, profiles, review/rating, media or Discord fields. Deadline exactly 30 days; expired at server now >= purgeDueAt; expired remains listed until explicit purge. */
    BinMeeting: {
      /** @constant */
      type: "meeting";
      id: components["schemas"]["Id"];
      label: string;
      deletedAt: components["schemas"]["Instant"];
      deletedByName: string;
      purgeDueAt: components["schemas"]["Instant"];
      expired: boolean;
      dependencies: string[];
    };
    /** @description Safe operational label and dependency descriptions/counts only; no deleted text, profiles, review/rating, media or Discord fields. Deadline exactly 30 days; expired at server now >= purgeDueAt; expired remains listed until explicit purge. */
    BinQuote: {
      /** @constant */
      type: "quote";
      id: components["schemas"]["Id"];
      label: string;
      deletedAt: components["schemas"]["Instant"];
      deletedByName: string;
      purgeDueAt: components["schemas"]["Instant"];
      expired: boolean;
      dependencies: string[];
    };
    /** @description Safe operational label and dependency descriptions/counts only; no deleted text, profiles, review/rating, media or Discord fields. Deadline exactly 30 days; expired at server now >= purgeDueAt; expired remains listed until explicit purge. */
    BinWeek: {
      /** @constant */
      type: "week";
      id: components["schemas"]["Id"];
      label: string;
      deletedAt: components["schemas"]["Instant"];
      deletedByName: string;
      purgeDueAt: components["schemas"]["Instant"];
      expired: boolean;
      dependencies: string[];
    };
    /** @description Safe operational label and dependency descriptions/counts only; no deleted text, profiles, review/rating, media or Discord fields. Deadline exactly 30 days; expired at server now >= purgeDueAt; expired remains listed until explicit purge. */
    BinHighlight: {
      /** @constant */
      type: "highlight";
      id: components["schemas"]["Id"];
      label: string;
      deletedAt: components["schemas"]["Instant"];
      deletedByName: string;
      purgeDueAt: components["schemas"]["Instant"];
      expired: boolean;
      dependencies: string[];
    };
    RecycleBinEntry: components["schemas"]["BinBook"] | components["schemas"]["BinMeeting"] | components["schemas"]["BinQuote"] | components["schemas"]["BinWeek"] | components["schemas"]["BinHighlight"];
    /** @description Book title/meeting date may identify target; quote/highlight labels generic Spanish, never substantive text. Dependencies safe counts/descriptions only, not ids or payload. Preview is not permission to cascade destruction. */
    DeletionPreview: {
      label: string;
      dependencies: string[];
    };
    /** @description Policy pending #48; no invented cadence/storage/rotation/retention. Nullable last successful timestamp; demo supplied timestamp is simulated. */
    BackupInfo: {
      /** @constant */
      policy: "pending";
      lastBackupAt: components["schemas"]["Instant"] | null;
    };
    /** @description Whitelist id/action, target type/id/safe immutable label, actor id/displayName, occurredAt only. Newest instant then descending event-id ties. Generic quote/highlight labels. No raw payload/prose/ratings/profiles/Discord/tokens/media. Only successful critical transitions, no reads/noops/refusals. Persistent audit #50. */
    AuditEvent: {
      id: components["schemas"]["Id"];
      /** @enum {string} */
      action: "member_approved" | "member_revoked" | "member_restored" | "curator_assigned" | "curator_cleared" | "book_status_changed" | "summary_published" | "summary_unpublished" | "highlight_published" | "highlight_unpublished" | "soft_deleted" | "restored" | "purged" | "vote_closed" | "tie_resolved" | "exported";
      target: {
        /** @enum {string} */
        type: "member" | "curator" | "book" | "meeting" | "summary" | "highlight" | "week" | "quote" | "vote" | "club";
        id: components["schemas"]["Id"];
        label: string;
      };
      actor: {
        id: components["schemas"]["Id"];
        displayName: string;
      };
      occurredAt: components["schemas"]["Instant"];
    };
    /** @description 409 without data/download or session expiry; Spanish safe message. Five-minute server-verified same-admin freshness, not confirmation/boolean. */
    ReauthenticationError: {
      /** @constant */
      code: "reauthentication_required";
      message: string;
    };
    ExportDeletion: {
      deletedAt: components["schemas"]["Instant"];
      deletedBy: components["schemas"]["Id"];
      purgeDueAt: components["schemas"]["Instant"];
    };
    ExportMember: {
      id: components["schemas"]["Id"];
      displayName: string;
      /** @enum {string} */
      role: "member" | "admin";
      /** @enum {string} */
      status: "active" | "revoked";
      avatarMediaId: components["schemas"]["Id"] | null;
    };
    ExportAllowlist: {
      memberId: components["schemas"]["Id"];
      discordId: string;
      addedAt: components["schemas"]["Instant"];
      revokedAt: components["schemas"]["Instant"] | null;
    };
    ExportProfile: {
      memberId: components["schemas"]["Id"];
      bio: string | null;
      favouriteQuote: string | null;
      favouriteBookIds: components["schemas"]["Id"][];
    };
    ExportBook: {
      id: components["schemas"]["Id"];
      title: string;
      authors: string[];
      /** @enum {string} */
      status: "propuesto" | "elegido" | "leyendo" | "terminado" | "archivado";
      readingStartDate: components["schemas"]["CalendarDate"] | null;
      readingEndDate: components["schemas"]["CalendarDate"] | null;
      datesApproximate: boolean;
      plannedStartDate: components["schemas"]["CalendarDate"] | null;
      plannedEndDate: components["schemas"]["CalendarDate"] | null;
      description: string | null;
      publicationDate: string | null;
      publisher: string | null;
      isbn: string | null;
      pageCount: number | null;
      originVote: components["schemas"]["OriginVote"] | null;
      coverMediaId: components["schemas"]["Id"] | null;
      deletion: components["schemas"]["ExportDeletion"] | null;
    };
    ExportWeek: {
      id: components["schemas"]["Id"];
      bookId: components["schemas"]["Id"];
      weekNumber: number;
      percentStart: number;
      percentEnd: number;
      pageStart: number;
      pageEnd: number;
      dueDate: components["schemas"]["CalendarDate"] | null;
      notes: string | null;
      meetingId: components["schemas"]["Id"] | null;
      deletion: components["schemas"]["ExportDeletion"] | null;
    };
    ExportHighlight: {
      id: components["schemas"]["Id"];
      text: string;
      published: boolean;
      /** @enum {string} */
      kind: "quote" | "paraphrase";
      speakerIds: components["schemas"]["Id"][];
      removedPosition: number | null;
      deletion: components["schemas"]["ExportDeletion"] | null;
    };
    ExportMeeting: {
      id: components["schemas"]["Id"];
      bookId: components["schemas"]["Id"] | null;
      startsAt: components["schemas"]["Instant"];
      cancelled: boolean;
      attendance: components["schemas"]["Id"][] | null;
      markedSafe: boolean;
      summary: components["schemas"]["MeetingSummaryInput"] | null;
      highlights: components["schemas"]["ExportHighlight"][];
      deletion: components["schemas"]["ExportDeletion"] | null;
    };
    ExportCompletions: {
      weekId: components["schemas"]["Id"];
      memberIds: components["schemas"]["Id"][];
    };
    ExportFinished: {
      bookId: components["schemas"]["Id"];
      memberIds: components["schemas"]["Id"][];
    };
    ExportReview: {
      bookId: components["schemas"]["Id"];
      userId: components["schemas"]["Id"];
      scores: components["schemas"]["CriterionScores"];
      text: string | null;
      submittedAt: components["schemas"]["Instant"];
      editedAt: components["schemas"]["Instant"] | null;
    };
    ExportVote: {
      id: components["schemas"]["Id"];
      /** @enum {string} */
      status: "draft" | "open" | "closed";
      curatorId: components["schemas"]["Id"];
      openedAt: components["schemas"]["Instant"] | null;
      closedAt: components["schemas"]["Instant"] | null;
      candidates: {
          bookId: components["schemas"]["Id"];
          approverIds: components["schemas"]["Id"][];
        }[];
      outcome: (OneOf<[{
        winnerBookId: components["schemas"]["Id"];
        tieNote: string | null;
      }, {
        tiedBookIds: components["schemas"]["Id"][];
      }]>) | null;
    };
    ExportQuote: {
      id: components["schemas"]["Id"];
      text: string;
      author: string | null;
      source: string | null;
      active: boolean;
      deletion: components["schemas"]["ExportDeletion"] | null;
    };
    ExportTombstone: {
      type: components["schemas"]["DeletedType"];
      id: components["schemas"]["Id"];
      purgedAt: components["schemas"]["Instant"];
      purgedBy: components["schemas"]["Id"];
    };
    /** @description Manifest stable media id referenced by avatarMediaId/coverMediaId. Available bytes in ZIP under safe relative path; unavailable has path null, no external URL fetch/data URL. No path traversal or credentials. */
    ExportMedia: WithRequired<{
      id: components["schemas"]["Id"];
      path: string | null;
      /** @enum {string} */
      contentType: "image/jpeg" | "image/png" | "image/webp";
      available: boolean;
    }, "id" | "path" | "contentType" | "available">;
    /** @description Privileged versioned UTF-8 club.json inside ZIP, not HTTP JSON. Includes private reviews, drafts, revoked/recoverable records and safe audit; excludes sessions/OAuth credentials/secrets/purged substantive data. Canonical ids/links preserved, deletion separate nullable metadata; minimal tombstones auditable. No restoration/import guarantee. */
    ClubBusinessExport: {
      /** @constant */
      schemaVersion: 1;
      createdAt: components["schemas"]["Instant"];
      curatorId: components["schemas"]["Id"] | null;
      media: components["schemas"]["ExportMedia"][];
      members: components["schemas"]["ExportMember"][];
      allowlist: components["schemas"]["ExportAllowlist"][];
      profiles: components["schemas"]["ExportProfile"][];
      books: components["schemas"]["ExportBook"][];
      weeks: components["schemas"]["ExportWeek"][];
      meetings: components["schemas"]["ExportMeeting"][];
      completions: components["schemas"]["ExportCompletions"][];
      finished: components["schemas"]["ExportFinished"][];
      reviews: components["schemas"]["ExportReview"][];
      votes: components["schemas"]["ExportVote"][];
      quotes: components["schemas"]["ExportQuote"][];
      tombstones: components["schemas"]["ExportTombstone"][];
      audit: components["schemas"]["AuditEvent"][];
      rubric: components["schemas"]["RatingRubric"];
    };
    /** @description UTF-8 manifest.json; media list matches club.json media. Missing bytes explicitly unavailable; available native website media included. Version change requires contract-first migration before #49 implementation. */
    ExportManifest: {
      /** @constant */
      schemaVersion: 1;
      createdAt: components["schemas"]["Instant"];
      /** @constant */
      recordsFile: "club.json";
      media: components["schemas"]["ExportMedia"][];
    };
  };
  responses: {
    /** @description Datos no válidos. */
    Error400: {
      content: {
        "application/json": components["schemas"]["Error"];
      };
    };
    /** @description Debes iniciar sesión. */
    Error401: {
      content: {
        "application/json": components["schemas"]["Error"];
      };
    };
    /** @description No tienes permiso para realizar esta acción. */
    Error403: {
      content: {
        "application/json": components["schemas"]["Error"];
      };
    };
    /** @description No se encuentra el recurso. */
    Error404: {
      content: {
        "application/json": components["schemas"]["Error"];
      };
    };
    /** @description El estado actual no permite esta acción. */
    Error409: {
      content: {
        "application/json": components["schemas"]["Error"];
      };
    };
    /** @description No se ha podido completar la solicitud. */
    Error500: {
      content: {
        "application/json": components["schemas"]["Error"];
      };
    };
    /** @description El servicio no está disponible temporalmente. */
    Error503: {
      content: {
        "application/json": components["schemas"]["Error"];
      };
    };
  };
  parameters: never;
  requestBodies: never;
  headers: never;
  pathItems: never;
}

export type $defs = Record<string, never>;

export type external = Record<string, never>;

export interface operations {

  /**
   * getSession
   * @description Always 200 anonymous/denied/signedIn; bootstraps csrftoken cookie. Recheck allowlist/revocation server-side. No second current-user endpoint.
   */
  getSession: {
    responses: {
      /** @description Successful result. */
      200: {
        content: {
          "application/json": components["schemas"]["Session"];
        };
      };
      500: components["responses"]["Error500"];
      503: components["responses"]["Error503"];
    };
  };
  /**
   * signOut
   * @description Idempotent logout even without authenticated membership. CSRF required; invalidate session cookie.
   */
  signOut: {
    responses: {
      /** @description Successful; no response body. */
      204: {
        content: never;
      };
      403: components["responses"]["Error403"];
      500: components["responses"]["Error500"];
      503: components["responses"]["Error503"];
    };
  };
  /**
   * startDemoSignIn
   * @description CSRF required. DEMO_MODE only, establishes fictional session; otherwise generic 404. Never available on real club instance.
   */
  startDemoSignIn: {
    responses: {
      /** @description Successful; no response body. */
      204: {
        content: never;
      };
      403: components["responses"]["Error403"];
      404: components["responses"]["Error404"];
      500: components["responses"]["Error500"];
      503: components["responses"]["Error503"];
    };
  };
  /**
   * getHome
   * @description Home is gated server-side before activity text and review totals are composed; ratings/records cannot leak via card/feed counts.
   */
  getHome: {
    responses: {
      /** @description Successful result. */
      200: {
        content: {
          "application/json": components["schemas"]["HomeData"];
        };
      };
      401: components["responses"]["Error401"];
      500: components["responses"]["Error500"];
      503: components["responses"]["Error503"];
    };
  };
  /**
   * setWeekCompleted
   * @description Own session identity only; 403 smuggled ownership, 401 before lookup, unknown/removed week 404 before invalid input. Independent from finished flag; idempotent.
   */
  setWeekCompleted: {
    parameters: {
      path: {
        /** @description Opaque weekId. */
        weekId: components["schemas"]["Id"];
      };
    };
    requestBody: {
      content: {
        /**
         * @example {
         *   "completed": false
         * }
         */
        "application/json": components["schemas"]["WeekCompletionInput"];
      };
    };
    responses: {
      /** @description Successful; no response body. */
      204: {
        content: never;
      };
      400: components["responses"]["Error400"];
      401: components["responses"]["Error401"];
      403: components["responses"]["Error403"];
      404: components["responses"]["Error404"];
      500: components["responses"]["Error500"];
      503: components["responses"]["Error503"];
    };
  };
  /**
   * listBooks
   * @description Approved membership rechecked before data lookup. See docs/api.md for server obligations and error precedence.
   */
  listBooks: {
    responses: {
      /** @description Successful result. */
      200: {
        content: {
          "application/json": components["schemas"]["LibraryBook"][];
        };
      };
      401: components["responses"]["Error401"];
      500: components["responses"]["Error500"];
      503: components["responses"]["Error503"];
    };
  };
  /**
   * getBook
   * @description Approved membership rechecked before data lookup. See docs/api.md for server obligations and error precedence.
   */
  getBook: {
    parameters: {
      path: {
        /** @description Opaque bookId. */
        bookId: components["schemas"]["Id"];
      };
    };
    responses: {
      /** @description Successful result. */
      200: {
        content: {
          "application/json": components["schemas"]["BookDetail"];
        };
      };
      401: components["responses"]["Error401"];
      404: components["responses"]["Error404"];
      500: components["responses"]["Error500"];
      503: components["responses"]["Error503"];
    };
  };
  /**
   * listMeetings
   * @description Approved membership rechecked before data lookup. See docs/api.md for server obligations and error precedence.
   */
  listMeetings: {
    responses: {
      /** @description Successful result. */
      200: {
        content: {
          "application/json": components["schemas"]["MeetingList"];
        };
      };
      401: components["responses"]["Error401"];
      500: components["responses"]["Error500"];
      503: components["responses"]["Error503"];
    };
  };
  /**
   * getMeeting
   * @description Central MeetingRecord gate includes admin member views; published content only; cancelled/removed linked week suppress substantive records.
   */
  getMeeting: {
    parameters: {
      path: {
        /** @description Opaque meetingId. */
        meetingId: components["schemas"]["Id"];
      };
    };
    responses: {
      /** @description Successful result. */
      200: {
        content: {
          "application/json": components["schemas"]["MeetingDetail"];
        };
      };
      401: components["responses"]["Error401"];
      404: components["responses"]["Error404"];
      500: components["responses"]["Error500"];
      503: components["responses"]["Error503"];
    };
  };
  /**
   * getVotes
   * @description Approved membership rechecked before data lookup. See docs/api.md for server obligations and error precedence.
   */
  getVotes: {
    responses: {
      /** @description Successful result. */
      200: {
        content: {
          "application/json": components["schemas"]["VotesOverview"];
        };
      };
      401: components["responses"]["Error401"];
      500: components["responses"]["Error500"];
      503: components["responses"]["Error503"];
    };
  };
  /**
   * createVote
   * @description 401 then effective current curator/admin permission 403; missing curator or existing draft/open 409. Empty draft shortlist belongs to current curator even when admin creates. No request body.
   */
  createVote: {
    responses: {
      /** @description Successful result. */
      201: {
        content: {
          "application/json": components["schemas"]["Vote"];
        };
      };
      401: components["responses"]["Error401"];
      403: components["responses"]["Error403"];
      409: components["responses"]["Error409"];
      500: components["responses"]["Error500"];
      503: components["responses"]["Error503"];
    };
  };
  /**
   * getVote
   * @description Approved membership rechecked before data lookup. See docs/api.md for server obligations and error precedence.
   */
  getVote: {
    parameters: {
      path: {
        /** @description Opaque voteId. */
        voteId: components["schemas"]["Id"];
      };
    };
    responses: {
      /** @description Successful result. */
      200: {
        content: {
          "application/json": components["schemas"]["Vote"];
        };
      };
      401: components["responses"]["Error401"];
      404: components["responses"]["Error404"];
      500: components["responses"]["Error500"];
      503: components["responses"]["Error503"];
    };
  };
  /**
   * setApproval
   * @description Own identity from session. 401 then unknown vote/candidate 404, state not open 409, invalid input 400; ownership keys 403. Public approvals; no automatic book transitions.
   */
  setApproval: {
    parameters: {
      path: {
        /** @description Opaque voteId. */
        voteId: components["schemas"]["Id"];
        /** @description Opaque bookId. */
        bookId: components["schemas"]["Id"];
      };
    };
    requestBody: {
      content: {
        /**
         * @example {
         *   "approved": false
         * }
         */
        "application/json": components["schemas"]["ApprovalInput"];
      };
    };
    responses: {
      /** @description Successful result. */
      200: {
        content: {
          "application/json": components["schemas"]["Vote"];
        };
      };
      400: components["responses"]["Error400"];
      401: components["responses"]["Error401"];
      403: components["responses"]["Error403"];
      404: components["responses"]["Error404"];
      409: components["responses"]["Error409"];
      500: components["responses"]["Error500"];
      503: components["responses"]["Error503"];
    };
  };
  /**
   * addCandidate
   * @description 401 then current curator/admin 403 before lookup, vote/book 404 then closed/duplicate/non-propuesto book 409, invalid input 400. Append candidate.
   */
  addCandidate: {
    parameters: {
      path: {
        /** @description Opaque voteId. */
        voteId: components["schemas"]["Id"];
      };
    };
    requestBody: {
      content: {
        /**
         * @example {
         *   "bookId": "book-fiction-1"
         * }
         */
        "application/json": components["schemas"]["CandidateInput"];
      };
    };
    responses: {
      /** @description Successful result. */
      200: {
        content: {
          "application/json": components["schemas"]["Vote"];
        };
      };
      400: components["responses"]["Error400"];
      401: components["responses"]["Error401"];
      403: components["responses"]["Error403"];
      404: components["responses"]["Error404"];
      409: components["responses"]["Error409"];
      500: components["responses"]["Error500"];
      503: components["responses"]["Error503"];
    };
  };
  /**
   * removeCandidate
   * @description 401 then current curator/admin 403, unknown vote/candidate 404, closed or open shortlist <=2 409. Remove all approvals atomically.
   */
  removeCandidate: {
    parameters: {
      path: {
        /** @description Opaque voteId. */
        voteId: components["schemas"]["Id"];
        /** @description Opaque bookId. */
        bookId: components["schemas"]["Id"];
      };
    };
    responses: {
      /** @description Successful result. */
      200: {
        content: {
          "application/json": components["schemas"]["Vote"];
        };
      };
      401: components["responses"]["Error401"];
      403: components["responses"]["Error403"];
      404: components["responses"]["Error404"];
      409: components["responses"]["Error409"];
      500: components["responses"]["Error500"];
      503: components["responses"]["Error503"];
    };
  };
  /**
   * reorderCandidates
   * @description 401 then permission 403, vote/any book lookup 404, closed or stale/non-exact candidate set 409, malformed input 400.
   */
  reorderCandidates: {
    parameters: {
      path: {
        /** @description Opaque voteId. */
        voteId: components["schemas"]["Id"];
      };
    };
    requestBody: {
      content: {
        /**
         * @example {
         *   "bookIds": []
         * }
         */
        "application/json": components["schemas"]["CandidateOrderInput"];
      };
    };
    responses: {
      /** @description Successful result. */
      200: {
        content: {
          "application/json": components["schemas"]["Vote"];
        };
      };
      400: components["responses"]["Error400"];
      401: components["responses"]["Error401"];
      403: components["responses"]["Error403"];
      404: components["responses"]["Error404"];
      409: components["responses"]["Error409"];
      500: components["responses"]["Error500"];
      503: components["responses"]["Error503"];
    };
  };
  /**
   * openVote
   * @description 401 then permission 403, vote lookup 404, non-draft or <2 candidates 409. No body.
   */
  openVote: {
    parameters: {
      path: {
        /** @description Opaque voteId. */
        voteId: components["schemas"]["Id"];
      };
    };
    responses: {
      /** @description Successful result. */
      200: {
        content: {
          "application/json": components["schemas"]["Vote"];
        };
      };
      401: components["responses"]["Error401"];
      403: components["responses"]["Error403"];
      404: components["responses"]["Error404"];
      409: components["responses"]["Error409"];
      500: components["responses"]["Error500"];
      503: components["responses"]["Error503"];
    };
  };
  /**
   * closeVote
   * @description 401 then permission 403, lookup 404, non-open 409. Server computes winner/tie. No body or automatic catalogue/curator changes.
   */
  closeVote: {
    parameters: {
      path: {
        /** @description Opaque voteId. */
        voteId: components["schemas"]["Id"];
      };
    };
    responses: {
      /** @description Successful result. */
      200: {
        content: {
          "application/json": components["schemas"]["Vote"];
        };
      };
      401: components["responses"]["Error401"];
      403: components["responses"]["Error403"];
      404: components["responses"]["Error404"];
      409: components["responses"]["Error409"];
      500: components["responses"]["Error500"];
      503: components["responses"]["Error503"];
    };
  };
  /**
   * recordTieWinner
   * @description 401 then admin-only 403, vote/book lookup 404, not pending tie/not tied book 409, trimmed note >1000 400. Manual outcome, never book transitions.
   */
  recordTieWinner: {
    parameters: {
      path: {
        /** @description Opaque voteId. */
        voteId: components["schemas"]["Id"];
      };
    };
    requestBody: {
      content: {
        /**
         * @example {
         *   "bookId": "book-fiction-1",
         *   "note": "Texto ficticio"
         * }
         */
        "application/json": components["schemas"]["TieWinnerInput"];
      };
    };
    responses: {
      /** @description Successful result. */
      200: {
        content: {
          "application/json": components["schemas"]["Vote"];
        };
      };
      400: components["responses"]["Error400"];
      401: components["responses"]["Error401"];
      403: components["responses"]["Error403"];
      404: components["responses"]["Error404"];
      409: components["responses"]["Error409"];
      500: components["responses"]["Error500"];
      503: components["responses"]["Error503"];
    };
  };
  /**
   * getBookRatings
   * @description 401 before book lookup. Ratings gate finished AND own complete review, including historical/admin member views. Own review always returned.
   */
  getBookRatings: {
    parameters: {
      path: {
        /** @description Opaque bookId. */
        bookId: components["schemas"]["Id"];
      };
    };
    responses: {
      /** @description Successful result. */
      200: {
        content: {
          "application/json": components["schemas"]["BookRatings"];
        };
      };
      401: components["responses"]["Error401"];
      404: components["responses"]["Error404"];
      500: components["responses"]["Error500"];
      503: components["responses"]["Error503"];
    };
  };
  /**
   * getRatingRubric
   * @description Approved membership rechecked before data lookup. See docs/api.md for server obligations and error precedence.
   */
  getRatingRubric: {
    responses: {
      /** @description Successful result. */
      200: {
        content: {
          "application/json": components["schemas"]["RatingRubric"];
        };
      };
      401: components["responses"]["Error401"];
      500: components["responses"]["Error500"];
      503: components["responses"]["Error503"];
    };
  };
  /**
   * setBookFinished
   * @description Session identity only. 401, ownership 403, book lookup 404, not ratable when finishing or existing review when clearing 409, invalid 400. Independent from weekly completion.
   */
  setBookFinished: {
    parameters: {
      path: {
        /** @description Opaque bookId. */
        bookId: components["schemas"]["Id"];
      };
    };
    requestBody: {
      content: {
        /**
         * @example {
         *   "finished": false
         * }
         */
        "application/json": components["schemas"]["FinishedInput"];
      };
    };
    responses: {
      /** @description Successful result. */
      200: {
        content: {
          "application/json": components["schemas"]["BookRatings"];
        };
      };
      400: components["responses"]["Error400"];
      401: components["responses"]["Error401"];
      403: components["responses"]["Error403"];
      404: components["responses"]["Error404"];
      409: components["responses"]["Error409"];
      500: components["responses"]["Error500"];
      503: components["responses"]["Error503"];
    };
  };
  /**
   * saveMyReview
   * @description Session identity only. 401, smuggled ownership 403, book lookup 404, not ratable/not finished 409, scores/text 400. Atomic create/replace; exactly five half-star scores; text <=5000 AFTER trim, blank->null.
   */
  saveMyReview: {
    parameters: {
      path: {
        /** @description Opaque bookId. */
        bookId: components["schemas"]["Id"];
      };
    };
    requestBody: {
      content: {
        /**
         * @example {
         *   "scores": {
         *     "disfrute": 1,
         *     "estilo": 1,
         *     "personajes": 1,
         *     "trama": 1,
         *     "huella": 1
         *   }
         * }
         */
        "application/json": components["schemas"]["ReviewInput"];
      };
    };
    responses: {
      /** @description Successful result. */
      200: {
        content: {
          "application/json": components["schemas"]["BookRatings"];
        };
      };
      400: components["responses"]["Error400"];
      401: components["responses"]["Error401"];
      403: components["responses"]["Error403"];
      404: components["responses"]["Error404"];
      409: components["responses"]["Error409"];
      500: components["responses"]["Error500"];
      503: components["responses"]["Error503"];
    };
  };
  /**
   * getStatistics
   * @description Drop viewer-locked books BEFORE all means/counts/radars/highlights, with thresholds/denominators unchanged. No hidden book count.
   */
  getStatistics: {
    responses: {
      /** @description Successful result. */
      200: {
        content: {
          "application/json": components["schemas"]["Statistics"];
        };
      };
      401: components["responses"]["Error401"];
      500: components["responses"]["Error500"];
      503: components["responses"]["Error503"];
    };
  };
  /**
   * getTasteCompatibility
   * @description Only viewer-unlocked shared ratings. Three shared books minimum before differences/metadata. Insufficient status has no scores/books; permitted sharedBookCount remains at outer member level.
   */
  getTasteCompatibility: {
    responses: {
      /** @description Successful result. */
      200: {
        content: {
          "application/json": components["schemas"]["TasteCompatibility"];
        };
      };
      401: components["responses"]["Error401"];
      500: components["responses"]["Error500"];
      503: components["responses"]["Error503"];
    };
  };
  /**
   * listMembers
   * @description Approved membership rechecked before data lookup. See docs/api.md for server obligations and error precedence.
   */
  listMembers: {
    responses: {
      /** @description Successful result. */
      200: {
        content: {
          "application/json": components["schemas"]["MemberDirectory"];
        };
      };
      401: components["responses"]["Error401"];
      500: components["responses"]["Error500"];
      503: components["responses"]["Error503"];
    };
  };
  /**
   * getMemberProfile
   * @description 401 before lookup; revoked and unknown IDs indistinguishable generic 404. Public website-native profile/progress only, never ratings/taste/Discord identity.
   */
  getMemberProfile: {
    parameters: {
      path: {
        /** @description Opaque memberId. */
        memberId: components["schemas"]["Id"];
      };
    };
    responses: {
      /** @description Successful result. */
      200: {
        content: {
          "application/json": components["schemas"]["MemberProfile"];
        };
      };
      401: components["responses"]["Error401"];
      404: components["responses"]["Error404"];
      500: components["responses"]["Error500"];
      503: components["responses"]["Error503"];
    };
  };
  /**
   * getMyProfile
   * @description Approved membership rechecked before data lookup. See docs/api.md for server obligations and error precedence.
   */
  getMyProfile: {
    responses: {
      /** @description Successful result. */
      200: {
        content: {
          "application/json": components["schemas"]["MyProfile"];
        };
      };
      401: components["responses"]["Error401"];
      500: components["responses"]["Error500"];
      503: components["responses"]["Error503"];
    };
  };
  /**
   * updateMyProfile
   * @description 401 before validation, any smuggled owner/member/id key 403 and never used for identity. JSON metadata+optional avatar image multipart parts. Normalize trim before lengths, blank optional text null, allowed ordered distinct <=5 favourites. Replace requires valid image <=2 MiB; all validation before atomic profile/avatar save.
   */
  updateMyProfile: {
    requestBody: {
      content: {
        /**
         * @example {
         *   "metadata": {
         *     "displayName": "Texto ficticio",
         *     "favouriteBookIds": [],
         *     "avatarAction": "keep"
         *   }
         * }
         */
        "multipart/form-data": components["schemas"]["ProfileMultipart"];
      };
    };
    responses: {
      /** @description Successful result. */
      200: {
        content: {
          "application/json": components["schemas"]["MyProfile"];
        };
      };
      400: components["responses"]["Error400"];
      401: components["responses"]["Error401"];
      403: components["responses"]["Error403"];
      500: components["responses"]["Error500"];
      503: components["responses"]["Error503"];
    };
  };
  /**
   * listMyReviews
   * @description Approved membership rechecked before data lookup. See docs/api.md for server obligations and error precedence.
   */
  listMyReviews: {
    responses: {
      /** @description Successful result. */
      200: {
        content: {
          "application/json": components["schemas"]["MyReviewEntry"][];
        };
      };
      401: components["responses"]["Error401"];
      500: components["responses"]["Error500"];
      503: components["responses"]["Error503"];
    };
  };
  /**
   * Same-site OAuth navigation
   * @description Top-level navigation, not JSON sign-in. Discord identify scope only; approved exact IDs, revoke check, state and identity checked server-side. Server-held same-origin return navigation; deny missing/invalid state without club payload. No access/refresh tokens exposed. Export purpose performs admin reauthentication (#102). For purpose=export require existing approved admin and bind server OAuth state to that same identity; require a fresh provider authentication, not reuse of prior local confirmation. Callback records server recent-auth time only after state, identity and current allowlist/admin checks; wrong identity never authorises export. Safe same-site return only.
   */
  startSignIn: {
    parameters: {
      query?: {
        /** @description export purpose reserves admin recent reauthentication for #102; server stores purpose/return path in OAuth state, no arbitrary external redirect. */
        purpose?: "login" | "export";
      };
    };
    responses: {
      /** @description Redirect to Discord authorisation from start, or safe same-origin page/session gate after callback. Failure lands on anonymous/denied Spanish page; no club payload. */
      302: {
        headers: {
          /** @description Provider URL (start) or validated same-origin page (callback). */
          Location: string;
        };
        content: never;
      };
      500: components["responses"]["Error500"];
      503: components["responses"]["Error503"];
    };
  };
  /**
   * Same-site OAuth navigation
   * @description Top-level navigation, not JSON sign-in. Discord identify scope only; approved exact IDs, revoke check, state and identity checked server-side. Server-held same-origin return navigation; deny missing/invalid state without club payload. No access/refresh tokens exposed. Export purpose performs admin reauthentication (#102). For server-held export purpose, successful fresh provider authentication must match original approved admin identity and rechecked allowlist/admin role before server stores recent-auth timestamp. Absent/stale authorisation later yields export 409 without expiring approved session. No tokens exposed.
   */
  discordCallback: {
    parameters: {
      query?: {
        /** @description Provider response; validate OAuth state and exact approved identity server-side. Never echo values. */
        code?: string;
        /** @description Provider response; validate OAuth state and exact approved identity server-side. Never echo values. */
        state?: string;
        /** @description Provider response; validate OAuth state and exact approved identity server-side. Never echo values. */
        error?: string;
      };
    };
    responses: {
      /** @description Redirect to Discord authorisation from start, or safe same-origin page/session gate after callback. Failure lands on anonymous/denied Spanish page; no club payload. */
      302: {
        headers: {
          /** @description Provider URL (start) or validated same-origin page (callback). */
          Location: string;
        };
        content: never;
      };
      500: components["responses"]["Error500"];
      503: components["responses"]["Error503"];
    };
  };
  /**
   * getBackupInfo
   * @description Effective approved admin only; recheck allowlist and role on server. 401 before 403; both before lookup/payload validation. Curator alone is denied. CSRF on unsafe methods. Atomic refusal changes nothing; member/own-profile gates apply to admin outside these endpoints.
   */
  getBackupInfo: {
    responses: {
      /** @description Successful approved-admin result. */
      200: {
        content: {
          "application/json": components["schemas"]["BackupInfo"];
        };
      };
      401: components["responses"]["Error401"];
      403: components["responses"]["Error403"];
      500: components["responses"]["Error500"];
      503: components["responses"]["Error503"];
    };
  };
  /**
   * exportClubData
   * @description Effective approved admin only; recheck allowlist and role on server. 401 before 403; both before lookup/payload validation. Curator alone is denied. CSRF on unsafe methods. Atomic refusal changes nothing; member/own-profile gates apply to admin outside these endpoints. Requires recent same-approved-admin Discord OAuth reauthentication after verified identity/allowlist checks. Five minutes by server clock, recorded server-side (#49/#5). Confirmation/request boolean insufficient; no body accepted. Include UTF-8 manifest.json + club.json and available website media. Authenticated noncached attachment; sessions/secrets excluded. Export event included once in safe audit.
   */
  exportClubData: {
    responses: {
      /** @description Authenticated private ZIP attachment; never a JSON wire response. */
      200: {
        headers: {
          /**
           * @description Safe server filename without supplied path; fixed draft name.
           * @example attachment; filename="club-de-lectura.zip"
           */
          "Content-Disposition": "attachment; filename=\"club-de-lectura.zip\"";
          /** @example no-store */
          "Cache-Control": "no-store";
        };
        content: {
          "application/zip": Blob;
        };
      };
      401: components["responses"]["Error401"];
      403: components["responses"]["Error403"];
      /** @description Missing/stale recent authorisation; no download, existing approved session remains valid. */
      409: {
        content: {
          "application/json": components["schemas"]["ReauthenticationError"];
        };
      };
      500: components["responses"]["Error500"];
      503: components["responses"]["Error503"];
    };
  };
  /**
   * getAuditLog
   * @description Effective approved admin only; recheck allowlist and role on server. 401 before 403; both before lookup/payload validation. Curator alone is denied. CSRF on unsafe methods. Atomic refusal changes nothing; member/own-profile gates apply to admin outside these endpoints.
   */
  getAuditLog: {
    responses: {
      /** @description Successful approved-admin result. */
      200: {
        content: {
          "application/json": components["schemas"]["AuditEvent"][];
        };
      };
      401: components["responses"]["Error401"];
      403: components["responses"]["Error403"];
      500: components["responses"]["Error500"];
      503: components["responses"]["Error503"];
    };
  };
  /**
   * getRecycleBin
   * @description Effective approved admin only; recheck allowlist and role on server. 401 before 403; both before lookup/payload validation. Curator alone is denied. CSRF on unsafe methods. Atomic refusal changes nothing; member/own-profile gates apply to admin outside these endpoints.
   */
  getRecycleBin: {
    responses: {
      /** @description Successful approved-admin result. */
      200: {
        content: {
          "application/json": components["schemas"]["RecycleBinEntry"][];
        };
      };
      401: components["responses"]["Error401"];
      403: components["responses"]["Error403"];
      500: components["responses"]["Error500"];
      503: components["responses"]["Error503"];
    };
  };
  /**
   * getDeletionPreview
   * @description Effective approved admin only; recheck allowlist and role on server. 401 before 403; both before lookup/payload validation. Curator alone is denied. CSRF on unsafe methods. Atomic refusal changes nothing; member/own-profile gates apply to admin outside these endpoints. Only book/meeting/quote preview types; safe operational dependencies.
   */
  getDeletionPreview: {
    parameters: {
      path: {
        type: "book" | "meeting" | "quote";
        id: components["schemas"]["Id"];
      };
    };
    responses: {
      /** @description Successful approved-admin result. */
      200: {
        content: {
          "application/json": components["schemas"]["DeletionPreview"];
        };
      };
      400: components["responses"]["Error400"];
      401: components["responses"]["Error401"];
      403: components["responses"]["Error403"];
      404: components["responses"]["Error404"];
      500: components["responses"]["Error500"];
      503: components["responses"]["Error503"];
    };
  };
  /**
   * restoreDeleted
   * @description Effective approved admin only; recheck allowlist and role on server. 401 before 403; both before lookup/payload validation. Curator alone is denied. CSRF on unsafe methods. Atomic refusal changes nothing; member/own-profile gates apply to admin outside these endpoints. Missing/nonremoved/purged target 404. Expired restore 409. Restore selected metadata only, not independently removed descendants; required parent first. One leyendo, quote uniqueness and canonical same-book/one-to-one link checks 409. Meeting restoration allowed with removed linked week (gate remains locked). Purge is dependency-blocked 409, never cascades: book weeks/meetings/reviews/finished/favourites/votes; meeting reservations/attendance/highlights; week completions/links. Quote/highlight eligible independently. 30-day deadline does not promise automatic job. #12/#46/#47 refine production erasure first.
   */
  restoreDeleted: {
    parameters: {
      path: {
        type: components["schemas"]["DeletedType"];
        id: components["schemas"]["Id"];
      };
    };
    responses: {
      /** @description Successful approved-admin result. */
      200: {
        content: {
          "application/json": components["schemas"]["RecycleBinEntry"][];
        };
      };
      400: components["responses"]["Error400"];
      401: components["responses"]["Error401"];
      403: components["responses"]["Error403"];
      404: components["responses"]["Error404"];
      409: components["responses"]["Error409"];
      500: components["responses"]["Error500"];
      503: components["responses"]["Error503"];
    };
  };
  /**
   * purgeDeleted
   * @description Effective approved admin only; recheck allowlist and role on server. 401 before 403; both before lookup/payload validation. Curator alone is denied. CSRF on unsafe methods. Atomic refusal changes nothing; member/own-profile gates apply to admin outside these endpoints. Missing/nonremoved/purged target 404. Expired restore 409. Restore selected metadata only, not independently removed descendants; required parent first. One leyendo, quote uniqueness and canonical same-book/one-to-one link checks 409. Meeting restoration allowed with removed linked week (gate remains locked). Purge is dependency-blocked 409, never cascades: book weeks/meetings/reviews/finished/favourites/votes; meeting reservations/attendance/highlights; week completions/links. Quote/highlight eligible independently. 30-day deadline does not promise automatic job. #12/#46/#47 refine production erasure first.
   */
  purgeDeleted: {
    parameters: {
      path: {
        type: components["schemas"]["DeletedType"];
        id: components["schemas"]["Id"];
      };
    };
    responses: {
      /** @description Successful approved-admin result. */
      200: {
        content: {
          "application/json": components["schemas"]["RecycleBinEntry"][];
        };
      };
      400: components["responses"]["Error400"];
      401: components["responses"]["Error401"];
      403: components["responses"]["Error403"];
      404: components["responses"]["Error404"];
      409: components["responses"]["Error409"];
      500: components["responses"]["Error500"];
      503: components["responses"]["Error503"];
    };
  };
  /**
   * deleteBook
   * @description Effective approved admin only; recheck allowlist and role on server. 401 before 403; both before lookup/payload validation. Curator alone is denied. CSRF on unsafe methods. Atomic refusal changes nothing; member/own-profile gates apply to admin outside these endpoints. Soft removal retains linked business history and metadata for exactly 30 days; repeated/missing target 404. Never cascade purge; member projections suppress removed targets/dependent content.
   */
  deleteBook: {
    parameters: {
      path: {
        id: components["schemas"]["Id"];
      };
    };
    responses: {
      /** @description Successful approved-admin result. */
      200: {
        content: {
          "application/json": components["schemas"]["RecycleBinEntry"][];
        };
      };
      401: components["responses"]["Error401"];
      403: components["responses"]["Error403"];
      404: components["responses"]["Error404"];
      500: components["responses"]["Error500"];
      503: components["responses"]["Error503"];
    };
  };
  /**
   * deleteMeeting
   * @description Effective approved admin only; recheck allowlist and role on server. 401 before 403; both before lookup/payload validation. Curator alone is denied. CSRF on unsafe methods. Atomic refusal changes nothing; member/own-profile gates apply to admin outside these endpoints. Soft removal retains linked business history and metadata for exactly 30 days; repeated/missing target 404. Never cascade purge; member projections suppress removed targets/dependent content.
   */
  deleteMeeting: {
    parameters: {
      path: {
        id: components["schemas"]["Id"];
      };
    };
    responses: {
      /** @description Successful approved-admin result. */
      200: {
        content: {
          "application/json": components["schemas"]["RecycleBinEntry"][];
        };
      };
      401: components["responses"]["Error401"];
      403: components["responses"]["Error403"];
      404: components["responses"]["Error404"];
      500: components["responses"]["Error500"];
      503: components["responses"]["Error503"];
    };
  };
  /**
   * updateLiteraryQuote
   * @description Effective approved admin only; recheck allowlist and role on server. 401 before 403; both before lookup/payload validation. Curator alone is denied. CSRF on unsafe methods. Atomic refusal changes nothing; member/own-profile gates apply to admin outside these endpoints. Stable id/order, normalized duplicates 409.
   */
  updateLiteraryQuote: {
    parameters: {
      path: {
        id: components["schemas"]["Id"];
      };
    };
    requestBody: {
      content: {
        /**
         * @example {
         *   "text": "Texto literario ficticio.",
         *   "author": null,
         *   "source": null,
         *   "active": true
         * }
         */
        "application/json": components["schemas"]["LiteraryQuoteInput"];
      };
    };
    responses: {
      /** @description Successful approved-admin result. */
      200: {
        content: {
          "application/json": components["schemas"]["AdminLiteraryQuote"];
        };
      };
      400: components["responses"]["Error400"];
      401: components["responses"]["Error401"];
      403: components["responses"]["Error403"];
      404: components["responses"]["Error404"];
      409: components["responses"]["Error409"];
      500: components["responses"]["Error500"];
      503: components["responses"]["Error503"];
    };
  };
  /**
   * deleteLiteraryQuote
   * @description Effective approved admin only; recheck allowlist and role on server. 401 before 403; both before lookup/payload validation. Curator alone is denied. CSRF on unsafe methods. Atomic refusal changes nothing; member/own-profile gates apply to admin outside these endpoints. Soft removal retains linked business history and metadata for exactly 30 days; repeated/missing target 404. Never cascade purge; member projections suppress removed targets/dependent content.
   */
  deleteLiteraryQuote: {
    parameters: {
      path: {
        id: components["schemas"]["Id"];
      };
    };
    responses: {
      /** @description Successful approved-admin result. */
      200: {
        content: {
          "application/json": components["schemas"]["RecycleBinEntry"][];
        };
      };
      401: components["responses"]["Error401"];
      403: components["responses"]["Error403"];
      404: components["responses"]["Error404"];
      500: components["responses"]["Error500"];
      503: components["responses"]["Error503"];
    };
  };
  /**
   * listAdminQuotes
   * @description Effective approved admin only; recheck allowlist and role on server. 401 before 403; both before lookup/payload validation. Curator alone is denied. CSRF on unsafe methods. Atomic refusal changes nothing; member/own-profile gates apply to admin outside these endpoints.
   */
  listAdminQuotes: {
    responses: {
      /** @description Successful approved-admin result. */
      200: {
        content: {
          "application/json": components["schemas"]["AdminLiteraryQuote"][];
        };
      };
      401: components["responses"]["Error401"];
      403: components["responses"]["Error403"];
      500: components["responses"]["Error500"];
      503: components["responses"]["Error503"];
    };
  };
  /**
   * addLiteraryQuote
   * @description Effective approved admin only; recheck allowlist and role on server. 401 before 403; both before lookup/payload validation. Curator alone is denied. CSRF on unsafe methods. Atomic refusal changes nothing; member/own-profile gates apply to admin outside these endpoints. Normalized duplicate 409, including recoverable quotes.
   */
  addLiteraryQuote: {
    requestBody: {
      content: {
        /**
         * @example {
         *   "text": "Texto literario ficticio.",
         *   "author": null,
         *   "source": null,
         *   "active": true
         * }
         */
        "application/json": components["schemas"]["LiteraryQuoteInput"];
      };
    };
    responses: {
      /** @description Successful approved-admin result. */
      201: {
        content: {
          "application/json": components["schemas"]["AdminLiteraryQuote"];
        };
      };
      400: components["responses"]["Error400"];
      401: components["responses"]["Error401"];
      403: components["responses"]["Error403"];
      409: components["responses"]["Error409"];
      500: components["responses"]["Error500"];
      503: components["responses"]["Error503"];
    };
  };
  /**
   * saveRatingRubric
   * @description Effective approved admin only; recheck allowlist and role on server. 401 before 403; both before lookup/payload validation. Curator alone is denied. CSRF on unsafe methods. Atomic refusal changes nothing; member/own-profile gates apply to admin outside these endpoints. Validate all 25 anchors before commit.
   */
  saveRatingRubric: {
    requestBody: {
      content: {
        /**
         * @example {
         *   "disfrute": {
         *     "1": null,
         *     "2": null,
         *     "3": null,
         *     "4": null,
         *     "5": null
         *   },
         *   "estilo": {
         *     "1": null,
         *     "2": null,
         *     "3": null,
         *     "4": null,
         *     "5": null
         *   },
         *   "personajes": {
         *     "1": null,
         *     "2": null,
         *     "3": null,
         *     "4": null,
         *     "5": null
         *   },
         *   "trama": {
         *     "1": null,
         *     "2": null,
         *     "3": null,
         *     "4": null,
         *     "5": null
         *   },
         *   "huella": {
         *     "1": null,
         *     "2": null,
         *     "3": null,
         *     "4": null,
         *     "5": null
         *   }
         * }
         */
        "application/json": components["schemas"]["RatingRubricInput"];
      };
    };
    responses: {
      /** @description Successful approved-admin result. */
      200: {
        content: {
          "application/json": components["schemas"]["RatingRubric"];
        };
      };
      400: components["responses"]["Error400"];
      401: components["responses"]["Error401"];
      403: components["responses"]["Error403"];
      500: components["responses"]["Error500"];
      503: components["responses"]["Error503"];
    };
  };
  /**
   * getAdminMeetingRecord
   * @description Effective approved admin only; recheck allowlist and role on server. 401 before 403; both before lookup/payload validation. Curator alone is denied. CSRF on unsafe methods. Atomic refusal changes nothing; member/own-profile gates apply to admin outside these endpoints. Draft editor only.
   */
  getAdminMeetingRecord: {
    parameters: {
      path: {
        meetingId: components["schemas"]["Id"];
      };
    };
    responses: {
      /** @description Successful approved-admin result. */
      200: {
        content: {
          "application/json": components["schemas"]["AdminMeetingRecord"];
        };
      };
      401: components["responses"]["Error401"];
      403: components["responses"]["Error403"];
      404: components["responses"]["Error404"];
      500: components["responses"]["Error500"];
      503: components["responses"]["Error503"];
    };
  };
  /**
   * saveMeetingSummary
   * @description Effective approved admin only; recheck allowlist and role on server. 401 before 403; both before lookup/payload validation. Curator alone is denied. CSRF on unsafe methods. Atomic refusal changes nothing; member/own-profile gates apply to admin outside these endpoints. Independent publication, blank published 400.
   */
  saveMeetingSummary: {
    parameters: {
      path: {
        meetingId: components["schemas"]["Id"];
      };
    };
    requestBody: {
      content: {
        /**
         * @example {
         *   "text": "",
         *   "published": false
         * }
         */
        "application/json": components["schemas"]["MeetingSummaryInput"];
      };
    };
    responses: {
      /** @description Successful approved-admin result. */
      200: {
        content: {
          "application/json": components["schemas"]["AdminMeetingRecord"];
        };
      };
      400: components["responses"]["Error400"];
      401: components["responses"]["Error401"];
      403: components["responses"]["Error403"];
      404: components["responses"]["Error404"];
      500: components["responses"]["Error500"];
      503: components["responses"]["Error503"];
    };
  };
  /**
   * createMeetingHighlight
   * @description Effective approved admin only; recheck allowlist and role on server. 401 before 403; both before lookup/payload validation. Curator alone is denied. CSRF on unsafe methods. Atomic refusal changes nothing; member/own-profile gates apply to admin outside these endpoints. Active speakers only on creation.
   */
  createMeetingHighlight: {
    parameters: {
      path: {
        meetingId: components["schemas"]["Id"];
      };
    };
    requestBody: {
      content: {
        /**
         * @example {
         *   "text": "IntervenciÃ³n ficticia",
         *   "published": false,
         *   "kind": "paraphrase",
         *   "speakerIds": []
         * }
         */
        "application/json": components["schemas"]["MeetingHighlightInput"];
      };
    };
    responses: {
      /** @description Successful approved-admin result. */
      201: {
        content: {
          "application/json": components["schemas"]["AdminMeetingRecord"];
        };
      };
      400: components["responses"]["Error400"];
      401: components["responses"]["Error401"];
      403: components["responses"]["Error403"];
      404: components["responses"]["Error404"];
      500: components["responses"]["Error500"];
      503: components["responses"]["Error503"];
    };
  };
  /**
   * updateMeetingHighlight
   * @description Effective approved admin only; recheck allowlist and role on server. 401 before 403; both before lookup/payload validation. Curator alone is denied. CSRF on unsafe methods. Atomic refusal changes nothing; member/own-profile gates apply to admin outside these endpoints. Retain/remove unchanged revoked attribution; new revoked/unknown speaker choices 400.
   */
  updateMeetingHighlight: {
    parameters: {
      path: {
        meetingId: components["schemas"]["Id"];
        highlightId: components["schemas"]["Id"];
      };
    };
    requestBody: {
      content: {
        /**
         * @example {
         *   "text": "IntervenciÃ³n ficticia",
         *   "published": false,
         *   "kind": "paraphrase",
         *   "speakerIds": []
         * }
         */
        "application/json": components["schemas"]["MeetingHighlightInput"];
      };
    };
    responses: {
      /** @description Successful approved-admin result. */
      200: {
        content: {
          "application/json": components["schemas"]["AdminMeetingRecord"];
        };
      };
      400: components["responses"]["Error400"];
      401: components["responses"]["Error401"];
      403: components["responses"]["Error403"];
      404: components["responses"]["Error404"];
      500: components["responses"]["Error500"];
      503: components["responses"]["Error503"];
    };
  };
  /**
   * removeMeetingHighlight
   * @description Effective approved admin only; recheck allowlist and role on server. 401 before 403; both before lookup/payload validation. Curator alone is denied. CSRF on unsafe methods. Atomic refusal changes nothing; member/own-profile gates apply to admin outside these endpoints. Soft removal keeps publication/content/attribution and original position with 30-day metadata.
   */
  removeMeetingHighlight: {
    parameters: {
      path: {
        meetingId: components["schemas"]["Id"];
        highlightId: components["schemas"]["Id"];
      };
    };
    responses: {
      /** @description Successful approved-admin result. */
      200: {
        content: {
          "application/json": components["schemas"]["AdminMeetingRecord"];
        };
      };
      401: components["responses"]["Error401"];
      403: components["responses"]["Error403"];
      404: components["responses"]["Error404"];
      500: components["responses"]["Error500"];
      503: components["responses"]["Error503"];
    };
  };
  /**
   * reorderMeetingHighlights
   * @description Effective approved admin only; recheck allowlist and role on server. 401 before 403; both before lookup/payload validation. Curator alone is denied. CSRF on unsafe methods. Atomic refusal changes nothing; member/own-profile gates apply to admin outside these endpoints. Exact active permutation; keep removed slots.
   */
  reorderMeetingHighlights: {
    parameters: {
      path: {
        meetingId: components["schemas"]["Id"];
      };
    };
    requestBody: {
      content: {
        /**
         * @example {
         *   "ids": []
         * }
         */
        "application/json": components["schemas"]["IdOrder"];
      };
    };
    responses: {
      /** @description Successful approved-admin result. */
      200: {
        content: {
          "application/json": components["schemas"]["AdminMeetingRecord"];
        };
      };
      400: components["responses"]["Error400"];
      401: components["responses"]["Error401"];
      403: components["responses"]["Error403"];
      404: components["responses"]["Error404"];
      500: components["responses"]["Error500"];
      503: components["responses"]["Error503"];
    };
  };
  /**
   * setMeetingRecordSafe
   * @description Effective approved admin only; recheck allowlist and role on server. 401 before 403; both before lookup/payload validation. Curator alone is denied. CSRF on unsafe methods. Atomic refusal changes nothing; member/own-profile gates apply to admin outside these endpoints. Both safe values conflict 409 when any active/removed week link exists.
   */
  setMeetingRecordSafe: {
    parameters: {
      path: {
        meetingId: components["schemas"]["Id"];
      };
    };
    requestBody: {
      content: {
        /**
         * @example {
         *   "safe": true
         * }
         */
        "application/json": components["schemas"]["SafeInput"];
      };
    };
    responses: {
      /** @description Successful approved-admin result. */
      200: {
        content: {
          "application/json": components["schemas"]["AdminMeetingRecord"];
        };
      };
      400: components["responses"]["Error400"];
      401: components["responses"]["Error401"];
      403: components["responses"]["Error403"];
      404: components["responses"]["Error404"];
      409: components["responses"]["Error409"];
      500: components["responses"]["Error500"];
      503: components["responses"]["Error503"];
    };
  };
  /**
   * getAdminReadingPlan
   * @description Effective approved admin only; recheck allowlist and role on server. 401 before 403; both before lookup/payload validation. Curator alone is denied. CSRF on unsafe methods. Atomic refusal changes nothing; member/own-profile gates apply to admin outside these endpoints. Active operational plan.
   */
  getAdminReadingPlan: {
    parameters: {
      path: {
        bookId: components["schemas"]["Id"];
      };
    };
    responses: {
      /** @description Successful approved-admin result. */
      200: {
        content: {
          "application/json": components["schemas"]["AdminReadingPlan"];
        };
      };
      401: components["responses"]["Error401"];
      403: components["responses"]["Error403"];
      404: components["responses"]["Error404"];
      500: components["responses"]["Error500"];
      503: components["responses"]["Error503"];
    };
  };
  /**
   * createReadingWeek
   * @description Effective approved admin only; recheck allowlist and role on server. 401 before 403; both before lookup/payload validation. Curator alone is denied. CSRF on unsafe methods. Atomic refusal changes nothing; member/own-profile gates apply to admin outside these endpoints. Canonical links and recomputed warning acknowledgement required; refusal atomic. Unacknowledged recomputed warnings are 400 invalid_input (not conversion); occupied link is 409 conflict.
   */
  createReadingWeek: {
    parameters: {
      path: {
        bookId: components["schemas"]["Id"];
      };
    };
    requestBody: {
      content: {
        /**
         * @example {
         *   "input": {
         *     "percentStart": 0,
         *     "percentEnd": 25,
         *     "pageStart": 1,
         *     "pageEnd": 80,
         *     "dueDate": null,
         *     "notes": null,
         *     "meetingId": null
         *   },
         *   "acknowledged": false
         * }
         */
        "application/json": components["schemas"]["ReadingWeekWrite"];
      };
    };
    responses: {
      /** @description Successful approved-admin result. */
      201: {
        content: {
          "application/json": components["schemas"]["AdminReadingPlan"];
        };
      };
      400: components["responses"]["Error400"];
      401: components["responses"]["Error401"];
      403: components["responses"]["Error403"];
      404: components["responses"]["Error404"];
      409: components["responses"]["Error409"];
      500: components["responses"]["Error500"];
      503: components["responses"]["Error503"];
    };
  };
  /**
   * updateReadingWeek
   * @description Effective approved admin only; recheck allowlist and role on server. 401 before 403; both before lookup/payload validation. Curator alone is denied. CSRF on unsafe methods. Atomic refusal changes nothing; member/own-profile gates apply to admin outside these endpoints. Stable id retains completions; canonical links and recomputed warning acknowledgement. Unacknowledged recomputed warnings are 400 invalid_input (not conversion); occupied link is 409 conflict.
   */
  updateReadingWeek: {
    parameters: {
      path: {
        bookId: components["schemas"]["Id"];
        weekId: components["schemas"]["Id"];
      };
    };
    requestBody: {
      content: {
        /**
         * @example {
         *   "input": {
         *     "percentStart": 0,
         *     "percentEnd": 25,
         *     "pageStart": 1,
         *     "pageEnd": 80,
         *     "dueDate": null,
         *     "notes": null,
         *     "meetingId": null
         *   },
         *   "acknowledged": false
         * }
         */
        "application/json": components["schemas"]["ReadingWeekWrite"];
      };
    };
    responses: {
      /** @description Successful approved-admin result. */
      200: {
        content: {
          "application/json": components["schemas"]["AdminReadingPlan"];
        };
      };
      400: components["responses"]["Error400"];
      401: components["responses"]["Error401"];
      403: components["responses"]["Error403"];
      404: components["responses"]["Error404"];
      409: components["responses"]["Error409"];
      500: components["responses"]["Error500"];
      503: components["responses"]["Error503"];
    };
  };
  /**
   * removeReadingWeek
   * @description Effective approved admin only; recheck allowlist and role on server. 401 before 403; both before lookup/payload validation. Curator alone is denied. CSRF on unsafe methods. Atomic refusal changes nothing; member/own-profile gates apply to admin outside these endpoints. Retain facts/completions/canonical meeting link, 30-day removal metadata; linked member record locked even if safe.
   */
  removeReadingWeek: {
    parameters: {
      path: {
        bookId: components["schemas"]["Id"];
        weekId: components["schemas"]["Id"];
      };
    };
    responses: {
      /** @description Successful approved-admin result. */
      200: {
        content: {
          "application/json": components["schemas"]["AdminReadingPlan"];
        };
      };
      401: components["responses"]["Error401"];
      403: components["responses"]["Error403"];
      404: components["responses"]["Error404"];
      500: components["responses"]["Error500"];
      503: components["responses"]["Error503"];
    };
  };
  /**
   * reorderReadingWeeks
   * @description Effective approved admin only; recheck allowlist and role on server. 401 before 403; both before lookup/payload validation. Curator alone is denied. CSRF on unsafe methods. Atomic refusal changes nothing; member/own-profile gates apply to admin outside these endpoints. Exact active permutation then full-plan warnings recomputed. Unacknowledged recomputed warnings are 400 invalid_input (not conversion); occupied link is 409 conflict.
   */
  reorderReadingWeeks: {
    parameters: {
      path: {
        bookId: components["schemas"]["Id"];
      };
    };
    requestBody: {
      content: {
        /**
         * @example {
         *   "ids": [],
         *   "acknowledged": false
         * }
         */
        "application/json": components["schemas"]["ReadingWeekOrder"];
      };
    };
    responses: {
      /** @description Successful approved-admin result. */
      200: {
        content: {
          "application/json": components["schemas"]["AdminReadingPlan"];
        };
      };
      400: components["responses"]["Error400"];
      401: components["responses"]["Error401"];
      403: components["responses"]["Error403"];
      404: components["responses"]["Error404"];
      500: components["responses"]["Error500"];
      503: components["responses"]["Error503"];
    };
  };
  /**
   * listAdminMeetings
   * @description Effective approved admin only; recheck allowlist and role on server. 401 before 403; both before lookup/payload validation. Curator alone is denied. CSRF on unsafe methods. Atomic refusal changes nothing; member/own-profile gates apply to admin outside these endpoints.
   */
  listAdminMeetings: {
    responses: {
      /** @description Successful approved-admin result. */
      200: {
        content: {
          "application/json": components["schemas"]["AdminMeetingCalendar"];
        };
      };
      401: components["responses"]["Error401"];
      403: components["responses"]["Error403"];
      500: components["responses"]["Error500"];
      503: components["responses"]["Error503"];
    };
  };
  /**
   * createMeeting
   * @description Effective approved admin only; recheck allowlist and role on server. 401 before 403; both before lookup/payload validation. Curator alone is denied. CSRF on unsafe methods. Atomic refusal changes nothing; member/own-profile gates apply to admin outside these endpoints. Canonical book/week links validated; occupied reservation 409.
   */
  createMeeting: {
    requestBody: {
      content: {
        /**
         * @example {
         *   "startsAt": "2026-01-15T19:00:00Z",
         *   "bookId": null,
         *   "weekId": null
         * }
         */
        "application/json": components["schemas"]["MeetingInput"];
      };
    };
    responses: {
      /** @description Successful approved-admin result. */
      201: {
        content: {
          "application/json": components["schemas"]["AdminMeeting"];
        };
      };
      400: components["responses"]["Error400"];
      401: components["responses"]["Error401"];
      403: components["responses"]["Error403"];
      404: components["responses"]["Error404"];
      409: components["responses"]["Error409"];
      500: components["responses"]["Error500"];
      503: components["responses"]["Error503"];
    };
  };
  /**
   * getAdminMeeting
   * @description Effective approved admin only; recheck allowlist and role on server. 401 before 403; both before lookup/payload validation. Curator alone is denied. CSRF on unsafe methods. Atomic refusal changes nothing; member/own-profile gates apply to admin outside these endpoints. Operational attendance editor.
   */
  getAdminMeeting: {
    parameters: {
      path: {
        meetingId: components["schemas"]["Id"];
      };
    };
    responses: {
      /** @description Successful approved-admin result. */
      200: {
        content: {
          "application/json": components["schemas"]["AdminMeeting"];
        };
      };
      401: components["responses"]["Error401"];
      403: components["responses"]["Error403"];
      404: components["responses"]["Error404"];
      500: components["responses"]["Error500"];
      503: components["responses"]["Error503"];
    };
  };
  /**
   * updateMeeting
   * @description Effective approved admin only; recheck allowlist and role on server. 401 before 403; both before lookup/payload validation. Curator alone is denied. CSRF on unsafe methods. Atomic refusal changes nothing; member/own-profile gates apply to admin outside these endpoints. Unchanged removed association retained; deliberate unlink/relink releases it. No reading facts change.
   */
  updateMeeting: {
    parameters: {
      path: {
        meetingId: components["schemas"]["Id"];
      };
    };
    requestBody: {
      content: {
        /**
         * @example {
         *   "startsAt": "2026-01-15T19:00:00Z",
         *   "bookId": null,
         *   "weekId": null
         * }
         */
        "application/json": components["schemas"]["MeetingInput"];
      };
    };
    responses: {
      /** @description Successful approved-admin result. */
      200: {
        content: {
          "application/json": components["schemas"]["AdminMeeting"];
        };
      };
      400: components["responses"]["Error400"];
      401: components["responses"]["Error401"];
      403: components["responses"]["Error403"];
      404: components["responses"]["Error404"];
      409: components["responses"]["Error409"];
      500: components["responses"]["Error500"];
      503: components["responses"]["Error503"];
    };
  };
  /**
   * setMeetingCancelled
   * @description Effective approved admin only; recheck allowlist and role on server. 401 before 403; both before lookup/payload validation. Curator alone is denied. CSRF on unsafe methods. Atomic refusal changes nothing; member/own-profile gates apply to admin outside these endpoints. Preserve records/attendance; member projection suppresses them while cancelled.
   */
  setMeetingCancelled: {
    parameters: {
      path: {
        meetingId: components["schemas"]["Id"];
      };
    };
    requestBody: {
      content: {
        /**
         * @example {
         *   "cancelled": true
         * }
         */
        "application/json": components["schemas"]["CancelledInput"];
      };
    };
    responses: {
      /** @description Successful approved-admin result. */
      200: {
        content: {
          "application/json": components["schemas"]["AdminMeeting"];
        };
      };
      400: components["responses"]["Error400"];
      401: components["responses"]["Error401"];
      403: components["responses"]["Error403"];
      404: components["responses"]["Error404"];
      500: components["responses"]["Error500"];
      503: components["responses"]["Error503"];
    };
  };
  /**
   * setMeetingAttendance
   * @description Effective approved admin only; recheck allowlist and role on server. 401 before 403; both before lookup/payload validation. Curator alone is denied. CSRF on unsafe methods. Atomic refusal changes nothing; member/own-profile gates apply to admin outside these endpoints. Strictly past and not cancelled; active selections replace while revoked recorded history retained.
   */
  setMeetingAttendance: {
    parameters: {
      path: {
        meetingId: components["schemas"]["Id"];
      };
    };
    requestBody: {
      content: {
        /**
         * @example {
         *   "memberIds": []
         * }
         */
        "application/json": components["schemas"]["AttendanceInput"];
      };
    };
    responses: {
      /** @description Successful approved-admin result. */
      200: {
        content: {
          "application/json": components["schemas"]["AdminMeeting"];
        };
      };
      400: components["responses"]["Error400"];
      401: components["responses"]["Error401"];
      403: components["responses"]["Error403"];
      404: components["responses"]["Error404"];
      409: components["responses"]["Error409"];
      500: components["responses"]["Error500"];
      503: components["responses"]["Error503"];
    };
  };
  /**
   * listAdminBooks
   * @description Effective approved admin only; recheck allowlist and role on server. 401 before 403; both before lookup/payload validation. Curator alone is denied. CSRF on unsafe methods. Atomic refusal changes nothing; member/own-profile gates apply to admin outside these endpoints.
   */
  listAdminBooks: {
    responses: {
      /** @description Successful approved-admin result. */
      200: {
        content: {
          "application/json": components["schemas"]["AdminBook"][];
        };
      };
      401: components["responses"]["Error401"];
      403: components["responses"]["Error403"];
      500: components["responses"]["Error500"];
      503: components["responses"]["Error503"];
    };
  };
  /**
   * createBook
   * @description Effective approved admin only; recheck allowlist and role on server. 401 before 403; both before lookup/payload validation. Curator alone is denied. CSRF on unsafe methods. Atomic refusal changes nothing; member/own-profile gates apply to admin outside these endpoints. Single leyendo rechecked after async image processing immediately before commit, 409 with safe current-book label.
   */
  createBook: {
    requestBody: {
      content: {
        /**
         * @example {
         *   "metadata": {
         *     "title": "Texto ficticio",
         *     "authors": [],
         *     "status": "propuesto",
         *     "readingStartDate": null,
         *     "readingEndDate": null,
         *     "datesApproximate": false,
         *     "plannedStartDate": null,
         *     "plannedEndDate": null,
         *     "description": null,
         *     "publicationDate": null,
         *     "publisher": null,
         *     "isbn": null,
         *     "pageCount": null,
         *     "coverAction": "keep"
         *   }
         * }
         */
        "multipart/form-data": components["schemas"]["BookMultipart"];
      };
    };
    responses: {
      /** @description Successful approved-admin result. */
      201: {
        content: {
          "application/json": components["schemas"]["AdminBook"];
        };
      };
      400: components["responses"]["Error400"];
      401: components["responses"]["Error401"];
      403: components["responses"]["Error403"];
      404: components["responses"]["Error404"];
      409: components["responses"]["Error409"];
      500: components["responses"]["Error500"];
      503: components["responses"]["Error503"];
    };
  };
  /**
   * getAdminBook
   * @description Effective approved admin only; recheck allowlist and role on server. 401 before 403; both before lookup/payload validation. Curator alone is denied. CSRF on unsafe methods. Atomic refusal changes nothing; member/own-profile gates apply to admin outside these endpoints. Metadata only.
   */
  getAdminBook: {
    parameters: {
      path: {
        bookId: components["schemas"]["Id"];
      };
    };
    responses: {
      /** @description Successful approved-admin result. */
      200: {
        content: {
          "application/json": components["schemas"]["AdminBook"];
        };
      };
      401: components["responses"]["Error401"];
      403: components["responses"]["Error403"];
      404: components["responses"]["Error404"];
      500: components["responses"]["Error500"];
      503: components["responses"]["Error503"];
    };
  };
  /**
   * updateBook
   * @description Effective approved admin only; recheck allowlist and role on server. 401 before 403; both before lookup/payload validation. Curator alone is denied. CSRF on unsafe methods. Atomic refusal changes nothing; member/own-profile gates apply to admin outside these endpoints. Stable id/originVote preserved; same atomic whole edit and single leyendo invariant.
   */
  updateBook: {
    parameters: {
      path: {
        bookId: components["schemas"]["Id"];
      };
    };
    requestBody: {
      content: {
        /**
         * @example {
         *   "metadata": {
         *     "title": "Texto ficticio",
         *     "authors": [],
         *     "status": "propuesto",
         *     "readingStartDate": null,
         *     "readingEndDate": null,
         *     "datesApproximate": false,
         *     "plannedStartDate": null,
         *     "plannedEndDate": null,
         *     "description": null,
         *     "publicationDate": null,
         *     "publisher": null,
         *     "isbn": null,
         *     "pageCount": null,
         *     "coverAction": "keep"
         *   }
         * }
         */
        "multipart/form-data": components["schemas"]["BookMultipart"];
      };
    };
    responses: {
      /** @description Successful approved-admin result. */
      200: {
        content: {
          "application/json": components["schemas"]["AdminBook"];
        };
      };
      400: components["responses"]["Error400"];
      401: components["responses"]["Error401"];
      403: components["responses"]["Error403"];
      404: components["responses"]["Error404"];
      409: components["responses"]["Error409"];
      500: components["responses"]["Error500"];
      503: components["responses"]["Error503"];
    };
  };
  /**
   * searchBookMetadata
   * @description Effective approved admin only; recheck allowlist and role on server. 401 before 403; both before lookup/payload validation. Curator alone is denied. CSRF on unsafe methods. Atomic refusal changes nothing; member/own-profile gates apply to admin outside these endpoints. Explicit trimmed title/author query, blank/overlong 400. No write from search/local selection; actual free provider lookup #15.
   */
  searchBookMetadata: {
    parameters: {
      query: {
        /** @example Texto ficticio */
        query: string;
      };
    };
    responses: {
      /** @description Successful approved-admin result. */
      200: {
        content: {
          "application/json": components["schemas"]["BookMetadataResult"][];
        };
      };
      400: components["responses"]["Error400"];
      401: components["responses"]["Error401"];
      403: components["responses"]["Error403"];
      500: components["responses"]["Error500"];
      503: components["responses"]["Error503"];
    };
  };
  /**
   * getAdminMembers
   * @description Effective approved admin only; recheck allowlist and role on server. 401 before 403; both before lookup/payload validation. Curator alone is denied. CSRF on unsafe methods. Atomic refusal changes nothing; member/own-profile gates apply to admin outside these endpoints.
   */
  getAdminMembers: {
    responses: {
      /** @description Successful approved-admin result. */
      200: {
        content: {
          "application/json": components["schemas"]["AdminMembers"];
        };
      };
      401: components["responses"]["Error401"];
      403: components["responses"]["Error403"];
      500: components["responses"]["Error500"];
      503: components["responses"]["Error503"];
    };
  };
  /**
   * addMember
   * @description Effective approved admin only; recheck allowlist and role on server. 401 before 403; both before lookup/payload validation. Curator alone is denied. CSRF on unsafe methods. Atomic refusal changes nothing; member/own-profile gates apply to admin outside these endpoints. Existing active/revoked Discord id 409 before invalid input 400.
   */
  addMember: {
    requestBody: {
      content: {
        /**
         * @example {
         *   "discordId": "12345678901234567",
         *   "displayName": "Persona ficticia"
         * }
         */
        "application/json": components["schemas"]["NewMember"];
      };
    };
    responses: {
      /** @description Successful approved-admin result. */
      201: {
        content: {
          "application/json": components["schemas"]["AdminMembers"];
        };
      };
      400: components["responses"]["Error400"];
      401: components["responses"]["Error401"];
      403: components["responses"]["Error403"];
      409: components["responses"]["Error409"];
      500: components["responses"]["Error500"];
      503: components["responses"]["Error503"];
    };
  };
  /**
   * revokeMember
   * @description Effective approved admin only; recheck allowlist and role on server. 401 before 403; both before lookup/payload validation. Curator alone is denied. CSRF on unsafe methods. Atomic refusal changes nothing; member/own-profile gates apply to admin outside these endpoints. Missing 404, signed-in admin/already revoked 409; clear curator if needed, retain contributions.
   */
  revokeMember: {
    parameters: {
      path: {
        memberId: components["schemas"]["Id"];
      };
    };
    responses: {
      /** @description Successful approved-admin result. */
      200: {
        content: {
          "application/json": components["schemas"]["AdminMembers"];
        };
      };
      401: components["responses"]["Error401"];
      403: components["responses"]["Error403"];
      404: components["responses"]["Error404"];
      409: components["responses"]["Error409"];
      500: components["responses"]["Error500"];
      503: components["responses"]["Error503"];
    };
  };
  /**
   * restoreMember
   * @description Effective approved admin only; recheck allowlist and role on server. 401 before 403; both before lookup/payload validation. Curator alone is denied. CSRF on unsafe methods. Atomic refusal changes nothing; member/own-profile gates apply to admin outside these endpoints. Missing 404, already active 409; preserved own profile.
   */
  restoreMember: {
    parameters: {
      path: {
        memberId: components["schemas"]["Id"];
      };
    };
    responses: {
      /** @description Successful approved-admin result. */
      200: {
        content: {
          "application/json": components["schemas"]["AdminMembers"];
        };
      };
      401: components["responses"]["Error401"];
      403: components["responses"]["Error403"];
      404: components["responses"]["Error404"];
      409: components["responses"]["Error409"];
      500: components["responses"]["Error500"];
      503: components["responses"]["Error503"];
    };
  };
  /**
   * setCurator
   * @description Effective approved admin only; recheck allowlist and role on server. 401 before 403; both before lookup/payload validation. Curator alone is denied. CSRF on unsafe methods. Atomic refusal changes nothing; member/own-profile gates apply to admin outside these endpoints. Unknown/revoked member 404, null clears; existing votes retain recorded curator; no role changes.
   */
  setCurator: {
    requestBody: {
      content: {
        /**
         * @example {
         *   "memberId": null
         * }
         */
        "application/json": components["schemas"]["CuratorInput"];
      };
    };
    responses: {
      /** @description Successful approved-admin result. */
      200: {
        content: {
          "application/json": components["schemas"]["AdminMembers"];
        };
      };
      400: components["responses"]["Error400"];
      401: components["responses"]["Error401"];
      403: components["responses"]["Error403"];
      404: components["responses"]["Error404"];
      500: components["responses"]["Error500"];
      503: components["responses"]["Error503"];
    };
  };
}
