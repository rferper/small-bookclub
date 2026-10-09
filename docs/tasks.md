> **Historical draft, retired.** The stack described here (server-rendered templates, HTMX) is outdated; see `docs/decisions.md`. The GitHub issues are the active backlog.

# Club de Lectura — Task Backlog

Shared context for every task (read this before picking one up):

- **Spec:** `product-spec.md` is the source of truth. Do not add features it lists as non-goals.
- **Stack:** Python, Django, SQLite, server-rendered Django templates with HTMX and a little Alpine.js, django-allauth for Discord OAuth, pytest-django for tests. Milestone 2 adds a local AI worker (faster-whisper + Ollama/llama.cpp) and a Discord bot whose language is decided by task 55.
- **Conventions:** user-facing text is Spanish; code and comments are English. Every permission and spoiler rule is enforced on the server, never only by hiding things in the template. A task is done only when it has passing tests.
- **Data:** use fictional fixtures only; never invent real club data.

---

## 1. Set up an empty project with a passing test
Goal: Have a runnable Django project skeleton with one green test.
Description: Create the Python project (dependency manager, `pyproject.toml`, Django, pytest-django, Ruff) and a Django project configured for SQLite, Spanish locale and a club timezone read from an environment variable. Add `.env.example`, `.gitignore`, a short README with run/test commands, and one smoke test that loads the settings and gets a 200 from a health-check URL.

## 2. Custom user model with roles and profile fields
Goal: Define the club's user model before any other migration exists.
Description: Create a custom Django user model with a unique `discord_user_id`, a `role` (admin/member), `approved`, `revoked_at`, and website-native profile fields (display name, bio, favourite quote, avatar path). Set it as `AUTH_USER_MODEL` and add tests for uniqueness and default values.

## 3. Base layout and cottage design system
Goal: Give every page a shared, responsive, accessible shell in the club's visual style.
Description: Build a base template with the main navigation (Inicio, Biblioteca, Reuniones, Votaciones, Estadísticas, Miembros, Mi perfil, and Administración shown only to admins), a mobile menu, and CSS colour tokens from the spec's palette (parchment, sage, soft green, forest, wood). Use free/system serif headings and sans-serif body text, visible keyboard focus, and `prefers-reduced-motion` handling; add HTMX and Alpine.js from pinned versions.

## 4. Require sign-in on every route
Goal: Make the whole site private by default.
Description: Add middleware that redirects any unauthenticated request to the login page, with an explicit small allowlist (login, OAuth callback, health check, static files). Add tests proving that pages and any JSON/HTMX endpoints return no club data to anonymous users.

## 5. Discord OAuth sign-in with an allowlist
Goal: Let approved members sign in with Discord and block everyone else.
Description: Configure django-allauth's Discord provider with the `identify` scope, and link the Discord user ID to the custom user model. Sign-in succeeds only if that Discord ID belongs to an approved, non-revoked user; otherwise show a friendly Spanish access-denied page and create no session.

## 6. Seed the first admin from the environment
Goal: Create the initial admin securely without any open "become admin" path.
Description: Write a management command that reads a Discord user ID from an environment variable and creates or promotes that user to approved admin, idempotently. Test that running it twice is safe and that no web route can grant the admin role.

## 7. Revoke members and invalidate their sessions
Goal: Revoking a member immediately ends their access.
Description: Implement a revoke action that sets `revoked_at` and deletes or invalidates all of that user's existing sessions, plus a session check that rejects revoked users on every request. Test that a logged-in member who is revoked is refused on their very next request.

## 8. Admin page to manage the member allowlist
Goal: Let the admin add, approve and revoke members by Discord ID.
Description: Build an admin-only page under Administración listing members with their status, a form to add a Discord user ID with an initial display name, and approve/revoke buttons with confirmation. Members and curators must get a 403 on every one of these views.

## 9. Edit own website profile
Goal: Let each member customise their own profile.
Description: Build the "Mi perfil" page where a member edits their display name, short bio, favourite literary quote and avatar. Validate avatar type and size, store uploads in a private media folder served only to signed-in members, and test that a member can never edit someone else's profile by changing an ID in the request.

## 10. Members directory
Goal: Show signed-in members who is in the club.
Description: Build the "Miembros" list page and a profile detail page showing each member's avatar, display name, bio and quote, using website-native data only (never Discord names or avatars). Revoked members are hidden from the directory.

## 11. Central permission helpers
Goal: Put all role checks in one tested module.
Description: Create a single module of permission functions (e.g. `is_admin`, `is_current_curator`, `can_edit_profile`) and view decorators/mixins that use them. Cover every row of the spec's permission matrix (section 3) with unit tests so later features reuse these helpers instead of writing ad-hoc checks.

## 12. Soft-delete infrastructure
Goal: Provide reusable soft delete with a 30-day restore window.
Description: Create an abstract model or mixin with `deleted_at`, `deleted_by` and `purge_due_at`, a default manager that hides deleted rows, and an unfiltered manager for admin views. Add `soft_delete()` and `restore()` methods with tests; this is used later by books, meetings and other club content.

## 13. Book model and the one-active-book rule
Goal: Store books with manual statuses and never more than one "Leyendo" book.
Description: Create the soft-deletable `Book` model (title, authors, description, cover, publication info, external IDs, status Propuesto/Elegido/Leyendo/Terminado/Archivado, optional start/end dates). Enforce the single active book with a database constraint and a transactional service function, with tests that two books can never be "Leyendo" at once.

## 14. Admin manual book create and edit
Goal: Let the admin add and correct books without any external API.
Description: Build admin-only create and edit forms for every book field, including cover upload with type/size validation and support for missing or approximate dates on historical books. Test that a book can be created entirely by hand.

## 15. Open Library metadata search
Goal: Let the admin prefill a new book from Open Library.
Description: Add an admin search box that queries the Open Library API server-side (with a timeout and a polite User-Agent) and lets the admin pick a result to prefill the book form, cover included. The site must keep working if the API is down, and imported fields remain fully editable; mock the API in tests.

## 16. Change book status manually
Goal: Let the admin move a book through its lifecycle by hand.
Description: Add admin controls on a book to change its status, with a confirmation step and a clear error if another book is already "Leyendo". Statuses never change automatically from dates or votes; test that.

## 17. Bookshelf view
Goal: Browse all club books as a cozy cover grid.
Description: Build the "Biblioteca" page as a responsive grid of book covers with title and author, a placeholder for books without a cover, and simple status filter and sort. Each card links to the book detail page, and the page has a friendly empty state.

## 18. Timeline view
Goal: Browse club books in chronological order.
Description: Add a timeline mode to Biblioteca ordered by reading dates, handling books with approximate or missing dates gracefully (e.g. grouped under "Fecha desconocida"). It opens the same book detail page as the bookshelf, and works on phone and desktop.

## 19. Book detail page skeleton
Goal: Show one book's metadata and club status in one place.
Description: Build the book detail page with cover, metadata, status and dates, plus clearly separated empty placeholder sections for the reading schedule, meetings, ratings and originating vote. Later tasks fill those sections in.

## 20. Meeting model and admin calendar management
Goal: Let the admin create and freely change weekly meetings.
Description: Create the soft-deletable `Meeting` model (book, start datetime in the club timezone, status scheduled/cancelled/completed, summary fields) and admin forms to add, reschedule, cancel and delete meetings, including ad-hoc ones. No external calendar or Discord event sync.

## 21. Reading assignments linked to meetings
Goal: Let the admin enter each week's reading range by hand.
Description: Create the `ReadingAssignment` model (book, week number, percent start/end, page start/end, optional due date, admin notes) with a single canonical one-to-one link to a meeting. Build admin forms that warn on implausible ranges but allow them, never infer pages from percent or the reverse, and test that rescheduling a meeting does not change its assignment.

## 22. Weekly reading completion toggle
Goal: Let each member mark a week's reading as done or not done.
Description: Create the `ReadingCompletion` model (unique per assignment and user) and an HTMX "Marcar como leído / Desmarcar" toggle that only affects the signed-in user. Nothing happens automatically when a week passes; test that one member's toggle never affects another.

## 23. "He terminado el libro" toggle
Goal: Let each member mark a whole book as personally finished.
Description: Create the `BookCompletion` model (unique per book and user) and a toggle on the book page. It is independent of weekly completions: finishing the last week does not mark the book finished, and test that.

## 24. Homepage: current book and this week's reading
Goal: Show the active book and the current weekly target prominently.
Description: Build the top of "Inicio" with the active book's cover, title and author, and this week's assignment (week label, percent range, page range, linked meeting date) with the completion toggle. Include friendly empty states for "no active book" and "no assignment yet".

## 25. Homepage: next meeting and member progress
Goal: Show the next meeting and who has done this week's reading.
Description: Add a next-meeting card (local date and time, assigned range, link to details) and a calm list of members' avatars showing who has completed the current assignment. Never show rankings or scolding language.

## 26. Meetings list page
Goal: Let members see upcoming and past meetings.
Description: Build the "Reuniones" page listing future and past meetings with date, book, linked reading range and status; cancelled meetings must be visually unambiguous. Make it comfortable on mobile, with a list view at minimum.

## 27. Meeting detail and attendance
Goal: Show a meeting's details and let the admin record who attended.
Description: Build the meeting detail page (date, book, assigned range, attendance) and an admin-only attendance form backed by a `MeetingAttendance` model that is unique per meeting and user. Members see attendance read-only.

## 28. Meeting summary and highlights editor
Goal: Let the admin write and publish a meeting's summary and highlights.
Description: Add an admin editor for the summary text and an ordered list of free-form `MeetingHighlight` entries (text, optional speaker members, quote/paraphrase flag), each with draft/published status. Members must never receive draft content; sanitise all text against script injection.

## 29. Weekly spoiler gating for meeting summaries
Goal: Hide a meeting's summary and highlights until the member has read that week.
Description: Implement one central function that decides whether a user can see a meeting's published summary and highlights: allowed only if they completed the linked assignment, and hidden by default when there is no linked assignment unless the admin marks it safe. Test that finishing week 2 unlocks week 2 but not week 3, including in raw HTML and HTMX responses.

## 30. Curator assignment
Goal: Let the admin record who the current curator is.
Description: Create a `CuratorAssignment` model (member, related vote or cycle, assigned date) and an admin form to set it. Curator is an assignment, not a role; test that a curator gains no admin powers.

## 31. Vote and shortlist creation
Goal: Let the curator build a shortlist of candidate books.
Description: Create `Vote` (curator, status draft/open/closed, open/close dates, winner, tie note) and `VoteCandidate` (unique per vote and book, order) models. Build a page where the current curator (or admin as override) adds, removes, orders and opens the shortlist; ordinary members are refused.

## 32. Public approval voting
Goal: Let members approve any number of shortlisted books while a vote is open.
Description: Create `VoteApproval` (unique per vote, book and user) and a voting page with covers, short metadata and HTMX checkboxes, showing live totals and the names of voters for each book. Approvals can be added or withdrawn only while the vote is open, and test that each approval counts exactly one.

## 33. Close a vote and resolve ties
Goal: Let the curator or admin close a vote and record the winner.
Description: Add a "Cerrar votación" action with confirmation for the curator or admin, after which the vote is read-only. If there is a clear winner, record it; if tied, require the admin (or an explicitly authorised curator) to pick the winner with a note. Closing never changes book statuses or curator automatically.

## 34. Voting history
Goal: Keep every past election browsable.
Description: Build a history list and read-only detail view for closed votes showing curator, all candidates (including losers), each member's approvals, the winner, timestamps and any tie note. Link the winning book's detail page to its originating vote.

## 35. Rating rubric editor
Goal: Let the admin write what each star level means for each criterion.
Description: Create a `RatingRubric` model (criterion Disfrute/Estilo/Personajes/Trama/Huella, star 1–5, nullable description) and an admin editor for it. Do not prefill any rubric text; the owner writes it.

## 36. Review model and rating maths
Goal: Store reviews with five mandatory half-star scores and compute averages correctly.
Description: Create the `Review` model (unique per book and user, five scores constrained to 1.0–5.0 in 0.5 steps at form and database level, optional text, timestamps) and pure functions for a member's overall score and club averages. Test that scores 5, 4.5, 3, 4, 2.5 give exactly 3.8 and that missing or invalid values are rejected.

## 37. Review submission and edit form
Goal: Let members rate and review club books, and edit later.
Description: Build an accessible form with a keyboard-friendly half-star control per criterion (showing the rubric description when present), the live overall mean, and an optional text box. Members can edit their own review any time and never anyone else's; historical books use the same form.

## 38. Review spoiler gating
Goal: Hide others' ratings until a member has finished the book and submitted their own.
Description: Implement one central function deciding whether a user can see other members' reviews and aggregate scores for a book: allowed only after "He terminado el libro" and a complete own review. Test that finishing alone is not enough and that no hidden rating or aggregate appears in HTML or any HTMX/JSON response, including for the admin's member view.

## 39. Ratings section on the book page
Goal: Show permitted reviews, club averages and a radar chart on each book.
Description: Fill the book detail ratings section with each member's scores and text, club overall and per-criterion averages with the review count `n`, and a radar chart (Chart.js) comparing a selected member to the club mean, plus an equivalent numeric table. Everything passes through the review gating function; unrated books never show "0/5".

## 40. Statistics calculation module
Goal: Compute club statistics as tested pure functions.
Description: Write pure functions for completed-book and meeting counts, book and criterion means, highest/lowest rated books, average score per member, most generous/harshest rater and most divisive book, with minimum sample sizes. Inputs must already be filtered by the viewer's spoiler permissions.

## 41. Taste compatibility between members
Goal: Compare two members' tastes on books both have rated.
Description: Implement a pairwise compatibility metric (e.g. mean absolute difference, overall and per criterion) using only commonly rated books, returning the overlap count. Below a minimum overlap, return a "not enough data" result shown as «Aún no hay suficientes libros en común».

## 42. Statistics page
Goal: Present club and member statistics clearly on phone and desktop.
Description: Build the "Estadísticas" page using the statistics and compatibility modules, with simple charts plus text/table alternatives and explicit denominators. Make sure books the viewer cannot see ratings for are excluded from what they see.

## 43. Literary quotes
Goal: Show a random literary quote on each homepage visit.
Description: Create a `LiteraryQuote` model (text, author/source, enabled) with an admin manager, a small seed set of public-domain quotes with verified attribution, and a homepage block picking one enabled quote at random per visit. Include an empty state when there are no quotes.

## 44. Homepage small stats
Goal: Add a few lightweight club numbers to the homepage.
Description: Show a small block with counts such as books completed, books reviewed and members. Reuse the statistics module and never reveal spoiler-gated scores.

## 45. Activity log and homepage feed
Goal: Show recent club activity without leaking spoilers.
Description: Create an `ActivityEvent` model (type, subject, actor, time, safe payload) and record events for book selected, vote opened/closed, nominations, summary published and review submitted. Render a recent-activity list on the homepage that filters each event through the relevant spoiler and permission checks for the viewer.

## 46. Recycle bin
Goal: Let the admin see and restore deleted content within 30 days.
Description: Build an admin "Papelera" page listing soft-deleted books, meetings and other soft-deletable content with deletion date and purge date, plus restore and "purge now" actions. Warn about dependencies before deleting a book that has reviews, votes or meetings, and never cascade-delete history.

## 47. Automatic purge after 30 days
Goal: Permanently remove soft-deleted content once its retention has passed.
Description: Write a management command that purges items whose `purge_due_at` has passed, without orphaning history such as votes or reviews, and document how to schedule it. Test with a frozen clock just before and after the 30-day threshold.

## 48. Automated backups and restore test
Goal: Make consistent backups of the database and uploads, and prove they restore.
Description: Write a management command that snapshots SQLite with its online backup API (never a raw file copy), bundles media uploads, and keeps a bounded rotation of backups. Add an automated test that restores a backup into a fresh location and checks the records and files.

## 49. Admin data export
Goal: Let the admin download a full copy of club data.
Description: Add an admin-only export (JSON of all models plus media files, or a full database snapshot) behind recent re-authentication. Members must not be able to reach it.

## 50. Admin audit log
Goal: Record critical admin actions without copying private text.
Description: Create an audit log of actions such as member approve/revoke, status changes, vote closure, tie resolution, deletions, restores and exports, storing who, what and when but not review or summary text. Show it read-only to the admin.

## 51. Security hardening
Goal: Bring the site up to the spec's security baseline.
Description: Configure secure cookies, HTTPS-related settings, security headers, CSRF protection, `noindex` headers, and rate limiting on login/OAuth and expensive routes. Check upload validation, make sure logs exclude member-sensitive content, and add tests for the key settings.

## 52. Empty, loading and error states
Goal: Make every page friendly when there is nothing to show or something fails.
Description: Review every page for the empty states listed in the spec (no book, no meeting, no ratings, no vote, no history) and add warm Spanish messages. Add custom 403, 404 and 500 pages in the site's style.

## 53. Accessibility pass
Goal: Meet WCAG-oriented basics across the site.
Description: Check keyboard navigation, focus visibility, colour contrast of the palette, form labels and errors, alt text for covers and avatars, chart text alternatives and reduced-motion behaviour. Fix issues found and add an automated accessibility check (e.g. axe via Playwright) on key pages.

## 54. End-to-end user journeys
Goal: Cover the Milestone 1 definition of done with browser tests.
Description: Write Playwright tests, with mocked Discord login and fictional fixtures, for: sign in, edit profile, complete the weekly reading, vote, finish and rate a book, see unlocked ratings and summaries, and browse the timeline. Run them at both phone and desktop viewport sizes.

## 55. Portable deployment guide
Goal: Document how to run the site in production on any free option without committing to one.
Description: Write a production configuration (e.g. Dockerfile or process manager + Caddy for HTTPS, static/media handling, environment variables, scheduled purge and backups) and `docs/deployment.md` comparing self-hosting, free cloud and hybrid. Do not choose or pay for any host.

## 56. Discord voice capture spike (Milestone 2)
Goal: Prove whether a bot can record per-speaker audio in the club's real Discord voice channel.
Description: Build a throwaway proof-of-concept bot (try discord.js with `@discordjs/voice` first, and Python libraries if promising) that joins a private server voice channel with current DAVE encryption and records separate audio for 2–3 real speakers. Write up the results, including user-ID mapping, joins/leaves and overlap, and recommend the bot's language or the manual-upload fallback.

## 57. Audio processing job model and admin status page
Goal: Track recording processing jobs safely on the website.
Description: Create an `AudioProcessingJob` model (meeting, status, temporary file paths, error, cleanup deadline, approved date) and an admin-only page showing job status and errors. File paths and job details must never be visible to members.

## 58. Manual recording upload fallback
Goal: Let the admin upload a meeting recording when the bot cannot record.
Description: Add an admin-only upload form attached to a meeting that validates file type and maximum size, stores the file in a temporary per-job directory, and creates a processing job. This feeds the same pipeline as bot recordings.

## 59. Local transcription worker
Goal: Turn a meeting recording into a timestamped transcript locally.
Description: Build a worker that picks up pending jobs and transcribes Spanish/Catalan audio with faster-whisper (or whisper.cpp), producing timestamped segments with speaker candidates when per-user tracks exist. Benchmark model sizes on the actual hardware and document the choice; nothing is sent to a paid API.

## 60. Local summary and highlights generation
Goal: Produce an editable Spanish draft summary and highlights from a transcript.
Description: Use a local model via Ollama or llama.cpp to chunk the transcript, summarise it in Spanish to a configurable target length (default about 300 words), and propose free-form highlights, attributing speakers only when supported and otherwise using neutral wording. Save the results as draft summary and highlights for the meeting; never auto-publish.

## 61. Discord recording bot commands
Goal: Let an authorised member start and stop recording with a visible bot.
Description: Implement the bot (in the language recommended by task 56) with explicit start/stop commands, clear in-channel announcements of recording state, and a hand-off of recorded audio to a processing job. Unknown Discord users are flagged rather than attributed, and recording stops on request.

## 62. Approval cleanup and draft expiry
Goal: Delete raw audio and transcripts once a summary is approved or abandoned.
Description: When the admin publishes an AI draft, delete the job's raw audio, transcript and temporary files, keeping only the published text, with explicit error handling if deletion fails. Add a configurable expiry that warns the admin and cleans up drafts that are never approved, and test both paths.
