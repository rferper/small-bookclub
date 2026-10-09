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

For example, http://localhost:5173/?mock-session=anonymous&mock-demo=1 shows the sign-in screen with the demo spot. The mock lives in memory, so a full page reload starts again from the query parameters.
