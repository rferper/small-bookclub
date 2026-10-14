# Page-state review (#52)

Reviewed the routes in `frontend/src/routes.tsx` against product-spec §9 and the existing page tests. Spanish empty states, `Loading` and retryable `LoadError` already cover the business screens; this pass keeps their established copy. The shared retry now replaces a failed load with loading feedback while a successful mutation refresh retains confirmed content and focus.

| Routes / screens | Empty or unavailable content | Loading / failure evidence |
|---|---|---|
| Inicio | No current book, weekly assignment, upcoming meeting, activity or completed books | HomePage tests: initial pending call, new club, failed load/retry and failed week save |
| Biblioteca and book detail | Empty shelf/search; no schedule, own review or unlocked club ratings; missing book | LibraryPage, BookPage and BookCompletion tests: pending, retry, 404 and mutation failure |
| Rating form | Not-yet-eligible explanation; optional empty review; missing book | RatePage tests: pending, retry, validation, conflict and save failure |
| Reuniones and meeting detail | No upcoming/past meetings, attendance, summary or highlights; missing meeting | MeetingsPage and MeetingPage tests: pending, retry, 404 and server-projected spoiler gates |
| Votaciones and vote detail | No curator, current vote or history; draft/closed state; missing vote | VotesPage, VotePage and VoteManagement tests: pending, retry, 404 and failed candidate/ballot/lifecycle writes |
| Estadísticas | No unlocked ratings; insufficient shared books; no other comparable member | StatisticsPage and StatisticsCompatibility tests: pending, local retry and zero-data explanations |
| Miembros and member detail | No other member; blank biography, favourite quote/books; missing member | MembersPage and MemberProfilePage tests: pending, retry and 404 |
| Mi perfil | Empty own reviews and favourites, no finished club-book options, absent avatar | MyProfilePage and ProfileForm tests: independently loading/retryable sections, validation and retained failed save input |
| Admin hub, member management | Static hub requires no data; only current admin/no curator/revoked accounts | AdminGuard and AdminMembersPage tests: access refusal, list pending/retry and failed writes |
| Admin books, create/edit | Empty catalogue/search; absent cover; missing edit target; blank creation form | AdminBooksPage tests: pending/retry/404, manual entry after search failure, retained failed save input |
| Admin meetings, create/edit/record | No meetings/assignments/attendance; blank summary/highlights; missing target | AdminMeetingsPage and AdminMeetingRecordPage tests: pending/retry/404, validation and retained failed writes |
| Admin reading plans | No book/plan/weeks and missing selected book | AdminReadingPlansPage tests: loading, retry, unavailable selection and failed changes |
| Admin quotes/rubric | No quotes; blank rubric anchors | AdminLiteraryPages tests: pending/retry and retained failed edits |
| Admin recycle bin | No removed content | AdminRecycleBinPage tests: pending/retry, refusal and retained failed restore/purge |
| Admin backups/export and audit | Backup setup honestly pending; empty audit | AdminOperationsPages tests: pending/retry, export/reauth failures and access refusal |
| Session, forbidden and unknown routes | Sign-in/denied screens reveal no club data; styled reserved section and unknown URL | SessionGate, AccessDeniedPage, AdminGuard and PageRecovery tests |

Unexpected route/render exceptions now reach a standalone Spanish fallback. It uses no session/API hooks and displays no caught error, stack, server payload or club data. A normal document link to `/` restarts the application and rechecks the session. Backend API errors retain their JSON contract; they are handled by the existing session gate or local retry UI. This presentation does not replace any backend permission or spoiler rule.

The #94 photo-copy follow-up is fixed: removing a pending upload when no saved photo exists simply discards it, restores the empty avatar and focuses the file input. Removing an actual saved photo still offers the existing pending-removal/undo flow.

Automated evidence: `PageRecovery.test.tsx` covers a held retry, secret-free router crash, unknown URL and reserved admin route; the existing page suites cover the matrix above. Disposable terminal Playwright additionally verifies desktop/mobile empty library, API-error retry/loading, 403, 404, crash fallback and photo discard with fictional fixtures. Screenshots are inspected before merge; comprehensive accessibility and deployed end-to-end journeys remain #53 and #54.
