# ARS Frontend Design and Localization Rule

Create and persist the following project rule for the ARS frontend. Apply it to every new or modified UI component, page, modal, notification, empty state, and form.

Before changing UI code, inspect the existing project theme tokens, typography styles, localization setup, and installed dependencies. Reuse them; do not create parallel design systems.

## 1. Theme and color system

- ARS uses a yellow, white, and black/charcoal visual identity.
- Use the project’s existing CSS variables, tokens, shared components, and approved color variants.
- Do not hardcode arbitrary hex colors when an existing token or component variant exists.
- Do not introduce unrelated palettes, gradients, neon colors, or inconsistent button colors.
- Preserve accessible contrast in all normal, hover, focus-visible, active, disabled, loading, light-mode, and dark-mode states.
- For dark/yellow filled buttons, ensure text and icons remain readable; use the project-approved white foreground when appropriate.

## 2. Icons

- Use the existing `lucide-react` icon library already implemented in the project.
- Reuse existing shared icon wrappers and icon conventions where available.
- Do not use emoji, Unicode symbols, random SVG files, Font Awesome, Material Icons, image icons, or a new icon library unless the project owner explicitly approves it.
- Use icons that accurately describe the action and include accessible labels/tooltips where required.

## 3. Language and localization

- Every application-controlled user-facing string must match the currently selected system language.
- When the locale is English, do not show Vietnamese labels, placeholders, validation messages, button text, status labels, modal text, empty states, success/error toasts, or help text.
- When the locale is Vietnamese, use Vietnamese translations consistently.
- Use the project’s translation mechanism and translation keys; do not hardcode new English or Vietnamese strings directly inside components.
- Keep user-generated content, paper titles, abstracts, names, uploaded documents, and external source metadata in their original language.
- After modifying a page, check the full screen for mixed-language UI text.

## 4. Typography

- Use the project’s existing font stack and typography tokens, including Roboto and any established editorial-heading font.
- Do not introduce a new web font, inline `font-family`, or unrelated typography style without approval.
- Reuse shared text, heading, label, table, button, and form styles.
- Keep font size, weight, line height, and spacing consistent with nearby ARS screens.

## 5. Required completion check

Before declaring UI work complete:

1. Confirm colors use existing ARS theme tokens/components.
2. Confirm all icons come from `lucide-react`.
3. Test the page in English and Vietnamese and remove mixed-language interface text.
4. Confirm typography uses existing project styles.
5. Check hover/focus/disabled states and responsive layout.
6. Report any missing theme token, icon, translation key, or font rule instead of inventing a new pattern.

If an existing screen violates this rule, preserve the rule for all new work and flag the inconsistency for a separate, scoped cleanup task.