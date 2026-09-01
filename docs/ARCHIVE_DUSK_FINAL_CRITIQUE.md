# Archive Dusk Final Critique

## Cozy Study Revision

The follow-up color review found the original implementation visually
over-weighted toward yellow/brown surfaces. The revised default now uses:

- warm white as the dominant canvas;
- black for navigation and primary text;
- yellow for lamp-light curves, primary actions, focus, and selection;
- teal, indigo, sage, coral, and semantic status colors for supporting variety;
- black text on yellow controls, never white text on yellow;
- short route, custom-dropdown, and tab-panel transfer animations.

Archive Dusk remains available as an explicit dark theme. Paper Day is now the
consistent first-visit default, independent of operating-system dark mode.

## Outcome

Archive Dusk replaces the bright white and generic blue presentation in the
priority ARS surfaces with a scholarly dark-ink and aged-paper system. Existing
routes, API calls, permissions, validation, and role workflows were preserved.

## Problems Corrected

- Replaced the flat navy/white application shell with layered ink, umber, and
  warm paper surfaces.
- Replaced the old `light | night` contract with intentional
  `paper-day | archive-dusk` themes while migrating stored legacy choices.
- Mapped legacy color aliases to semantic variables to prevent dark navy text
  from remaining on dark surfaces.
- Removed obsolete MainLayout `night` selector overrides.
- Replaced generic bright-blue actions with brass, ochre, sage, and oxide
  semantic states.
- Added structured sidebar context and a separate account area.
- Differentiated Forum posts, comments, replies, composers, filters, and the
  open-post state using surface depth, rules, indentation, and typography.
- Strengthened table headers, alternating rows, selected/hover states, and
  shared toolbar/pagination structure.
- Reworked Landing and Auth into an editorial research-desk composition.
- Migrated the registration policy modal away from hardcoded white and blue.

## Critique Against AI-Generated UI Patterns

### Removed

- Uniform rounded white cards.
- Generic blue primary buttons and active navigation.
- Random avatar colors in Forum posts.
- Slate-blue dark mode and duplicated theme-specific overrides.
- White modal and form assumptions in priority authentication surfaces.

### Deliberately Avoided

- Gradients and decorative color effects.
- Glass surfaces and excessive blur.
- Fake metrics, charts, or citations.
- Oversized empty marketing sections.
- Motion without a product purpose.

## Contrast Evidence

Calculated WCAG contrast ratios for representative combinations:

- Archive Dusk primary text on canvas: 12.60:1.
- Archive Dusk secondary text on canvas: 8.69:1.
- Dark ink on brass primary action: 7.00:1.
- Dark ink on parchment: 10.93:1.
- Paper Day primary text on canvas: 9.94:1.
- Paper Day muted text on canvas after correction: 4.72:1.
- Archive Dusk danger text on danger surface: 7.41:1.

## Visual Verification

Browser checks were completed on the local Vite application at 1280 x 720 and
390 x 844.

- Landing desktop: ink canvas, brass actions, parchment dossier, readable
  editorial hierarchy.
- Landing mobile: 390-pixel viewport, no horizontal overflow, actions and
  headings wrap without collision.
- Login desktop: balanced two-panel library/paper composition and clear form
  hierarchy.
- Login mobile: stacked masthead and form, full-width controls, no horizontal
  overflow.
- The anonymous Forum URL correctly redirects to Login, so authenticated Forum,
  sidebar, dropdown, modal, and Admin queue screenshots require a signed-in
  test account. Their structure was verified through component tests, CSS
  review, and the production build, but no authentication state was fabricated.

## Technical Verification

- `npx tsc --noEmit`: passed using the project-local TypeScript compiler.
- Production build: passed (`tsc -b && vite build`).
- Focused Vitest: 23 passed across MainLayout theme/collapse, Landing, and Login.
- One browser visual flow covered Landing and Login at desktop/mobile sizes.
- `git diff --check`: passed; only repository line-ending notices were emitted.
- Priority color scan found no remaining direct white, default blue, or obsolete
  `data-theme='night'` declarations in the migrated scope.

## Existing Test-Contract Drift

The broader focused attempt also exposed failures unrelated to this visual
work: Forum tests still expect disabled reactions and older comment counts,
while Register tests still expect the pre-ORCID role form. Those tests should
be reconciled with the already-modified product flow separately. This redesign
does not revert those newer behaviors.

## Future Token Migration

The highest-value remaining legacy modules are:

- PDF viewer.
- Lecturer guidance projects.
- Wallet top-up modal and reviewer earnings wallet.
- Graduate-student report modal.
- Notification center.
- Publication shared components and lower-frequency role dialogs.

These pages inherit compatibility aliases and remain functional, but should be
migrated to semantic variables module by module rather than by global color
replacement.
