# Design system

Living document, starting from `product-spec.md` §4. Issue #3 implements the base in `frontend/` (Tailwind theme + CSS variables); update this file when the design changes. Lovable may be used to prototype screens, but only these tokens and patterns are carried into `frontend/`.

## Mood

A calm, green, cottage-inspired digital library. Functionality comes before decoration: no gamification, streaks, flashy animation, ambient audio or fantasy UI.

## Colour tokens

Defined in `frontend/src/index.css` under `@theme`, so each is a Tailwind colour (`bg-parchment`, `text-forest`, `border-wood`...) and a CSS variable (`--color-forest`).

| Token | Hex | Typical use | Contrast on parchment |
|---|---|---|---|
| `parchment` | `#F5F0E4` | Page background | — |
| `paper` | `#FBF8F1` | Card surfaces | — |
| `sage` | `#B7C9A8` | Soft surfaces, active nav, avatar placeholders | — |
| `soft-green` | `#728D69` | Accent borders and decoration only | 3.2:1 (not for text) |
| `moss` | `#4F6548` | Green text, links, positive status | 5.6:1 |
| `forest` | `#344F3C` | Body text, headings, primary buttons | 7.9:1 |
| `wood` | `#8B7355` | Borders, small details only | 3.9:1 (not for text) |
| `bark` | `#6E5A42` | Muted text (dates, captions, empty states) | 5.8:1 |

`moss`, `paper` and `bark` were added on 2026-10-09 because `soft-green` and `wood` fail WCAG AA for normal text. Text on `sage` must be `forest` (5.1:1). Primary buttons are `forest` with `parchment` text (7.9:1).

## Typography

- Serif headings (`font-serif`): Iowan Old Style, Palatino, Book Antiqua, Georgia.
- Sans-serif body and UI (`font-sans`): the system UI font.
- System fonts only, so no font downloads or paid assets.

## Components

- `Card`: paper surface, soft wood border, serif `h2`; the section is labelled by its heading.
- `EmptyState`: italic `bark` text, warm and specific to the section.
- `BookCover`: 2:3 image, or a forest cloth-bound placeholder with title and author when there is no cover.
- `Avatar`: round image, or `sage` circle with initials.
- Primary button: `bg-forest text-parchment`; secondary/pressed state: `border-2 border-forest text-forest`.
- `ActionButton`: a button for one async action (sign in, sign out). It is disabled while the action runs and shows a Spanish `role="alert"` message next to it if the action fails. Variants: primary, secondary and quiet (header).
- `AuthScreen`: the centred paper card used instead of the club for the sign-in, access-denied and session-error screens; it has its own `main` and serif `h1`, and no navigation.

## Charts

First used by the radar in «Comparación con el club» (#92). Hand-built inline SVG, sized with a `viewBox` so it scales down to a phone; at most 28rem wide.

- Every chart has a visible, equivalent `<table>` next to or below it, with a caption, column headers and row headers. The `svg` is `role="img"` with an `aria-label` that says what it compares and that the values are in the table.
- Series differ in more than colour: the main series (a member) is a solid `forest` line with round markers and a light `forest` fill; the comparison series (the club) is a dashed `bark` line with hollow square markers and no fill, drawn on top. Strokes are at least 2 px and use tokens with at least 3:1 on `paper`. Fills stay translucent so every outline and marker remains visible where shapes overlap.
- A visible HTML legend names each series, with a sample of its line and marker.
- Grid lines and axes may use `wood` at reduced opacity; labels use text tokens only (`forest`, `moss`, `bark`), never `soft-green` or `wood`, and render at 12 CSS px or more. Scale labels sit between axes, where no data point can fall, and are drawn after the series with a `paper` halo (`paint-order: stroke`) so no shape covers them.
- No animation, transition, tooltip or focusable element inside a chart; the data never lives only in a hover.

## Layout

- Mobile-first, with an equally comfortable desktop layout (especially statistics).
- Soft surfaces, book covers, understated borders, comfortable spacing.

## Accessibility

- Visible keyboard focus on every interactive element.
- Labels on all inputs; errors described in text.
- Alt text for covers and avatars; a table or text alternative for every chart.
- Respect `prefers-reduced-motion`.

## Copy

- Spanish, warm and low-pressure. Never "racha rota", urgent alerts or punitive labels.
- Navigation labels: Inicio, Biblioteca, Reuniones, Votaciones, Estadísticas, Miembros, Mi perfil, Administración (admin only).
- Every page has a friendly empty state.
