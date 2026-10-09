# Design system

Living document, starting from `product-spec.md` §4. Issue #3 implements the base in `frontend/` (Tailwind theme + CSS variables); update this file when the design changes. Lovable may be used to prototype screens, but only these tokens and patterns are carried into `frontend/`.

## Mood

A calm, green, cottage-inspired digital library. Functionality comes before decoration: no gamification, streaks, flashy animation, ambient audio or fantasy UI.

## Colour tokens (starting points)

| Token | Hex | Typical use |
|---|---|---|
| `--parchment` | `#F5F0E4` | Page background |
| `--sage` | `#B7C9A8` | Soft surfaces, highlights |
| `--soft-green` | `#728D69` | Accents, secondary buttons |
| `--forest` | `#344F3C` | Headings, primary buttons, text on light surfaces |
| `--wood` | `#8B7355` | Borders, small details |

Check text/background pairs for WCAG AA contrast before using them.

## Typography

- Legible serif for headings; restrained sans-serif for body and UI text.
- System fonts or freely licensed fonts only; no paid assets.

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
