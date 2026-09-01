# 003 — Add one-shot staggered cascade to workspace cards

- **Status**: TODO
- **Commit**: 68fe3d5
- **Severity**: MEDIUM
- **Category**: 1. Purpose & frequency + 7. Cohesion & tokens
- **Estimated scope**: 2 files, ~30 lines added

## Problem

The four workspace cards (Researcher, Reviewer, Lecturer, Graduate Student)
render instantly on first paint. They are the page's main "what does ARS do"
moment, but visually they look like a static grid until you hover one. A one-shot
staggered cascade — the cards fading up by ~12px in sequence with a 60ms stagger —
makes the landing feel composed rather than loaded.

The cascade must:
- Run once on first paint only (no replay on scroll/hover).
- Be interruptible: hovering a card mid-cascade should not feel laggy.
- Respect `prefers-reduced-motion: reduce` (snap into place).
- Not block interaction (no `pointer-events: none` gate).
- Be GPU-only (animate `transform` + `opacity` only).

`src/pages/Landing/Landing.tsx:362-373` — current (workspace grid markup)

```tsx
<div className={styles.workspaceGrid}>
  {workspaces.map(({ icon: Icon, title, description }) => (
    <article className={styles.workspace} key={title}>
      <Icon size={24} aria-hidden="true" />
      <h3>{title}</h3>
      <p>{description}</p>
    </article>
  ))}
</div>
```

`src/pages/Landing/Landing.module.css:495-501` — current (`.workspace` layout rule, no animation)

```css
.workspace {
  min-height: 270px;
  padding: 27px 25px;
  border-right: 1px solid var(--rule);
  border-bottom: 1px solid var(--rule);
  background: var(--surface-base);
}
```

## Target

Add a CSS keyframe animation `cardRise` (12px translateY + opacity) and apply it
to `.workspace` with `animation-delay` calculated from the card's index. Use a
single class with the delay encoded via inline style or a CSS custom property.

Because the cards are mapped from an array in JSX, the cleanest implementation
is to set `style={{ animationDelay: \`${index * 60}ms\` }}` on each `<article>`.

`src/pages/Landing/Landing.module.css` — add at the end of the workspace rules
(after line 924, the hover rule we already updated in plan 002):

```css
@keyframes cardRise {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.workspace {
  animation: cardRise 520ms var(--motion-ease-standard) both;
  animation-delay: var(--workspace-stagger, 0ms);
}
```

`src/pages/Landing/Landing.tsx:362-373` — target

```tsx
<div className={styles.workspaceGrid}>
  {workspaces.map(({ icon: Icon, title, description }, index) => (
    <article
      className={styles.workspace}
      key={title}
      style={{ '--workspace-stagger': `${index * 60}ms` } as React.CSSProperties}
    >
      <Icon size={24} aria-hidden="true" />
      <h3>{title}</h3>
      <p>{description}</p>
    </article>
  ))}
</div>
```

Total cascade: 4 cards × 60ms stagger + 520ms duration = 760ms for the last
card to settle. Within the landing-page budget (~1s) for first-paint choreography.

## Repo conventions to follow

- Tokens used: `var(--motion-ease-standard)` (`src/styles/ars-tokens.css:200`)
  is `cubic-bezier(0.16, 1, 0.3, 1)`, a strong ease-out — correct for entry
  per AUDIT.md §2.
- The `animation-fill-mode: both` keeps the card invisible until its delay
  elapses (no flash-of-visible-card for staggered items).
- The `prefers-reduced-motion` block at `src/styles/ars-tokens.css:360-368`
  zeroes `--duration-*`, but does not zero animation duration directly. The
  plan's `both` fill-mode still works under reduced motion; we add a reduced-motion
  override below.

## Steps

1. **Edit `src/pages/Landing/Landing.module.css`**, append after the
   `.workspace:hover` block (around line 924):

   ```css
   @keyframes cardRise {
     from {
       opacity: 0;
       transform: translateY(12px);
     }
     to {
       opacity: 1;
       transform: translateY(0);
     }
   }

   .workspace {
     animation: cardRise 520ms var(--motion-ease-standard) both;
     animation-delay: var(--workspace-stagger, 0ms);
   }

   @media (prefers-reduced-motion: reduce) {
     .workspace {
       animation: none;
     }
   }
   ```

   Note: append these AFTER the existing `.workspace` block (lines 495-501 and
   922-924) so the cascade animation has higher specificity than the existing
   declarations but doesn't disturb the layout properties.

2. **Edit `src/pages/Landing/Landing.tsx`**, change the workspace grid
   `.map(...)` (around line 362) to:

   ```tsx
   {workspaces.map(({ icon: Icon, title, description }, index) => (
     <article
       className={styles.workspace}
       key={title}
       style={{ '--workspace-stagger': `${index * 60}ms` } as React.CSSProperties}
     >
       <Icon size={24} aria-hidden="true" />
       <h3>{title}</h3>
       <p>{description}</p>
     </article>
   ))}
   ```

   (Added `index` to the map callback and a `style` prop on the `<article>`.)

3. Verify TypeScript accepts `style` with a custom CSS property — the cast
   `as React.CSSProperties` is the project's pattern (see
   `src/components/...` for any pre-existing examples; if absent, the cast
   above is sufficient).

## Boundaries

- Do NOT change the `.workspace` layout rules at lines 495-501 and 922-924.
- Do NOT add `pointer-events: none` — the cards must remain hover-able during
  the cascade.
- Do NOT add a stagger longer than 80ms — longer staggers on a landing grid
  feel like a load screen, not a cascade.
- Do NOT animate `width`, `height`, `padding`, `margin`, `top`, `left`,
  `right`, `bottom`, or `box-shadow` — only `transform` and `opacity` per
  AUDIT.md §5.
- Do NOT add new dependencies.

## Verification

- **Mechanical**: `npx tsc --noEmit` should pass (TS expects the
  `React.CSSProperties` cast). `npx eslint src/pages/Landing` should pass.
- **Feel check**:
  - Reload the Landing page; the four cards should fade up in sequence over
    ~760ms. Hover during the cascade — hover should remain responsive (the
    transform transition in plan 002 retargets from the keyframe's
    `translateY(0)` end-state, no lag).
  - In DevTools Animations panel, slow playback to 25% and confirm the four
    cards appear at distinct timestamps.
  - Toggle `prefers-reduced-motion: reduce` (Rendering panel) and confirm the
    cascade is replaced with an instant appearance.
- **Done when**: the four workspace cards fade up in sequence on first paint,
  the cascade completes under 1s, hover remains responsive mid-cascade, and
  reduced-motion users see the grid instantly.