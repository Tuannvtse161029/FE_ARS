# 002 — Split workspace-card hover into transform-only motion

- **Status**: TODO
- **Commit**: 68fe3d5
- **Severity**: MEDIUM
- **Category**: 5. Performance + 3. Physicality & origin
- **Estimated scope**: 1 file, ~6 lines changed

## Problem

The workspace card hover animates `transform` AND `box-shadow` together. The
shadow change forces a paint on every frame of the 200ms transition because
`box-shadow` is a paint-only property, not a compositor-only one. On slower
devices and on Safari this is the single biggest perf hit on the Landing page.

Also, `transform-origin: 50% 50%` (the default) means the card lifts from its
center, which is fine for a card lift but reads as "popping up" rather than
"rising". A subtle origin bias toward the top (`50% 100%`) keeps the card
visually anchored to the row baseline, which feels more architectural.

`src/pages/Landing/Landing.module.css:923-924` — current

```css
.workspace { background: var(--surface-base); border-color: var(--border-subtle); transition: transform var(--duration-standard) var(--motion-ease-standard), box-shadow var(--duration-standard) var(--motion-ease-standard); }
.workspace:hover { transform: translateY(-3px); box-shadow: 0 14px 34px var(--shadow-color); }
```

## Target

Animate `transform` only on the hover (compositor layer, cheap), and let the
shadow fade in *after* the lift settles by using a `transition-delay` on the
shadow. Also pin `transform-origin: 50% 100%` so the card reads as rising
from its baseline, not popping from the middle.

`src/pages/Landing/Landing.module.css:923-924` — target

```css
.workspace {
  background: var(--surface-base);
  border-color: var(--border-subtle);
  transform-origin: 50% 100%;
  transition:
    transform var(--transition-fast) var(--motion-ease-standard),
    box-shadow var(--transition-normal) var(--motion-ease-standard) 120ms;
}
.workspace:hover {
  transform: translateY(-3px);
  box-shadow: 0 14px 34px var(--shadow-color);
}
```

Note: `var(--transition-fast)` is `150ms` and `var(--transition-normal)` is `200ms`
(see `src/styles/ars-tokens.css:201-202, 291-292`). The 120ms delay on the shadow
puts it just behind the lift so the shadow fades in once the card has settled.

## Repo conventions to follow

- Motion tokens live in `src/styles/ars-tokens.css:200-203, 291-295`.
- Existing exemplar for transform-only animation: `.skipLink` at
  `src/pages/Landing/Landing.module.css:65-71` already uses
  `transition: transform 160ms ease` — this plan is bringing the workspace
  rule up to the same rigor.
- The `prefers-reduced-motion` block in `src/styles/ars-tokens.css:360-368`
  already zeros the durations, so the shadow will simply snap on under reduced
  motion.

## Steps

1. **Edit `src/pages/Landing/Landing.module.css`**, find the two `.workspace`
   rules at lines ~923-924 (the second occurrence of `.workspace` in the file —
   the first is at ~495 and only sets background + border).
2. Replace the `transition:` shorthand so it reads:

   ```css
   transition:
     transform var(--transition-fast) var(--motion-ease-standard),
     box-shadow var(--transition-normal) var(--motion-ease-standard) 120ms;
   ```

3. Add `transform-origin: 50% 100%;` to the same `.workspace` rule (placed
   after `border-color:` for readability).
4. Leave the `:hover` rule as-is — its `transform: translateY(-3px)` and
   `box-shadow` are correct.

## Boundaries

- Do NOT touch the first `.workspace` rule at `src/pages/Landing/Landing.module.css:495-501`
  (layout-only definition, no transition).
- Do NOT add a `@media (hover: hover) and (pointer: fine)` gate — touch
  hover is acceptable here because the card has no destructive action.
- Do NOT add new CSS variables.
- Do NOT change `translateY(-3px)` — the magnitude is correct for the card's
  scale.

## Verification

- **Mechanical**: `npx tsc --noEmit` (CSS-only, expected to pass). Visually
  inspect DevTools → Computed → `transition` for `.workspace` — should report
  two transitions, the second one with a 120ms delay.
- **Feel check**:
  - In DevTools Performance panel, record a hover-and-leave on a workspace
    card and confirm no `Paint` flash occurs during the lift — only a
    `Composite Layers` event.
  - In DevTools Animations panel, slow playback to 10% and confirm the card
    finishes its lift before the shadow starts fading in.
  - Toggle `prefers-reduced-motion: reduce` (Rendering panel) and confirm the
    card snaps with no transition.
- **Done when**: hovering a workspace card feels responsive (150ms lift,
  200ms shadow trailing by 120ms) and the DevTools Performance recording
  shows zero paint events during the lift.