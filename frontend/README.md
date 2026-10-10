# Frontend

React + Vite + TypeScript + Tailwind app for the club website. User-facing text is Spanish.

```sh
npm ci          # install
npm run dev     # run at http://localhost:5173
npm test        # unit and component tests (Vitest)
npm run lint    # oxlint
npm run build   # type-check and production build
```

## Structure

- `src/api/`: the only code that talks to the backend. `client.ts` defines the `ApiClient` interface, `types.ts` the data shapes (the draft API contract), and `mock/` an in-memory implementation with fictional data used until the backend exists. Components get the client through `ApiProvider` and the hooks in `hooks.ts`.
- `src/pages/`: one component per route; `src/routes.tsx` maps URLs to pages.
- `src/session/`: `SessionGate`, the root route. It loads the session and shows the sign-in, access-denied or session-error screen at any URL until a member is signed in. This is cosmetic; the backend enforces sign-in and the allowlist.
- `src/components/`: shared layout and UI pieces.
- `src/lib/`: pure helpers (Spanish formatting in the club timezone).
- `src/test/`: test setup and `renderApp`, which renders real routes with any API client.

## Configuration

- `VITE_CLUB_TIMEZONE`: timezone used to show dates (default `Europe/Madrid`).

## Mock session in development

`npm run dev` uses the mock client, signed in as the fictional admin. Query parameters on the first page load choose another state (read only in `src/App.tsx`, parsed by `src/api/mock/devOptions.ts`):

- `?mock-session=anonymous`, `member`, `admin`, `curator` or `denied`: who is signed in. `curator` is the member currently assigned as curator (Jordi), with the `member` role; curator is an assignment, not a role.
- `?mock-sign-in=member`, `admin`, `curator` or `denied`: where «Entrar con Discord» leads (default `member`).
- `?mock-demo=1`: offer the demo sign-in spot (#75).
- `?mock-data=empty`: a club that has just started, with no books, meetings, activity, curator or votes (for example, the empty Biblioteca, Reuniones or Votaciones). This club has only the admin, so combine it with `admin` or `anonymous` sessions, not `member` or `curator`.
- `?mock-vote=draft`, `tie`, `none` or `open-tie`: changes the current vote of the default club (#66, #91). `draft`: Jordi's vote is not open yet (shortlist only, no approvals). `tie`: Jordi's vote closed on 7 October 2026 with a tie pending between «Marianela» and «Los pazos de Ulloa», so there is no current vote and it heads the history. `none`: Jordi is still the curator but there is no current vote. `open-tie`: Jordi's vote is still open, with «Marianela» and «Los pazos de Ulloa» tied at five votes each, so closing it gives a pending tie. Ignored with `?mock-data=empty`.

- `?mock-rubric=ejemplo`: fills some rating rubric anchors (2, 3 and 4 stars of every criterion except Personajes) with obvious placeholders such as «[Texto de ejemplo] Trama, 3 estrellas», to see how the rating form shows them (#67). By default every anchor is empty, because the club's owner writes the real descriptions (#70). Combines with the other options.

For example, http://localhost:5173/?mock-session=anonymous&mock-demo=1 shows the sign-in screen with the demo spot. The mock lives in memory, so a full page reload starts again from the query parameters.

## Fixture meetings

The default mock's «now» is 9 October 2026. Each meeting in Reuniones shows one case of the meeting page (#65). The record is gated for the signed-in user, admin included, so some cases depend on the session:

| Meeting | Case |
|---|---|
| `/reuniones/mt0` | Cancelled (17 September 2026). |
| `/reuniones/mt1` | Visible record: summary with paragraphs, a quote with one speaker, a paraphrase with two, one with no speaker; a draft highlight that is never shown; attendance recorded. |
| `/reuniones/mt2` | Locked until week 2 is read: locked for the default admin, visible with `?mock-session=member`. |
| `/reuniones/mt3`, `/reuniones/mt4` | Upcoming, with no attendance section; locked until weeks 3 and 4 are read. Marking week 3 on Inicio unlocks `mt3` (its summary is still empty). |
| `/reuniones/mt5` | No linked week, marked safe: visible to everyone («Niebla»). |
| `/reuniones/mt6` | No linked week, not marked safe: locked for everyone («Cumbres borrascosas»). |
| `/reuniones/mt7` | No book, marked safe, with a draft summary that is not published: «no summary yet», no highlights, attendance not recorded. |
| `/reuniones/no-existe` | Unknown meeting. |

## Fixture votes

Jordi is the current curator. Votes are public, so every session sees the same counts and names; only the checked boxes and «Votaste por este libro» depend on who is signed in (#66):

| Vote | Case |
|---|---|
| `/votaciones/v2` | Jordi's open vote, also shown in full on `/votaciones`: «Marianela» (with a cover, 5 votes), «Los pazos de Ulloa» (no cover, publication date or page count; approved by the default admin), «La gaviota» (no votes) and a long title approved by the default member. With `?mock-vote=draft` it is a draft, and with `?mock-vote=tie` a closed vote with a pending tie. |
| `/votaciones/v1` | Carmen's closed vote, linked from «La Regenta»: won by «La Regenta» after a tie, with a two-line tie note, and two losing candidates. |
| `/votaciones/v0` | Pablo's closed vote, linked from «Cumbres borrascosas»: a clear winner with no tie note, and two losing candidates. |
| `/votaciones/no-existe` | Unknown vote. |

The catalogue also has two «Propuesto» books that are in no vote, «Doña Perfecta» and «Sotileza», so the curator can add them to a shortlist (#91). Books with any other status are never offered.

### Vote management (#91)

The controls follow the server's flags (`canCreateVote`, `canManage`, `canRecordTieWinner`), so they depend on the session. Members (`?mock-session=member`) never see any of them. The mock's «now» (9 October 2026) is the opening and closing date of anything opened or closed in the browser.

| Session and scenario | What appears |
|---|---|
| default admin or `?mock-session=curator`, `/votaciones/v2` | «Gestionar la votación» on the open vote: «Subir», «Bajar», «Quitar» (with a confirmation for a book with votes), «Añadir libros» and «Cerrar votación» (with a confirmation; closing gives «Marianela» as the winner). |
| admin or curator, `?mock-vote=draft`, `/votaciones/v2` | The draft editor and «Abrir votación». |
| admin or curator, `?mock-vote=none`, `/votaciones` | «Preparar una votación», which opens the new draft's page. |
| admin or curator, `?mock-vote=open-tie`, `/votaciones/v2` | Closing gives a pending tie; the admin then sees the tie-break form. |
| admin, `?mock-vote=tie`, `/votaciones/v2` | «Registrar el libro elegido»: a choice between the tied books and an optional note. |
| curator, `?mock-vote=tie`, `/votaciones/v2` | The pending tie and a note that the admin records the club's choice; no form. |
| admin, `?mock-data=empty`, `/votaciones` | No button; a note that a curator must be assigned first in Administración. |

## Fixture ratings

The ratings on each book page («Valoraciones») and its rating form (`/biblioteca/<id>/valorar`) are gated for the signed-in user, the admin included: the club's ratings appear only once the user has marked «He terminado el libro» and sent their own rating (#67). So the case depends on the session:

| Book | Default admin (Lucía) | `?mock-session=member` (Mateo) |
|---|---|---|
| `/biblioteca/b2` «Cumbres borrascosas» | Visible: n = 4, her own rating 5, 4,5, 3, 4, 2,5 (3,8), a review with line breaks and literal `<b>`/`<script>`, one with no text, one edited and a long one; club mean 4,1 and an Estilo mean of 4,25 (shown 4,3). The form edits her rating. | Locked, not finished. |
| `/biblioteca/b1` «Niebla» (no weekly plan) | Locked, finished: «Valorar el libro» opens a new rating. | Visible: n = 3, his own rating first. |
| `/biblioteca/b3` «La Regenta» (`leyendo`) | Locked, not finished, although Carmen has rated it. | Locked, not finished. |
| `/biblioteca/b6` «Ángel Guerra» (`archivado`) | Locked, not finished; nobody has rated it, so finishing and rating it gives n = 1. | The same. |
| `/biblioteca/b4`, `/biblioteca/b5` (`elegido`, `propuesto`) | Not ratable. | Not ratable. |

The rubric has no descriptions unless `?mock-rubric=ejemplo` is used. The mock lives in memory, so a rating saved in the browser lasts until the next full page load.
