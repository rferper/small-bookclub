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

- `?mock-session=anonymous`, `member`, `admin` or `denied`: who is signed in.
- `?mock-sign-in=member`, `admin` or `denied`: where «Entrar con Discord» leads (default `member`).
- `?mock-demo=1`: offer the demo sign-in spot (#75).
- `?mock-data=empty`: a club that has just started, with no books, meetings or activity (for example, the empty Biblioteca or Reuniones). This club has only the admin, so combine it with `admin` or `anonymous` sessions, not `member`.

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
