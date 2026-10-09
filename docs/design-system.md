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
