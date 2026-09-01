# 001 — Consolidate landing-page transitions onto project motion tokens

- **Status**: TODO
- **Commit**: 68fe3d5
- **Severity**: MEDIUM
- **Category**: 2. Easing & duration + 7. Cohesion & tokens
- **Estimated scope**: 1 file, ~6 lines changed

## Problem

The Landing page has three transition declarations that bypass the project's motion
token system:

- `transition: transform 160ms ease;` on the skip link
- `transition: background 160ms ease, transform 160ms ease;` on `.loginButton`/`.primaryButton`
- `transition: transform var(--duration-standard) var(--motion-ease-standard), box-shadow var(--duration-standard) var(--motion-ease-standard);` on `.workspace` (this one is correct)

`ease` is too weak for deliberate UI motion — its curve is nearly symmetric, so
the response feels mushy instead of snappy. The project already exposes strong
ease-out values via tokens; using them keeps the Landing page coherent with the
rest of the FE.

`src/pages/Landing/Landing.module.css:66` — current

```css
.skipLink {
  position: fixed;
  top: 12px;
  left: 12px;
  z-index: 100;
  padding: 10px 14px;
  color: var(--ink-on-dark);
  background: var(--ink);
  text-decoration: none;
  transform: translateY(-180%);
  transition: transform 160ms ease;
}
```

`src/pages/Landing/Landing.module.css:162` — current

```css
.loginButton,
.primaryButton {
  min-height: 44px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 9px;
  padding: 0 18px;
  border: 1px solid transparent;
  color: var(--ink-on-paper);
  background: var(--blue);
  font-size: 0.87rem;
  font-weight: 750;
  text-decoration: none;
  transition: background 160ms ease, transform 160ms ease;
}
```

## Target

Replace both `160ms ease` declarations with the project tokens, keeping the
existing durations inside the project's scale:

- `--transition-fast` = `var(--duration-fast) var(--motion-ease-standard)` = `150ms cubic-bezier(0.16, 1, 0.3, 1)`
- `--motion-ease-standard` = `cubic-bezier(0.16, 1, 0.3, 1)` (strong ease-out, already tokenized in `src/styles/ars-tokens.css:200`)
- `--duration-fast` = `150ms` (`src/styles/ars-tokens.css:291`)

The skip link only needs `transform`. The buttons keep both `background` and
`transform` (used in plan 005 for press feedback).

## Repo conventions to follow

- Motion tokens live in `src/styles/ars-tokens.css:200-203, 291-295`.
- Existing exemplar: `.workspace` at `src/pages/Landing/Landing.module.css:923` already
  uses `transition: transform var(--duration-standard) var(--motion-ease-standard)`.
- The `prefers-reduced-motion` block at `src/styles/ars-tokens.css:360-368` already
  zeros out the durations; the skip-link + buttons will inherit the zero branch
  automatically once they consume the tokens.

## Steps

1. **Edit `src/pages/Landing/Landing.module.css`**, find the `.skipLink` block
   at line ~65-70 and change the transition line:

   ```css
   /* before */
   transition: transform 160ms ease;

   /* after */
   transition: transform var(--transition-fast);
   ```

2. In the same file, find the `.loginButton, .primaryButton` block at line ~148-167
   and change the transition line:

   ```css
   /* before */
   transition: background 160ms ease, transform 160ms ease;

   /* after */
   transition: background var(--transition-fast), transform var(--transition-fast);
   ```

3. Do **not** touch the `.workspace` hover transition — it already uses the
   right tokens.

## Boundaries

- Do NOT change the `:hover` or `:focus-visible` rules that follow the
  `.loginButton`/`.primaryButton` transition block.
- Do NOT remove the `prefers-reduced-motion` override block at the bottom of
  the file (`src/pages/Landing/Landing.module.css:786-790`) — it stays as a
  defensive backstop.
- Do NOT introduce new CSS variables.

## Verification

- **Mechanical**: `npx tsc --noEmit` should still report zero errors
  (CSS-only change, expected to pass). Visually inspect the rendered values in
  DevTools → Computed → `transition` for `.skipLink` and `.loginButton` — both
  should report `transform 0.15s cubic-bezier(0.16, 1, 0.3, 1)` (and background
  for the buttons).
- **Feel check**:
  - In a browser, tab to focus the skip link — it should slide down with a
    snappy out-curve (fast start, soft landing).
  - Hover the "Log in to ARS" button — the background fade should feel
    responsive, not mushy.
- **Done when**: the three rules above all read `var(--transition-fast)` /
  `var(--motion-ease-standard)` / `var(--duration-standard)`, and the rendered
  cubic-bezier is `cubic-bezier(0.16, 1, 0.3, 1)` for every transition on the
  Landing page.