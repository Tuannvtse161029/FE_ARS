# 005 — Add press feedback to primary CTA + login button

- **Status**: TODO
- **Commit**: 68fe3d5
- **Severity**: MEDIUM
- **Category**: 1. Purpose & frequency + 3. Physicality & origin
- **Estimated scope**: 1 file, ~10 lines changed

## Problem

The two most important CTAs on the Landing page — `.loginButton` (header) and
`.primaryButton` (hero + future CTA section) — have **no press feedback at all**.
The `:hover` rule sets `transform: none`, cancelling any `transform` on the
hover state. On a touch device, tapping either button gives the user zero
confirmation that the tap registered. On a desktop with a mouse, the cursor
changes to a pointer but the button itself does nothing.

This is exactly the "press feedback" pattern called out in AUDIT.md §3: a
subtle `transform: scale(0.97)` on `:active` with a 160ms ease-out transition.
The press should feel responsive, not crushed (magnitude 0.95–0.98, target 0.97).

`src/pages/Landing/Landing.module.css:170-176` — current

```css
.loginButton:hover,
.loginButton:focus-visible,
.primaryButton:hover,
.primaryButton:focus-visible {
  background: var(--accent-hover);
  color: var(--ink-on-paper);
  transform: none;
}
```

## Target

Add a `:active` rule that drops scale to 0.97 and keeps the transition on
`transform` (which plan 001 has already wired to `var(--transition-fast)`).

`src/pages/Landing/Landing.module.css` — append after the existing
`:hover, :focus-visible` block (around line 175):

```css
.loginButton:active,
.primaryButton:active {
  transform: scale(0.97);
}
```

`transform-origin: center` is the default and is correct here — the press is
centered on a button, not anchored to a trigger.

## Repo conventions to follow

- Tokens used: `var(--transition-fast)` (already wired to transform in plan
  001) = `150ms cubic-bezier(0.16, 1, 0.3, 1)`.
- Existing exemplar for press feedback pattern: `Button` component at
  `src/components/Button/Button.module.css` (if present) or any
  `transform: scale(...)` `:active` rule in `src/pages/*`. If no exemplar
  exists, this plan introduces the canonical pattern for the Landing page.
- The `prefers-reduced-motion` block in `src/styles/ars-tokens.css:360-368`
  zeros the duration, so the press will snap without a transition.

## Steps

1. **Edit `src/pages/Landing/Landing.module.css`**, find the
   `.loginButton:hover, .loginButton:focus-visible, .primaryButton:hover,
   .primaryButton:focus-visible` block (around line 170-175) and add the
   following block immediately AFTER it:

   ```css
   .loginButton:active,
   .primaryButton:active {
     transform: scale(0.97);
   }
   ```

2. Do not touch any other selector or property.

## Boundaries

- Do NOT change the `:hover` rule's `transform: none` — that prevents a
  hover-state transform from accumulating with the press transform.
- Do NOT add a `:active` rule to `.textLink` or to other elements — this
  plan is scoped to the two primary CTAs only.
- Do NOT use `scale(0.95)` or `scale(0.9)` — the magnitude is too aggressive
  per AUDIT.md §3 (recommended range 0.95–0.98).
- Do NOT add a press feedback animation to the workspace cards or the
  dossier — those have hover-state transforms that would conflict.

## Verification

- **Mechanical**: `npx tsc --noEmit` should pass (CSS-only change).
- **Feel check**:
  - Hover and hold the "Log in to ARS" button with a mouse — the button
    should shrink to 97% on press and spring back on release within 150ms.
  - On a touch-enabled device or browser DevTools' "Toggle device toolbar",
    tap the button — the same press feedback should fire.
  - In DevTools, verify the `.loginButton:active` selector matches by
    inspecting it in the Elements panel after pressing the button.
  - Toggle `prefers-reduced-motion: reduce` (Rendering panel) and confirm
    the button still gives a visible press feedback (it just snaps without
    a transition).
- **Done when**: tapping or clicking either CTA produces a visible scale-down
  feedback that completes in under 200ms, the press does not lag or jank,
  and the release springs back smoothly.