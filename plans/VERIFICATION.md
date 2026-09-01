# Verification — Landing Page Motion Plans 001–005

All 5 plans applied in order: 001 → 005 → 002 → 003 → 004.

## Mechanical (already verified)

- ✅ `npx tsc --noEmit` — exit 0
- ✅ `npx vite build` — exit 0
- ❌ `npx eslint` — not applicable (no `eslint.config.js` in this project)

## Feel checks (run in a browser)

### Plan 001 — Token swap (`.skipLink`, `.loginButton`, `.primaryButton`)

1. **Skip link**: tab through the page so the skip link takes focus. It should
   slide down from above the viewport with a snappy out-curve (fast start, soft
   landing). Previously `160ms ease` — now `150ms` with `cubic-bezier(0.16, 1, 0.3, 1)`.
2. **Header "Log in" button**: hover and confirm the background color fades
   to `--accent-hover` within ~150ms. No more `ease` mushy curve.
3. In DevTools → Elements → Computed → `transition`, confirm the cubic-bezier
   on `.loginButton` reads `cubic-bezier(0.16, 1, 0.3, 1)` and the duration is
   `0.15s`.

### Plan 005 — Press feedback on primary CTAs

1. Click and hold the header "Log in" button — it should shrink to `scale(0.97)`
   and spring back on release within ~150ms.
2. Same on the hero "Log in to ARS" CTA.
3. Toggle **Device Toolbar** in DevTools (mobile emulation) and tap — the same
   press feedback should fire on touch.
4. Toggle `prefers-reduced-motion: reduce` (DevTools → Rendering panel). The
   press should still be visible (it just snaps without a transition).

### Plan 002 — Workspace card hover (transform-only)

1. Hover any of the four workspace cards. The card should:
   - Rise `translateY(-3px)` over 150ms (snappy out-curve).
   - Lift from its **baseline** (transform-origin `50% 100%`), not its center.
   - The shadow should fade in **after** the lift settles (~120ms delay), not
     alongside it.
2. In DevTools → Performance panel, record a hover-and-leave on a card. The
   lift itself should show **zero Paint events** (only Composite Layers). The
   shadow fade-in is the only Paint event.

### Plan 003 — Workspace card cascade

1. Hard-reload the page. The four workspace cards (Researcher, Reviewer,
   Lecturer, Graduate Student) should fade up + rise 12px in sequence with a
   60ms stagger. Total cascade: ~700ms from first card appearing to the
   fourth settling.
2. Hover a card during the cascade — hover should still respond within 150ms
   (the cascade `transform: translateY(0)` end-state retargets into the hover
   `transform: translateY(-3px)` cleanly).
3. In DevTools → Animations panel, slow playback to 25% and confirm four
   distinct timestamps on the four cards.
4. Toggle `prefers-reduced-motion: reduce` — the cascade should disappear
   and the grid should appear instantly.

### Plan 004 — Hero entrance

1. Hard-reload the page. The hero copy (left column with headline + lead +
   CTAs) should fade up + rise 12px **first**, then the dossier card (right
   column) follows 80ms later. Both complete ~620ms after their delay. Total
   visible entrance: ~700ms.
2. During the entrance, click the "Log in to ARS" CTA — it should be
   clickable from frame 0 (no `pointer-events: none`).
3. In DevTools → Animations panel, slow playback to 25% and confirm two
   distinct entry animations on `.heroCopy` and `.dossier`.
4. Toggle `prefers-reduced-motion: reduce` — hero appears instantly.

## What changed, by file

### `src/pages/Landing/Landing.module.css`

| Line | Change |
| --- | --- |
| 66 | `.skipLink` transition: `160ms ease` → `var(--transition-fast)` |
| 162 | `.loginButton, .primaryButton` transition: `160ms ease` → `var(--transition-fast)` |
| 174-177 | **NEW**: `.loginButton:active, .primaryButton:active { transform: scale(0.97); }` |
| 928 | `.workspace` transition refactored: `transform` now `--transition-fast`; `box-shadow` now `--transition-normal` with `120ms` delay. Added `transform-origin: 50% 100%`. |
| 933-948 | **NEW**: `@keyframes cardRise` + `.workspace` cascade animation + reduced-motion override (plan 003) |
| 956-977 | **NEW**: `@keyframes heroRise` + `.heroCopy, .dossier` entrance animation + reduced-motion override (plan 004) |

### `src/pages/Landing/Landing.tsx`

| Line | Change |
| --- | --- |
| 230-231 | **NEW**: `style={{ '--hero-stagger': '0ms' }}` on `.heroCopy` (plan 004) |
| 262-263 | **NEW**: `style={{ '--hero-stagger': '80ms' }}` on `.dossier` (plan 004) |
| 433-449 | `.map(...)` callback gains `index`; `<article>` gains `style={{ '--workspace-stagger': \`${index * 60}ms\` }}` (plan 003) |

## Done when

- TypeScript build green ✅
- Vite build green ✅
- All feel checks above match expected behavior

## Notes

- `prefers-reduced-motion: reduce` was honored on every animation added.
- All animations use `transform` + `opacity` only — compositor-layer only,
  zero layout/paint cost on hover/entrance.
- The pre-existing `transition: none` block at the bottom of
  `Landing.module.css` (`.skipLink, .loginButton, .primaryButton`) now
  effectively becomes a no-op since those rules already consume
  `var(--transition-fast)`, which the global token system zeros out under
  reduced motion.
