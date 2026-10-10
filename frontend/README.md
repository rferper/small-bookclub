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

## Weekly completion on book pages (#90)

«Plan de lectura» on `/biblioteca/b3` has five own-user toggles, including past, current and future assignments. The default admin has read week 1 but not week 2; Mateo (`?mock-session=member`) has read weeks 1 and 2; Jordi (`?mock-session=curator`) has also read week 3. Marking week 2 unlocks its published record on the next `/reuniones/mt2` load; unmarking locks it again. Week 3 changes appear on the next Inicio load, including public progress. A book without assignments, such as `/biblioteca/b1`, has no weekly controls.

Any existing assignment remains manually selectable on finished or archived books too. Changes last for the mock-client session, including navigation away and back, and reset on a full reload. Completing all weeks never changes «He terminado el libro» or the ratings gate. A pending action disables only its own row; a failed action preserves the confirmed state and offers retry on that row. Real backend enforcement remains #22 and the HTTP contract remains #71.

## Fixture ratings

The ratings on each book page («Valoraciones») and its rating form (`/biblioteca/<id>/valorar`) are gated for the signed-in user, the admin included: the club's ratings appear only once the user has marked «He terminado el libro» and sent their own rating (#67). So the case depends on the session:

| Book | Default admin (Lucía) | `?mock-session=member` (Mateo) |
|---|---|---|
| `/biblioteca/b2` «Cumbres borrascosas» | Visible: n = 4, her own rating 5, 4,5, 3, 4, 2,5 (3,8), a review with line breaks and literal `<b>`/`<script>`, one with no text, one edited and a long one; club mean 4,1 and an Estilo mean of 4,25 (shown 4,3). The form edits her rating. | Locked, not finished. |
| `/biblioteca/b1` «Niebla» (no weekly plan) | Locked, finished: «Valorar el libro» opens a new rating. | Visible: n = 3, his own rating first. |
| `/biblioteca/b3` «La Regenta» (`leyendo`) | Locked, not finished, although Carmen has rated it. | Locked, not finished. |
| `/biblioteca/b6` «Ángel Guerra» (`archivado`) | Locked, not finished; nobody has rated it, so finishing and rating it gives n = 1. | The same. |
| `/biblioteca/b4`, `/biblioteca/b5` (`elegido`, `propuesto`) | Not ratable. | Not ratable. |

Wherever the ratings are visible, «Comparación con el club» shows the radar chart and its table (#92): admin `/biblioteca/b2` (Lucía, Carmen, Inés and Jordi), `?mock-session=member` `/biblioteca/b1` (Mateo, Elena and Pablo), and n = 1 on admin `/biblioteca/b6` after marking it finished and rating it (no selector; both shapes coincide).

The rubric has no descriptions unless `?mock-rubric=ejemplo` is used. The mock lives in memory, so a rating saved in the browser lasts until the next full page load.

## Fixture statistics

Estadísticas (`/estadisticas`, #68) counts only the ratings of the books the signed-in user has unlocked (finished **and** rated, as in «Fixture ratings»), the admin included. The other books are absent from the response. To give the page enough data, the default club has three more read books, all `archivado`, with no weekly plan: «Fortunata y Jacinta» (`b12`, rated by Lucía, Carmen, Pablo and Elena; Jordi has finished it but not rated it), «El sí de las niñas» (`b13`, Lucía, Carmen and Inés) and «El ingenioso hidalgo don Quijote de la Mancha» (`b14`, Lucía and Mateo). The first two figures are not gated and are the same for everyone: «Libros leídos» 6 (`terminado` and `archivado` books) and «Reuniones celebradas» 5 (not cancelled, before the mock's «now»). Highlights need 3 ratings per book or member. Displayed values are rounded to one decimal; the data is not.

| Session | Counted books (n, mean, standard deviation), in page order | Ratings and means | Members (n, mean) | Highlights |
|---|---|---|---|---|
| Default admin (Lucía) | «Fortunata y Jacinta» (4, 4,525, 0,259); «Cumbres borrascosas» (4, 4,05, 0,218); «El ingenioso hidalgo…» (2, 4,0, 0,2); «El sí de las niñas» (3, 3,2, 0,829). «Niebla» and «La Regenta» are absent. | 4 books, 13 ratings, mean 51,9/13 = 3,992 (shown 4,0). Criteria 52,5/13, 53/13, 52/13, 50/13, 52/13 (4,0 · 4,1 · 4,0 · 3,8 · 4,0). | Lucía (tú) 4, 3,775; Carmen 3, 4,433; Elena 1, 4,6; Inés 2, 3,5; Jordi 1, 4,0; Mateo 1, 3,8; Pablo 1, 4,1. | Mejor valorado «Fortunata y Jacinta» (4,5 · 4 valoraciones); menos valorado and que más divide «El sí de las niñas» (3,2; desviación típica 0,8); más generosa Carmen (media 4,4 en 3 valoraciones); más exigente Lucía (media 3,8 en 4 valoraciones). |
| `?mock-session=member` (Mateo) | «El ingenioso hidalgo…» (2, 4,0, 0,2); «Niebla» (3, 3,933, 0,579). | 2 books, 5 ratings, mean 3,96 (4,0). Criteria 4,2 · 4,2 · 3,9 · 3,2 · 4,3. | Mateo (tú) 2, 3,8; Elena 1, 3,3; Lucía 1, 4,2; Pablo 1, 4,7. | All five empty: only «Niebla» has 3 ratings and no member has 3, so the insufficient-data texts show. |
| `?mock-session=curator` (Jordi) | «Cumbres borrascosas» (4, 4,05, 0,218). | 1 book, 4 ratings, mean 4,05 (4,1). Criteria 4,0 · 4,3 · 4,1 · 4,0 · 3,9. | Jordi (tú) 1, 4,0; Carmen 1, 4,4; Inés 1, 4,0; Lucía 1, 3,8. | All five empty. |
| Default admin after rating «Niebla» with 4 stars in every criterion | As above, plus «Niebla» (4, 3,95, 0,502) between «El ingenioso hidalgo…» and «El sí de las niñas». | 5 books, 17 ratings, mean 67,7/17 = 3,982 (4,0). Criteria 69/17, 70,5/17, 67/17, 63,5/17, 68,5/17 (4,1 · 4,1 · 3,9 · 3,7 · 4,0). | Lucía (tú) 5, 3,82; Carmen 3, 4,433; Elena 2, 3,95; Inés 2, 3,5; Jordi 1, 4,0; Mateo 2, 3,8; Pablo 2, 4,4. | The same as before. |
| `?mock-data=empty` (admin) | None. | `{ status: 'empty' }`: «Libros leídos» 0, «Reuniones celebradas» 0 and one empty state, with no highlights, charts or tables. | — | — |

Every case in «Fixture ratings», «Fixture votes» and «Fixture meetings» is unchanged, and «Ángel Guerra» (`b6`) is still unrated. The new books are archived, so Inicio's count of `terminado` books (#44) is unchanged too.

## Fixture taste compatibility

«Gustos en común» on Estadísticas (#93) compares the signed-in user with one other member, chosen in «Comparar con» (the first by name is selected). A book counts as shared only if the signed-in user has unlocked it (finished **and** rated, as in «Fixture statistics») and the other member has rated it too; a finished flag without a rating never counts. The admin gets the same as anyone else in her situation. At least 3 shared books are needed; below that only the count is sent and the page shows «Aún no hay suficientes libros en común.». The difference is the mean of |your overall − their overall| over the shared books (0–4); displayed values are rounded to one decimal, the data is not. The fixtures are the same as in «Fixture statistics».

| Session | Shared books per member (by name) | Comparison |
|---|---|---|
| Default admin (Lucía) | Carmen 3, Elena 1, Inés 2, Jordi 1, Mateo 1, Pablo 1. Elena has finished «Cumbres borrascosas» and Jordi «Fortunata y Jacinta» without rating them, so they count 1, not 2. | Carmen (selected): overall difference 2,8/3 = 0,933 (shown «0,9 puntos, en 3 libros en común»); criteria Disfrute 4/3, Estilo 2/3, Personajes 4/3, Trama 2,5/3, Huella 5,5/3 (1,3 · 0,7 · 1,3 · 0,8 · 1,8); books «Cumbres borrascosas» 3,8 / 4,4 / 0,6, «El sí de las niñas» 2,3 / 4,3 / 2,0, «Fortunata y Jacinta» 4,8 / 4,6 / 0,2. Everyone else insufficient. |
| `?mock-session=member` (Mateo) | Carmen 0, Elena 1, Inés 0, Jordi 0, Lucía 1, Pablo 1. | All insufficient; no book in the response. |
| `?mock-session=curator` (Jordi) | Carmen 1, Elena 0, Inés 1, Lucía 1, Mateo 0, Pablo 0. | All insufficient. |
| `?mock-data=empty` (admin) | — | No «Gustos en común» section (no ratings to show), and no call. |
| Default admin after rating «Niebla» (any scores) | Carmen 3, Elena 2, Inés 2, Jordi 1, Mateo 2, Pablo 2. | Carmen unchanged; everyone else still insufficient. |
| Default admin after editing «Cumbres borrascosas» to 4 in every criterion | Unchanged. | Carmen: overall difference 2,6/3 = 0,867 (0,9). |
| `?mock-session=member` after finishing and rating «Fortunata y Jacinta» (`b12`) and then «El sí de las niñas» (`b13`) with 4 in every criterion | After `b12`: Lucía 2 (still insufficient). After both: Carmen 2, Elena 2, Inés 1, Jordi 0, Lucía 3, Pablo 2. | Lucía: overall difference 2,9/3 = 0,967 (1,0); criteria Disfrute 3,5/3, Estilo 1, Personajes 1, Trama 2/3, Huella 4/3 (1,2 · 1,0 · 1,0 · 0,7 · 1,3); books «El ingenioso hidalgo…» 3,8 / 4,2 / 0,4, «El sí de las niñas» 4,0 / 2,3 / 1,7, «Fortunata y Jacinta» 4,0 / 4,8 / 0,8. «Cumbres borrascosas» is absent: Mateo has not rated it. |

## Fixture members

Miembros (`/miembros`) lists the active members by name, the signed-in user marked «(tú)», with this week's status from the same state as Inicio's «Cómo va el club esta semana» (#69). The current week is 3: in the default session only Carmen and Jordi have read it, so they show «✓ Leído» and everyone else «Leyendo»; marking week 3 on Inicio turns the signed-in user's status into «✓ Leído». Profiles (`/miembros/<id>`) never show ratings or reviews; another member's profile links to Estadísticas, and your own to «Editar mi perfil» (`/mi-perfil`, see «Mi perfil» below). Every `avatarUrl` is `null`, so avatars are initials; tests set one to see an image avatar.

| Member | Profile case | Week 3 |
|---|---|---|
| `/miembros/m1` Lucía (default admin) | Short bio, a quote and two favourites («Niebla», «Cumbres borrascosas»). Her own profile in the default session. | Leyendo |
| `/miembros/m2` Mateo (`?mock-session=member`) | No bio; a quote and one favourite with a long title («El ingenioso hidalgo don Quijote de la Mancha»). | Leyendo |
| `/miembros/m3` Carmen | Full: a two-paragraph bio with literal `<b>` and `<script>` text, a two-line quote and three favourites («Cumbres borrascosas», «Fortunata y Jacinta», «El ingenioso hidalgo don Quijote de la Mancha»). | ✓ Leído |
| `/miembros/m4` Pablo | Empty: no bio, no quote and no favourites. | Leyendo |
| `/miembros/m5` Inés | Long bio (over 400 characters), no quote, one favourite («El sí de las niñas»). | Leyendo |
| `/miembros/m6` Jordi (`?mock-session=curator`) | Short bio and a quote, no favourites. | ✓ Leído |
| `/miembros/m7` Elena | Short bio, no quote, two favourites («Ángel Guerra», «Niebla»). | Leyendo |
| `/miembros/m8` Tomás | Initially revoked: he has a bio, a quote and a favourite, but is not listed and his profile shows the same «No encontramos a este miembro» page as `/miembros/no-existe`. Administración can restore his access and preserved profile. He has no past contributions. | — |
| `/miembros/no-existe` | Unknown member: the not-found page. | — |

With `?mock-data=empty` the club has only the admin: Miembros lists «Lucía (tú)» with no week line or status and says «Todavía no hay más miembros en el club.», and her profile is empty.

## Administración

Administración (`/administracion`, #70) has a hub linking to «Miembros y curaduría» (`/administracion/miembros`). The default admin (Lucía) sees seven active members and revoked Tomás, can add a fictional Discord ID, revoke another member after confirmation, restore access and assign or clear the curator. Changes persist in the same mock client until a full reload. Past votes, reviews and attendance remain under the member's name after revocation; existing votes retain their recorded curator.

With `?mock-session=member` (Mateo) or `?mock-session=curator` (Jordi), the navigation has no Administración link and direct admin URLs show the admin-only message without making admin calls. The mock also refuses each admin call with 403. The guard is cosmetic; backend enforcement follows in #11. With `?mock-data=empty`, the admin sees only Lucía, no revoked group and no curator; assigning Lucía enables «Preparar una votación» on Votaciones.

These fixture Discord IDs are entirely fictional, made-up 18-digit strings, never real accounts. Only admin responses expose them:

| Member | Fictional Discord ID |
|---|---|
| Lucía (`m1`) | `000000000000000101` |
| Mateo (`m2`) | `000000000000000102` |
| Carmen (`m3`) | `000000000000000103` |
| Pablo (`m4`) | `000000000000000104` |
| Inés (`m5`) | `000000000000000105` |
| Jordi (`m6`) | `000000000000000106` |
| Elena (`m7`) | `000000000000000107` |
| Tomás (`m8`, initially revoked) | `000000000000000108` |

## Admin catalogue (#95)

The Administración hub also links to Libros (`/administracion/libros`), with create (`/administracion/libros/nuevo`) and edit (`/administracion/libros/<id>/editar`) forms. AdminGuard protects all three; every catalogue/search mock call separately checks the admin role. The client documentation and draft shapes live in `src/api/client.ts` and `types.ts`: `listAdminBooks`, `getAdminBook`, `createBook`, `updateBook`, `searchBookMetadata`, `AdminBook`, `BookInput`, and `BookMetadataResult`. They contain metadata only, never reviews or meeting records.

Try searching `jardín` or `Alba` for the fictional «El jardín de las cartas» (two authors and an in-memory sample cover), or `faro` for an incomplete result. Any unmatched query returns the manual fallback. Selection fills blanks only; manual corrections, uploaded/removed covers, status and reading dates survive. Nothing is saved until «Guardar libro», which saves metadata and cover together and opens the book page. A historical book needs only a title and status. All five statuses are manual; only one `leyendo` book is allowed (initially «La Regenta»), and multiple `elegido` books are allowed. The active book must be changed first to activate another.

Planned dates are separate from the existing actual dates used in Biblioteca; each date pair is independently checked. Approximate dates keep their stored full calendar values and display as month/year. Blank optional metadata is null and authors are one trimmed nonblank entry per line. Cover files reuse the profile image rules: nonempty JPEG/PNG/WebP, at most 2,097,152 bytes inclusive. Changes persist only within this mock-client lifetime; subsequent Biblioteca, book, Inicio and vote nomination reads see them without reloading. Metadata edits preserve reviews, approvals, outcomes, weekly completions, schedules, meetings and the read-only origin vote. There is no deletion, reading-plan edit, real metadata request or backend yet (#13–#16/#71).

## Mi perfil

Mi perfil (`/mi-perfil`, #94) edits the signed-in user's own profile and lists their own ratings. The calls take no member id, so each session edits only itself. «Libros favoritos» offers every `terminado` or `archivado` book by title: «Ángel Guerra», «Cumbres borrascosas», «El ingenioso hidalgo don Quijote de la Mancha», «El sí de las niñas», «Fortunata y Jacinta» and «Niebla».

| Session | Form values | «Mis valoraciones», newest first |
|---|---|---|
| Default admin (Lucía) | Her short bio and quote; favourites «Niebla», «Cumbres borrascosas»; no photo. | «El ingenioso hidalgo…», «El sí de las niñas», «Fortunata y Jacinta», «Cumbres borrascosas» (3,8). Editing «Cumbres borrascosas» moves it first with «editada el 9 de octubre de 2026»; finishing and rating «Ángel Guerra» adds it first. |
| `?mock-session=member` (Mateo) | No bio; his quote; favourite «El ingenioso hidalgo…». | «El ingenioso hidalgo…», «Niebla». |
| `?mock-data=empty` (admin) | Only her name; no favourites and no books to choose («El club aún no ha terminado ningún libro…»). | Empty: «Aquí aparecerán tus valoraciones de los libros del club.» |

A photo must be JPEG, PNG or WebP of at most 2 MB; it is previewed and sent only with «Guardar cambios». The mock keeps the saved name, texts, favourites and photo (as a data URL) in memory, so Miembros, the profiles, Inicio, «Valoraciones», Votaciones, Reuniones and Estadísticas show them until the next full page load.
