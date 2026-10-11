/** Generated from root openapi.yaml. DO NOT EDIT. Run npm run generate:api. */
export interface paths {
    "/api/health": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Public process liveness
         * @description Implemented bootstrap; does not query the database or external providers.
         */
        get: operations["getHealth"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/session": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * getSession
         * @description Always 200 anonymous/denied/signedIn; bootstraps csrftoken cookie. Recheck allowlist/revocation server-side. No second current-user endpoint.
         */
        get: operations["getSession"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/auth/logout": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * signOut
         * @description Idempotent logout even without authenticated membership. CSRF required; invalidate session cookie.
         */
        post: operations["signOut"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/auth/demo": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * startDemoSignIn
         * @description CSRF required. DEMO_MODE only, establishes fictional session; otherwise generic 404. Never available on real club instance.
         */
        post: operations["startDemoSignIn"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/home": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * getHome
         * @description Home is gated server-side before activity text and review totals are composed; ratings/records cannot leak via card/feed counts.
         */
        get: operations["getHome"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/weeks/{weekId}/completion": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /**
         * setWeekCompleted
         * @description Own session identity only; 403 smuggled ownership, 401 before lookup, unknown/removed week 404 before invalid input. Independent from finished flag; idempotent.
         */
        put: operations["setWeekCompleted"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/books": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * listBooks
         * @description Approved membership rechecked before data lookup. See docs/api.md for server obligations and error precedence.
         */
        get: operations["listBooks"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/books/{bookId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * getBook
         * @description Approved membership rechecked before data lookup. See docs/api.md for server obligations and error precedence.
         */
        get: operations["getBook"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/meetings": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * listMeetings
         * @description Approved membership rechecked before data lookup. See docs/api.md for server obligations and error precedence.
         */
        get: operations["listMeetings"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/meetings/{meetingId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * getMeeting
         * @description Central MeetingRecord gate includes admin member views; published content only; cancelled/removed linked week suppress substantive records.
         */
        get: operations["getMeeting"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/votes": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * getVotes
         * @description Approved membership rechecked before data lookup. See docs/api.md for server obligations and error precedence.
         */
        get: operations["getVotes"];
        put?: never;
        /**
         * createVote
         * @description 401 then effective current curator/admin permission 403; missing curator or existing draft/open 409. Empty draft shortlist belongs to current curator even when admin creates. No request body.
         */
        post: operations["createVote"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/votes/{voteId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * getVote
         * @description Approved membership rechecked before data lookup. See docs/api.md for server obligations and error precedence.
         */
        get: operations["getVote"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/votes/{voteId}/candidates/{bookId}/approval": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /**
         * setApproval
         * @description Own identity from session. 401 then unknown vote/candidate 404, state not open 409, invalid input 400; ownership keys 403. Public approvals; no automatic book transitions.
         */
        put: operations["setApproval"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/votes/{voteId}/candidates": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * addCandidate
         * @description 401 then current curator/admin 403 before lookup, vote/book 404 then closed/duplicate/non-propuesto book 409, invalid input 400. Append candidate.
         */
        post: operations["addCandidate"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/votes/{voteId}/candidates/{bookId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /**
         * removeCandidate
         * @description 401 then current curator/admin 403, unknown vote/candidate 404, closed or open shortlist <=2 409. Remove all approvals atomically.
         */
        delete: operations["removeCandidate"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/votes/{voteId}/candidates/order": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /**
         * reorderCandidates
         * @description 401 then permission 403, vote/any book lookup 404, closed or stale/non-exact candidate set 409, malformed input 400.
         */
        put: operations["reorderCandidates"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/votes/{voteId}/open": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * openVote
         * @description 401 then permission 403, vote lookup 404, non-draft or <2 candidates 409. No body.
         */
        post: operations["openVote"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/votes/{voteId}/close": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * closeVote
         * @description 401 then permission 403, lookup 404, non-open 409. Server computes winner/tie. No body or automatic catalogue/curator changes.
         */
        post: operations["closeVote"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/votes/{voteId}/tie-winner": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * recordTieWinner
         * @description 401 then admin-only 403, vote/book lookup 404, not pending tie/not tied book 409, trimmed note >1000 400. Manual outcome, never book transitions.
         */
        post: operations["recordTieWinner"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/books/{bookId}/ratings": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * getBookRatings
         * @description 401 before book lookup. Ratings gate finished AND own complete review, including historical/admin member views. Own review always returned.
         */
        get: operations["getBookRatings"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/rating-rubric": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * getRatingRubric
         * @description Approved membership rechecked before data lookup. See docs/api.md for server obligations and error precedence.
         */
        get: operations["getRatingRubric"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/books/{bookId}/finished": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /**
         * setBookFinished
         * @description Session identity only. 401, ownership 403, book lookup 404, not ratable when finishing or existing review when clearing 409, invalid 400. Independent from weekly completion.
         */
        put: operations["setBookFinished"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/books/{bookId}/my-review": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /**
         * saveMyReview
         * @description Session identity only. 401, smuggled ownership 403, book lookup 404, not ratable/not finished 409, scores/text 400. Atomic create/replace; exactly five half-star scores; text <=5000 AFTER trim, blank->null.
         */
        put: operations["saveMyReview"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/statistics": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * getStatistics
         * @description Drop viewer-locked books BEFORE all means/counts/radars/highlights, with thresholds/denominators unchanged. No hidden book count.
         */
        get: operations["getStatistics"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/statistics/compatibility": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * getTasteCompatibility
         * @description Only viewer-unlocked shared ratings. Three shared books minimum before differences/metadata. Insufficient status has no scores/books; permitted sharedBookCount remains at outer member level.
         */
        get: operations["getTasteCompatibility"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/members": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * listMembers
         * @description Approved membership rechecked before data lookup. See docs/api.md for server obligations and error precedence.
         */
        get: operations["listMembers"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/members/{memberId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * getMemberProfile
         * @description 401 before lookup; revoked and unknown IDs indistinguishable generic 404. Public website-native profile/progress only, never ratings/taste/Discord identity.
         */
        get: operations["getMemberProfile"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/me/profile": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
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
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/me/reviews": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * listMyReviews
         * @description Approved membership rechecked before data lookup. See docs/api.md for server obligations and error precedence.
         */
        get: operations["listMyReviews"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/auth/discord/start": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Same-site OAuth navigation
         * @description Top-level navigation, not JSON sign-in. Discord identify scope only; approved exact IDs, revoke check, state and identity checked server-side. Server-held same-origin return navigation; deny missing/invalid state without club payload. No access/refresh tokens exposed. Export purpose performs admin reauthentication (#102). For purpose=export require existing approved admin and bind server OAuth state to that same identity; require a fresh provider authentication, not reuse of prior local confirmation. Callback records server recent-auth time only after state, identity and current allowlist/admin checks; wrong identity never authorises export. Safe same-site return only.
         */
        get: operations["startSignIn"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/auth/discord/callback": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Same-site OAuth navigation
         * @description Top-level navigation, not JSON sign-in. Discord identify scope only; approved exact IDs, revoke check, state and identity checked server-side. Server-held same-origin return navigation; deny missing/invalid state without club payload. No access/refresh tokens exposed. Export purpose performs admin reauthentication (#102). For server-held export purpose, successful fresh provider authentication must match original approved admin identity and rechecked allowlist/admin role before server stores recent-auth timestamp. Absent/stale authorisation later yields export 409 without expiring approved session. No tokens exposed.
         */
        get: operations["discordCallback"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/backups": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * getBackupInfo
         * @description Effective approved admin only; recheck allowlist and role on server. 401 before 403; both before lookup/payload validation. Curator alone is denied. CSRF on unsafe methods. Atomic refusal changes nothing; member/own-profile gates apply to admin outside these endpoints.
         */
        get: operations["getBackupInfo"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/export": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * exportClubData
         * @description Effective approved admin only; recheck allowlist and role on server. 401 before 403; both before lookup/payload validation. Curator alone is denied. CSRF on unsafe methods. Atomic refusal changes nothing; member/own-profile gates apply to admin outside these endpoints. Requires recent same-approved-admin Discord OAuth reauthentication after verified identity/allowlist checks. Five minutes by server clock, recorded server-side (#49/#5). Confirmation/request boolean insufficient; no body accepted. Include UTF-8 manifest.json + club.json and available website media. Authenticated noncached attachment; sessions/secrets excluded. Export event included once in safe audit.
         */
        post: operations["exportClubData"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/audit-log": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * getAuditLog
         * @description Effective approved admin only; recheck allowlist and role on server. 401 before 403; both before lookup/payload validation. Curator alone is denied. CSRF on unsafe methods. Atomic refusal changes nothing; member/own-profile gates apply to admin outside these endpoints.
         */
        get: operations["getAuditLog"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/bin": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * getRecycleBin
         * @description Effective approved admin only; recheck allowlist and role on server. 401 before 403; both before lookup/payload validation. Curator alone is denied. CSRF on unsafe methods. Atomic refusal changes nothing; member/own-profile gates apply to admin outside these endpoints.
         */
        get: operations["getRecycleBin"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/deletion-preview/{type}/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * getDeletionPreview
         * @description Effective approved admin only; recheck allowlist and role on server. 401 before 403; both before lookup/payload validation. Curator alone is denied. CSRF on unsafe methods. Atomic refusal changes nothing; member/own-profile gates apply to admin outside these endpoints. Only book/meeting/quote preview types; safe operational dependencies.
         */
        get: operations["getDeletionPreview"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/bin/{type}/{id}/restore": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * restoreDeleted
         * @description Effective approved admin only; recheck allowlist and role on server. 401 before 403; both before lookup/payload validation. Curator alone is denied. CSRF on unsafe methods. Atomic refusal changes nothing; member/own-profile gates apply to admin outside these endpoints. Missing/nonremoved/purged target 404. Expired restore 409. Restore selected metadata only, not independently removed descendants; required parent first. One leyendo, quote uniqueness and canonical same-book/one-to-one link checks 409. Meeting restoration allowed with removed linked week (gate remains locked). Purge is dependency-blocked 409, never cascades: book weeks/meetings/reviews/finished/favourites/votes; meeting reservations/attendance/highlights; week completions/links. Quote/highlight eligible independently. 30-day deadline does not promise automatic job. #12/#46/#47 refine production erasure first.
         */
        post: operations["restoreDeleted"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/bin/{type}/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /**
         * purgeDeleted
         * @description Effective approved admin only; recheck allowlist and role on server. 401 before 403; both before lookup/payload validation. Curator alone is denied. CSRF on unsafe methods. Atomic refusal changes nothing; member/own-profile gates apply to admin outside these endpoints. Missing/nonremoved/purged target 404. Expired restore 409. Restore selected metadata only, not independently removed descendants; required parent first. One leyendo, quote uniqueness and canonical same-book/one-to-one link checks 409. Meeting restoration allowed with removed linked week (gate remains locked). Purge is dependency-blocked 409, never cascades: book weeks/meetings/reviews/finished/favourites/votes; meeting reservations/attendance/highlights; week completions/links. Quote/highlight eligible independently. 30-day deadline does not promise automatic job. #12/#46/#47 refine production erasure first.
         */
        delete: operations["purgeDeleted"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/books/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /**
         * deleteBook
         * @description Effective approved admin only; recheck allowlist and role on server. 401 before 403; both before lookup/payload validation. Curator alone is denied. CSRF on unsafe methods. Atomic refusal changes nothing; member/own-profile gates apply to admin outside these endpoints. Soft removal retains linked business history and metadata for exactly 30 days; repeated/missing target 404. Never cascade purge; member projections suppress removed targets/dependent content.
         */
        delete: operations["deleteBook"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/meetings/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /**
         * deleteMeeting
         * @description Effective approved admin only; recheck allowlist and role on server. 401 before 403; both before lookup/payload validation. Curator alone is denied. CSRF on unsafe methods. Atomic refusal changes nothing; member/own-profile gates apply to admin outside these endpoints. Soft removal retains linked business history and metadata for exactly 30 days; repeated/missing target 404. Never cascade purge; member projections suppress removed targets/dependent content.
         */
        delete: operations["deleteMeeting"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/quotes/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /**
         * updateLiteraryQuote
         * @description Effective approved admin only; recheck allowlist and role on server. 401 before 403; both before lookup/payload validation. Curator alone is denied. CSRF on unsafe methods. Atomic refusal changes nothing; member/own-profile gates apply to admin outside these endpoints. Stable id/order, normalized duplicates 409.
         */
        put: operations["updateLiteraryQuote"];
        post?: never;
        /**
         * deleteLiteraryQuote
         * @description Effective approved admin only; recheck allowlist and role on server. 401 before 403; both before lookup/payload validation. Curator alone is denied. CSRF on unsafe methods. Atomic refusal changes nothing; member/own-profile gates apply to admin outside these endpoints. Soft removal retains linked business history and metadata for exactly 30 days; repeated/missing target 404. Never cascade purge; member projections suppress removed targets/dependent content.
         */
        delete: operations["deleteLiteraryQuote"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/quotes": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * listAdminQuotes
         * @description Effective approved admin only; recheck allowlist and role on server. 401 before 403; both before lookup/payload validation. Curator alone is denied. CSRF on unsafe methods. Atomic refusal changes nothing; member/own-profile gates apply to admin outside these endpoints.
         */
        get: operations["listAdminQuotes"];
        put?: never;
        /**
         * addLiteraryQuote
         * @description Effective approved admin only; recheck allowlist and role on server. 401 before 403; both before lookup/payload validation. Curator alone is denied. CSRF on unsafe methods. Atomic refusal changes nothing; member/own-profile gates apply to admin outside these endpoints. Normalized duplicate 409, including recoverable quotes.
         */
        post: operations["addLiteraryQuote"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/rating-rubric": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /**
         * saveRatingRubric
         * @description Effective approved admin only; recheck allowlist and role on server. 401 before 403; both before lookup/payload validation. Curator alone is denied. CSRF on unsafe methods. Atomic refusal changes nothing; member/own-profile gates apply to admin outside these endpoints. Validate all 25 anchors before commit.
         */
        put: operations["saveRatingRubric"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/meetings/{meetingId}/record": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * getAdminMeetingRecord
         * @description Effective approved admin only; recheck allowlist and role on server. 401 before 403; both before lookup/payload validation. Curator alone is denied. CSRF on unsafe methods. Atomic refusal changes nothing; member/own-profile gates apply to admin outside these endpoints. Draft editor only.
         */
        get: operations["getAdminMeetingRecord"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/meetings/{meetingId}/record/summary": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /**
         * saveMeetingSummary
         * @description Effective approved admin only; recheck allowlist and role on server. 401 before 403; both before lookup/payload validation. Curator alone is denied. CSRF on unsafe methods. Atomic refusal changes nothing; member/own-profile gates apply to admin outside these endpoints. Independent publication, blank published 400.
         */
        put: operations["saveMeetingSummary"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/meetings/{meetingId}/record/highlights": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * createMeetingHighlight
         * @description Effective approved admin only; recheck allowlist and role on server. 401 before 403; both before lookup/payload validation. Curator alone is denied. CSRF on unsafe methods. Atomic refusal changes nothing; member/own-profile gates apply to admin outside these endpoints. Active speakers only on creation.
         */
        post: operations["createMeetingHighlight"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/meetings/{meetingId}/record/highlights/{highlightId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /**
         * updateMeetingHighlight
         * @description Effective approved admin only; recheck allowlist and role on server. 401 before 403; both before lookup/payload validation. Curator alone is denied. CSRF on unsafe methods. Atomic refusal changes nothing; member/own-profile gates apply to admin outside these endpoints. Retain/remove unchanged revoked attribution; new revoked/unknown speaker choices 400.
         */
        put: operations["updateMeetingHighlight"];
        post?: never;
        /**
         * removeMeetingHighlight
         * @description Effective approved admin only; recheck allowlist and role on server. 401 before 403; both before lookup/payload validation. Curator alone is denied. CSRF on unsafe methods. Atomic refusal changes nothing; member/own-profile gates apply to admin outside these endpoints. Soft removal keeps publication/content/attribution and original position with 30-day metadata.
         */
        delete: operations["removeMeetingHighlight"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/meetings/{meetingId}/record/highlights/order": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /**
         * reorderMeetingHighlights
         * @description Effective approved admin only; recheck allowlist and role on server. 401 before 403; both before lookup/payload validation. Curator alone is denied. CSRF on unsafe methods. Atomic refusal changes nothing; member/own-profile gates apply to admin outside these endpoints. Exact active permutation; keep removed slots.
         */
        put: operations["reorderMeetingHighlights"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/meetings/{meetingId}/record/safe": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /**
         * setMeetingRecordSafe
         * @description Effective approved admin only; recheck allowlist and role on server. 401 before 403; both before lookup/payload validation. Curator alone is denied. CSRF on unsafe methods. Atomic refusal changes nothing; member/own-profile gates apply to admin outside these endpoints. Both safe values conflict 409 when any active/removed week link exists.
         */
        put: operations["setMeetingRecordSafe"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/books/{bookId}/reading-plan": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * getAdminReadingPlan
         * @description Effective approved admin only; recheck allowlist and role on server. 401 before 403; both before lookup/payload validation. Curator alone is denied. CSRF on unsafe methods. Atomic refusal changes nothing; member/own-profile gates apply to admin outside these endpoints. Active operational plan.
         */
        get: operations["getAdminReadingPlan"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/books/{bookId}/reading-plan/weeks": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * createReadingWeek
         * @description Effective approved admin only; recheck allowlist and role on server. 401 before 403; both before lookup/payload validation. Curator alone is denied. CSRF on unsafe methods. Atomic refusal changes nothing; member/own-profile gates apply to admin outside these endpoints. Canonical links and recomputed warning acknowledgement required; refusal atomic. Unacknowledged recomputed warnings are 400 invalid_input (not conversion); occupied link is 409 conflict.
         */
        post: operations["createReadingWeek"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/books/{bookId}/reading-plan/weeks/{weekId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /**
         * updateReadingWeek
         * @description Effective approved admin only; recheck allowlist and role on server. 401 before 403; both before lookup/payload validation. Curator alone is denied. CSRF on unsafe methods. Atomic refusal changes nothing; member/own-profile gates apply to admin outside these endpoints. Stable id retains completions; canonical links and recomputed warning acknowledgement. Unacknowledged recomputed warnings are 400 invalid_input (not conversion); occupied link is 409 conflict.
         */
        put: operations["updateReadingWeek"];
        post?: never;
        /**
         * removeReadingWeek
         * @description Effective approved admin only; recheck allowlist and role on server. 401 before 403; both before lookup/payload validation. Curator alone is denied. CSRF on unsafe methods. Atomic refusal changes nothing; member/own-profile gates apply to admin outside these endpoints. Retain facts/completions/canonical meeting link, 30-day removal metadata; linked member record locked even if safe.
         */
        delete: operations["removeReadingWeek"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/books/{bookId}/reading-plan/weeks/order": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /**
         * reorderReadingWeeks
         * @description Effective approved admin only; recheck allowlist and role on server. 401 before 403; both before lookup/payload validation. Curator alone is denied. CSRF on unsafe methods. Atomic refusal changes nothing; member/own-profile gates apply to admin outside these endpoints. Exact active permutation then full-plan warnings recomputed. Unacknowledged recomputed warnings are 400 invalid_input (not conversion); occupied link is 409 conflict.
         */
        put: operations["reorderReadingWeeks"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/meetings": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * listAdminMeetings
         * @description Effective approved admin only; recheck allowlist and role on server. 401 before 403; both before lookup/payload validation. Curator alone is denied. CSRF on unsafe methods. Atomic refusal changes nothing; member/own-profile gates apply to admin outside these endpoints.
         */
        get: operations["listAdminMeetings"];
        put?: never;
        /**
         * createMeeting
         * @description Effective approved admin only; recheck allowlist and role on server. 401 before 403; both before lookup/payload validation. Curator alone is denied. CSRF on unsafe methods. Atomic refusal changes nothing; member/own-profile gates apply to admin outside these endpoints. Canonical book/week links validated; occupied reservation 409.
         */
        post: operations["createMeeting"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/meetings/{meetingId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
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
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/meetings/{meetingId}/cancelled": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /**
         * setMeetingCancelled
         * @description Effective approved admin only; recheck allowlist and role on server. 401 before 403; both before lookup/payload validation. Curator alone is denied. CSRF on unsafe methods. Atomic refusal changes nothing; member/own-profile gates apply to admin outside these endpoints. Preserve records/attendance; member projection suppresses them while cancelled.
         */
        put: operations["setMeetingCancelled"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/meetings/{meetingId}/attendance": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /**
         * setMeetingAttendance
         * @description Effective approved admin only; recheck allowlist and role on server. 401 before 403; both before lookup/payload validation. Curator alone is denied. CSRF on unsafe methods. Atomic refusal changes nothing; member/own-profile gates apply to admin outside these endpoints. Strictly past and not cancelled; active selections replace while revoked recorded history retained.
         */
        put: operations["setMeetingAttendance"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/books": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * listAdminBooks
         * @description Effective approved admin only; recheck allowlist and role on server. 401 before 403; both before lookup/payload validation. Curator alone is denied. CSRF on unsafe methods. Atomic refusal changes nothing; member/own-profile gates apply to admin outside these endpoints.
         */
        get: operations["listAdminBooks"];
        put?: never;
        /**
         * createBook
         * @description Effective approved admin only; recheck allowlist and role on server. 401 before 403; both before lookup/payload validation. Curator alone is denied. CSRF on unsafe methods. Atomic refusal changes nothing; member/own-profile gates apply to admin outside these endpoints. Single leyendo rechecked after async image processing immediately before commit, 409 with safe current-book label.
         */
        post: operations["createBook"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/books/{bookId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
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
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/book-metadata": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * searchBookMetadata
         * @description Effective approved admin only; recheck allowlist and role on server. 401 before 403; both before lookup/payload validation. Curator alone is denied. CSRF on unsafe methods. Atomic refusal changes nothing; member/own-profile gates apply to admin outside these endpoints. Explicit trimmed title/author query, blank/overlong 400. No write from search/local selection; actual free provider lookup #15.
         */
        get: operations["searchBookMetadata"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/members": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * getAdminMembers
         * @description Effective approved admin only; recheck allowlist and role on server. 401 before 403; both before lookup/payload validation. Curator alone is denied. CSRF on unsafe methods. Atomic refusal changes nothing; member/own-profile gates apply to admin outside these endpoints.
         */
        get: operations["getAdminMembers"];
        put?: never;
        /**
         * addMember
         * @description Effective approved admin only; recheck allowlist and role on server. 401 before 403; both before lookup/payload validation. Curator alone is denied. CSRF on unsafe methods. Atomic refusal changes nothing; member/own-profile gates apply to admin outside these endpoints. Existing active/revoked Discord id 409 before invalid input 400.
         */
        post: operations["addMember"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/members/{memberId}/revoke": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * revokeMember
         * @description Effective approved admin only; recheck allowlist and role on server. 401 before 403; both before lookup/payload validation. Curator alone is denied. CSRF on unsafe methods. Atomic refusal changes nothing; member/own-profile gates apply to admin outside these endpoints. Missing 404, signed-in admin/already revoked 409; clear curator if needed, retain contributions.
         */
        post: operations["revokeMember"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/members/{memberId}/restore": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * restoreMember
         * @description Effective approved admin only; recheck allowlist and role on server. 401 before 403; both before lookup/payload validation. Curator alone is denied. CSRF on unsafe methods. Atomic refusal changes nothing; member/own-profile gates apply to admin outside these endpoints. Missing 404, already active 409; preserved own profile.
         */
        post: operations["restoreMember"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/curator": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /**
         * setCurator
         * @description Effective approved admin only; recheck allowlist and role on server. 401 before 403; both before lookup/payload validation. Curator alone is denied. CSRF on unsafe methods. Atomic refusal changes nothing; member/own-profile gates apply to admin outside these endpoints. Unknown/revoked member 404, null clears; existing votes retain recorded curator; no role changes.
         */
        put: operations["setCurator"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
}
export type webhooks = Record<string, never>;
export interface components {
    schemas: {
        /**
         * @description Opaque website identifier, not necessarily UUID; never a Discord identity.
         * @example book-fiction-1
         */
        Id: string;
        /**
         * Format: date-time
         * @description ISO 8601 instant with offset; server clock and configured club timezone govern ordering.
         * @example 2026-01-15T19:00:00Z
         */
        Instant: string;
        /**
         * Format: date
         * @description Calendar date YYYY-MM-DD without a timezone. Approximate historical dates use this best-known date plus datesApproximate; unknown dates are null.
         * @example 1985-01-01
         */
        CalendarDate: string;
        /**
         * @example {
         *       "id": "book-fiction-1",
         *       "displayName": "Texto ficticio",
         *       "avatarUrl": null
         *     }
         */
        MemberSummary: {
            id: components["schemas"]["Id"];
            displayName: string;
            avatarUrl: string | null;
        };
        /**
         * @example {
         *       "id": "book-fiction-1",
         *       "displayName": "Texto ficticio",
         *       "role": "admin",
         *       "avatarUrl": null
         *     }
         */
        CurrentUser: {
            id: components["schemas"]["Id"];
            displayName: string;
            /** @enum {string} */
            role: "admin" | "member";
            avatarUrl: string | null;
        };
        /**
         * @example {
         *       "status": "anonymous",
         *       "demoSignInAvailable": false
         *     }
         */
        SessionAnonymous: {
            /**
             * @description discriminator enum property added by openapi-typescript
             * @enum {string}
             */
            status: "anonymous";
            demoSignInAvailable: boolean;
        };
        /**
         * @example {
         *       "status": "denied",
         *       "demoSignInAvailable": false
         *     }
         */
        SessionDenied: {
            /**
             * @description discriminator enum property added by openapi-typescript
             * @enum {string}
             */
            status: "denied";
            demoSignInAvailable: boolean;
        };
        /**
         * @example {
         *       "status": "signedIn",
         *       "user": {
         *         "id": "member-fiction-1",
         *         "displayName": "Lucía",
         *         "role": "member",
         *         "avatarUrl": null
         *       }
         *     }
         */
        SessionSignedIn: {
            /**
             * @description discriminator enum property added by openapi-typescript
             * @enum {string}
             */
            status: "signedIn";
            user: components["schemas"]["CurrentUser"];
        };
        /**
         * @description Only signedIn carries a website user. Anonymous/denied carry no club information. Demo availability is false in production; no tokens, Discord IDs, secrets or passwords are exposed. Revoked sessions are refused.
         * @example {
         *       "status": "anonymous",
         *       "demoSignInAvailable": false
         *     }
         */
        Session: components["schemas"]["SessionAnonymous"] | components["schemas"]["SessionDenied"] | components["schemas"]["SessionSignedIn"];
        /**
         * @example {
         *       "id": "book-fiction-1",
         *       "title": "Texto ficticio",
         *       "authors": [],
         *       "coverUrl": null
         *     }
         */
        BookSummary: {
            id: components["schemas"]["Id"];
            title: string;
            authors: string[];
            coverUrl: string | null;
        };
        /**
         * @example {
         *       "weekNumber": 1,
         *       "percentStart": 0,
         *       "percentEnd": 0,
         *       "pageStart": 0,
         *       "pageEnd": 0
         *     }
         */
        MeetingAssignment: {
            weekNumber: number;
            percentStart: number;
            percentEnd: number;
            pageStart: number;
            pageEnd: number;
        };
        /**
         * @example {
         *       "id": "book-fiction-1",
         *       "weekNumber": 1,
         *       "percentStart": 0,
         *       "percentEnd": 0,
         *       "pageStart": 0,
         *       "pageEnd": 0,
         *       "meetingStartsAt": null,
         *       "completedByMe": false
         *     }
         */
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
        /**
         * @example {
         *       "id": "book-fiction-1",
         *       "startsAt": "2026-01-15T19:00:00Z",
         *       "book": null,
         *       "assignment": null
         *     }
         */
        NextMeeting: {
            id: components["schemas"]["Id"];
            startsAt: components["schemas"]["Instant"];
            book: components["schemas"]["BookSummary"] | null;
            assignment: components["schemas"]["MeetingAssignment"] | null;
        };
        /**
         * @example {
         *       "member": {
         *         "id": "book-fiction-1",
         *         "displayName": "Texto ficticio",
         *         "avatarUrl": null
         *       },
         *       "completed": false
         *     }
         */
        MemberProgress: {
            member: components["schemas"]["MemberSummary"];
            completed: boolean;
        };
        /**
         * @description Spanish plain text composed server-side AFTER gates. review_available requires a canonical visible book the viewer finished AND fully rated. summary_published requires a canonical visible noncancelled meeting with an actually published summary and the existing completed-active-week or explicitly-safe-unlinked record gate. Removed linked weeks stay blocked. Omit unverifiable subject references. No hidden content or inference via labels.
         * @example {
         *       "id": "book-fiction-1",
         *       "type": "book_selected",
         *       "occurredAt": "2026-01-15T19:00:00Z",
         *       "text": "Texto ficticio"
         *     }
         */
        ActivityEvent: {
            id: components["schemas"]["Id"];
            /** @enum {string} */
            type: "book_selected" | "vote_opened" | "vote_closed" | "nomination_added" | "summary_published" | "review_available";
            occurredAt: components["schemas"]["Instant"];
            text: string;
        };
        /**
         * @description Books with terminado status and active member count are public to members. reviews counts only reviews for viewer-unlocked books (finished AND full own rating), never a hidden global total.
         * @example {
         *       "booksCompleted": 0,
         *       "reviews": 0,
         *       "members": 0
         *     }
         */
        ClubStats: {
            booksCompleted: number;
            reviews: number;
            members: number;
        };
        /**
         * @example {
         *       "text": "Texto ficticio",
         *       "author": null,
         *       "source": null
         *     }
         */
        LiteraryQuote: {
            text: string;
            author: string | null;
            source: string | null;
        };
        /**
         * @example {
         *       "currentBook": null,
         *       "currentWeek": null,
         *       "nextMeeting": null,
         *       "memberProgress": [],
         *       "recentActivity": [],
         *       "stats": {
         *         "booksCompleted": 0,
         *         "reviews": 0,
         *         "members": 0
         *       },
         *       "quote": null
         *     }
         */
        HomeData: {
            currentBook: components["schemas"]["BookSummary"] | null;
            currentWeek: components["schemas"]["ReadingWeek"] | null;
            nextMeeting: components["schemas"]["NextMeeting"] | null;
            memberProgress: components["schemas"]["MemberProgress"][];
            recentActivity: components["schemas"]["ActivityEvent"][];
            stats: components["schemas"]["ClubStats"];
            quote: components["schemas"]["LiteraryQuote"] | null;
        };
        /**
         * @description Catalogue metadata only; no review/count/mean/meeting record keys. Unsorted list; client applies existing local filters/sorts.
         * @example {
         *       "id": "book-fiction-1",
         *       "title": "Texto ficticio",
         *       "authors": [],
         *       "coverUrl": null,
         *       "status": "propuesto",
         *       "readingStartDate": null,
         *       "readingEndDate": null,
         *       "datesApproximate": false
         *     }
         */
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
        /**
         * @example {
         *       "id": "book-fiction-1",
         *       "startsAt": "2026-01-15T19:00:00Z"
         *     }
         */
        ScheduleMeeting: {
            id: components["schemas"]["Id"];
            startsAt: components["schemas"]["Instant"];
        };
        /**
         * @example {
         *       "id": "book-fiction-1",
         *       "completedByMe": false,
         *       "weekNumber": 1,
         *       "percentStart": 0,
         *       "percentEnd": 0,
         *       "pageStart": 0,
         *       "pageEnd": 0,
         *       "dueDate": null,
         *       "meeting": null,
         *       "notes": null
         *     }
         */
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
        /**
         * @example {
         *       "id": "book-fiction-1",
         *       "startsAt": "2026-01-15T19:00:00Z",
         *       "cancelled": false,
         *       "weekNumber": null
         *     }
         */
        BookMeeting: {
            id: components["schemas"]["Id"];
            startsAt: components["schemas"]["Instant"];
            cancelled: boolean;
            weekNumber: number | null;
        };
        /**
         * @example {
         *       "id": "book-fiction-1",
         *       "label": "Texto ficticio"
         *     }
         */
        OriginVote: {
            id: components["schemas"]["Id"];
            label: string;
        };
        /**
         * @description publicationDate is free text, e.g. 1884–1885, not forced to ISO date. Schedule by weekNumber; meetings ascending startsAt. No ratings or substantive meeting records.
         * @example {
         *       "id": "book-fiction-1",
         *       "title": "Texto ficticio",
         *       "authors": [],
         *       "coverUrl": null,
         *       "status": "propuesto",
         *       "readingStartDate": null,
         *       "readingEndDate": null,
         *       "datesApproximate": false,
         *       "plannedStartDate": null,
         *       "plannedEndDate": null,
         *       "description": null,
         *       "publicationDate": null,
         *       "publisher": null,
         *       "isbn": null,
         *       "pageCount": null,
         *       "schedule": [],
         *       "meetings": [],
         *       "originVote": null
         *     }
         */
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
        /**
         * @example {
         *       "id": "book-fiction-1",
         *       "startsAt": "2026-01-15T19:00:00Z",
         *       "cancelled": false,
         *       "book": null,
         *       "assignment": null
         *     }
         */
        MeetingListItem: {
            id: components["schemas"]["Id"];
            startsAt: components["schemas"]["Instant"];
            cancelled: boolean;
            book: components["schemas"]["BookSummary"] | null;
            assignment: components["schemas"]["MeetingAssignment"] | null;
        };
        /**
         * @description Server partitions at startsAt >= now: upcoming soonest first, past newest first. Cancelled entries stay in date partition. No pagination or substantive records.
         * @example {
         *       "upcoming": [],
         *       "past": []
         *     }
         */
        MeetingList: {
            upcoming: components["schemas"]["MeetingListItem"][];
            past: components["schemas"]["MeetingListItem"][];
        };
        /**
         * @example {
         *       "id": "book-fiction-1",
         *       "text": "Texto ficticio",
         *       "kind": "quote",
         *       "speakers": []
         *     }
         */
        MeetingHighlight: {
            id: components["schemas"]["Id"];
            text: string;
            /** @enum {string} */
            kind: "quote" | "paraphrase";
            speakers: components["schemas"]["MemberSummary"][];
        };
        /**
         * @example {
         *       "status": "visible",
         *       "summary": null,
         *       "highlights": []
         *     }
         */
        MeetingRecordVisible: {
            /**
             * @description discriminator enum property added by openapi-typescript
             * @enum {string}
             */
            status: "visible";
            summary: string | null;
            highlights: components["schemas"]["MeetingHighlight"][];
        };
        /**
         * @example {
         *       "status": "lockedWeekNotRead",
         *       "weekNumber": 2
         *     }
         */
        MeetingRecordLockedWeekNotRead: {
            /**
             * @description discriminator enum property added by openapi-typescript
             * @enum {string}
             */
            status: "lockedWeekNotRead";
            weekNumber: number;
        };
        /**
         * @example {
         *       "status": "lockedNoWeek"
         *     }
         */
        MeetingRecordLockedNoWeek: {
            /**
             * @description discriminator enum property added by openapi-typescript
             * @enum {string}
             */
            status: "lockedNoWeek";
        };
        /**
         * @description Central server gate for admin and member views: completed linked active week OR explicitly safe unlinked record. Cancelled meeting or removed linked week always lockedNoWeek, even when previously safe/completed. Visible returns published summary/highlights only; drafts and deleted highlights absent. Locked records reveal no existence/count/content of records.
         * @example {
         *       "status": "visible",
         *       "summary": null,
         *       "highlights": []
         *     }
         */
        MeetingRecord: components["schemas"]["MeetingRecordVisible"] | components["schemas"]["MeetingRecordLockedWeekNotRead"] | components["schemas"]["MeetingRecordLockedNoWeek"];
        /**
         * @description Attendance null when upcoming/cancelled or not recorded; otherwise list (possibly empty).
         * @example {
         *       "id": "book-fiction-1",
         *       "startsAt": "2026-01-15T19:00:00Z",
         *       "cancelled": false,
         *       "book": null,
         *       "assignment": null,
         *       "upcoming": false,
         *       "attendance": null,
         *       "record": {
         *         "status": "visible",
         *         "summary": null,
         *         "highlights": []
         *       }
         *     }
         */
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
        /**
         * @example {
         *       "id": "book-fiction-1",
         *       "title": "Texto ficticio",
         *       "authors": [],
         *       "coverUrl": null,
         *       "publicationDate": null,
         *       "pageCount": null
         *     }
         */
        VoteCandidateBook: {
            id: components["schemas"]["Id"];
            title: string;
            authors: string[];
            coverUrl: string | null;
            publicationDate: string | null;
            pageCount: number | null;
        };
        /**
         * @description Public approvals; one per candidate/member, empty and approvedByMe false in draft.
         * @example {
         *       "book": {
         *         "id": "book-fiction-1",
         *         "title": "Texto ficticio",
         *         "authors": [],
         *         "coverUrl": null,
         *         "publicationDate": null,
         *         "pageCount": null
         *       },
         *       "approvals": [],
         *       "approvedByMe": false
         *     }
         */
        VoteCandidate: {
            book: components["schemas"]["VoteCandidateBook"];
            approvals: components["schemas"]["MemberSummary"][];
            approvedByMe: boolean;
        };
        /**
         * @example {
         *       "status": "winner",
         *       "winner": {
         *         "id": "book-fiction-1",
         *         "title": "Texto ficticio",
         *         "authors": [],
         *         "coverUrl": null
         *       },
         *       "tieNote": null
         *     }
         */
        VoteOutcomeWinner: {
            /**
             * @description discriminator enum property added by openapi-typescript
             * @enum {string}
             */
            status: "winner";
            winner: components["schemas"]["BookSummary"];
            tieNote: string | null;
        };
        /**
         * @example {
         *       "status": "tiePending",
         *       "tiedBookIds": [
         *         "book-fiction-1",
         *         "book-fiction-2"
         *       ]
         *     }
         */
        VoteOutcomeTiePending: {
            /**
             * @description discriminator enum property added by openapi-typescript
             * @enum {string}
             */
            status: "tiePending";
            tiedBookIds: components["schemas"]["Id"][];
        };
        /**
         * @description Server chooses strictly highest approvals at close, otherwise every tied highest candidate (including zero) remains pending. Only admin records manual tie winner; never automatically changes book status, origin vote or curator.
         * @example {
         *       "status": "winner",
         *       "winner": {
         *         "id": "book-fiction-1",
         *         "title": "Texto ficticio",
         *         "authors": [],
         *         "coverUrl": null
         *       },
         *       "tieNote": null
         *     }
         */
        VoteOutcome: components["schemas"]["VoteOutcomeWinner"] | components["schemas"]["VoteOutcomeTiePending"];
        /**
         * @description Candidates remain in shortlist order. At most one draft/open. Draft has null openedAt/closedAt/outcome; open has openedAt but null closedAt/outcome; closed has both instants and outcome. Flags computed by server; management current curator/admin, tie winner admin only. No automatic role or lifecycle changes.
         * @example {
         *       "id": "book-fiction-1",
         *       "status": "draft",
         *       "curator": {
         *         "id": "book-fiction-1",
         *         "displayName": "Texto ficticio",
         *         "avatarUrl": null
         *       },
         *       "openedAt": null,
         *       "closedAt": null,
         *       "candidates": [],
         *       "outcome": null,
         *       "canManage": false,
         *       "canRecordTieWinner": false,
         *       "curatedByMe": false
         *     }
         */
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
        /**
         * @example {
         *       "id": "book-fiction-1",
         *       "curator": {
         *         "id": "book-fiction-1",
         *         "displayName": "Texto ficticio",
         *         "avatarUrl": null
         *       },
         *       "openedAt": "2026-01-15T19:00:00Z",
         *       "closedAt": "2026-01-15T19:00:00Z",
         *       "outcome": {
         *         "status": "winner",
         *         "winner": {
         *           "id": "book-fiction-1",
         *           "title": "Texto ficticio",
         *           "authors": [],
         *           "coverUrl": null
         *         },
         *         "tieNote": null
         *       },
         *       "candidateCount": 0
         *     }
         */
        VoteHistoryItem: {
            id: components["schemas"]["Id"];
            curator: components["schemas"]["MemberSummary"];
            openedAt: components["schemas"]["Instant"];
            closedAt: components["schemas"]["Instant"];
            outcome: components["schemas"]["VoteOutcome"];
            candidateCount: number;
        };
        /**
         * @description History newest closedAt first, including pending ties. Current null without draft/open; may create only current curator/admin with curator assigned and no draft/open.
         * @example {
         *       "curator": null,
         *       "current": null,
         *       "history": [],
         *       "canCreateVote": false
         *     }
         */
        VotesOverview: {
            curator: components["schemas"]["MemberSummary"] | null;
            current: components["schemas"]["Vote"] | null;
            history: components["schemas"]["VoteHistoryItem"][];
            canCreateVote: boolean;
        };
        /**
         * @description Exactly five scores, 1..5 in half-star steps. Disfrute/Estilo/Personajes/Trama/Huella Spanish labels use these lowercase code keys.
         * @example {
         *       "disfrute": 1,
         *       "estilo": 1,
         *       "personajes": 1,
         *       "trama": 1,
         *       "huella": 1
         *     }
         */
        CriterionScores: {
            disfrute: number;
            estilo: number;
            personajes: number;
            trama: number;
            huella: number;
        };
        /**
         * @description Unrounded means, not constrained to half-star steps.
         * @example {
         *       "disfrute": 1,
         *       "estilo": 1,
         *       "personajes": 1,
         *       "trama": 1,
         *       "huella": 1
         *     }
         */
        CriterionMeans: {
            disfrute: number;
            estilo: number;
            personajes: number;
            trama: number;
            huella: number;
        };
        /**
         * @description Mean absolute differences 0..4, not star scores or half-star constrained.
         * @example {
         *       "disfrute": 0,
         *       "estilo": 0,
         *       "personajes": 0,
         *       "trama": 0,
         *       "huella": 0
         *     }
         */
        CriterionDifferences: {
            disfrute: number;
            estilo: number;
            personajes: number;
            trama: number;
            huella: number;
        };
        /**
         * @description Own review always returned. Overall unweighted mean of five scores; edit retains submittedAt.
         * @example {
         *       "scores": {
         *         "disfrute": 1,
         *         "estilo": 1,
         *         "personajes": 1,
         *         "trama": 1,
         *         "huella": 1
         *       },
         *       "overall": 1,
         *       "text": null,
         *       "submittedAt": "2026-01-15T19:00:00Z",
         *       "editedAt": null
         *     }
         */
        MyReview: {
            scores: components["schemas"]["CriterionScores"];
            overall: number;
            text: string | null;
            submittedAt: components["schemas"]["Instant"];
            editedAt: components["schemas"]["Instant"] | null;
        };
        /**
         * @example {
         *       "member": {
         *         "id": "book-fiction-1",
         *         "displayName": "Texto ficticio",
         *         "avatarUrl": null
         *       },
         *       "scores": {
         *         "disfrute": 1,
         *         "estilo": 1,
         *         "personajes": 1,
         *         "trama": 1,
         *         "huella": 1
         *       },
         *       "overall": 1,
         *       "text": null,
         *       "isMine": false
         *     }
         */
        ClubReview: {
            member: components["schemas"]["MemberSummary"];
            scores: components["schemas"]["CriterionScores"];
            overall: number;
            text: string | null;
            isMine: boolean;
        };
        /**
         * @example {
         *       "status": "locked"
         *     }
         */
        ClubRatingsLocked: {
            /**
             * @description discriminator enum property added by openapi-typescript
             * @enum {string}
             */
            status: "locked";
        };
        /**
         * @example {
         *       "status": "visible",
         *       "reviewCount": 1,
         *       "overallMean": 1,
         *       "criterionMeans": {
         *         "disfrute": 1,
         *         "estilo": 1,
         *         "personajes": 1,
         *         "trama": 1,
         *         "huella": 1
         *       },
         *       "reviews": [
         *         {
         *           "member": {
         *             "id": "book-fiction-1",
         *             "displayName": "Texto ficticio",
         *             "avatarUrl": null
         *           },
         *           "scores": {
         *             "disfrute": 1,
         *             "estilo": 1,
         *             "personajes": 1,
         *             "trama": 1,
         *             "huella": 1
         *           },
         *           "overall": 1,
         *           "text": null,
         *           "isMine": false
         *         }
         *       ]
         *     }
         */
        ClubRatingsVisible: {
            /**
             * @description discriminator enum property added by openapi-typescript
             * @enum {string}
             */
            status: "visible";
            reviewCount: number;
            overallMean: number;
            criterionMeans: components["schemas"]["CriterionMeans"];
            reviews: components["schemas"]["ClubReview"][];
        };
        /**
         * @description Viewer finished AND submitted all five scores before ANY other rating/count/aggregate is returned. Same gate for historical books and admin member views. Own review first, others by Spanish display name, never score. Mean of member overall means equally weighted; reviewCount denominator explicit.
         * @example {
         *       "status": "locked"
         *     }
         */
        ClubRatings: components["schemas"]["ClubRatingsLocked"] | components["schemas"]["ClubRatingsVisible"];
        /**
         * @description Only leyendo/terminado/archivado official books ratable. finishedByMe independent of all weekly completions.
         * @example {
         *       "book": {
         *         "id": "book-fiction-1",
         *         "title": "Texto ficticio",
         *         "authors": [],
         *         "coverUrl": null
         *       },
         *       "ratable": false,
         *       "finishedByMe": false,
         *       "myReview": null,
         *       "club": {
         *         "status": "locked"
         *       }
         *     }
         */
        BookRatings: {
            book: components["schemas"]["BookSummary"];
            ratable: boolean;
            finishedByMe: boolean;
            myReview: components["schemas"]["MyReview"] | null;
            club: components["schemas"]["ClubRatings"];
        };
        /**
         * @example {
         *       "1": null,
         *       "2": null,
         *       "3": null,
         *       "4": null,
         *       "5": null
         *     }
         */
        RubricAnchors: {
            1: string | null;
            2: string | null;
            3: string | null;
            4: string | null;
            5: string | null;
        };
        /**
         * @description Admin-written anchors can all be null; no invented canonical prose.
         * @example {
         *       "disfrute": {
         *         "1": null,
         *         "2": null,
         *         "3": null,
         *         "4": null,
         *         "5": null
         *       },
         *       "estilo": {
         *         "1": null,
         *         "2": null,
         *         "3": null,
         *         "4": null,
         *         "5": null
         *       },
         *       "personajes": {
         *         "1": null,
         *         "2": null,
         *         "3": null,
         *         "4": null,
         *         "5": null
         *       },
         *       "trama": {
         *         "1": null,
         *         "2": null,
         *         "3": null,
         *         "4": null,
         *         "5": null
         *       },
         *       "huella": {
         *         "1": null,
         *         "2": null,
         *         "3": null,
         *         "4": null,
         *         "5": null
         *       }
         *     }
         */
        RatingRubric: {
            disfrute: components["schemas"]["RubricAnchors"];
            estilo: components["schemas"]["RubricAnchors"];
            personajes: components["schemas"]["RubricAnchors"];
            trama: components["schemas"]["RubricAnchors"];
            huella: components["schemas"]["RubricAnchors"];
        };
        /**
         * @example {
         *       "scores": {
         *         "disfrute": 1,
         *         "estilo": 1,
         *         "personajes": 1,
         *         "trama": 1,
         *         "huella": 1
         *       }
         *     }
         */
        ReviewInput: {
            scores: components["schemas"]["CriterionScores"];
            text?: string | null;
        };
        /**
         * @example {
         *       "bookRatings": 3,
         *       "memberRatings": 3
         *     }
         */
        StatisticsThresholds: {
            bookRatings: number;
            memberRatings: number;
        };
        /**
         * @description Population standard deviation of overall scores; 0 with one review. Not rounded.
         * @example {
         *       "book": {
         *         "id": "book-fiction-1",
         *         "title": "Texto ficticio",
         *         "authors": [],
         *         "coverUrl": null
         *       },
         *       "reviewCount": 1,
         *       "overallMean": 1,
         *       "dispersion": 0
         *     }
         */
        BookStatistics: {
            book: components["schemas"]["BookSummary"];
            reviewCount: number;
            overallMean: number;
            dispersion: number;
        };
        /**
         * @example {
         *       "member": {
         *         "id": "book-fiction-1",
         *         "displayName": "Texto ficticio",
         *         "avatarUrl": null
         *       },
         *       "isMe": false,
         *       "reviewCount": 1,
         *       "overallMean": 1
         *     }
         */
        MemberStatistics: {
            member: components["schemas"]["MemberSummary"];
            isMe: boolean;
            reviewCount: number;
            overallMean: number;
        };
        /**
         * @description Threshold 3 counted ratings per book/member. Empty below threshold; include all ties sorted Spanish title/name.
         * @example {
         *       "topRated": [],
         *       "lowestRated": [],
         *       "mostDivisive": [],
         *       "mostGenerous": [],
         *       "harshest": []
         *     }
         */
        StatisticsHighlights: {
            topRated: components["schemas"]["BookStatistics"][];
            lowestRated: components["schemas"]["BookStatistics"][];
            mostDivisive: components["schemas"]["BookStatistics"][];
            mostGenerous: components["schemas"]["MemberStatistics"][];
            harshest: components["schemas"]["MemberStatistics"][];
        };
        /**
         * @example {
         *       "status": "empty"
         *     }
         */
        RatingStatisticsEmpty: {
            /**
             * @description discriminator enum property added by openapi-typescript
             * @enum {string}
             */
            status: "empty";
        };
        /**
         * @example {
         *       "status": "available",
         *       "bookCount": 1,
         *       "reviewCount": 1,
         *       "overallMean": 1,
         *       "criterionMeans": {
         *         "disfrute": 1,
         *         "estilo": 1,
         *         "personajes": 1,
         *         "trama": 1,
         *         "huella": 1
         *       },
         *       "books": [
         *         {
         *           "book": {
         *             "id": "book-fiction-1",
         *             "title": "Texto ficticio",
         *             "authors": [],
         *             "coverUrl": null
         *           },
         *           "reviewCount": 1,
         *           "overallMean": 1,
         *           "dispersion": 0
         *         }
         *       ],
         *       "members": [
         *         {
         *           "member": {
         *             "id": "book-fiction-1",
         *             "displayName": "Texto ficticio",
         *             "avatarUrl": null
         *           },
         *           "isMe": false,
         *           "reviewCount": 1,
         *           "overallMean": 1
         *         }
         *       ],
         *       "highlights": {
         *         "topRated": [],
         *         "lowestRated": [],
         *         "mostDivisive": [],
         *         "mostGenerous": [],
         *         "harshest": []
         *       }
         *     }
         */
        RatingStatisticsAvailable: {
            /**
             * @description discriminator enum property added by openapi-typescript
             * @enum {string}
             */
            status: "available";
            bookCount: number;
            reviewCount: number;
            overallMean: number;
            criterionMeans: components["schemas"]["CriterionMeans"];
            books: components["schemas"]["BookStatistics"][];
            members: components["schemas"]["MemberStatistics"][];
            highlights: components["schemas"]["StatisticsHighlights"];
        };
        /**
         * @description Only viewer-unlocked books before any aggregation; no hidden book/count/candidate inference. Each counted review equally weighted. Books highest mean first then Spanish title; viewer first then display name. Empty branch contains only status.
         * @example {
         *       "status": "empty"
         *     }
         */
        RatingStatistics: components["schemas"]["RatingStatisticsEmpty"] | components["schemas"]["RatingStatisticsAvailable"];
        /**
         * @description Public catalogue counts terminado/archivado; meetingsHeld noncancelled before server now. Rating totals/radars/highlights gated independently.
         * @example {
         *       "booksRead": 0,
         *       "meetingsHeld": 0,
         *       "thresholds": {
         *         "bookRatings": 3,
         *         "memberRatings": 3
         *       },
         *       "ratings": {
         *         "status": "empty"
         *       }
         *     }
         */
        Statistics: {
            booksRead: number;
            meetingsHeld: number;
            thresholds: components["schemas"]["StatisticsThresholds"];
            ratings: components["schemas"]["RatingStatistics"];
        };
        /**
         * @example {
         *       "book": {
         *         "id": "book-fiction-1",
         *         "title": "Texto ficticio",
         *         "authors": [],
         *         "coverUrl": null
         *       },
         *       "myOverall": 1,
         *       "theirOverall": 1,
         *       "difference": 0
         *     }
         */
        SharedBook: {
            book: components["schemas"]["BookSummary"];
            myOverall: number;
            theirOverall: number;
            difference: number;
        };
        /**
         * @example {
         *       "status": "insufficient"
         *     }
         */
        TasteComparisonInsufficient: {
            /**
             * @description discriminator enum property added by openapi-typescript
             * @enum {string}
             */
            status: "insufficient";
        };
        /**
         * @example {
         *       "status": "available",
         *       "overallDifference": 0,
         *       "criterionDifferences": {
         *         "disfrute": 0,
         *         "estilo": 0,
         *         "personajes": 0,
         *         "trama": 0,
         *         "huella": 0
         *       },
         *       "books": [
         *         {
         *           "book": {
         *             "id": "book-fiction-1",
         *             "title": "Texto ficticio",
         *             "authors": [],
         *             "coverUrl": null
         *           },
         *           "myOverall": 1,
         *           "theirOverall": 1,
         *           "difference": 0
         *         },
         *         {
         *           "book": {
         *             "id": "book-fiction-1",
         *             "title": "Texto ficticio",
         *             "authors": [],
         *             "coverUrl": null
         *           },
         *           "myOverall": 1,
         *           "theirOverall": 1,
         *           "difference": 0
         *         },
         *         {
         *           "book": {
         *             "id": "book-fiction-1",
         *             "title": "Texto ficticio",
         *             "authors": [],
         *             "coverUrl": null
         *           },
         *           "myOverall": 1,
         *           "theirOverall": 1,
         *           "difference": 0
         *         }
         *       ]
         *     }
         */
        TasteComparisonAvailable: {
            /**
             * @description discriminator enum property added by openapi-typescript
             * @enum {string}
             */
            status: "available";
            overallDifference: number;
            criterionDifferences: components["schemas"]["CriterionDifferences"];
            books: components["schemas"]["SharedBook"][];
        };
        /**
         * @description Only shared books viewer finished/rated AND other member rated. At least minSharedBooks (currently 3) before differences/book metadata; insufficient carries status only. Difference unrounded mean absolute overall/criterion difference, 0..4. Books Spanish title order.
         * @example {
         *       "status": "insufficient"
         *     }
         */
        TasteComparison: components["schemas"]["TasteComparisonInsufficient"] | components["schemas"]["TasteComparisonAvailable"];
        /**
         * @description Count only permitted shared books, never hidden overlap. Insufficient retains this explicit count but no books/scores.
         * @example {
         *       "member": {
         *         "id": "book-fiction-1",
         *         "displayName": "Texto ficticio",
         *         "avatarUrl": null
         *       },
         *       "sharedBookCount": 0,
         *       "comparison": {
         *         "status": "insufficient"
         *       }
         *     }
         */
        MemberCompatibility: {
            member: components["schemas"]["MemberSummary"];
            sharedBookCount: number;
            comparison: components["schemas"]["TasteComparison"];
        };
        /**
         * @description Every other active member by Spanish display name, never difference; viewer omitted. Empty club members list valid.
         * @example {
         *       "minSharedBooks": 1,
         *       "members": []
         *     }
         */
        TasteCompatibility: {
            minSharedBooks: number;
            members: components["schemas"]["MemberCompatibility"][];
        };
        /**
         * @example {
         *       "member": {
         *         "id": "book-fiction-1",
         *         "displayName": "Texto ficticio",
         *         "avatarUrl": null
         *       },
         *       "isMe": false,
         *       "completedCurrentWeek": null
         *     }
         */
        MemberDirectoryEntry: {
            member: components["schemas"]["MemberSummary"];
            isMe: boolean;
            completedCurrentWeek: boolean | null;
        };
        /**
         * @description Active members only incl viewer by Spanish name. Public progress null exactly with no current week; no ratings/taste/Discord IDs.
         * @example {
         *       "currentWeekNumber": null,
         *       "members": []
         *     }
         */
        MemberDirectory: {
            currentWeekNumber: number | null;
            members: components["schemas"]["MemberDirectoryEntry"][];
        };
        /**
         * @example {
         *       "weekNumber": 1,
         *       "completed": false
         *     }
         */
        MemberWeekStatus: {
            weekNumber: number;
            completed: boolean;
        };
        /**
         * @description Website-native profile/public reading progress only. Favourite books are intentional public choices, metadata summaries without ratings. Revoked/unknown profile same generic 404.
         * @example {
         *       "member": {
         *         "id": "book-fiction-1",
         *         "displayName": "Texto ficticio",
         *         "avatarUrl": null
         *       },
         *       "bio": null,
         *       "favouriteQuote": null,
         *       "favouriteBooks": [],
         *       "isMe": false,
         *       "currentWeek": null
         *     }
         */
        MemberProfile: {
            member: components["schemas"]["MemberSummary"];
            bio: string | null;
            favouriteQuote: string | null;
            favouriteBooks: components["schemas"]["BookSummary"][];
            isMe: boolean;
            currentWeek: components["schemas"]["MemberWeekStatus"] | null;
        };
        /**
         * @description Allowed favourites: terminado/archivado visible catalogue books, Spanish title order; selected books in chosen order.
         * @example {
         *       "member": {
         *         "id": "book-fiction-1",
         *         "displayName": "Texto ficticio",
         *         "avatarUrl": null
         *       },
         *       "bio": null,
         *       "favouriteQuote": null,
         *       "favouriteBooks": [],
         *       "favouriteOptions": []
         *     }
         */
        MyProfile: {
            member: components["schemas"]["MemberSummary"];
            bio: string | null;
            favouriteQuote: string | null;
            favouriteBooks: components["schemas"]["BookSummary"][];
            favouriteOptions: components["schemas"]["BookSummary"][];
        };
        /**
         * @description JSON metadata multipart part. Optional text missing/null/trimmed blank becomes null. Max lengths AFTER trim, server obligation. Favourites ordered distinct allowed IDs; reject whole transaction for any invalid value. Smuggled ownership keys 403, never used for ownership.
         * @example {
         *       "displayName": "Texto ficticio",
         *       "favouriteBookIds": [],
         *       "avatarAction": "keep"
         *     }
         */
        ProfileMetadata: {
            /** @description Trim, then 1..40 chars single line. Reject control characters incl U+2028/U+2029. */
            displayName: string;
            bio?: string | null;
            favouriteQuote?: string | null;
            favouriteBookIds: components["schemas"]["Id"][];
            /** @enum {string} */
            avatarAction: "keep" | "remove" | "replace";
        };
        /**
         * @description Multipart adapter: metadata application/json part; avatar binary image part for replace. Browser File/AvatarChange never JSON objects.
         * @example {
         *       "metadata": {
         *         "displayName": "Texto ficticio",
         *         "favouriteBookIds": [],
         *         "avatarAction": "keep"
         *       }
         *     }
         */
        ProfileMultipart: {
            metadata: components["schemas"]["ProfileMetadata"];
            /**
             * Format: binary
             * @description JPEG/PNG/WebP bytes, >0 and <=2097152 bytes; required ONLY for replace. Server sniffs/validates content before atomic save.
             */
            avatar?: Blob;
        } & unknown;
        /**
         * @description Only own review, latest max(submittedAt, editedAt) first then Spanish title, no club totals. Removed books omitted.
         * @example {
         *       "book": {
         *         "id": "book-fiction-1",
         *         "title": "Texto ficticio",
         *         "authors": [],
         *         "coverUrl": null
         *       },
         *       "scores": {
         *         "disfrute": 1,
         *         "estilo": 1,
         *         "personajes": 1,
         *         "trama": 1,
         *         "huella": 1
         *       },
         *       "overall": 1,
         *       "text": null,
         *       "submittedAt": "2026-01-15T19:00:00Z",
         *       "editedAt": null
         *     }
         */
        MyReviewEntry: {
            book: components["schemas"]["BookSummary"];
            scores: components["schemas"]["CriterionScores"];
            overall: number;
            text: string | null;
            submittedAt: components["schemas"]["Instant"];
            editedAt: components["schemas"]["Instant"] | null;
        };
        /**
         * @example {
         *       "completed": false
         *     }
         */
        WeekCompletionInput: {
            completed: boolean;
        };
        /**
         * @example {
         *       "approved": false
         *     }
         */
        ApprovalInput: {
            approved: boolean;
        };
        /**
         * @example {
         *       "finished": false
         *     }
         */
        FinishedInput: {
            finished: boolean;
        };
        /**
         * @example {
         *       "bookId": "book-fiction-1"
         *     }
         */
        CandidateInput: {
            bookId: components["schemas"]["Id"];
        };
        /**
         * @description Exactly current candidates in requested order; known but stale/different set 409, unknown book 404.
         * @example {
         *       "bookIds": []
         *     }
         */
        CandidateOrderInput: {
            bookIds: components["schemas"]["Id"][];
        };
        /**
         * @description Note trimmed before limit; blank becomes null; tied candidate only, admin only.
         * @example {
         *       "bookId": "book-fiction-1",
         *       "note": "Texto ficticio"
         *     }
         */
        TieWinnerInput: {
            bookId: components["schemas"]["Id"];
            note: string;
        };
        /**
         * @description Central JSON error; Spanish safe plain text, no request echo/private payload. Local ApiError(status,message) adapter deferred #103.
         * @example {
         *       "code": "unauthenticated",
         *       "message": "Debes iniciar sesión."
         *     }
         */
        Error: {
            /** @enum {string} */
            code: "invalid_input" | "unauthenticated" | "forbidden" | "not_found" | "conflict" | "reauthentication_required" | "internal_error" | "service_unavailable";
            message: string;
        };
        /**
         * @description Explicit catalogue metadata only; no schedule, ratings, review counts or substantive meeting records. Stable id and originVote are server-owned. Only one retained active book may be leyendo (409). Dates/status never change automatically.
         * @example {
         *       "id": "book-fiction-1",
         *       "title": "Texto ficticio",
         *       "authors": [],
         *       "coverUrl": null,
         *       "status": "propuesto",
         *       "readingStartDate": null,
         *       "readingEndDate": null,
         *       "datesApproximate": false,
         *       "plannedStartDate": null,
         *       "plannedEndDate": null,
         *       "description": null,
         *       "publicationDate": null,
         *       "publisher": null,
         *       "isbn": null,
         *       "pageCount": null,
         *       "originVote": null
         *     }
         */
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
        /**
         * @description Trim first; optional blank text becomes null, omit blank author lines. Validate each planned/actual date pair independently, reject year 0000/end before own start. No required dates or forced date agreement. metadataResultId required only for metadata cover action, server checks known search result; no arbitrary cover URLs accepted.
         * @example {
         *       "title": "Texto ficticio",
         *       "authors": [],
         *       "status": "propuesto",
         *       "readingStartDate": null,
         *       "readingEndDate": null,
         *       "datesApproximate": false,
         *       "plannedStartDate": null,
         *       "plannedEndDate": null,
         *       "description": null,
         *       "publicationDate": null,
         *       "publisher": null,
         *       "isbn": null,
         *       "pageCount": null,
         *       "coverAction": "keep"
         *     }
         */
        BookMetadataInput: {
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
        } & unknown;
        /**
         * @description Atomic metadata/cover transaction: JSON metadata part, optional binary cover. Sniff content; nonempty JPEG/PNG/WebP <=2097152 bytes inclusive. No File/blob/data URL JSON. Validate before any change.
         * @example {
         *       "metadata": {
         *         "title": "Texto ficticio",
         *         "authors": [],
         *         "status": "propuesto",
         *         "readingStartDate": null,
         *         "readingEndDate": null,
         *         "datesApproximate": false,
         *         "plannedStartDate": null,
         *         "plannedEndDate": null,
         *         "description": null,
         *         "publicationDate": null,
         *         "publisher": null,
         *         "isbn": null,
         *         "pageCount": null,
         *         "coverAction": "keep"
         *       }
         *     }
         */
        BookMultipart: {
            metadata: components["schemas"]["BookMetadataInput"];
            /** Format: binary */
            cover?: Blob;
        } & unknown;
        /**
         * @description Search result id is the sole imported-cover reference; local selection fills blank fields only, not a server write. Real external lookup belongs to #15.
         * @example {
         *       "id": "book-fiction-1",
         *       "title": "Texto ficticio",
         *       "authors": [],
         *       "description": null,
         *       "publicationDate": null,
         *       "publisher": null,
         *       "isbn": null,
         *       "pageCount": null,
         *       "coverUrl": null
         *     }
         */
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
        /**
         * @description Trim both fields. Name is one line without controls/Unicode separators. Approve with member role and empty profile; no role input. Duplicate Discord id active/revoked is 409.
         * @example {
         *       "discordId": "12345678901234567",
         *       "displayName": "Persona ficticia"
         *     }
         */
        NewMember: {
            discordId: string;
            displayName: string;
        };
        /**
         * @example {
         *       "member": {
         *         "id": "book-fiction-1",
         *         "displayName": "Texto ficticio",
         *         "avatarUrl": null
         *       },
         *       "discordId": "12345678901234567",
         *       "role": "admin",
         *       "status": "active",
         *       "addedAt": "2026-01-01T00:00:00Z",
         *       "revokedAt": null,
         *       "isMe": true,
         *       "isCurator": false
         *     }
         */
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
        /**
         * @description Allowlist alone includes Discord identities/access status. Active first, then revoked, Spanish name order. No profile prose/ratings. Revoking curator clears assignment, preserves contributions; never change role.
         * @example {
         *       "members": [],
         *       "curator": null
         *     }
         */
        AdminMembers: {
            members: components["schemas"]["AdminMember"][];
            curator: components["schemas"]["MemberSummary"] | null;
        };
        /**
         * @example {
         *       "memberId": null
         *     }
         */
        CuratorInput: {
            memberId: components["schemas"]["Id"] | null;
        };
        /**
         * @description Week must be active and belong to selected book; canonical one-to-one week.meetingId reservation, occupied week 409. No range/due-date/status mutation. Instants require offset; reject ambiguous/gap local time rather than select silently.
         * @example {
         *       "startsAt": "2026-01-15T19:00:00Z",
         *       "bookId": null,
         *       "weekId": null
         *     }
         */
        MeetingInput: {
            startsAt: components["schemas"]["Instant"];
            bookId: components["schemas"]["Id"] | null;
            weekId: components["schemas"]["Id"] | null;
        };
        /**
         * @description Operational calendar only. Removed link retained read-only until deliberate unlink/relink. Admin editor may retain historical attendance; member views suppress future/cancelled attendance. null is unrecorded, [] is explicitly empty; no erase-to-null action.
         * @example {
         *       "startsAt": "2026-01-15T19:00:00Z",
         *       "bookId": null,
         *       "weekId": null,
         *       "id": "meeting-fiction-1",
         *       "cancelled": false,
         *       "upcoming": true,
         *       "attendance": null,
         *       "attendanceEligible": false
         *     }
         */
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
        /**
         * @description Upcoming earliest first/past newest first by server time; cancellation does not change partition. Choices omit removed books/weeks and revoked members. No summary/highlight/rating content.
         * @example {
         *       "upcoming": [],
         *       "past": [],
         *       "books": [],
         *       "weeks": [],
         *       "activeMembers": []
         *     }
         */
        AdminMeetingCalendar: {
            upcoming: components["schemas"]["AdminMeeting"][];
            past: components["schemas"]["AdminMeeting"][];
            books: {
                id: components["schemas"]["Id"];
                title: string;
            }[];
            weeks: {
                id: components["schemas"]["Id"];
                bookId: components["schemas"]["Id"];
                weekNumber: number;
                meetingId: components["schemas"]["Id"] | null;
            }[];
            activeMembers: components["schemas"]["MemberSummary"][];
        };
        /**
         * @example {
         *       "cancelled": true
         *     }
         */
        CancelledInput: {
            cancelled: boolean;
        };
        /**
         * @description Only noncancelled meetings strictly before server now (otherwise 409). Replace active selections; preserve recorded revoked attendance ids. New revoked/unknown choices 400. Distinct ids required; [] records empty attendance, null invalid.
         * @example {
         *       "memberIds": []
         *     }
         */
        AttendanceInput: {
            memberIds: components["schemas"]["Id"][];
        };
        /**
         * @description Independent manual percentages/pages; decimals and >100 percentages allowed. No silent conversion. Due date preserved under links; finite numbers, positive safe-integer pages. Notes trim to null. Same-book one-to-one retained links checked atomically.
         * @example {
         *       "percentStart": 0,
         *       "percentEnd": 25,
         *       "pageStart": 1,
         *       "pageEnd": 80,
         *       "dueDate": null,
         *       "notes": null,
         *       "meetingId": null
         *     }
         */
        ReadingWeekInput: {
            percentStart: number;
            percentEnd: number;
            pageStart: number;
            pageEnd: number;
            dueDate: components["schemas"]["CalendarDate"] | null;
            notes: string | null;
            meetingId: components["schemas"]["Id"] | null;
        };
        /**
         * @description Server recomputes warnings against the proposed complete plan on every write; acknowledgement applies only to submitted inputs. Required explicit true when warnings exist; false yields 400 without mutation. Client resets after any edit.
         * @example {
         *       "input": {
         *         "percentStart": 0,
         *         "percentEnd": 25,
         *         "pageStart": 1,
         *         "pageEnd": 80,
         *         "dueDate": null,
         *         "notes": null,
         *         "meetingId": null
         *       },
         *       "acknowledged": false
         *     }
         */
        ReadingWeekWrite: {
            input: components["schemas"]["ReadingWeekInput"];
            acknowledged: boolean;
        };
        /**
         * @description Exact permutation of active ids once each; no missing/unknown/duplicate/foreign ids. Nonexact order 400, unknown/foreign active ids 400 (missing parent 404); preserves stable ids and removed highlight slots.
         * @example {
         *       "ids": []
         *     }
         */
        IdOrder: {
            ids: components["schemas"]["Id"][];
        };
        /**
         * @description Exact active-week permutation; dates never sort weeks. Recompute full-plan advisory warnings and require explicit acknowledgement, otherwise 400. No pages/percent conversion.
         * @example {
         *       "ids": [],
         *       "acknowledged": false
         *     }
         */
        ReadingWeekOrder: {
            ids: components["schemas"]["Id"][];
            acknowledged: boolean;
        };
        /**
         * @example {
         *       "percentStart": 0,
         *       "percentEnd": 25,
         *       "pageStart": 1,
         *       "pageEnd": 80,
         *       "dueDate": null,
         *       "notes": null,
         *       "meetingId": null,
         *       "id": "week-fiction-1",
         *       "weekNumber": 1,
         *       "completionCount": 0
         *     }
         */
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
        /**
         * @description Active weeks contiguous 1..N canonical order; distinct completions include revoked history. Removed meeting link read-only until explicit release. Meeting choices operational only.
         * @example {
         *       "book": {
         *         "id": "book-fiction-1",
         *         "title": "Texto ficticio",
         *         "pageCount": null
         *       },
         *       "weeks": [],
         *       "meetings": []
         *     }
         */
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
        /**
         * @description Trim plain text; blank unpublished becomes null summary. Published requires nonblank text. Summary publication is independent of every highlight.
         * @example {
         *       "text": "",
         *       "published": false
         *     }
         */
        MeetingSummaryInput: {
            text: string;
            published: boolean;
        } & unknown;
        /**
         * @description Trim nonblank plain text; literal line breaks/markup. New speakers must be active; existing revoked attribution may remain unchanged or be removed; no invented attribution. Each publication flag independent.
         * @example {
         *       "text": "IntervenciÃ³n ficticia",
         *       "published": false,
         *       "kind": "paraphrase",
         *       "speakerIds": []
         *     }
         */
        MeetingHighlightInput: {
            text: string;
            published: boolean;
            /** @enum {string} */
            kind: "quote" | "paraphrase";
            speakerIds: components["schemas"]["Id"][];
        };
        /**
         * @example {
         *       "text": "IntervenciÃ³n ficticia",
         *       "published": false,
         *       "kind": "paraphrase",
         *       "speakerIds": [],
         *       "id": "highlight-fiction-1",
         *       "speakers": []
         *     }
         */
        AdminMeetingHighlight: {
            text: string;
            published: boolean;
            /** @enum {string} */
            kind: "quote" | "paraphrase";
            speakerIds: components["schemas"]["Id"][];
            id: components["schemas"]["Id"];
            speakers: components["schemas"]["MemberSummary"][];
        };
        /**
         * @description Editor-only drafts; active highlights in canonical order, speaker choices active only but retained attribution may be revoked. Safe marking rejects BOTH states if ANY retained active/removed week links meeting (409); cancellation/removed week always suppresses member content even for admin.
         * @example {
         *       "id": "meeting-fiction-1",
         *       "startsAt": "2026-01-15T19:00:00Z",
         *       "cancelled": false,
         *       "book": null,
         *       "week": null,
         *       "markedSafe": false,
         *       "summary": null,
         *       "highlights": [],
         *       "speakerOptions": []
         *     }
         */
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
        /**
         * @example {
         *       "safe": true
         *     }
         */
        SafeInput: {
            safe: boolean;
        };
        /**
         * @description Trim nonblank text; optional blank author/source becomes null. Duplicate key collapses whitespace and Spanish lowercase across active/inactive/recoverable quotes excluding edited id (409). Stable ids/insertion order; no rights-verification claim.
         * @example {
         *       "text": "Texto literario ficticio.",
         *       "author": null,
         *       "source": null,
         *       "active": true
         *     }
         */
        LiteraryQuoteInput: {
            text: string;
            author: string | null;
            source: string | null;
            active: boolean;
        };
        /**
         * @example {
         *       "id": "quote-fiction-1",
         *       "text": "Texto literario ficticio.",
         *       "author": null,
         *       "source": null,
         *       "active": true
         *     }
         */
        AdminLiteraryQuote: {
            id: components["schemas"]["Id"];
            text: string;
            author: string | null;
            source: string | null;
            active: boolean;
        };
        /**
         * @description Whole atomic replacement; exactly five criteria and exactly 1..5 whole-star anchors; nullable trimmed text <=500, blank normalizes null. No sixth criterion/half anchor. No invented default prose.
         * @example {
         *       "disfrute": {
         *         "1": null,
         *         "2": null,
         *         "3": null,
         *         "4": null,
         *         "5": null
         *       },
         *       "estilo": {
         *         "1": null,
         *         "2": null,
         *         "3": null,
         *         "4": null,
         *         "5": null
         *       },
         *       "personajes": {
         *         "1": null,
         *         "2": null,
         *         "3": null,
         *         "4": null,
         *         "5": null
         *       },
         *       "trama": {
         *         "1": null,
         *         "2": null,
         *         "3": null,
         *         "4": null,
         *         "5": null
         *       },
         *       "huella": {
         *         "1": null,
         *         "2": null,
         *         "3": null,
         *         "4": null,
         *         "5": null
         *       }
         *     }
         */
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
        /**
         * @example book
         * @enum {string}
         */
        DeletedType: "book" | "meeting" | "quote" | "week" | "highlight";
        /**
         * @description Safe operational label and dependency descriptions/counts only; no deleted text, profiles, review/rating, media or Discord fields. Deadline exactly 30 days; expired at server now >= purgeDueAt; expired remains listed until explicit purge.
         * @example {
         *       "type": "book",
         *       "id": "book-fiction-1",
         *       "label": "Registro ficticio",
         *       "deletedAt": "2026-01-01T00:00:00Z",
         *       "deletedByName": "Persona ficticia",
         *       "purgeDueAt": "2026-01-31T00:00:00Z",
         *       "expired": false,
         *       "dependencies": []
         *     }
         */
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
        /**
         * @description Safe operational label and dependency descriptions/counts only; no deleted text, profiles, review/rating, media or Discord fields. Deadline exactly 30 days; expired at server now >= purgeDueAt; expired remains listed until explicit purge.
         * @example {
         *       "type": "meeting",
         *       "id": "meeting-fiction-1",
         *       "label": "Registro ficticio",
         *       "deletedAt": "2026-01-01T00:00:00Z",
         *       "deletedByName": "Persona ficticia",
         *       "purgeDueAt": "2026-01-31T00:00:00Z",
         *       "expired": false,
         *       "dependencies": []
         *     }
         */
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
        /**
         * @description Safe operational label and dependency descriptions/counts only; no deleted text, profiles, review/rating, media or Discord fields. Deadline exactly 30 days; expired at server now >= purgeDueAt; expired remains listed until explicit purge.
         * @example {
         *       "type": "quote",
         *       "id": "quote-fiction-1",
         *       "label": "Cita literaria",
         *       "deletedAt": "2026-01-01T00:00:00Z",
         *       "deletedByName": "Persona ficticia",
         *       "purgeDueAt": "2026-01-31T00:00:00Z",
         *       "expired": false,
         *       "dependencies": []
         *     }
         */
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
        /**
         * @description Safe operational label and dependency descriptions/counts only; no deleted text, profiles, review/rating, media or Discord fields. Deadline exactly 30 days; expired at server now >= purgeDueAt; expired remains listed until explicit purge.
         * @example {
         *       "type": "week",
         *       "id": "week-fiction-1",
         *       "label": "Registro ficticio",
         *       "deletedAt": "2026-01-01T00:00:00Z",
         *       "deletedByName": "Persona ficticia",
         *       "purgeDueAt": "2026-01-31T00:00:00Z",
         *       "expired": false,
         *       "dependencies": []
         *     }
         */
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
        /**
         * @description Safe operational label and dependency descriptions/counts only; no deleted text, profiles, review/rating, media or Discord fields. Deadline exactly 30 days; expired at server now >= purgeDueAt; expired remains listed until explicit purge.
         * @example {
         *       "type": "highlight",
         *       "id": "highlight-fiction-1",
         *       "label": "Intervención",
         *       "deletedAt": "2026-01-01T00:00:00Z",
         *       "deletedByName": "Persona ficticia",
         *       "purgeDueAt": "2026-01-31T00:00:00Z",
         *       "expired": false,
         *       "dependencies": []
         *     }
         */
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
        /**
         * @example {
         *       "type": "book",
         *       "id": "book-fiction-1",
         *       "label": "Registro ficticio",
         *       "deletedAt": "2026-01-01T00:00:00Z",
         *       "deletedByName": "Persona ficticia",
         *       "purgeDueAt": "2026-01-31T00:00:00Z",
         *       "expired": false,
         *       "dependencies": []
         *     }
         */
        RecycleBinEntry: components["schemas"]["BinBook"] | components["schemas"]["BinMeeting"] | components["schemas"]["BinQuote"] | components["schemas"]["BinWeek"] | components["schemas"]["BinHighlight"];
        /**
         * @description Book title/meeting date may identify target; quote/highlight labels generic Spanish, never substantive text. Dependencies safe counts/descriptions only, not ids or payload. Preview is not permission to cascade destruction.
         * @example {
         *       "label": "Registro ficticio",
         *       "dependencies": []
         *     }
         */
        DeletionPreview: {
            label: string;
            dependencies: string[];
        };
        /**
         * @description Policy pending #48; no invented cadence/storage/rotation/retention. Nullable last successful timestamp; demo supplied timestamp is simulated.
         * @example {
         *       "policy": "pending",
         *       "lastBackupAt": null
         *     }
         */
        BackupInfo: {
            /** @constant */
            policy: "pending";
            lastBackupAt: components["schemas"]["Instant"] | null;
        };
        /**
         * @description Whitelist id/action, target type/id/safe immutable label, actor id/displayName, occurredAt only. Newest instant then descending event-id ties. Generic quote/highlight labels. No raw payload/prose/ratings/profiles/Discord/tokens/media. Only successful critical transitions, no reads/noops/refusals. Persistent audit #50.
         * @example {
         *       "id": "audit-fiction-1",
         *       "action": "exported",
         *       "target": {
         *         "type": "club",
         *         "id": "club",
         *         "label": "Club de lectura"
         *       },
         *       "actor": {
         *         "id": "member-fiction-1",
         *         "displayName": "Persona ficticia"
         *       },
         *       "occurredAt": "2026-01-15T19:00:00Z"
         *     }
         */
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
        /**
         * @description 409 without data/download or session expiry; Spanish safe message. Five-minute server-verified same-admin freshness, not confirmation/boolean.
         * @example {
         *       "code": "reauthentication_required",
         *       "message": "Vuelve a identificarte con Discord para exportar los datos."
         *     }
         */
        ReauthenticationError: {
            /** @constant */
            code: "reauthentication_required";
            message: string;
        };
        /**
         * @example {
         *       "deletedAt": "2026-01-01T00:00:00Z",
         *       "deletedBy": "member-fiction-1",
         *       "purgeDueAt": "2026-01-31T00:00:00Z"
         *     }
         */
        ExportDeletion: {
            deletedAt: components["schemas"]["Instant"];
            deletedBy: components["schemas"]["Id"];
            purgeDueAt: components["schemas"]["Instant"];
        };
        /**
         * @example {
         *       "id": "member-fiction-1",
         *       "displayName": "Persona ficticia",
         *       "role": "member",
         *       "status": "revoked",
         *       "avatarMediaId": null
         *     }
         */
        ExportMember: {
            id: components["schemas"]["Id"];
            displayName: string;
            /** @enum {string} */
            role: "member" | "admin";
            /** @enum {string} */
            status: "active" | "revoked";
            avatarMediaId: components["schemas"]["Id"] | null;
        };
        /**
         * @example {
         *       "memberId": "member-fiction-1",
         *       "discordId": "12345678901234567",
         *       "addedAt": "2026-01-15T19:00:00Z",
         *       "revokedAt": "2026-01-15T19:00:00Z"
         *     }
         */
        ExportAllowlist: {
            memberId: components["schemas"]["Id"];
            discordId: string;
            addedAt: components["schemas"]["Instant"];
            revokedAt: components["schemas"]["Instant"] | null;
        };
        /**
         * @example {
         *       "memberId": "member-fiction-1",
         *       "bio": "Biografía ficticia.",
         *       "favouriteQuote": null,
         *       "favouriteBookIds": []
         *     }
         */
        ExportProfile: {
            memberId: components["schemas"]["Id"];
            bio: string | null;
            favouriteQuote: string | null;
            favouriteBookIds: components["schemas"]["Id"][];
        };
        /**
         * @example {
         *       "id": "book-fiction-1",
         *       "title": "Texto ficticio",
         *       "authors": [],
         *       "status": "propuesto",
         *       "readingStartDate": null,
         *       "readingEndDate": null,
         *       "datesApproximate": false,
         *       "plannedStartDate": null,
         *       "plannedEndDate": null,
         *       "description": null,
         *       "publicationDate": null,
         *       "publisher": null,
         *       "isbn": null,
         *       "pageCount": null,
         *       "originVote": null,
         *       "deletion": null,
         *       "coverMediaId": null
         *     }
         */
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
        /**
         * @example {
         *       "percentStart": 0,
         *       "percentEnd": 25,
         *       "pageStart": 1,
         *       "pageEnd": 80,
         *       "dueDate": null,
         *       "notes": null,
         *       "meetingId": null,
         *       "id": "week-fiction-1",
         *       "bookId": "book-fiction-1",
         *       "weekNumber": 1,
         *       "deletion": {
         *         "deletedAt": "2026-01-01T00:00:00Z",
         *         "deletedBy": "member-fiction-1",
         *         "purgeDueAt": "2026-01-31T00:00:00Z"
         *       }
         *     }
         */
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
        /**
         * @example {
         *       "text": "IntervenciÃ³n ficticia",
         *       "published": false,
         *       "kind": "paraphrase",
         *       "speakerIds": [
         *         "member-fiction-1"
         *       ],
         *       "id": "highlight-fiction-1",
         *       "removedPosition": null,
         *       "deletion": null
         *     }
         */
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
        /**
         * @example {
         *       "id": "meeting-fiction-1",
         *       "bookId": "book-fiction-1",
         *       "startsAt": "2026-01-15T19:00:00Z",
         *       "cancelled": false,
         *       "attendance": [],
         *       "markedSafe": false,
         *       "summary": {
         *         "text": "Borrador ficticio.",
         *         "published": false
         *       },
         *       "highlights": [
         *         {
         *           "text": "IntervenciÃ³n ficticia",
         *           "published": false,
         *           "kind": "paraphrase",
         *           "speakerIds": [
         *             "member-fiction-1"
         *           ],
         *           "id": "highlight-fiction-1",
         *           "removedPosition": null,
         *           "deletion": null
         *         }
         *       ],
         *       "deletion": null
         *     }
         */
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
        /**
         * @example {
         *       "weekId": "week-fiction-1",
         *       "memberIds": [
         *         "member-fiction-1"
         *       ]
         *     }
         */
        ExportCompletions: {
            weekId: components["schemas"]["Id"];
            memberIds: components["schemas"]["Id"][];
        };
        /**
         * @example {
         *       "bookId": "book-fiction-1",
         *       "memberIds": [
         *         "member-fiction-1"
         *       ]
         *     }
         */
        ExportFinished: {
            bookId: components["schemas"]["Id"];
            memberIds: components["schemas"]["Id"][];
        };
        /**
         * @example {
         *       "bookId": "book-fiction-1",
         *       "userId": "member-fiction-1",
         *       "scores": {
         *         "disfrute": 5,
         *         "estilo": 4.5,
         *         "personajes": 3,
         *         "trama": 4,
         *         "huella": 2.5
         *       },
         *       "text": "Reseña privada ficticia.",
         *       "submittedAt": "2026-01-15T19:00:00Z",
         *       "editedAt": null
         *     }
         */
        ExportReview: {
            bookId: components["schemas"]["Id"];
            userId: components["schemas"]["Id"];
            scores: components["schemas"]["CriterionScores"];
            text: string | null;
            submittedAt: components["schemas"]["Instant"];
            editedAt: components["schemas"]["Instant"] | null;
        };
        /**
         * @example {
         *       "id": "vote-fiction-1",
         *       "status": "closed",
         *       "curatorId": "member-fiction-1",
         *       "openedAt": "2026-01-15T19:00:00Z",
         *       "closedAt": "2026-01-15T19:00:00Z",
         *       "candidates": [
         *         {
         *           "bookId": "book-fiction-1",
         *           "approverIds": [
         *             "member-fiction-1"
         *           ]
         *         }
         *       ],
         *       "outcome": {
         *         "winnerBookId": "book-fiction-1",
         *         "tieNote": null
         *       }
         *     }
         */
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
            outcome: ({
                winnerBookId: components["schemas"]["Id"];
                tieNote: string | null;
            } | {
                tiedBookIds: components["schemas"]["Id"][];
            }) | null;
        };
        /**
         * @example {
         *       "id": "quote-fiction-1",
         *       "text": "Texto literario ficticio.",
         *       "author": null,
         *       "source": null,
         *       "active": true,
         *       "deletion": null
         *     }
         */
        ExportQuote: {
            id: components["schemas"]["Id"];
            text: string;
            author: string | null;
            source: string | null;
            active: boolean;
            deletion: components["schemas"]["ExportDeletion"] | null;
        };
        /**
         * @example {
         *       "type": "quote",
         *       "id": "purged-quote-fiction-1",
         *       "purgedAt": "2026-01-15T19:00:00Z",
         *       "purgedBy": "member-fiction-1"
         *     }
         */
        ExportTombstone: {
            type: components["schemas"]["DeletedType"];
            id: components["schemas"]["Id"];
            purgedAt: components["schemas"]["Instant"];
            purgedBy: components["schemas"]["Id"];
        };
        /**
         * @description Manifest stable media id referenced by avatarMediaId/coverMediaId. Available bytes in ZIP under safe relative path; unavailable has path null, no external URL fetch/data URL. No path traversal or credentials.
         * @example {
         *       "id": "media-fiction-1",
         *       "path": "media/media-fiction-1.webp",
         *       "contentType": "image/webp",
         *       "available": true
         *     }
         */
        ExportMedia: {
            id: components["schemas"]["Id"];
            path: string | null;
            /** @enum {string} */
            contentType: "image/jpeg" | "image/png" | "image/webp";
            available: boolean;
        } & unknown;
        /**
         * @description Privileged versioned UTF-8 club.json inside ZIP, not HTTP JSON. Includes private reviews, drafts, revoked/recoverable records and safe audit; excludes sessions/OAuth credentials/secrets/purged substantive data. Canonical ids/links preserved, deletion separate nullable metadata; minimal tombstones auditable. No restoration/import guarantee.
         * @example {
         *       "schemaVersion": 1,
         *       "createdAt": "2026-01-15T19:00:00Z",
         *       "curatorId": null,
         *       "media": [],
         *       "rubric": {
         *         "disfrute": {
         *           "1": null,
         *           "2": null,
         *           "3": null,
         *           "4": null,
         *           "5": null
         *         },
         *         "estilo": {
         *           "1": null,
         *           "2": null,
         *           "3": null,
         *           "4": null,
         *           "5": null
         *         },
         *         "personajes": {
         *           "1": null,
         *           "2": null,
         *           "3": null,
         *           "4": null,
         *           "5": null
         *         },
         *         "trama": {
         *           "1": null,
         *           "2": null,
         *           "3": null,
         *           "4": null,
         *           "5": null
         *         },
         *         "huella": {
         *           "1": null,
         *           "2": null,
         *           "3": null,
         *           "4": null,
         *           "5": null
         *         }
         *       },
         *       "members": [],
         *       "allowlist": [],
         *       "profiles": [],
         *       "books": [],
         *       "weeks": [],
         *       "meetings": [],
         *       "completions": [],
         *       "finished": [],
         *       "reviews": [],
         *       "votes": [],
         *       "quotes": [],
         *       "tombstones": [],
         *       "audit": []
         *     }
         * @example {
         *       "schemaVersion": 1,
         *       "createdAt": "2026-01-15T19:00:00Z",
         *       "curatorId": null,
         *       "media": [
         *         {
         *           "id": "media-fiction-1",
         *           "path": "media/media-fiction-1.webp",
         *           "contentType": "image/webp",
         *           "available": true
         *         }
         *       ],
         *       "rubric": {
         *         "disfrute": {
         *           "1": null,
         *           "2": null,
         *           "3": null,
         *           "4": null,
         *           "5": null
         *         },
         *         "estilo": {
         *           "1": null,
         *           "2": null,
         *           "3": null,
         *           "4": null,
         *           "5": null
         *         },
         *         "personajes": {
         *           "1": null,
         *           "2": null,
         *           "3": null,
         *           "4": null,
         *           "5": null
         *         },
         *         "trama": {
         *           "1": null,
         *           "2": null,
         *           "3": null,
         *           "4": null,
         *           "5": null
         *         },
         *         "huella": {
         *           "1": null,
         *           "2": null,
         *           "3": null,
         *           "4": null,
         *           "5": null
         *         }
         *       },
         *       "members": [
         *         {
         *           "id": "member-fiction-1",
         *           "displayName": "Persona ficticia",
         *           "role": "member",
         *           "status": "revoked",
         *           "avatarMediaId": null
         *         }
         *       ],
         *       "allowlist": [
         *         {
         *           "memberId": "member-fiction-1",
         *           "discordId": "12345678901234567",
         *           "addedAt": "2026-01-15T19:00:00Z",
         *           "revokedAt": "2026-01-15T19:00:00Z"
         *         }
         *       ],
         *       "profiles": [
         *         {
         *           "memberId": "member-fiction-1",
         *           "bio": "Biografía ficticia.",
         *           "favouriteQuote": null,
         *           "favouriteBookIds": []
         *         }
         *       ],
         *       "books": [
         *         {
         *           "id": "book-fiction-1",
         *           "title": "Texto ficticio",
         *           "authors": [],
         *           "status": "propuesto",
         *           "readingStartDate": null,
         *           "readingEndDate": null,
         *           "datesApproximate": false,
         *           "plannedStartDate": null,
         *           "plannedEndDate": null,
         *           "description": null,
         *           "publicationDate": null,
         *           "publisher": null,
         *           "isbn": null,
         *           "pageCount": null,
         *           "originVote": null,
         *           "deletion": null,
         *           "coverMediaId": null
         *         }
         *       ],
         *       "weeks": [
         *         {
         *           "percentStart": 0,
         *           "percentEnd": 25,
         *           "pageStart": 1,
         *           "pageEnd": 80,
         *           "dueDate": null,
         *           "notes": null,
         *           "meetingId": null,
         *           "id": "week-fiction-1",
         *           "bookId": "book-fiction-1",
         *           "weekNumber": 1,
         *           "deletion": {
         *             "deletedAt": "2026-01-01T00:00:00Z",
         *             "deletedBy": "member-fiction-1",
         *             "purgeDueAt": "2026-01-31T00:00:00Z"
         *           }
         *         }
         *       ],
         *       "meetings": [
         *         {
         *           "id": "meeting-fiction-1",
         *           "bookId": "book-fiction-1",
         *           "startsAt": "2026-01-15T19:00:00Z",
         *           "cancelled": false,
         *           "attendance": [],
         *           "markedSafe": false,
         *           "summary": {
         *             "text": "Borrador ficticio.",
         *             "published": false
         *           },
         *           "highlights": [
         *             {
         *               "text": "IntervenciÃ³n ficticia",
         *               "published": false,
         *               "kind": "paraphrase",
         *               "speakerIds": [
         *                 "member-fiction-1"
         *               ],
         *               "id": "highlight-fiction-1",
         *               "removedPosition": null,
         *               "deletion": null
         *             }
         *           ],
         *           "deletion": null
         *         }
         *       ],
         *       "completions": [
         *         {
         *           "weekId": "week-fiction-1",
         *           "memberIds": [
         *             "member-fiction-1"
         *           ]
         *         }
         *       ],
         *       "finished": [
         *         {
         *           "bookId": "book-fiction-1",
         *           "memberIds": [
         *             "member-fiction-1"
         *           ]
         *         }
         *       ],
         *       "reviews": [
         *         {
         *           "bookId": "book-fiction-1",
         *           "userId": "member-fiction-1",
         *           "scores": {
         *             "disfrute": 5,
         *             "estilo": 4.5,
         *             "personajes": 3,
         *             "trama": 4,
         *             "huella": 2.5
         *           },
         *           "text": "Reseña privada ficticia.",
         *           "submittedAt": "2026-01-15T19:00:00Z",
         *           "editedAt": null
         *         }
         *       ],
         *       "votes": [
         *         {
         *           "id": "vote-fiction-1",
         *           "status": "closed",
         *           "curatorId": "member-fiction-1",
         *           "openedAt": "2026-01-15T19:00:00Z",
         *           "closedAt": "2026-01-15T19:00:00Z",
         *           "candidates": [
         *             {
         *               "bookId": "book-fiction-1",
         *               "approverIds": [
         *                 "member-fiction-1"
         *               ]
         *             }
         *           ],
         *           "outcome": {
         *             "winnerBookId": "book-fiction-1",
         *             "tieNote": null
         *           }
         *         }
         *       ],
         *       "quotes": [
         *         {
         *           "id": "quote-fiction-1",
         *           "text": "Texto literario ficticio.",
         *           "author": null,
         *           "source": null,
         *           "active": true,
         *           "deletion": null
         *         }
         *       ],
         *       "tombstones": [
         *         {
         *           "type": "quote",
         *           "id": "purged-quote-fiction-1",
         *           "purgedAt": "2026-01-15T19:00:00Z",
         *           "purgedBy": "member-fiction-1"
         *         }
         *       ],
         *       "audit": [
         *         {
         *           "id": "audit-fiction-1",
         *           "action": "exported",
         *           "target": {
         *             "type": "club",
         *             "id": "club",
         *             "label": "Club de lectura"
         *           },
         *           "actor": {
         *             "id": "member-fiction-1",
         *             "displayName": "Persona ficticia"
         *           },
         *           "occurredAt": "2026-01-15T19:00:00Z"
         *         }
         *       ]
         *     }
         */
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
        /**
         * @description UTF-8 manifest.json; media list matches club.json media. Missing bytes explicitly unavailable; available native website media included. Version change requires contract-first migration before #49 implementation.
         * @example {
         *       "schemaVersion": 1,
         *       "createdAt": "2026-01-15T19:00:00Z",
         *       "recordsFile": "club.json",
         *       "media": []
         *     }
         */
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
            headers: {
                [name: string]: unknown;
            };
            content: {
                /**
                 * @example {
                 *       "code": "invalid_input",
                 *       "message": "Datos no válidos."
                 *     }
                 */
                "application/json": components["schemas"]["Error"];
            };
        };
        /** @description Debes iniciar sesión. */
        Error401: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                /**
                 * @example {
                 *       "code": "unauthenticated",
                 *       "message": "Debes iniciar sesión."
                 *     }
                 */
                "application/json": components["schemas"]["Error"];
            };
        };
        /** @description No tienes permiso para realizar esta acción. */
        Error403: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                /**
                 * @example {
                 *       "code": "forbidden",
                 *       "message": "No tienes permiso para realizar esta acción."
                 *     }
                 */
                "application/json": components["schemas"]["Error"];
            };
        };
        /** @description No se encuentra el recurso. */
        Error404: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                /**
                 * @example {
                 *       "code": "not_found",
                 *       "message": "No se encuentra el recurso."
                 *     }
                 */
                "application/json": components["schemas"]["Error"];
            };
        };
        /** @description El estado actual no permite esta acción. */
        Error409: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                /**
                 * @example {
                 *       "code": "conflict",
                 *       "message": "El estado actual no permite esta acción."
                 *     }
                 */
                "application/json": components["schemas"]["Error"];
            };
        };
        /** @description No se ha podido completar la solicitud. */
        Error500: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                /**
                 * @example {
                 *       "code": "internal_error",
                 *       "message": "No se ha podido completar la solicitud."
                 *     }
                 */
                "application/json": components["schemas"]["Error"];
            };
        };
        /** @description El servicio no está disponible temporalmente. */
        Error503: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                /**
                 * @example {
                 *       "code": "service_unavailable",
                 *       "message": "El servicio no está disponible temporalmente."
                 *     }
                 */
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
export interface operations {
    getHealth: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description The API process is responding. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "status": "ok"
                     *     }
                     */
                    "application/json": {
                        /** @constant */
                        status: "ok";
                    };
                };
            };
        };
    };
    getSession: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful result. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "status": "anonymous",
                     *       "demoSignInAvailable": false
                     *     }
                     */
                    "application/json": components["schemas"]["Session"];
                };
            };
            500: components["responses"]["Error500"];
            503: components["responses"]["Error503"];
        };
    };
    signOut: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful; no response body. */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            403: components["responses"]["Error403"];
            500: components["responses"]["Error500"];
            503: components["responses"]["Error503"];
        };
    };
    startDemoSignIn: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful; no response body. */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            403: components["responses"]["Error403"];
            404: components["responses"]["Error404"];
            500: components["responses"]["Error500"];
            503: components["responses"]["Error503"];
        };
    };
    getHome: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful result. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "currentBook": null,
                     *       "currentWeek": null,
                     *       "nextMeeting": null,
                     *       "memberProgress": [],
                     *       "recentActivity": [],
                     *       "stats": {
                     *         "booksCompleted": 0,
                     *         "reviews": 0,
                     *         "members": 0
                     *       },
                     *       "quote": null
                     *     }
                     */
                    "application/json": components["schemas"]["HomeData"];
                };
            };
            401: components["responses"]["Error401"];
            500: components["responses"]["Error500"];
            503: components["responses"]["Error503"];
        };
    };
    setWeekCompleted: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Opaque weekId. */
                weekId: components["schemas"]["Id"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                /**
                 * @example {
                 *       "completed": false
                 *     }
                 */
                "application/json": components["schemas"]["WeekCompletionInput"];
            };
        };
        responses: {
            /** @description Successful; no response body. */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            400: components["responses"]["Error400"];
            401: components["responses"]["Error401"];
            403: components["responses"]["Error403"];
            404: components["responses"]["Error404"];
            500: components["responses"]["Error500"];
            503: components["responses"]["Error503"];
        };
    };
    listBooks: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful result. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /** @example [] */
                    "application/json": components["schemas"]["LibraryBook"][];
                };
            };
            401: components["responses"]["Error401"];
            500: components["responses"]["Error500"];
            503: components["responses"]["Error503"];
        };
    };
    getBook: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Opaque bookId. */
                bookId: components["schemas"]["Id"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful result. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "id": "book-fiction-1",
                     *       "title": "Texto ficticio",
                     *       "authors": [],
                     *       "coverUrl": null,
                     *       "status": "propuesto",
                     *       "readingStartDate": null,
                     *       "readingEndDate": null,
                     *       "datesApproximate": false,
                     *       "plannedStartDate": null,
                     *       "plannedEndDate": null,
                     *       "description": null,
                     *       "publicationDate": null,
                     *       "publisher": null,
                     *       "isbn": null,
                     *       "pageCount": null,
                     *       "schedule": [],
                     *       "meetings": [],
                     *       "originVote": null
                     *     }
                     */
                    "application/json": components["schemas"]["BookDetail"];
                };
            };
            401: components["responses"]["Error401"];
            404: components["responses"]["Error404"];
            500: components["responses"]["Error500"];
            503: components["responses"]["Error503"];
        };
    };
    listMeetings: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful result. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "upcoming": [],
                     *       "past": []
                     *     }
                     */
                    "application/json": components["schemas"]["MeetingList"];
                };
            };
            401: components["responses"]["Error401"];
            500: components["responses"]["Error500"];
            503: components["responses"]["Error503"];
        };
    };
    getMeeting: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Opaque meetingId. */
                meetingId: components["schemas"]["Id"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful result. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "id": "book-fiction-1",
                     *       "startsAt": "2026-01-15T19:00:00Z",
                     *       "cancelled": false,
                     *       "book": null,
                     *       "assignment": null,
                     *       "upcoming": false,
                     *       "attendance": null,
                     *       "record": {
                     *         "status": "visible",
                     *         "summary": null,
                     *         "highlights": []
                     *       }
                     *     }
                     */
                    "application/json": components["schemas"]["MeetingDetail"];
                };
            };
            401: components["responses"]["Error401"];
            404: components["responses"]["Error404"];
            500: components["responses"]["Error500"];
            503: components["responses"]["Error503"];
        };
    };
    getVotes: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful result. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "curator": null,
                     *       "current": null,
                     *       "history": [],
                     *       "canCreateVote": false
                     *     }
                     */
                    "application/json": components["schemas"]["VotesOverview"];
                };
            };
            401: components["responses"]["Error401"];
            500: components["responses"]["Error500"];
            503: components["responses"]["Error503"];
        };
    };
    createVote: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful result. */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "id": "book-fiction-1",
                     *       "status": "draft",
                     *       "curator": {
                     *         "id": "book-fiction-1",
                     *         "displayName": "Texto ficticio",
                     *         "avatarUrl": null
                     *       },
                     *       "openedAt": null,
                     *       "closedAt": null,
                     *       "candidates": [],
                     *       "outcome": null,
                     *       "canManage": false,
                     *       "canRecordTieWinner": false,
                     *       "curatedByMe": false
                     *     }
                     */
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
    getVote: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Opaque voteId. */
                voteId: components["schemas"]["Id"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful result. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "id": "book-fiction-1",
                     *       "status": "draft",
                     *       "curator": {
                     *         "id": "book-fiction-1",
                     *         "displayName": "Texto ficticio",
                     *         "avatarUrl": null
                     *       },
                     *       "openedAt": null,
                     *       "closedAt": null,
                     *       "candidates": [],
                     *       "outcome": null,
                     *       "canManage": false,
                     *       "canRecordTieWinner": false,
                     *       "curatedByMe": false
                     *     }
                     */
                    "application/json": components["schemas"]["Vote"];
                };
            };
            401: components["responses"]["Error401"];
            404: components["responses"]["Error404"];
            500: components["responses"]["Error500"];
            503: components["responses"]["Error503"];
        };
    };
    setApproval: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Opaque voteId. */
                voteId: components["schemas"]["Id"];
                /** @description Opaque bookId. */
                bookId: components["schemas"]["Id"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                /**
                 * @example {
                 *       "approved": false
                 *     }
                 */
                "application/json": components["schemas"]["ApprovalInput"];
            };
        };
        responses: {
            /** @description Successful result. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "id": "book-fiction-1",
                     *       "status": "draft",
                     *       "curator": {
                     *         "id": "book-fiction-1",
                     *         "displayName": "Texto ficticio",
                     *         "avatarUrl": null
                     *       },
                     *       "openedAt": null,
                     *       "closedAt": null,
                     *       "candidates": [],
                     *       "outcome": null,
                     *       "canManage": false,
                     *       "canRecordTieWinner": false,
                     *       "curatedByMe": false
                     *     }
                     */
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
    addCandidate: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Opaque voteId. */
                voteId: components["schemas"]["Id"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                /**
                 * @example {
                 *       "bookId": "book-fiction-1"
                 *     }
                 */
                "application/json": components["schemas"]["CandidateInput"];
            };
        };
        responses: {
            /** @description Successful result. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "id": "book-fiction-1",
                     *       "status": "draft",
                     *       "curator": {
                     *         "id": "book-fiction-1",
                     *         "displayName": "Texto ficticio",
                     *         "avatarUrl": null
                     *       },
                     *       "openedAt": null,
                     *       "closedAt": null,
                     *       "candidates": [],
                     *       "outcome": null,
                     *       "canManage": false,
                     *       "canRecordTieWinner": false,
                     *       "curatedByMe": false
                     *     }
                     */
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
    removeCandidate: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Opaque voteId. */
                voteId: components["schemas"]["Id"];
                /** @description Opaque bookId. */
                bookId: components["schemas"]["Id"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful result. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "id": "book-fiction-1",
                     *       "status": "draft",
                     *       "curator": {
                     *         "id": "book-fiction-1",
                     *         "displayName": "Texto ficticio",
                     *         "avatarUrl": null
                     *       },
                     *       "openedAt": null,
                     *       "closedAt": null,
                     *       "candidates": [],
                     *       "outcome": null,
                     *       "canManage": false,
                     *       "canRecordTieWinner": false,
                     *       "curatedByMe": false
                     *     }
                     */
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
    reorderCandidates: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Opaque voteId. */
                voteId: components["schemas"]["Id"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                /**
                 * @example {
                 *       "bookIds": []
                 *     }
                 */
                "application/json": components["schemas"]["CandidateOrderInput"];
            };
        };
        responses: {
            /** @description Successful result. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "id": "book-fiction-1",
                     *       "status": "draft",
                     *       "curator": {
                     *         "id": "book-fiction-1",
                     *         "displayName": "Texto ficticio",
                     *         "avatarUrl": null
                     *       },
                     *       "openedAt": null,
                     *       "closedAt": null,
                     *       "candidates": [],
                     *       "outcome": null,
                     *       "canManage": false,
                     *       "canRecordTieWinner": false,
                     *       "curatedByMe": false
                     *     }
                     */
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
    openVote: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Opaque voteId. */
                voteId: components["schemas"]["Id"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful result. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "id": "book-fiction-1",
                     *       "status": "draft",
                     *       "curator": {
                     *         "id": "book-fiction-1",
                     *         "displayName": "Texto ficticio",
                     *         "avatarUrl": null
                     *       },
                     *       "openedAt": null,
                     *       "closedAt": null,
                     *       "candidates": [],
                     *       "outcome": null,
                     *       "canManage": false,
                     *       "canRecordTieWinner": false,
                     *       "curatedByMe": false
                     *     }
                     */
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
    closeVote: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Opaque voteId. */
                voteId: components["schemas"]["Id"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful result. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "id": "book-fiction-1",
                     *       "status": "draft",
                     *       "curator": {
                     *         "id": "book-fiction-1",
                     *         "displayName": "Texto ficticio",
                     *         "avatarUrl": null
                     *       },
                     *       "openedAt": null,
                     *       "closedAt": null,
                     *       "candidates": [],
                     *       "outcome": null,
                     *       "canManage": false,
                     *       "canRecordTieWinner": false,
                     *       "curatedByMe": false
                     *     }
                     */
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
    recordTieWinner: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Opaque voteId. */
                voteId: components["schemas"]["Id"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                /**
                 * @example {
                 *       "bookId": "book-fiction-1",
                 *       "note": "Texto ficticio"
                 *     }
                 */
                "application/json": components["schemas"]["TieWinnerInput"];
            };
        };
        responses: {
            /** @description Successful result. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "id": "book-fiction-1",
                     *       "status": "draft",
                     *       "curator": {
                     *         "id": "book-fiction-1",
                     *         "displayName": "Texto ficticio",
                     *         "avatarUrl": null
                     *       },
                     *       "openedAt": null,
                     *       "closedAt": null,
                     *       "candidates": [],
                     *       "outcome": null,
                     *       "canManage": false,
                     *       "canRecordTieWinner": false,
                     *       "curatedByMe": false
                     *     }
                     */
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
    getBookRatings: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Opaque bookId. */
                bookId: components["schemas"]["Id"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful result. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "book": {
                     *         "id": "book-fiction-1",
                     *         "title": "Texto ficticio",
                     *         "authors": [],
                     *         "coverUrl": null
                     *       },
                     *       "ratable": false,
                     *       "finishedByMe": false,
                     *       "myReview": null,
                     *       "club": {
                     *         "status": "locked"
                     *       }
                     *     }
                     */
                    "application/json": components["schemas"]["BookRatings"];
                };
            };
            401: components["responses"]["Error401"];
            404: components["responses"]["Error404"];
            500: components["responses"]["Error500"];
            503: components["responses"]["Error503"];
        };
    };
    getRatingRubric: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful result. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "disfrute": {
                     *         "1": null,
                     *         "2": null,
                     *         "3": null,
                     *         "4": null,
                     *         "5": null
                     *       },
                     *       "estilo": {
                     *         "1": null,
                     *         "2": null,
                     *         "3": null,
                     *         "4": null,
                     *         "5": null
                     *       },
                     *       "personajes": {
                     *         "1": null,
                     *         "2": null,
                     *         "3": null,
                     *         "4": null,
                     *         "5": null
                     *       },
                     *       "trama": {
                     *         "1": null,
                     *         "2": null,
                     *         "3": null,
                     *         "4": null,
                     *         "5": null
                     *       },
                     *       "huella": {
                     *         "1": null,
                     *         "2": null,
                     *         "3": null,
                     *         "4": null,
                     *         "5": null
                     *       }
                     *     }
                     */
                    "application/json": components["schemas"]["RatingRubric"];
                };
            };
            401: components["responses"]["Error401"];
            500: components["responses"]["Error500"];
            503: components["responses"]["Error503"];
        };
    };
    setBookFinished: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Opaque bookId. */
                bookId: components["schemas"]["Id"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                /**
                 * @example {
                 *       "finished": false
                 *     }
                 */
                "application/json": components["schemas"]["FinishedInput"];
            };
        };
        responses: {
            /** @description Successful result. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "book": {
                     *         "id": "book-fiction-1",
                     *         "title": "Texto ficticio",
                     *         "authors": [],
                     *         "coverUrl": null
                     *       },
                     *       "ratable": false,
                     *       "finishedByMe": false,
                     *       "myReview": null,
                     *       "club": {
                     *         "status": "locked"
                     *       }
                     *     }
                     */
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
    saveMyReview: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Opaque bookId. */
                bookId: components["schemas"]["Id"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                /**
                 * @example {
                 *       "scores": {
                 *         "disfrute": 1,
                 *         "estilo": 1,
                 *         "personajes": 1,
                 *         "trama": 1,
                 *         "huella": 1
                 *       }
                 *     }
                 */
                "application/json": components["schemas"]["ReviewInput"];
            };
        };
        responses: {
            /** @description Successful result. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "book": {
                     *         "id": "book-fiction-1",
                     *         "title": "Texto ficticio",
                     *         "authors": [],
                     *         "coverUrl": null
                     *       },
                     *       "ratable": false,
                     *       "finishedByMe": false,
                     *       "myReview": null,
                     *       "club": {
                     *         "status": "locked"
                     *       }
                     *     }
                     */
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
    getStatistics: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful result. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "booksRead": 0,
                     *       "meetingsHeld": 0,
                     *       "thresholds": {
                     *         "bookRatings": 3,
                     *         "memberRatings": 3
                     *       },
                     *       "ratings": {
                     *         "status": "empty"
                     *       }
                     *     }
                     */
                    "application/json": components["schemas"]["Statistics"];
                };
            };
            401: components["responses"]["Error401"];
            500: components["responses"]["Error500"];
            503: components["responses"]["Error503"];
        };
    };
    getTasteCompatibility: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful result. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "minSharedBooks": 1,
                     *       "members": []
                     *     }
                     */
                    "application/json": components["schemas"]["TasteCompatibility"];
                };
            };
            401: components["responses"]["Error401"];
            500: components["responses"]["Error500"];
            503: components["responses"]["Error503"];
        };
    };
    listMembers: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful result. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "currentWeekNumber": null,
                     *       "members": []
                     *     }
                     */
                    "application/json": components["schemas"]["MemberDirectory"];
                };
            };
            401: components["responses"]["Error401"];
            500: components["responses"]["Error500"];
            503: components["responses"]["Error503"];
        };
    };
    getMemberProfile: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Opaque memberId. */
                memberId: components["schemas"]["Id"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful result. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "member": {
                     *         "id": "book-fiction-1",
                     *         "displayName": "Texto ficticio",
                     *         "avatarUrl": null
                     *       },
                     *       "bio": null,
                     *       "favouriteQuote": null,
                     *       "favouriteBooks": [],
                     *       "isMe": false,
                     *       "currentWeek": null
                     *     }
                     */
                    "application/json": components["schemas"]["MemberProfile"];
                };
            };
            401: components["responses"]["Error401"];
            404: components["responses"]["Error404"];
            500: components["responses"]["Error500"];
            503: components["responses"]["Error503"];
        };
    };
    getMyProfile: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful result. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "member": {
                     *         "id": "book-fiction-1",
                     *         "displayName": "Texto ficticio",
                     *         "avatarUrl": null
                     *       },
                     *       "bio": null,
                     *       "favouriteQuote": null,
                     *       "favouriteBooks": [],
                     *       "favouriteOptions": []
                     *     }
                     */
                    "application/json": components["schemas"]["MyProfile"];
                };
            };
            401: components["responses"]["Error401"];
            500: components["responses"]["Error500"];
            503: components["responses"]["Error503"];
        };
    };
    updateMyProfile: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                /**
                 * @example {
                 *       "metadata": {
                 *         "displayName": "Texto ficticio",
                 *         "favouriteBookIds": [],
                 *         "avatarAction": "keep"
                 *       }
                 *     }
                 */
                "multipart/form-data": components["schemas"]["ProfileMultipart"];
            };
        };
        responses: {
            /** @description Successful result. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "member": {
                     *         "id": "book-fiction-1",
                     *         "displayName": "Texto ficticio",
                     *         "avatarUrl": null
                     *       },
                     *       "bio": null,
                     *       "favouriteQuote": null,
                     *       "favouriteBooks": [],
                     *       "favouriteOptions": []
                     *     }
                     */
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
    listMyReviews: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful result. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /** @example [] */
                    "application/json": components["schemas"]["MyReviewEntry"][];
                };
            };
            401: components["responses"]["Error401"];
            500: components["responses"]["Error500"];
            503: components["responses"]["Error503"];
        };
    };
    startSignIn: {
        parameters: {
            query?: {
                /** @description export purpose reserves admin recent reauthentication for #102; server stores purpose/return path in OAuth state, no arbitrary external redirect. */
                purpose?: "login" | "export";
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Redirect to Discord authorisation from start, or safe same-origin page/session gate after callback. Failure lands on anonymous/denied Spanish page; no club payload. */
            302: {
                headers: {
                    /** @description Provider URL (start) or validated same-origin page (callback). */
                    Location: string;
                    [name: string]: unknown;
                };
                content?: never;
            };
            500: components["responses"]["Error500"];
            503: components["responses"]["Error503"];
        };
    };
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
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Redirect to Discord authorisation from start, or safe same-origin page/session gate after callback. Failure lands on anonymous/denied Spanish page; no club payload. */
            302: {
                headers: {
                    /** @description Provider URL (start) or validated same-origin page (callback). */
                    Location: string;
                    [name: string]: unknown;
                };
                content?: never;
            };
            500: components["responses"]["Error500"];
            503: components["responses"]["Error503"];
        };
    };
    getBackupInfo: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful approved-admin result. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "policy": "pending",
                     *       "lastBackupAt": null
                     *     }
                     */
                    "application/json": components["schemas"]["BackupInfo"];
                };
            };
            401: components["responses"]["Error401"];
            403: components["responses"]["Error403"];
            500: components["responses"]["Error500"];
            503: components["responses"]["Error503"];
        };
    };
    exportClubData: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
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
                    [name: string]: unknown;
                };
                content: {
                    "application/zip": Blob;
                };
            };
            401: components["responses"]["Error401"];
            403: components["responses"]["Error403"];
            /** @description Missing/stale recent authorisation; no download, existing approved session remains valid. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "code": "reauthentication_required",
                     *       "message": "Vuelve a identificarte con Discord para exportar los datos."
                     *     }
                     */
                    "application/json": components["schemas"]["ReauthenticationError"];
                };
            };
            500: components["responses"]["Error500"];
            503: components["responses"]["Error503"];
        };
    };
    getAuditLog: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful approved-admin result. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /** @example [] */
                    "application/json": components["schemas"]["AuditEvent"][];
                };
            };
            401: components["responses"]["Error401"];
            403: components["responses"]["Error403"];
            500: components["responses"]["Error500"];
            503: components["responses"]["Error503"];
        };
    };
    getRecycleBin: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful approved-admin result. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /** @example [] */
                    "application/json": components["schemas"]["RecycleBinEntry"][];
                };
            };
            401: components["responses"]["Error401"];
            403: components["responses"]["Error403"];
            500: components["responses"]["Error500"];
            503: components["responses"]["Error503"];
        };
    };
    getDeletionPreview: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                type: "book" | "meeting" | "quote";
                id: components["schemas"]["Id"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful approved-admin result. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "label": "Registro ficticio",
                     *       "dependencies": []
                     *     }
                     */
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
    restoreDeleted: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                type: components["schemas"]["DeletedType"];
                id: components["schemas"]["Id"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful approved-admin result. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /** @example [] */
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
    purgeDeleted: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                type: components["schemas"]["DeletedType"];
                id: components["schemas"]["Id"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful approved-admin result. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /** @example [] */
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
    deleteBook: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: components["schemas"]["Id"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful approved-admin result. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /** @example [] */
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
    deleteMeeting: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: components["schemas"]["Id"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful approved-admin result. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /** @example [] */
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
    updateLiteraryQuote: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: components["schemas"]["Id"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                /**
                 * @example {
                 *       "text": "Texto literario ficticio.",
                 *       "author": null,
                 *       "source": null,
                 *       "active": true
                 *     }
                 */
                "application/json": components["schemas"]["LiteraryQuoteInput"];
            };
        };
        responses: {
            /** @description Successful approved-admin result. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "id": "quote-fiction-1",
                     *       "text": "Texto literario ficticio.",
                     *       "author": null,
                     *       "source": null,
                     *       "active": true
                     *     }
                     */
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
    deleteLiteraryQuote: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: components["schemas"]["Id"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful approved-admin result. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /** @example [] */
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
    listAdminQuotes: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful approved-admin result. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /** @example [] */
                    "application/json": components["schemas"]["AdminLiteraryQuote"][];
                };
            };
            401: components["responses"]["Error401"];
            403: components["responses"]["Error403"];
            500: components["responses"]["Error500"];
            503: components["responses"]["Error503"];
        };
    };
    addLiteraryQuote: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                /**
                 * @example {
                 *       "text": "Texto literario ficticio.",
                 *       "author": null,
                 *       "source": null,
                 *       "active": true
                 *     }
                 */
                "application/json": components["schemas"]["LiteraryQuoteInput"];
            };
        };
        responses: {
            /** @description Successful approved-admin result. */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "id": "quote-fiction-1",
                     *       "text": "Texto literario ficticio.",
                     *       "author": null,
                     *       "source": null,
                     *       "active": true
                     *     }
                     */
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
    saveRatingRubric: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                /**
                 * @example {
                 *       "disfrute": {
                 *         "1": null,
                 *         "2": null,
                 *         "3": null,
                 *         "4": null,
                 *         "5": null
                 *       },
                 *       "estilo": {
                 *         "1": null,
                 *         "2": null,
                 *         "3": null,
                 *         "4": null,
                 *         "5": null
                 *       },
                 *       "personajes": {
                 *         "1": null,
                 *         "2": null,
                 *         "3": null,
                 *         "4": null,
                 *         "5": null
                 *       },
                 *       "trama": {
                 *         "1": null,
                 *         "2": null,
                 *         "3": null,
                 *         "4": null,
                 *         "5": null
                 *       },
                 *       "huella": {
                 *         "1": null,
                 *         "2": null,
                 *         "3": null,
                 *         "4": null,
                 *         "5": null
                 *       }
                 *     }
                 */
                "application/json": components["schemas"]["RatingRubricInput"];
            };
        };
        responses: {
            /** @description Successful approved-admin result. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "disfrute": {
                     *         "1": null,
                     *         "2": null,
                     *         "3": null,
                     *         "4": null,
                     *         "5": null
                     *       },
                     *       "estilo": {
                     *         "1": null,
                     *         "2": null,
                     *         "3": null,
                     *         "4": null,
                     *         "5": null
                     *       },
                     *       "personajes": {
                     *         "1": null,
                     *         "2": null,
                     *         "3": null,
                     *         "4": null,
                     *         "5": null
                     *       },
                     *       "trama": {
                     *         "1": null,
                     *         "2": null,
                     *         "3": null,
                     *         "4": null,
                     *         "5": null
                     *       },
                     *       "huella": {
                     *         "1": null,
                     *         "2": null,
                     *         "3": null,
                     *         "4": null,
                     *         "5": null
                     *       }
                     *     }
                     */
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
    getAdminMeetingRecord: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                meetingId: components["schemas"]["Id"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful approved-admin result. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "id": "meeting-fiction-1",
                     *       "startsAt": "2026-01-15T19:00:00Z",
                     *       "cancelled": false,
                     *       "book": null,
                     *       "week": null,
                     *       "markedSafe": false,
                     *       "summary": null,
                     *       "highlights": [],
                     *       "speakerOptions": []
                     *     }
                     */
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
    saveMeetingSummary: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                meetingId: components["schemas"]["Id"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                /**
                 * @example {
                 *       "text": "",
                 *       "published": false
                 *     }
                 */
                "application/json": components["schemas"]["MeetingSummaryInput"];
            };
        };
        responses: {
            /** @description Successful approved-admin result. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "id": "meeting-fiction-1",
                     *       "startsAt": "2026-01-15T19:00:00Z",
                     *       "cancelled": false,
                     *       "book": null,
                     *       "week": null,
                     *       "markedSafe": false,
                     *       "summary": null,
                     *       "highlights": [],
                     *       "speakerOptions": []
                     *     }
                     */
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
    createMeetingHighlight: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                meetingId: components["schemas"]["Id"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                /**
                 * @example {
                 *       "text": "IntervenciÃ³n ficticia",
                 *       "published": false,
                 *       "kind": "paraphrase",
                 *       "speakerIds": []
                 *     }
                 */
                "application/json": components["schemas"]["MeetingHighlightInput"];
            };
        };
        responses: {
            /** @description Successful approved-admin result. */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "id": "meeting-fiction-1",
                     *       "startsAt": "2026-01-15T19:00:00Z",
                     *       "cancelled": false,
                     *       "book": null,
                     *       "week": null,
                     *       "markedSafe": false,
                     *       "summary": null,
                     *       "highlights": [],
                     *       "speakerOptions": []
                     *     }
                     */
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
    updateMeetingHighlight: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                meetingId: components["schemas"]["Id"];
                highlightId: components["schemas"]["Id"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                /**
                 * @example {
                 *       "text": "IntervenciÃ³n ficticia",
                 *       "published": false,
                 *       "kind": "paraphrase",
                 *       "speakerIds": []
                 *     }
                 */
                "application/json": components["schemas"]["MeetingHighlightInput"];
            };
        };
        responses: {
            /** @description Successful approved-admin result. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "id": "meeting-fiction-1",
                     *       "startsAt": "2026-01-15T19:00:00Z",
                     *       "cancelled": false,
                     *       "book": null,
                     *       "week": null,
                     *       "markedSafe": false,
                     *       "summary": null,
                     *       "highlights": [],
                     *       "speakerOptions": []
                     *     }
                     */
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
    removeMeetingHighlight: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                meetingId: components["schemas"]["Id"];
                highlightId: components["schemas"]["Id"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful approved-admin result. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "id": "meeting-fiction-1",
                     *       "startsAt": "2026-01-15T19:00:00Z",
                     *       "cancelled": false,
                     *       "book": null,
                     *       "week": null,
                     *       "markedSafe": false,
                     *       "summary": null,
                     *       "highlights": [],
                     *       "speakerOptions": []
                     *     }
                     */
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
    reorderMeetingHighlights: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                meetingId: components["schemas"]["Id"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                /**
                 * @example {
                 *       "ids": []
                 *     }
                 */
                "application/json": components["schemas"]["IdOrder"];
            };
        };
        responses: {
            /** @description Successful approved-admin result. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "id": "meeting-fiction-1",
                     *       "startsAt": "2026-01-15T19:00:00Z",
                     *       "cancelled": false,
                     *       "book": null,
                     *       "week": null,
                     *       "markedSafe": false,
                     *       "summary": null,
                     *       "highlights": [],
                     *       "speakerOptions": []
                     *     }
                     */
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
    setMeetingRecordSafe: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                meetingId: components["schemas"]["Id"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                /**
                 * @example {
                 *       "safe": true
                 *     }
                 */
                "application/json": components["schemas"]["SafeInput"];
            };
        };
        responses: {
            /** @description Successful approved-admin result. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "id": "meeting-fiction-1",
                     *       "startsAt": "2026-01-15T19:00:00Z",
                     *       "cancelled": false,
                     *       "book": null,
                     *       "week": null,
                     *       "markedSafe": false,
                     *       "summary": null,
                     *       "highlights": [],
                     *       "speakerOptions": []
                     *     }
                     */
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
    getAdminReadingPlan: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                bookId: components["schemas"]["Id"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful approved-admin result. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "book": {
                     *         "id": "book-fiction-1",
                     *         "title": "Texto ficticio",
                     *         "pageCount": null
                     *       },
                     *       "weeks": [],
                     *       "meetings": []
                     *     }
                     */
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
    createReadingWeek: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                bookId: components["schemas"]["Id"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                /**
                 * @example {
                 *       "input": {
                 *         "percentStart": 0,
                 *         "percentEnd": 25,
                 *         "pageStart": 1,
                 *         "pageEnd": 80,
                 *         "dueDate": null,
                 *         "notes": null,
                 *         "meetingId": null
                 *       },
                 *       "acknowledged": false
                 *     }
                 */
                "application/json": components["schemas"]["ReadingWeekWrite"];
            };
        };
        responses: {
            /** @description Successful approved-admin result. */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "book": {
                     *         "id": "book-fiction-1",
                     *         "title": "Texto ficticio",
                     *         "pageCount": null
                     *       },
                     *       "weeks": [],
                     *       "meetings": []
                     *     }
                     */
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
    updateReadingWeek: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                bookId: components["schemas"]["Id"];
                weekId: components["schemas"]["Id"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                /**
                 * @example {
                 *       "input": {
                 *         "percentStart": 0,
                 *         "percentEnd": 25,
                 *         "pageStart": 1,
                 *         "pageEnd": 80,
                 *         "dueDate": null,
                 *         "notes": null,
                 *         "meetingId": null
                 *       },
                 *       "acknowledged": false
                 *     }
                 */
                "application/json": components["schemas"]["ReadingWeekWrite"];
            };
        };
        responses: {
            /** @description Successful approved-admin result. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "book": {
                     *         "id": "book-fiction-1",
                     *         "title": "Texto ficticio",
                     *         "pageCount": null
                     *       },
                     *       "weeks": [],
                     *       "meetings": []
                     *     }
                     */
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
    removeReadingWeek: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                bookId: components["schemas"]["Id"];
                weekId: components["schemas"]["Id"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful approved-admin result. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "book": {
                     *         "id": "book-fiction-1",
                     *         "title": "Texto ficticio",
                     *         "pageCount": null
                     *       },
                     *       "weeks": [],
                     *       "meetings": []
                     *     }
                     */
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
    reorderReadingWeeks: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                bookId: components["schemas"]["Id"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                /**
                 * @example {
                 *       "ids": [],
                 *       "acknowledged": false
                 *     }
                 */
                "application/json": components["schemas"]["ReadingWeekOrder"];
            };
        };
        responses: {
            /** @description Successful approved-admin result. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "book": {
                     *         "id": "book-fiction-1",
                     *         "title": "Texto ficticio",
                     *         "pageCount": null
                     *       },
                     *       "weeks": [],
                     *       "meetings": []
                     *     }
                     */
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
    listAdminMeetings: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful approved-admin result. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "upcoming": [],
                     *       "past": [],
                     *       "books": [],
                     *       "weeks": [],
                     *       "activeMembers": []
                     *     }
                     */
                    "application/json": components["schemas"]["AdminMeetingCalendar"];
                };
            };
            401: components["responses"]["Error401"];
            403: components["responses"]["Error403"];
            500: components["responses"]["Error500"];
            503: components["responses"]["Error503"];
        };
    };
    createMeeting: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                /**
                 * @example {
                 *       "startsAt": "2026-01-15T19:00:00Z",
                 *       "bookId": null,
                 *       "weekId": null
                 *     }
                 */
                "application/json": components["schemas"]["MeetingInput"];
            };
        };
        responses: {
            /** @description Successful approved-admin result. */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "startsAt": "2026-01-15T19:00:00Z",
                     *       "bookId": null,
                     *       "weekId": null,
                     *       "id": "meeting-fiction-1",
                     *       "cancelled": false,
                     *       "upcoming": true,
                     *       "attendance": null,
                     *       "attendanceEligible": false
                     *     }
                     */
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
    getAdminMeeting: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                meetingId: components["schemas"]["Id"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful approved-admin result. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "startsAt": "2026-01-15T19:00:00Z",
                     *       "bookId": null,
                     *       "weekId": null,
                     *       "id": "meeting-fiction-1",
                     *       "cancelled": false,
                     *       "upcoming": true,
                     *       "attendance": null,
                     *       "attendanceEligible": false
                     *     }
                     */
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
    updateMeeting: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                meetingId: components["schemas"]["Id"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                /**
                 * @example {
                 *       "startsAt": "2026-01-15T19:00:00Z",
                 *       "bookId": null,
                 *       "weekId": null
                 *     }
                 */
                "application/json": components["schemas"]["MeetingInput"];
            };
        };
        responses: {
            /** @description Successful approved-admin result. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "startsAt": "2026-01-15T19:00:00Z",
                     *       "bookId": null,
                     *       "weekId": null,
                     *       "id": "meeting-fiction-1",
                     *       "cancelled": false,
                     *       "upcoming": true,
                     *       "attendance": null,
                     *       "attendanceEligible": false
                     *     }
                     */
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
    setMeetingCancelled: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                meetingId: components["schemas"]["Id"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                /**
                 * @example {
                 *       "cancelled": true
                 *     }
                 */
                "application/json": components["schemas"]["CancelledInput"];
            };
        };
        responses: {
            /** @description Successful approved-admin result. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "startsAt": "2026-01-15T19:00:00Z",
                     *       "bookId": null,
                     *       "weekId": null,
                     *       "id": "meeting-fiction-1",
                     *       "cancelled": false,
                     *       "upcoming": true,
                     *       "attendance": null,
                     *       "attendanceEligible": false
                     *     }
                     */
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
    setMeetingAttendance: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                meetingId: components["schemas"]["Id"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                /**
                 * @example {
                 *       "memberIds": []
                 *     }
                 */
                "application/json": components["schemas"]["AttendanceInput"];
            };
        };
        responses: {
            /** @description Successful approved-admin result. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "startsAt": "2026-01-15T19:00:00Z",
                     *       "bookId": null,
                     *       "weekId": null,
                     *       "id": "meeting-fiction-1",
                     *       "cancelled": false,
                     *       "upcoming": true,
                     *       "attendance": null,
                     *       "attendanceEligible": false
                     *     }
                     */
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
    listAdminBooks: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful approved-admin result. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /** @example [] */
                    "application/json": components["schemas"]["AdminBook"][];
                };
            };
            401: components["responses"]["Error401"];
            403: components["responses"]["Error403"];
            500: components["responses"]["Error500"];
            503: components["responses"]["Error503"];
        };
    };
    createBook: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                /**
                 * @example {
                 *       "metadata": {
                 *         "title": "Texto ficticio",
                 *         "authors": [],
                 *         "status": "propuesto",
                 *         "readingStartDate": null,
                 *         "readingEndDate": null,
                 *         "datesApproximate": false,
                 *         "plannedStartDate": null,
                 *         "plannedEndDate": null,
                 *         "description": null,
                 *         "publicationDate": null,
                 *         "publisher": null,
                 *         "isbn": null,
                 *         "pageCount": null,
                 *         "coverAction": "keep"
                 *       }
                 *     }
                 */
                "multipart/form-data": components["schemas"]["BookMultipart"];
            };
        };
        responses: {
            /** @description Successful approved-admin result. */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "id": "book-fiction-1",
                     *       "title": "Texto ficticio",
                     *       "authors": [],
                     *       "coverUrl": null,
                     *       "status": "propuesto",
                     *       "readingStartDate": null,
                     *       "readingEndDate": null,
                     *       "datesApproximate": false,
                     *       "plannedStartDate": null,
                     *       "plannedEndDate": null,
                     *       "description": null,
                     *       "publicationDate": null,
                     *       "publisher": null,
                     *       "isbn": null,
                     *       "pageCount": null,
                     *       "originVote": null
                     *     }
                     */
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
    getAdminBook: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                bookId: components["schemas"]["Id"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful approved-admin result. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "id": "book-fiction-1",
                     *       "title": "Texto ficticio",
                     *       "authors": [],
                     *       "coverUrl": null,
                     *       "status": "propuesto",
                     *       "readingStartDate": null,
                     *       "readingEndDate": null,
                     *       "datesApproximate": false,
                     *       "plannedStartDate": null,
                     *       "plannedEndDate": null,
                     *       "description": null,
                     *       "publicationDate": null,
                     *       "publisher": null,
                     *       "isbn": null,
                     *       "pageCount": null,
                     *       "originVote": null
                     *     }
                     */
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
    updateBook: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                bookId: components["schemas"]["Id"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                /**
                 * @example {
                 *       "metadata": {
                 *         "title": "Texto ficticio",
                 *         "authors": [],
                 *         "status": "propuesto",
                 *         "readingStartDate": null,
                 *         "readingEndDate": null,
                 *         "datesApproximate": false,
                 *         "plannedStartDate": null,
                 *         "plannedEndDate": null,
                 *         "description": null,
                 *         "publicationDate": null,
                 *         "publisher": null,
                 *         "isbn": null,
                 *         "pageCount": null,
                 *         "coverAction": "keep"
                 *       }
                 *     }
                 */
                "multipart/form-data": components["schemas"]["BookMultipart"];
            };
        };
        responses: {
            /** @description Successful approved-admin result. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "id": "book-fiction-1",
                     *       "title": "Texto ficticio",
                     *       "authors": [],
                     *       "coverUrl": null,
                     *       "status": "propuesto",
                     *       "readingStartDate": null,
                     *       "readingEndDate": null,
                     *       "datesApproximate": false,
                     *       "plannedStartDate": null,
                     *       "plannedEndDate": null,
                     *       "description": null,
                     *       "publicationDate": null,
                     *       "publisher": null,
                     *       "isbn": null,
                     *       "pageCount": null,
                     *       "originVote": null
                     *     }
                     */
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
    searchBookMetadata: {
        parameters: {
            query: {
                /** @example Texto ficticio */
                query: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful approved-admin result. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /** @example [] */
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
    getAdminMembers: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful approved-admin result. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "members": [],
                     *       "curator": null
                     *     }
                     */
                    "application/json": components["schemas"]["AdminMembers"];
                };
            };
            401: components["responses"]["Error401"];
            403: components["responses"]["Error403"];
            500: components["responses"]["Error500"];
            503: components["responses"]["Error503"];
        };
    };
    addMember: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                /**
                 * @example {
                 *       "discordId": "12345678901234567",
                 *       "displayName": "Persona ficticia"
                 *     }
                 */
                "application/json": components["schemas"]["NewMember"];
            };
        };
        responses: {
            /** @description Successful approved-admin result. */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "members": [],
                     *       "curator": null
                     *     }
                     */
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
    revokeMember: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                memberId: components["schemas"]["Id"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful approved-admin result. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "members": [],
                     *       "curator": null
                     *     }
                     */
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
    restoreMember: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                memberId: components["schemas"]["Id"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful approved-admin result. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "members": [],
                     *       "curator": null
                     *     }
                     */
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
    setCurator: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                /**
                 * @example {
                 *       "memberId": null
                 *     }
                 */
                "application/json": components["schemas"]["CuratorInput"];
            };
        };
        responses: {
            /** @description Successful approved-admin result. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "members": [],
                     *       "curator": null
                     *     }
                     */
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
