# 004 — Add one-shot hero entrance

- **Status**: TODO
- **Commit**: 68fe3d5
- **Severity**: LOW
- **Category**: 8. Missed opportunities + 1. Purpose & frequency
- **Estimated scope**: 2 files, ~30 lines added

## Problem

The hero section is the first viewport a visitor sees, but today everything in
it renders instantly: the headline, lead paragraph, both CTAs, and the dossier
card on the right. A landing-page hero is a "rare, high-emotion moment" by
AUDIT.md §1 — exactly the kind of place where a small amount of well-placed
motion is allowed. A one-shot fade + 12px rise on the hero copy and the dossier
(80ms apart) communicates "page has just arrived" without making the page feel
animated.

The entrance must:
- Run once on first paint only.
- Be interruptible — clicking the "Log in" CTA during the entrance should
  not feel laggy.
- Respect `prefers-reduced-motion`.
- Animate `transform` + `opacity` only.

`src/pages/Landing/Landing.tsx:201-247` — current hero markup (excerpt)

```tsx
<section className={styles.hero} aria-labelledby="landing-title">
  <div className={styles.heroInner}>
    <div className={styles.heroCopy}>
      {/* h1, lead, heroActions */}
    </div>
    <aside className={styles.dossier} aria-labelledby="dossier-title">
      {/* dossierHeader, h2, p, dl */}
    </aside>
  </div>
</section>
```

`src/pages/Landing/Landing.module.css:181-187` — current

```css
.hero {
  color: var(--ink-on-dark);
  background: var(--sidebar-bg);
}
```

(No entrance animation defined.)

## Target

Add a `heroRise` keyframe and apply it to `.heroCopy` and `.dossier` with an
80ms stagger via CSS custom properties. The hero background and
`.heroInner` grid wrapper are left alone.

```css
@keyframes heroRise {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.heroCopy,
.dossier {
  animation: heroRise 620ms var(--motion-ease-standard) both;
  animation-delay: var(--hero-stagger, 0ms);
}

@media (prefers-reduced-motion: reduce) {
  .heroCopy,
  .dossier {
    animation: none;
  }
}
```

Apply `--hero-stagger` inline on the JSX:

```tsx
<div
  className={styles.heroCopy}
  style={{ '--hero-stagger': '0ms' } as React.CSSProperties}
>
  {/* unchanged */}
</div>

<aside
  className={styles.dossier}
  aria-labelledby="dossier-title"
  style={{ '--hero-stagger': '80ms' } as React.CSSProperties}
>
  {/* unchanged */}
</aside>
```

Total: dossier finishes 80 + 620 = 700ms after first paint.

## Repo conventions to follow

- Tokens used: `var(--motion-ease-standard)` (`src/styles/ars-tokens.css:200`).
- Pattern exemplar: plan 003 uses the same keyframe + custom-property pattern.
  The two plans share the `as React.CSSProperties` cast.

## Steps

1. **Edit `src/pages/Landing/Landing.module.css`**, append at the end of the
   hero rules (find the last hero rule, around `.hero { ... }` at line ~700
   in the "Cozy study-light cascade" block, and append after the surrounding
   hero rules finish — easiest: append at the very end of the file, after
   the reduced-motion media query, in its own block).

   ```css
   @keyframes heroRise {
     from {
       opacity: 0;
       transform: translateY(12px);
     }
     to {
       opacity: 1;
       transform: translateY(0);
     }
   }

   .heroCopy,
   .dossier {
     animation: heroRise 620ms var(--motion-ease-standard) both;
     animation-delay: var(--hero-stagger, 0ms);
   }

   @media (prefers-reduced-motion: reduce) {
     .heroCopy,
     .dossier {
       animation: none;
     }
   }
   ```

   Important: place this AFTER the existing `prefers-reduced-motion` block at
   `src/pages/Landing/Landing.module.css:786-790` (which only covers
   `.skipLink, .loginButton, .primaryButton`) so the new reduced-motion
   override wins for `.heroCopy` and `.dossier`.

2. **Edit `src/pages/Landing/Landing.tsx`**, on the `.heroCopy` `<div>` (around
   line 205) add:

   ```tsx
   style={{ '--hero-stagger': '0ms' } as React.CSSProperties}
   ```

   On the `.dossier` `<aside>` (around line 232) add:

   ```tsx
   style={{ '--hero-stagger': '80ms' } as React.CSSProperties}
   ```

3. Leave the `.hero` section element and `.heroInner` wrapper alone — no
   entrance on those, so the grid layout is stable from frame 0.

## Boundaries

- Do NOT animate `.heroInner` (the grid wrapper) — it would cause a layout
  shift.
- Do NOT animate `.hero` background — the radial-gradient overlay stays
  static.
- Do NOT add an entrance to the header — that's a separate concern; the
  header should appear instantly so the navigation is available from frame 0.
- Do NOT use `animation-fill-mode: forwards` — `both` is correct because the
  `from` state (opacity: 0) must apply during the delay window.

## Verification

- **Mechanical**: `npx tsc --noEmit` should pass. `npx eslint
  src/pages/Landing` should pass.
- **Feel check**:
  - Reload the Landing page. The hero copy appears first (0ms delay), the
    dossier follows 80ms later, both complete ~620ms after their delay. Total
    visible animation: ~700ms.
  - During the entrance, click the "Log in to ARS" CTA — the link should be
    clickable from frame 0 (no `pointer-events: none`).
  - In DevTools Animations panel, slow playback to 25% and confirm two
    distinct entry animations on the two elements.
  - Toggle `prefers-reduced-motion: reduce` (Rendering panel) and confirm the
    hero appears instantly with no fade-up.
- **Done when**: the hero fades up in two stages on first paint, the
  cascade completes under 750ms, the page is fully clickable from frame 0,
  and reduced-motion users see the hero instantly.