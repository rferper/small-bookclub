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
- `src/components/`: shared layout and UI pieces.
- `src/lib/`: pure helpers (Spanish formatting in the club timezone).
- `src/test/`: test setup and `renderApp`, which renders real routes with any API client.

## Configuration

- `VITE_CLUB_TIMEZONE`: timezone used to show dates (default `Europe/Madrid`).
