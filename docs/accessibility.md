# Accessibility review (#53)

Run `npm ci`, `npx playwright install chromium` (Linux CI also needs `--with-deps`), then `npm run test:a11y` inside `frontend/`. The runner starts and stops its own fictional mock preview on port 5180 and refuses to reuse a running server. No backend database is accessed. CI runs the same command after frontend tests/build. Browser specifications live in `frontend/accessibility/`, separately from Vitest's `src/**/*.test.{ts,tsx}`.

The checks scan 15 representative screens at desktop (1440px) and mobile (360px): home, library/book, rating form, meetings, voting, statistics, members/profile, admin members/book creation/meeting creation/rubric and anonymous/denied entry. Axe WCAG 2 A/AA, 2.1 A/AA and 2.2 AA tags run with no rule exclusions or baseline violations. Computed enabled field-border contrast is checked against its rendered surface (minimum 3:1). Keyboard checks cover the skip link's visible outline, profile validation focus/described invalid state, confirmation Tab/Shift+Tab containment, Escape and focus restoration. Reduced-motion preference and the CSS override are checked in the browser; statistics overflow is measured with a forced classic 15px scrollbar.

## Reviewed basics

- Keyboard/focus: global visible forest outline; light outline on dark homepage links; native radio groups for half-star ratings; labelled selects and buttons; accessible confirmation focus management. Existing component tests cover invalid-field focus, dialog busy/error focus, radio keyboard selections and reorder/removal focus.
- Contrast: normal text uses forest/moss/bark (all at least 4.5:1 on their intended light surface), forest on sage, parchment on forest buttons/covers. Solid bark replaces translucent wood on interactive field boundaries. Decorative card separators/chart grid lines do not identify controls. Axe also checks rendered text contrast on scanned pages.
- Forms/errors: visible labels, fieldset legends, described text validation, alert/status messages and disabled pending submissions. Existing form suites test association/focus and retained failed input.
- Images: covers have title/author alternatives or labelled placeholders; standalone avatars retain named alt text, while directory-link avatars beside visible names are decorative to avoid repeating the name.
- Charts: labelled static radar/bar images have equivalent visible tables, captions, column/row headers and differentiated radar series. No hover-only data. Fixed-layout wrapping statistics tables and wider book-title columns retain all values without page-wide horizontal scroll, including classic scrollbars.
- Motion: global reduced-motion media query removes meaningful transitions/animations and smooth scrolling; charts do not animate.

Inspect the generated desktop/mobile book-statistics and shared-books screenshots in ignored `frontend/test-results/` before merge. Automated checks and this review cover WCAG-oriented basics; they do not certify complete WCAG conformance or replace assistive-technology/user testing. Deployed backend end-to-end coverage is tracked separately in #54.
