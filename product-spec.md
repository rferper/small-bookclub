# Club de Lectura — Product Specification & AI Development Blueprint

**Version:** 1.1  
**Date:** 9 October 2026 (1.1 adds the course requirements in §15; the chosen stack is in `docs/decisions.md`)  
**Status:** Requirements agreed; implementation not yet started  
**Intended audience:** The project owner and AI coding/development agents  
**Specification language:** English, to support implementation. **Product language:** Spanish only.  
**Priority:** Build a charming, reliable **private website for 6–10 friends**, not a large social network.

> **Primary instruction to an AI developer:** This document is the source of truth. Implement the agreed behaviour without inventing social features, notifications, subscriptions, or extra complexity. Resolve small technical details pragmatically; flag decisions explicitly marked *deferred*. Deliver in testable, incremental slices. Distinguish committed scope from ideas for later.

---

## 1. Product vision and constraints

The club reads **one book approximately every two months**, meets on **Discord roughly every week**, and divides the reading into manually agreed weekly portions. A different **curator** is selected informally after finishing each book; that curator proposes a shortlist, and members use **approval voting** (vote for multiple books, all selections carrying equal weight). The group is relaxed: meetings, reading assignments, voting, and progress can be changed manually without penalties.

The website is the club's **cozy, private digital library**, where members:

- See the current book, **this week's reading target** (both percentage and page range), next meeting, activity, small statistics, and a random general literary quote.
- Mark weekly portions as completed, with completion visible to friends.
- Browse all club books as a **bookshelf** or **timeline**, including manually entered older books.
- Nominate/vote on future books following the club's curator process.
- Write optional text reviews and mandatory ratings on **five criteria**; discover aggregate scores and members' taste similarities.
- Read weekly meeting descriptions, AI-assisted summaries, and carefully selected text highlights, protected from spoilers.
- Use custom website profiles. **Discord is only for sign-in and voice meetings**; most friends do not actively use Discord for other things.

### Non-negotiable constraints

| Requirement | Decision |
|---|---|
| Audience | 6–10 friends; closed club, not a public application. |
| Privacy | All website content is accessible **only to approved, signed-in members**. |
| Language | Spanish interface, descriptions, and AI-generated summaries; conversations may contain Catalan. Original-language direct quotes may remain in Catalan. |
| Cost | **Zero new recurring subscriptions, API fees, or paid hosting.** Prefer free/open-source tooling and available hardware. Existing electricity and internet costs are outside a claim of literally zero operating cost. |
| Deployment | **Real club instance: deferred until implementation.** A computer is available; do not assume a DGX Spark or any specific hardware. Compare self-hosting, free hosting, and hybrid when ready. A separate **public demo instance** with fictional data is deployed early to a free cloud host (§15). |
| Devices | Responsive/mobile-first, with an equally comfortable desktop experience. |
| Club atmosphere | Calm, green, cottage-inspired digital library; no gamified pressure, mandatory streaks, or flashy immersive elements. |
| No notifications | No email, Discord announcement bot, browser push, or overdue-reading reminders. A Discord bot may communicate **in-channel recording state**, which is not a general notification system. |
| Delivery | **Milestone 1: full core website. Milestone 2: Discord recording and AI assistance.** |

### Explicit non-goals for initial release

- Public profiles, public books, an open signup page, or sharing links publicly. (Exception: the separate demo instance with fictional data, §15.)
- A replacement for Discord chat; comments/forums/direct messaging.
- Personal book tracking outside books officially read by the club.
- Automatic book selection, automatic reading-plan generation, automated curator rotation, or strict scheduling.
- Personal reading streaks, reminders, penalties, leaderboards based on keeping up.
- Multi-edition pagination handling: everyone uses the same edition for each book.
- External calendar syncing and Discord scheduled event syncing.
- Paid AI services, mandatory cloud AI APIs, audio-highlight hosting.
- Sophisticated ML recommendations in the first release.

---

## 2. Delivery scope and priorities

### Milestone 1 — Core website (required before the bot)

1. **Private auth and club membership:** Discord OAuth sign-in, admin-controlled allowlist, independent editable website profiles, role-based permissions.
2. **Homepage:** active book, this week's assigned percentage and page range, next meeting, public progress, recent activity, a few statistics, random literary quote.
3. **Book catalogue:** search for metadata from a free source and correct/add manually; one active book; manual statuses; historical books, bookshelf and timeline.
4. **Reading schedule:** admin-configured weekly ranges (percent and pages), attached to meetings; individual completed toggles, visible to other members.
5. **Meetings:** editable weekly calendar; freely moved, skipped, added or cancelled; manual attendance; summary and highlights entered by admin; spoiler rules.
6. **Curator and votes:** manually select curator; curator proposes shortlist; public approval voting, editable until manually closed; archive full voting history; manual tie resolution.
7. **Ratings and reviews:** mandatory five-criterion scores (1–5 stars in 0.5 steps), optional text, independent submission before other reviews become visible, average/radar chart, editable anytime.
8. **Initial statistics:** book counts, means, top-rated books, individual rating tendencies, rating differences and member comparison, with sensible minimum sample sizes and explicit denominators.
9. **Operations:** admin controls, validation, audit-friendly state, backup/export, 30-day recoverable deletion, accessibility, tests and secure deployments.

### Milestone 2 — Discord bot and local AI (after Milestone 1 is stable)

1. Move club calls to a **private Discord server voice channel**, since bots cannot join group DMs.
2. Admin/member issues a manual recording command; bot joins voice, announces recording start and stop, and records participants previously informed about the process.
3. Process recording to obtain a **Spanish transcript from mixed Spanish/Catalan speech**; associate contributions with identifiable Discord users where technically reliable.
4. Generate **editable admin-only draft summary**, default approximately **300 words**, configurable per meeting, plus a **variable number of meaningful text highlights**.
5. Highlights are free-form and can paraphrase or quote faithfully; do not force categories, humour, or a minimum count. Attribute speakers only when supportable.
6. Admin reviews/corrects/publishes the draft. **Delete raw recording and transcript after approval** (with explicit error and retention handling). Keep the published summary/highlights; no audio clips.
7. Document a **fallback manual summary** for any missed/unrecorded meeting, and a technical fallback for unsupported Discord audio reception.

**Milestone 2 is not a prerequisite for launching Milestone 1.** Its feasibility depends on validating recording in a modern Discord/DAVE-compatible bot and finding local AI models suitable for the eventual hardware.

### Later / possible extensions, not commitments

- Private personal questions/notes for each weekly discussion.
- Richer taste compatibility charts, a 2D taste map, predictive recommendations, personalised book suggestions.
- Annual retrospective and club awards, detailed genre analytics.
- More ambient cottage flourishes, provided they do not undermine simplicity.
- Optional exports of reviews or a printable yearbook.

---

## 3. Members, roles, and permissions

### Roles

- **Admin:** One club owner. Can approve/revoke members, edit books, statuses and calendar, assign curator, correct catalogue data, create/recover/delete content, manage meetings, attendance, voting, quote library, criterion descriptions and AI-generated summaries.
- **Member:** Approved participant. Can customise **their own website profile**, see all permitted club content, complete reading targets, cast/change votes, mark a book personally completed, submit and edit **their own** ratings/reviews.
- **Current curator:** An **assignment to a member**, not a global account role. Can create/edit the shortlist for the current vote and **close it**. Admin retains override authority. The curator is selected manually by the group after a book finishes; no automated rotation.

### Permission matrix

| Action | Member | Current curator | Admin |
|---|:---:|:---:|:---:|
| Sign in with approved Discord ID | Yes | Yes | Yes |
| Edit own website profile | Yes | Yes | Yes |
| Add or revoke club members | No | No | Yes |
| Create/edit catalogue, current book and reading targets | No | No | Yes |
| Nominate books for the current vote | No | Yes | Yes (override) |
| Approve vote choices / change own votes | Yes | Yes | Yes |
| Close current vote | No | Yes | Yes |
| Record final tie-break winner | No | Propose/communicate | Yes, or curator with explicit authorisation |
| Mark own weekly reading complete / book finished | Yes | Yes | Yes |
| Rate/review and edit own review | Yes | Yes | Yes |
| Edit another person's review | No | No | No by default; exceptional moderation requires a separately logged admin action |
| Edit meeting dates, attendance, summaries/highlights | No | No | Yes |
| View review of current book before submitting own review | No | No | No by default; admin access to operations must not accidentally leak ratings in member views |
| Restore deleted club content | No | No | Yes |

**Note:** The club initially agreed to **admin + member** roles; the curator receives only narrowly defined extra voting privileges. Do not turn curator into an unrestricted administrator.

### Authentication and member profiles

- Discord OAuth2 (authorization code flow via a reputable maintained library), no local password management.
- An **admin-managed allowlist** of exact Discord user IDs; being part of a Discord server alone does **not** grant access.
- Store Discord user ID strictly as the external login identity and, later, optional bot/audio attribution key.
- Do **not** sync display name, avatar or biography from Discord as the permanent source of truth. Allow members to upload/change their **website-native display name, avatar, short bio, literary quote, favourite club books/genres**.
- Only approved accounts can complete sign-in and read pages/API data. Provide a friendly Spanish access-denied page.
- Revocation prevents new authenticated access and invalidates existing sessions as soon as practical.
- Seed the first admin securely from an environment-controlled Discord ID; never offer unrestricted self-registration or an open 'become admin' action.

---

## 4. Primary user experience and information architecture

### Navigation proposal (labels can be polished)

| Section | Spanish label | Key contents |
|---|---|---|
| Home | **Inicio** | Current book, weekly target, next meeting, recent activity, small stats, quote. |
| Books | **Biblioteca** | Bookshelf/timeline, filters, book detail. |
| Calendar | **Reuniones** | Calendar, meeting details, summaries and attendance. |
| Voting | **Votaciones** | Open shortlist, public votes, previous elections. |
| Statistics | **Estadísticas** | Overall and per-member rating/reading statistics. |
| Members | **Miembros** | Profiles, tastes, public weekly reading status. |
| Personal area | **Mi perfil** | Independent profile settings and personal reviews. |
| Admin (conditional) | **Administración** | Members, books, meetings, reading plans, quotes, rubric, backups, recycle bin, AI drafts (later). |

### Homepage: content priority

1. **Hero: currently reading**, including cover/title/author and link to full book page.
2. **This week's reading**, visually prominent: week label, **percentage range**, **page range**, due date/linked meeting; toggle **«Marcar como leído» / «Desmarcar»**. Example: *Semana 3 · 25–40 % · páginas 82–130 · reunión jueves 15*. These are illustrative, not canonical targets.
3. **Next meeting:** exact manually set local date/time, current assigned pages/percentage, link to meeting detail.
4. **Member progress overview:** names/avatars showing who has completed the assigned reading; no ranking or scolding.
5. **Recent club activity:** reviews becoming available, newly selected book, curator nominations, meeting archive updates. This is an on-site feed, **not a notification service**. Respect spoiler rules when composing entries.
6. **Small club stats:** completed books, currently reviewed books, number of members or similar lightweight metrics.
7. **General literary quotation:** random from a maintained collection **on page visit**; not tied to the currently read book, with attribution where known. Seed with properly sourced/public-domain or short appropriately usable quotations. Admin may edit collection.

Empty states matter: before first book, before first meeting, before anybody rates, after all assignments complete, no current vote, no old books added.

### Visual identity and tone

- **Cottage-inspired digital library**, not full-on fantasy/game UI.
- Suggested palette (starting points, editable): parchment `#F5F0E4`, sage `#B7C9A8`, soft green `#728D69`, dark forest `#344F3C`, wood `#8B7355`.
- Legible serif headings and restrained sans-serif UI body text; soft surfaces, book covers, understated borders and comfortable spacing.
- Keep functionality more prominent than texture, animation, ambient audio, fireplaces, or decorative illustrations.
- Mobile-first responsive layouts **and** thoughtful desktop experiences, especially statistics.
- Spanish microcopy: helpful, warm, low-pressure; no 'streak broken', urgent progress alerts or punitive labels.
- Meet WCAG-oriented keyboard focus, contrast, accessible inputs, chart alternatives, alt text, reduced-motion preference. Prefer system-hosted fonts/free licenses; never require a paid asset subscription.

---

## 5. Domain behaviour and detailed requirements

### 5.1 Books: catalogue and lifecycle

- Add a book via **free metadata search** (e.g. Open Library) with an entirely manual fallback. Import title, author(s), cover, description, publication date and identifying edition metadata *if available*.
- Admin can correct each field, replace/upload a cover and add a book without any matching API record.
- **One official active book at a time**. Book statuses are **manually** set by admin: *Propuesto* (candidate), *Elegido / pendiente*, *Leyendo*, *Terminado* (plus optional archived state). Winning a vote does not automatically start a book; dates do not automatically finish it.
- Track planned/actual reading dates when known, but allow missing/approximate dates for historical entries. Older books can be created one at a time (approximately 10–50 potential entries), with no requirement to import them all or construct fictional old meetings.
- Book detail contains cover, metadata, club status, current/past reading schedule, linked meetings, summaries and highlights, ratings/reviews, club averages, radar chart, and link to the originating vote when applicable.
- Browse book history in **two modes**: a cozy cover-grid bookshelf and chronological timeline, both opening the same detail page. Filters/sort should remain simple at first.
- No separate cataloguing of independent books that members read outside the club.

### 5.2 Weekly reading targets and progress

- Club typically meets weekly while reading each book over about two months. **All dates and intervals are flexible**.
- **Admin enters reading assignments manually**, based on decisions made outside the app (sometimes with an external LLM). The app does *not* generate reading breakdowns automatically.
- Each assignment specifies week/order, **percent start/end**, **page start/end**, linked meeting/due date, and optionally short admin notes. Members use one shared edition. No conversion between editions or personal digital-vs-physical mapping.
- Percent and pages are both stored/displayed as independently entered facts; do not silently infer one from the other if they conflict. Validate plausible ranges and warn, but allow the admin to correct intentional edge cases.
- **Each member independently marks an assignment complete or incomplete**. Completion is publicly visible *to authenticated club members*.
- There are **no reminders, penalties or automatic progress changes** when a week passes. A member can finish late and mark completed then.
- Weekly completion does **not** automatically mark the entire book as completed. There is a separate personal **«He terminado el libro»** control.
- A meeting is associated with a week's reading assignment, but moving a meeting does not silently alter its page or percent range. The admin can edit both as appropriate.

### 5.3 Meeting calendar and records

- Meeting schedule is created/edited on the **website** by admin. No Discord scheduled-event API, external calendar sync or automatic notifications.
- Show future meetings, past meetings, and details in a calendar/list view. Permit rescheduling, cancelling, skipping and ad-hoc meetings. Make cancelled status unambiguous.
- Each meeting links to the current book and a weekly assignment, when applicable.
- Admin manually records **attendance** after the meeting; show it in the meeting archive.
- Every meeting has an **editable summary field** and a collection of **editable free-form text highlights**; these can be blank or written manually if no recording exists.
- Only admin can create/edit/delete/publish summary and highlights. Member-facing meeting details can still show date, book, assigned range and attendance.
- **Weekly spoiler gating:** member may view a meeting's substantive summary/highlights only after completing that meeting's linked week's reading assignment. If no assignment is linked (e.g. unusual historical entry), admin may choose a safe visibility rule; default to hidden for non-admin members until explicitly safe.
- For AI-generated content (Milestone 2), initial status **draft**; publish only after admin approval. A manual summary can be published through the same UI.

### 5.4 Curators, nominations and approval voting

- Club finishes a book and **informally chooses the next curator**. Admin records selected curator. No fixed rotation.
- Curator selects a **shortlist** of candidate books based on their preferences (normally several). Curator alone can add/modify nominations while active, with admin override.
- Voting system is **approval voting**: each member may select **multiple shortlist books**; each choice is worth exactly one vote. One vote max per user per candidate.
- Voting is **public throughout**: authenticated members see who voted for each book and live totals, including before closure.
- Members can add/remove their selections freely until the vote is **manually closed by curator or admin**. Once closed, it is read-only.
- The book with the largest count is the natural winner. A tie is settled **manually by discussion** and admin (or specifically authorised curator) records the chosen winner. No automatic tie-break or required runoff.
- Preserve the **entire history**: curator, shortlist, selected candidates, votes by member, final winning book, timestamps/status and any tie resolution note. Losing nominations remain viewable in historical elections.
- Closed vote does not automatically activate/finish books or select the next curator.
- UI for an election: covers, brief book metadata, toggles/checkboxes for choices, live vote count and visible voters, explicit *«Cerrar votación»* with confirmation for authorised roles.

### 5.5 Ratings, reviews and spoiler protection

Members may review **only official club books**, including historical books. Ratings are entered after they personally finish reading the book, not necessarily after the group finishes or meets.

**Mandatory five dimensions (Spanish UI):**

1. **Disfrute** — enjoyment.
2. **Estilo** — prose and style.
3. **Personajes** — characters.
4. **Trama** — plot.
5. **Huella** — lasting impression.

Rules:

- Each criterion **required**, value from **1.0 to 5.0 inclusive, in 0.5-star increments** (not zero, and no missing criterion).
- A written review is **optional**.
- Member's overall score is the **unweighted mean of the five values**, retained/displayed with adequate precision (e.g. 3.7/5). Do not round the underlying computation to half-stars.
- The club's score is the **mean of the overall scores of all members who submitted**; every member has equal weight. This equals the mean of all five criterion ratings only because each review has exactly five required criteria.
- Criterion-level club averages are also shown. Display the number of submitted reviews; don't present an unrated book as `0/5`.
- **Independent rating rule:** members must (i) mark **«He terminado el libro»** and (ii) **submit their own complete five-criterion rating** before seeing other members' scores, written reviews, or aggregate scores that would reveal them. This is stricter than simply marking the book finished and overrides earlier ambiguity.
- Members may **edit their own rating and text review at any time** after submission. Calculated scores and statistics update accordingly.
- Historical books follow exactly the same five-criterion requirement; no simplified single-number historical reviews.
- Admin can manually define **criterion-specific textual meaning** of 1, 2, 3, 4 and 5 stars; the owner will provide these descriptions later. Do **not invent canonical rubric text**. Half-star values sit between anchors unless admin later supplies more definitions.
- Rating UI: accessible star/half-star control, labelled dimensions, overall mean, optional review box, edit flow.
- Book detail shows submitted member results and an accessible **radar chart** comparing a selected member's five criteria to club means, subject to spoiler gating; accompanying plain numeric table is required.

**Spoiler privacy is server-side.** Do not fetch other users' reviews and merely hide them with CSS. Apply access conditions to endpoints, server actions, aggregate/statistics surfaces, feed items and all chart data.

### 5.6 Statistics (basic launch, expandable social layer)

For Milestone 1, implement reliable simple indicators, then progressively social comparisons without making the system ML-heavy. Supported analyses include:

- Total completed club books, meeting counts, number of ratings, book-level and criterion-level means.
- Highest/lowest rated books (when sufficiently rated), average by member, most generous/harshest rater, and most divisive book (dispersion of scores).
- **Taste compatibility** between pairs of members on **commonly rated books only**, with overlap count displayed and a clearly labelled metric (e.g. mean absolute rating difference or Pearson correlation where adequate data exist).
- Differences by individual criterion (e.g. two members agree on *Trama* but disagree on *Estilo*).
- Optional public progress/attendance summaries, keeping the club's relaxed tone.
- Avoid overstating correlations with two shared ratings. Define a sensible minimum shared-sample threshold before showing a confident compatibility interpretation; otherwise show *«Aún no hay suficientes libros en común»*.
- Never quietly infer what someone thought of a book from an unfinished or absent review. Keep statistics consistent with review spoiler rules.
- Advanced recommendations, embeddings, personalised models and detailed taste map are **future**, not MVP blockers.

### 5.7 Literary quotes

- General quotes **about books/literature/reading**, not necessarily from the current club book.
- Display a **random selection on each homepage visit** from a maintained small corpus, with author/source if known.
- Admin can manage collection. Quote content should be checked for attribution and rights; prefer public-domain or appropriately brief excerpts, not full passages.

### 5.8 Recent activity

- A simple chronological list of internal events: new ratings (only when viewer entitled to see), book selected, vote opened/closed, reading changes that are reasonable to show, meeting summary published.
- **No external push/email/Discord notifications**.
- Avoid exposing ratings, excerpts, meeting highlights or aggregate scores to viewers who have not satisfied spoiler gates.
- Keep feed implementation lightweight; could be computed from persisted events or an activity log rather than a real-time event service.

---

## 6. Milestone 2 — Audio, transcription, summary, highlights

### Intended happy path

1. Admin/authorised member joins private Discord server voice channel; **manually invokes a recording command**.
2. Bot **clearly announces recording started**, displays recording status, and records only while active. Participants have previously been informed and have agreed; account for newcomers and stopping recording on request. Start/stop must be explicit, not covert.
3. Bot collects audio with speaker association **if the receiving library reliably exposes per-user audio streams**. Use Discord user IDs to map to club member profiles; flag unknown Discord users and prevent unauthorised contributions being misattributed.
4. Stop recording; bot **announces stop**. Private audio is temporarily held for processing; do not create permanent audio clips.
5. Offline/local pipeline: transcribe **Spanish plus occasional Catalan**, collect timestamps and speaker candidates, then generate Spanish summary with configurable target length (**default ~300 words**) and free-form text highlights.
6. Summary and highlights include **speaker attributions only when sufficiently supported**, and preserve original-language verbatim quotes only when speech recognition is reliable. Paraphrases are safer than invented 'exact quotes'.
7. Store a **draft** in website admin UI. Admin edits wording, attributions, quotes and highlight count, then approves/publishes. Automatically **delete raw audio and transcript** after successful approval; retain published approved text only.
8. If recording or processing fails, admin still has the same empty/manual summary and highlights editor. Avoid blocking publication of the meeting itself.

### Important technical caveat / feasibility spike

Discord has required **DAVE end-to-end encryption** for voice since March 2026. As documented by `@discordjs/voice`, bot voice **audio reception is not an officially documented/stability-guaranteed feature**. Do not promise robust audio capture or precise diarisation before a proof of concept succeeds in the actual chosen server/channel. An early Milestone 2 spike must validate:

- Bot joins the server channel with current DAVE support.
- Captures real voices for 2–3 speakers and overlapping dialogue.
- Associates PCM/Opus streams with the correct Discord user IDs consistently.
- Correctly handles joins/leaves, multiple users, network interruptions and channel moves.
- Produces usable Spanish/Catalan transcripts and non-hallucinated speaker attributions.

**Fallback if bot recording fails:** Use a manually uploaded recording generated by a supported tool and keep the rest of the transcription/summarisation pipeline unchanged. This is a technical contingency, not a change to the preferred Discord bot UX.

### Local AI approach (provisional, not paid)

- Speech-to-text: compare **faster-whisper** (Python) or **whisper.cpp**; run locally.
- AI summary: a locally executed multilingual instruct model via **Ollama** or **llama.cpp**, chosen after checking available CPU/GPU/RAM; avoid dependence on paid providers.
- For long conversations, chunk transcripts, combine intermediate summaries and verify key assertions/quotes against segments. Avoid claims of exact word-count guarantees; apply a word-count check and regenerate/revise if needed.
- Speaker identification: preferably Discord-provided stream/member linkage (if workable) rather than general-purpose diarisation alone. Unknown/unreliable speaker IDs become neutral *«Una persona comentó...»* and are flagged for admin correction.
- Process audio in temporary directories; enforce per-job isolation, failure cleanup, maximum input size and admin-only access to drafts.
- Optional technical logs must never include retained raw transcript segments or sensitive quotes by default.

### Retention and consent

- Before launch, document the club's standing understanding of recording and inform every member/guest. **No per-meeting approval pop-up** is required by product design, but bot start/stop must be visible and members must be able to request recording to stop. Follow applicable local recording/privacy law.
- Audio and raw transcript remain only until the admin **approves** the summary, then are deleted, including temporary working copies where technically feasible.
- Retention if a draft is **never approved** remains an implementation policy to define before Milestone 2 launch; do not keep unreviewed recordings forever. Offer a configurable short cleanup/expiry with an explicit warning to admin.
- Audio deletion is distinct from **database recycle-bin policy** and **backup retention**; avoid making impossible claims that backup copies disappear instantly.

---

## 7. Recommended technical architecture

> **Superseded for the stack:** the chosen stack is Django + Django Ninja (backend), React + Vite + TypeScript (frontend) and SQLite, with `openapi.yaml` as the contract; see `docs/decisions.md`. The table below is the original recommendation; its constraints (free, portable, local AI) still apply.

### Primary stack (choice delegated to implementation)

| Layer | Recommended solution | Rationale / constraints |
|---|---|---|
| Web app | **Next.js (App Router) + TypeScript** | One codebase for routes, UI, server actions/API, responsive SSR and admin tools. Good for self-hosting; choose a supported stable release when coding starts. |
| Styling/components | **Tailwind CSS + accessible headless components (e.g. shadcn/ui)** | Fast to create a consistent cottage-inspired design. Check licensing and accessibility. |
| Persistence | **SQLite + Drizzle ORM** | Small 6–10 member workload; relational integrity; zero external DB service cost. Use migrations. |
| Authentication | **Discord OAuth2** via maintained auth library | No stored passwords. Backend allowlist tied to Discord user IDs. |
| Charts | **Recharts** or another free accessible chart library | Ratings radar chart and straightforward member comparisons. Provide text equivalent. |
| Book metadata | **Open Library API**, optional manual replacement | Free lookup without making third-party metadata essential. Respect fair-use/rate limits and attribution. |
| Image storage | Private, backed-up filesystem/object storage available in chosen deployment | Admin/member uploaded avatars/covers; validate type/size; never assume free unlimited external CDN. |
| Discord bot (M2) | **Node.js/TypeScript + discord.js + `@discordjs/voice`**, tested for DAVE | Same language as website. Recording compatibility must be experimentally verified. |
| STT/LLM (M2) | **Local Whisper variant + local model** | No paid API dependence; actual model/runner chosen to fit hardware. |
| Deployment | **Undecided** | Evaluate actual available computer, uptime, connectivity, backups, security and free-host restrictions after implementation. |

### High-level structure

```text
club-de-lectura/
  apps/
    web/                 # Next.js UI + API/server actions
    discord-bot/         # Milestone 2 only
  packages/
    shared/              # Types, validation, shared constants
    database/            # Drizzle schema, migrations, repository helpers
  services/
    ai-worker/           # Milestone 2, Python or local model adapter
  docs/
    product-spec.md      # Copy of this document
    architecture.md
    decisions.md         # Short ADRs for technical decisions
    deployment.md
    operations.md        # Backups / recovery / maintenance
  tests/
  .env.example
  README.md
```

This monorepo is a **suggested** layout, not a mandatory complexity requirement. A simple single Next.js application is better than unnecessary microservices. Split out the bot/worker only when actually implementing Milestone 2.

### Deployment options — deliberate hold

| Option | Advantages | Caveats |
|---|---|---|
| Existing computer, self-host all | No hosting fee, straightforward SQLite persistence, local AI | Requires uptime, backups, networking, TLS and security patching; electricity/internet already exist but are not inherently free. |
| Free cloud website + local bot/AI | Website potentially available while computer off | Free-tier limits, cold starts, persistence, storage, exit policies; SQLite may not work reliably on ephemeral/serverless filesystems. |
| Full free cloud | No local always-on requirement | Always-on voice bot/audio jobs and free storage/AI are especially difficult to guarantee without billing. |

**Deployment decision rule:** Do not commit to a platform, external storage service or paid domain until the implementation is complete enough to measure requirements. A free provider may discontinue or constrain a tier; no platform can guarantee a permanently free service. Use a free subdomain or existing domain option if necessary rather than requiring a purchase.

---

## 8. Suggested data model (conceptual, before migrations)

All IDs internal UUIDs or database-native IDs unless noted. Include `created_at`/`updated_at` on mutable records; include `deleted_at` for soft-deletable club content. Use foreign keys, indexes and constraints. Schema names below are suggestions.

| Entity | Suggested key fields / behaviour |
|---|---|
| `users` | `id`, unique `discord_user_id`, `role` (admin/member), `approved`, `revoked_at`, separate website `display_name`, `bio`, `avatar_path`, `favourite_quote`, timestamps. |
| `user_favourite_books` | `user_id`, `book_id` (prefer club books), optional rank. |
| `books` | `id`, title, author, description, cover, publication metadata, external identifiers, lifecycle status, start/end dates optional, source vote ID, deleted_at. |
| `book_metadata_sources` (optional) | external source, source ID, last refreshed; do not overwrite user-edited fields silently. |
| `meetings` | `id`, `book_id`, starts_at + timezone, status (scheduled/cancelled/completed), optional `reading_assignment_id`, `summary_text`, `summary_status` (draft/published), publish metadata. |
| `meeting_attendance` | unique (`meeting_id`,`user_id`), manually maintained by admin. |
| `reading_assignments` | `id`, `book_id`, week index, `percent_start`, `percent_end`, `page_start`, `page_end`, optional due date, optional linked meeting ID, admin notes. |
| `reading_completions` | unique (`assignment_id`,`user_id`), `completed_at` (null/unset if not completed). |
| `book_user_completions` | unique (`book_id`,`user_id`), `completed_at`; independent of weekly completions. |
| `reviews` | unique (`book_id`,`user_id`), five numeric criterion columns (`disfrute`,`estilo`,`personajes`,`trama`,`huella`), optional `review_text`, submitted timestamp, edit timestamp. Calculated mean derived. |
| `rating_rubric` | criterion, star anchor 1–5, admin-authored description, nullable until filled. |
| `curator_assignments` | curator `user_id`, intended reading cycle/book or vote, assigned_at. |
| `votes` | `id`, curator ID, status (draft/open/closed), opened/closed dates, selected `winning_book_id`, tie note. |
| `vote_candidates` | unique (`vote_id`,`book_id`), shortlist order. |
| `vote_approvals` | unique (`vote_id`,`book_id`,`user_id`), inserted/deleted while open; preserving final snapshot is required. |
| `meeting_highlights` | meeting_id, sort order, content text, optional speaker user ID(s), quote/paraphrase marker, draft/published flag, timestamps. No mandatory category. |
| `literary_quotes` | quote text, author/source, enabled, timestamps. |
| `activity_events` (optional) | type, subject, actor, time, safe payload; spoiler-aware on read. |
| `audio_processing_jobs` (M2) | meeting_id, job status, temporary artifact paths, processing error/status, cleanup deadline, approved_at; prevent path leakage to members. |
| `recycle_bin` / soft delete metadata | deleted_by, deleted_at, purge_due_at; purge after 30 days. |

### Calculation and integrity rules

- Criteria values must satisfy `value IN (1, 1.5, 2, ... 5)`; apply both client and database/server validation.
- `review.overall = SUM(five criteria)/5`; `book.club_average = AVG(review.overall)`. Display count `n` next to means.
- Keep a single review per member/book, a single completion record per member/assignment, and a single approval per candidate/member.
- Vote modifications require status **open**; no updates after closing except an explicit audited admin correction workflow.
- Admin cannot accidentally activate two books at once; enforce invariant transactionally.
- Dates and status transitions are **manual**; no cron job should auto-finish books or close votes.
- Reviews of historical books can be rated without weekly assignments or meeting data.
- Spoiler gating must run centrally on read APIs and queries.
- Be especially careful with cycles between `meetings` and `reading_assignments`: use a single canonical FK where practical, or enforce one-to-one consistency.

---

## 9. Security, privacy, reliability and operations

### Security baseline

- HTTPS-only on public deployment; secure cookies (`HttpOnly`, `Secure`, `SameSite` appropriate to OAuth flow), server-side auth/session validation and CSRF protections as applicable.
- OAuth: use maintained provider library, `state`, PKCE where supported, exact redirect URIs, minimal scopes (`identify` for basic auth), avoid storing long-lived Discord tokens unless absolutely necessary.
- **Enforce approved Discord ID allowlist on server**, not just frontend route guards. Every API action checks effective role and ownership; member IDs in requests must not override session identity.
- Validate/sanitise all form inputs, uploaded images and external metadata; prevent script injection in reviews/summaries; size limits on avatars/covers.
- Apply rate limits to unauthenticated/authentication and expensive routes; audit admin-critical actions without copying private book-review/meeting text into logs.
- No external analytics by default. Avoid indexing: protect every route; `robots.txt` alone is insufficient.
- Secrets and Discord bot tokens only in environment files/secret storage; never in Git.
- Respect spoiler gates even in statistics, home activity feed, exports that a normal member can request, and book-card previews.

### Backups and recovery

- **Automatic database backups** using SQLite's safe online backup mechanism or an equivalent consistent snapshot; do not copy a live WAL-enabled database file naively.
- Back up uploaded covers/avatars as well as DB and relevant configuration; verify restore procedure by testing.
- Allow **admin manual export** (e.g. JSON plus files or a complete DB snapshot), protected behind reauthentication/admin authorisation.
- Frequency and destination are deferred to deployment; recommend daily encrypted snapshots with multiple rotation points if hosting permits.
- **30-day recycle bin** for user-facing books/meetings and other suitable deletable content. Admin can restore or purge earlier. Automatic purge after 30 days.
- Backups may retain older deleted data until backup expiry. Define bounded backup rotation and make this limitation clear to admin. Do not store infinite snapshots.
- Avoid dangerous cascade-deletion (e.g. deleting a historical book unintentionally destroys votes/reviews/meetings). Prefer tombstones/archival with explicit dependency warnings.

### Operational behaviour

- Website continues functioning normally with no Discord bot, metadata API downtime or AI model.
- Loading states, offline/error states, validation errors and friendly Spanish empty states are part of the product.
- Application should start with an empty database, initial admin allowlist and seeded sample data **only in development**, never exposed as genuine club data.
- Use date/time zones explicitly (configure a club-local timezone; do not hard-code from the developer's current location).
- Performance: small workload; avoid premature caching, queues, distributed DB, paid SaaS or a microservices fleet.
- Implement a basic health-check and structured logs without member-sensitive content.

---

## 10. AI development workflow and implementation order

This project will be **developed with AI coding assistance**, so make delivery verifiable, reproducible and bounded.

### Agent instructions

1. **Read this spec first.** Track progress in a short `docs/progress.md` checklist; keep a changelog for any spec deviations.
2. Build **one vertical slice at a time**: database migration + API/server logic + UI + tests; do not scaffold an entire fantasy architecture before the first page works.
3. Follow **test-first for critical invariants**: eligibility to view reviews/summaries, role permissions, vote lifecycle, ratings maths, independent completion flags, deletion restoration.
4. Use deterministic seed fixtures with **fictional** members/books in dev/test; never invent live club data.
5. Run lint, type-check, unit/integration tests and build in each milestone. Introduce end-to-end browser tests for important user journeys.
6. Do not add paid products, global accounts, email/notifications, forums, speculative AI features or unrelated integrations.
7. A feature is only **done** when implemented, test-covered, responsive, permission-checked and documented. Do not claim a recording bot works without testing actual voice audio.
8. Write Spanish end-user UI copy; developer documentation/code comments may remain in English.
9. Prefer managed complexity: simple database structure, clear boundaries, pure functions for ratings/statistics, centralised authorisation checks.
10. Hosting stays undecided: keep portable Node/container deployment instructions and avoid deployment-specific locks.

### Suggested execution slices

| Slice | Scope | Key exit test |
|---|---|---|
| 0. Bootstrap | Next.js, TypeScript, styles/design system, SQLite migrations, test framework | App builds and renders initial responsive shell. |
| 1. Auth/membership | OAuth callback, admin allowlist, protected routes, custom profiles | Non-member cannot access API or UI; approved member can edit only own profile. |
| 2. Books | Metadata search/manual CRUD, status transitions, bookshelf/timeline, legacy entry | Can add manually without API; cannot have two active books. |
| 3. Weekly reading | Meeting linkage, %/page ranges, public completion toggles | Independent user completion works; rescheduling doesn't rewrite range. |
| 4. Meetings | Calendar, attendance, summary/highlights editor, spoiler protection | Weekly summary inaccessible until corresponding assignment completed. |
| 5. Voting | Curator, shortlist, approval votes, manual closure/ties, history | Votes public/editable only while open; archived vote unchanged after closure. |
| 6. Reviews | Five mandatory fields, gating, edit, means, radar view | Can't view others' ratings before own valid submission and personal book completion. |
| 7. Stats/activity | Simple + social metrics, recent activity, quote rotation | Accurate means/samples, spoiler-safe feeds, sensible missing-data behaviour. |
| 8. Operations | Backups, exports, 30-day recycle bin, accessibility, final tests | Restore test succeeds; soft-deleted data purged after retention in tested clock scenario. |
| 9. Milestone 2 spike | Discord DAVE-compliant voice capture proof of concept | Can actually receive and attribute audio reliably in real private server, or escalate fallback. |
| 10. Milestone 2 delivery | Bot, local STT/LLM, draft/approval/cleanup workflow | Approved summary retained, audio/transcript securely deleted, errors recoverable. |

### Key acceptance tests (write automated coverage)

- **Authorisation:** unauthorised Discord ID gets no book data through UI or direct API; member cannot impersonate another member; curator permissions scoped to active vote.
- **Ratings:** scores `5, 4.5, 3, 4, 2.5` give exact mean `3.8`; missing criterion or out-of-range steps rejected. Club average changes after legitimate edit.
- **Rating gating:** finishing a book alone is insufficient to see others' ratings; own completed rating is required. Neither REST response nor server-rendered HTML leaks any hidden ratings or aggregates.
- **Weekly gating:** week 2 complete permits week 2 meeting summary, not automatically week 3. Admin can preview draft; ordinary members cannot read drafts.
- **Vote behaviour:** approving 3 of 4 candidates creates 3 equal-weight votes; vote can be withdrawn; public totals update; closed vote immutable; tied winners need explicit manual selection.
- **Book lifecycle:** manually selecting/finishing status; no automatic changes from date; one active book invariant.
- **History:** legacy book with no meetings/ranges still supports ratings and appears in shelf/timeline; approximate dates can remain blank.
- **Reschedule:** meeting change updates calendar but not the manually specified page/% assignment.
- **Deletion:** soft delete hides content immediately, restore works before 30 days, purge works after threshold without orphaning critical audit/history data.
- **Backup:** test restores database and uploaded avatars/covers, with complete consistent records.
- **Recording workflow (Milestone 2):** clear start/stop indication; job and speaker failures handled; no AI summaries auto-published; successful approval deletes temporary raw audio/transcript and preserves only approved text/highlights.

### Definition of done for each milestone

**Milestone 1:** A new approved member logs in with Discord, personalises their profile, sees today's current-book target, completes it, participates in a public approval vote, finishes and rates a book, views permitted ratings/graphs, browses meeting summaries and the historical book timeline; admin can manage every lifecycle and restore/export club data. Works comfortably on desktop and phone. No paid service required for the chosen deployment.

**Milestone 2:** The authorised recording command works in the **actual** club's private Discord voice channel; recorded audio is processed locally into an editable Spanish draft with calibrated member attributions, and approval publishes only the text while deleting raw source artefacts. Clear fallback if unsupported.

---

## 11. Open decisions and implementation risks

These items are **not missing product requirements**; they are intentionally deferred or depend on tests:

1. **Hosting/deployment:** exact hardware, whether always on, free domain/subdomain/TLS, self-hosted vs cloud/hybrid. Decide when implementation is ready.
2. **Site name and branding assets:** choose a club-specific name, wordmark and optional photos later. The cottage-green palette is the current direction.
3. **Exact rating rubric:** owner supplies 1–5 star meanings for each of the five criteria manually; UI should support entering them.
4. **Reading targets:** owner enters real weekly percentages/pages/dates manually for each book. Do not hallucinate schedules.
5. **Book metadata coverage:** free APIs may omit Spanish editions/covers; manual override is mandatory.
6. **Local AI model/performance:** unknown computer hardware; determine STT/LLM models after benchmarking and checking RAM/CPU/GPU.
7. **Discord audio reception:** **high technical risk** because bot receiving API is not guaranteed stable; validate early in Milestone 2. Speaker attribution may be imperfect.
8. **Temporary recording expiry:** choose a bounded expiry for abandoned/unapproved AI drafts before enabling recording; approval always triggers source deletion.
9. **Backup frequency and storage:** settle with deployment and test restoration; ensure deleted data eventually expire from old backups.
10. **Data rights and consent:** establish clear recording notice and member/guest expectations, independent of friendly club relations; no stealth recording.
11. **Admin-only tie resolution:** the discussion determines the winner; implementation can let admin register it, or grant current curator a narrowly scoped permission without adding new permanent role complexity.
12. **Statistics exposure during an active book:** review/aggregate spoiler gating must take precedence over an otherwise public club dashboard.

### Risk register

| Risk | Impact | Mitigation |
|---|---|---|
| Free hosting can't run long-lived Discord voice bot or persist SQLite | Medium/High | Deferred platform choice; portable app; self-host or separate local worker. |
| Discord DAVE and unofficial voice reception break recording | High for M2 | Real proof-of-concept; pinned compatible dependencies; manual-upload fallback. |
| Model hallucinates quotes, speakers or 'highlights' | High trust risk | Preserve source temporarily, attribute confidence, admin edit/approval, no fabrication claims. |
| Sensitive reviews or meeting details leak through aggregates or activity | High privacy risk | Central server-side spoiler/role checks and dedicated security tests. |
| A member loses Discord access | Medium | Admin identity reassignment/recovery procedure to define safely before use; no ad-hoc bypass of allowlist. |
| SQLite or cover storage lost on server failure | High | Automated consistent backups and tested recovery. |
| Free book metadata API incomplete | Low | Manual book data entry and cover uploads. |
| Scope creep from AI coding agent | Medium | This spec, milestone boundaries, testable acceptance, ADRs before deviations. |

---

## 12. Full decision log (questions 1–82)

The history below captures the choices from the requirements conversation. Later clarifications supersede earlier suggestions when they conflict. **Decision numbers are identifiers, not a ranking.**

| # | Decision |
|---:|---|
| 1 | **Integrated web + Discord:** website is source of truth for club content; Discord mainly meetings/auth. |
| 2 | Curator proposes several books; members vote; approx. one book every two months. |
| 3 | Curator picked manually after finishing a book; no fixed rotation. |
| 4 | **Approval voting:** members can choose multiple books, all with equal weight. |
| 5 | Votes **public**, including who voted while poll is open. |
| 6 | Poll closes manually, not by automatic deadline. |
| 7 | Reviews after personally finishing a book; optional prose. Later clarified to five mandatory rating criteria. |
| 8 | AI-generated meeting summary **editable** by admin; hybrid approach. |
| 9 | Prefer a private Discord **server voice channel** for bot access instead of group DM. |
| 10 | Meeting recording initiated manually by **Discord bot** command. |
| 11 | Preserve meeting summary and AI-detected highlights; no requirement to keep full source. |
| 12 | Highlights **text only**, no playable audio clips. |
| 13 | Ratings use **1–5 stars**, half-star increments. |
| 14 | **Admin (owner) + ordinary members**; curator has limited event-specific powers. |
| 15 | Website **fully private** to authorised members. |
| 16 | **Hybrid catalogue:** automatic metadata lookup and full manual editing/entry. |
| 17 | Members can rate when **they personally finish**, not when club finishes. |
| 18 | Social statistics are desired, starting simple and designed for future extension. |
| 19 | Meeting calendar managed on **website**, no Discord calendar sync needed. |
| 20 | Clean, classical digital-library aesthetic, not immersive. |
| 21 | Green **reading-cottage** palette and atmosphere; supersedes earlier brown-library palette suggestion. |
| 22 | Homepage current book, next meeting, recent activity, a few stats, literary quote, **prominent current week's percentage and page range**. |
| 23 | Weekly reading plan manually entered after group decides it externally. |
| 24 | Common edition; manually enter **percentage AND pages**; no per-edition system. |
| 25 | Simple per-member weekly completed/not-completed control. |
| 26 | Nothing happens when behind; no pressure or reminders. |
| 27 | Literary quote is **general**, not specific to current book. |
| 28 | Random literary quote **per homepage visit**. |
| 29 | Normally **weekly meetings**, freely adjustable. |
| 30 | Members just read during week; personal questions/notes are a **future** possibility. |
| 31 | History has **both bookshelf and timeline** views. |
| 32 | Book detail includes full metadata, weekly schedule, ratings/reviews, meetings, AI summaries/highlights, voting history. |
| 33 | Product **Spanish only**; spoken discussions may contain Catalan. |
| 34 | AI summary in Spanish, but exact quotes can retain original Spanish/Catalan. |
| 35 | Old read books may be added manually, even with incomplete details. |
| 36 | Approximately **10–50 historical books**; manual/partial entry fine, no bulk migration needed. |
| 37 | **Discord OAuth login**, admin-managed allowlist; website accounts distinct in presentation. |
| 38 | Admin **manually approves/authorises** member Discord IDs; no public invites. |
| 39 | Fully customisable **website-native profiles**; do not rely on Discord avatars/names. |
| 40 | **No notifications** (email, Discord announcements or push). |
| 41 | Meeting summary/highlight editing and publication **admin only**. |
| 42 | Reviews hidden until member personally finishes book, later **also requires submitting own review** (#49). |
| 43 | Separate **«He terminado el libro»** button (not inferred from final weekly completion). |
| 44 | Book score is average of **Disfrute, Estilo, Personajes, Trama, Huella**; owner will manually provide star meanings. This replaced an earlier pending question on vote result display. |
| 45 | All **five rating criteria mandatory**. |
| 46 | Members may edit their own ratings/reviews **anytime**. |
| 47 | Detailed five-criterion display including **radar vs club averages**. |
| 48 | Club rating weights **each member equally**. |
| 49 | Must submit own valid ratings **before seeing others' reviews and scores**. |
| 50 | Historical books use **same five-criterion rating system**. |
| 51 | Ratings/reviews for **official club books only**. |
| 52 | Archive **full voting history**, including losing candidates and voters. |
| 53 | Members can freely **change approval votes** while open. |
| 54 | Responsive **mobile-first** website, comfortable desktop too. |
| 55 | Weekly reading-completion status **public among members**. |
| 56 | Attendance marked **manually by admin** after meeting. |
| 57 | Bot automatically generates **draft** after recording; admin approves before publication. |
| 58 | AI summary **flexible length**, default approximately 300 words; highlights separate. |
| 59 | Meeting summaries attribute statements to identifiable **members**, where accurate. |
| 60 | Delete **raw audio and transcript after summary approval**. |
| 61 | No recurring consent popup; everyone informed in advance, **bot visibly announces start/stop**. |
| 62 | **100% free** project: no paid subscriptions, external AI API fees or paid hosting. |
| 63 | Self-hosting was contemplated; **no deployment decision finalised**. See #64. |
| 64 | **Defer hosting** until implementation; computer available but no specific hardware assumed. |
| 65 | Club size **6–10 members**. |
| 66 | **Curator-only nominations**, admin override. |
| 67 | **Curator or admin** may close an open vote. |
| 68 | Tied vote winners resolved **manually by club discussion**. |
| 69 | **Admin manually changes book status** into reading/completed. |
| 70 | Exactly **one active official book at a time**. |
| 71 | Weekly reading assignment **linked to a meeting**; edits remain manual/flexible. |
| 72 | Meeting summary/highlights unlocked **after member completes that week's assigned reading**. |
| 73 | Meeting summary always an **editable field**, even if no recording. |
| 74 | Highlights **fully editable**; admin can write them manually. |
| 75 | Highlights **free-form**, with no fixed categories or minimum count. |
| 76 | Highlights attribute statements to **members** when confidently known. |
| 77 | Highlights combine **paraphrases and accurate verbatim quotes**. |
| 78 | **Criterion-specific star descriptions**, entered **manually by owner**; not pre-written by AI. |
| 79 | **Incremental development:** complete website first, Discord AI bot second. |
| 80 | **Automatic backups** plus manual admin export. |
| 81 | **Soft delete for 30 days**, recoverable, then automated permanent purge. |
| 82 | Technology selection delegated to AI consultant/developer; recommended **Next.js + TypeScript + SQLite**, with later Discord bot. |

---

## 13. References to check during implementation

These are technical source pointers, **not** dependencies on paid services:

- Next.js self-hosting: https://nextjs.org/docs/app/guides/self-hosting
- Next.js deployment options: https://nextjs.org/docs/app/getting-started/deploying
- Discord OAuth2: https://discord.com/developers/docs/topics/oauth2
- Discord API (bot vs group DMs): https://github.com/discord/discord-api-docs/blob/main/developers/topics/oauth2.mdx
- Discord voice connections: https://github.com/discord/discord-api-docs/blob/main/developers/topics/voice-connections.mdx
- Discord DAVE requirement (official help): https://support.discord.com/hc/en-us/articles/38025123604631-Minimum-Client-Version-Requirements-for-Voice-Chat
- `@discordjs/voice` current docs and audio-reception caveat: https://discordjs.dev/docs/packages/voice/main
- SQLite: https://www.sqlite.org/docs.html
- Open Library developer API: https://openlibrary.org/developers/api
- Drizzle ORM: https://orm.drizzle.team/
- Whisper.cpp: https://github.com/ggml-org/whisper.cpp
- Faster-Whisper: https://github.com/SYSTRAN/faster-whisper

**Recheck API documentation, package support and any free-tier terms immediately before implementation.** Avoid pinning this specification to exact dependency versions that will change.

---

## 14. Working agreement for further AI development

Treat this specification as **baseline v1.0**. When coding agents uncover a genuine ambiguity:

1. Prefer the simplest implementation satisfying the already-agreed user experience.
2. Write an explicit short assumption in `docs/decisions.md` when the choice is reversible.
3. Escalate only material conflicts (e.g. privacy/security, paid services, unstable Discord capture, irreversible loss of data).
4. Do not re-ask any of the **82 settled product questions**.
5. Never claim a feature is implemented until there is working code and a passing relevant test.
6. Keep hosting **deferred** and the entire project **free of new recurring costs**.

---

## 15. Course final project requirements

This project is also the author's final project for an AI-assisted development course (2026 draft rules, which may change). These requirements are committed scope alongside Milestone 1. Milestone 2 is **not** required for the course.

### Repository contents

| Path | Purpose |
|---|---|
| `README.md` | Problem, functionality, architecture, and how to set up, run, test and deploy end to end. |
| `product-spec.md` | This document. |
| `AGENTS.md` | Instructions for coding agents. |
| `frontend/` | React app with tests and a central API client. |
| `backend/` | Django + Ninja API with unit and integration tests. |
| `openapi.yaml` | API contract; the backend follows it and the frontend is built against it. |
| `docker-compose.yml` | Runs the full system with one command. |
| `.github/workflows/` | CI runs all tests; CD deploys the demo when they pass. |
| `docs/` | Supporting docs, including the AI-assisted workflow. |
| `security/` | Scan outputs, PR audit output, agent/extension security notes, AI tool and data policy. |
| `ops/` | Operational diagnosis output, runbooks, backup and restore notes. |
| `agent-capabilities/`, `agent-hooks/`, `mcp-server/`, `custom-agent/` (or `plugins/`) | Agent extension pack. |
| `docs/agent-extension-pack.md`, `docs/permissions.md` | Extension pack documentation and permission notes. |

### Grading criteria to satisfy (target: full marks)

1. **Problem description:** the README explains the problem, functionality and expected behaviour.
2. **AI workflow:** document prompts and task delegation, context files, manual review and verification (the PM → engineer → QA process).
3. **Architecture:** the README describes frontend, backend, database, containerisation, CI/CD and how they fit together.
4. **Frontend:** functional, well structured, centralised backend communication, tests for core logic with run instructions.
5. **API contract:** OpenAPI reflects frontend needs and is the contract for backend development.
6. **Backend:** well structured, follows the OpenAPI spec, tests for core functionality.
7. **Database:** properly integrated, configurable per environment (dev, test, demo, production) and documented.
8. **Containerisation:** the full system runs via Docker Compose with clear instructions.
9. **Integration tests:** clearly separated from unit tests, cover key workflows, documented.
10. **Deployment:** deployed to a free cloud host with a working URL (the demo instance).
11. **CI/CD:** tests run automatically and the demo deploys when they pass.
12. **Agent extension pack:** project instructions, a reusable workflow, a subagent/specialist, an MCP tool/server, a hook or guardrail, and permission notes.
13. **Security, audit and DevOps hardening:** PR audit output, deterministic security scan findings, agent/extension security notes, operational diagnosis output, AI tool and data policy.
14. **Reproducibility:** instructions to set up, run, test and deploy end to end.

### Demo instance rules

- Separate deployment with `DEMO_MODE` enabled, seeded **fictional** members and books, and a demo sign-in so peer reviewers can use it without Discord.
- The real club instance never enables `DEMO_MODE`; tests prove the demo sign-in is unreachable without it.
- All spoiler and permission rules still apply in the demo.
- It must stay free: no paid hosting, domain or service.

### Phases (follow the course modules)

Each phase is a GitHub milestone. Every issue in every phase goes through the PM → engineer → QA loop in `docs/process.md`.

| Phase | Course module | What gets built |
|---|---|---|
| 1. Spec and backlog | 1. AI-native workflow | This spec, `AGENTS.md`, team roles, GitHub issues. Done. |
| 2. Development | 2. Development | `frontend` issues first: every screen on a mock API client with fictional data. Then the `contract` issue: `openapi.yaml` derived from the screens. Then `backend` issues: the backend skeleton and each feature's endpoints implemented from the contract, switching its screens from the mock to the HTTP client. Unit and frontend tests throughout; `polish` issues last. |
| 3. Deployment | 3. Deployment | Integration tests, Dockerfiles and Docker Compose, CI, demo mode, public deployment with staging and production, smoke test and rollback, CD gated on tests. |
| 4. DevOps and security | 4. DevOps | Environments and versioned releases, OpenTelemetry observability, one user-impact alert, a read-only AI on-call responder, security audits, agent security notes, AI tool/data policy, operations and security report. |
| 5. Agent extension pack | 5. Agent building blocks | Skills, PM/engineer/QA subagents, a specialist agent, worktrees, MCP server, hooks, permission docs. |
| 6. Final documentation | Final project | README and AI workflow docs; check every item in this section. |

Milestone 2 (Discord bot and local AI) is not part of the course and starts only when the user says so.

**End of specification.**
