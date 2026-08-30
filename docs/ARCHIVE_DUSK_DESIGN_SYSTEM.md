# Archive Dusk Design System

## Purpose

The ARS visual system combines a cozy study session with clear academic
structure: warm-white working surfaces, black ink/navigation, and localized
yellow desk-lamp light. Yellow is an accent and illumination source rather
than the page coating. Archive Dusk remains the optional dark counterpart.

## Themes

### Archive Dusk

- Default application experience.
- Deep olive-umber canvas and ink navigation.
- Warm raised surfaces for tools and queues.
- Parchment reserved for document-like content.
- Brass is the primary action and selection signal.

### Paper Day

- The default experience: white and warm-white canvases with localized yellow
  lamp-light curves.
- Uses the same hierarchy, spacing, and action language.
- Keeps black ink text, yellow primary actions, and restrained teal, indigo,
  sage, coral, and ochre supporting accents.

Themes are selected with `data-theme="archive-dusk"` or
`data-theme="paper-day"` on the document root. The persisted `ars_theme`
value migrates legacy `night` and `light` selections automatically.

## Semantic Token Contract

### Canvas and surfaces

- `--app-canvas`: application background.
- `--app-canvas-subtle`: adjacent section or secondary canvas.
- `--surface-base`: ordinary utility surface.
- `--surface-raised`: menus, dialogs, and elevated controls.
- `--surface-sunken`: recessed tools and secondary dark bands.
- `--surface-paper`: document or dossier surface.
- `--surface-paper-muted`: quieter paper region.
- `--surface-selected`: selected item or current context.

### Discussion hierarchy

- `--post-surface`: primary Forum post.
- `--comment-surface`: nested discussion.
- `--reply-surface`: lower-emphasis threaded reply.
- `--composer-surface`: focused writing surface.

### Tables and controls

- `--table-header`, `--table-row`, `--table-row-alt`: scanning hierarchy.
- `--control-bg`, `--control-bg-hover`, `--control-text`: inputs and buttons.
- `--border-subtle`, `--border-strong`: structural rules.

### Ink and accents

- `--ink-primary`, `--ink-secondary`, `--ink-muted`: text hierarchy.
- `--ink-on-paper`: dark ink for parchment surfaces.
- `--ink-on-dark`: light parchment text for dark surfaces.
- `--accent-primary`: brass action and selected state.
- `--accent-hover`: stronger action state.
- `--accent-ochre`: secondary editorial emphasis.
- `--accent-sage`: positive or supporting emphasis.
- `--focus-ring`: keyboard focus, always visible.

### Status

Every status uses paired text and surface tokens. Do not use accent colors as
error, warning, or success substitutes.

## Component Rules

### Sidebar

- Group navigation by workspace context.
- Use one-color Lucide icons.
- Mark the active route with brass and an inset panel or rule.
- Keep identity and account actions at the bottom.
- Avoid bright blue and colorful decorative navigation icons.

### Forum

- Posts are title-led raised paper records.
- Open posts receive a clear brass frame.
- Comments use a quieter nested surface.
- Replies indent and use a thin sage thread rule.
- The composer is a dedicated writing area with its own action bar.
- Filters remain visually separate from feed content.

### Tables

- Use a strong warm header and readable labels.
- Alternate row surfaces for scanning.
- Preserve visible hover, focus, and selected states.
- Put wide tables in horizontal overflow containers on small screens.

### Buttons and fields

- Primary action: yellow with black ink. Never place white text on yellow.
- Secondary action: sage or quiet raised surface.
- Danger action: oxide status tokens.
- All fields inherit control, border, text, focus, and error tokens.
- Icon-only actions require an accessible name or tooltip.

### Landing and authentication

- Use editorial serif headings and fine rules.
- Use parchment dossiers for research details.
- Keep forms on aged paper with dark ink.
- Avoid marketing-style gradients, floating glass cards, and large empty areas.

## Motion and Accessibility

- Focus states must remain visible on every surface.
- Do not use color as the only state signal.
- Maintain 44-pixel minimum interactive targets where practical.
- All transition duration tokens resolve to zero under
  `prefers-reduced-motion: reduce`.

## Implementation Rule

New component CSS must use semantic variables. New arbitrary hex, RGB, or
HSL colors belong only in `src/styles/ars-tokens.css`, after contrast review.
Legacy aliases exist only to keep un-migrated pages functional.

## Motion Language

- Route content transfers in with a short horizontal fade after navigation.
- Custom dropdowns enter from their trigger with a small lift and scale.
- Tab panels transfer horizontally when selection changes.
- Native browser select popups remain platform-controlled.
- Every animation resolves to effectively zero duration when the user prefers
  reduced motion.
