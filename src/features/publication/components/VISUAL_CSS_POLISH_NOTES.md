# Publication Feature — Visual CSS Polish Decisions

> Authored by **agent-visual-css-polish**. Documents what was changed
> (and why), what **cannot** be styled without TSX edits, and what
> future TSX work could unlock without reworking CSS.

This file is purely informational; no code lives here.

---

## 1. Files touched

| File | Type | Notes |
| --- | --- | --- |
| `src/features/publication/components/PublicationShared.module.css` | Updated | Expanded design tokens, status pill variants, button variants, panels, forms, tables, focus rings, responsive behavior. Converted `.page` and `.panel` to `:global(...)` so the rest of the file can target inline-styled descendants without TSX edits. |
| `src/features/publication/home/HomeResearchCatalog.module.css` | Updated | Reworked for the v2 catalog — toolbar (search + filters), results container, pagination. Paper cards moved out to `PublishedPaperCard.module.css` (owned by `agent-publication-card`). |

No other files (TS/TSX, App.tsx, MainLayout.tsx, routes, auth, shared
API types/services) were modified.

---

## 2. Why `.page` and `.panel` are `:global(...)` in PublicationShared

Several publication TSX files set inline `style={{...}}` on
`<table>`, `<td>`, `<article>`, `<h2>`, `<div>` elements that the
visual-only scope cannot remove. CSS Modules normally hash
identifiers, which would prevent sibling `:global(...)` descendant
selectors (e.g. `:global(.page table)`) from finding them — the
hashed `.page` is opaque to global selectors.

By declaring `.page` and `.panel` as `:global(.page)` /
`:global(.panel)`, the literal class name is emitted (and the JS
export from `shared.page` / `shared.panel` resolves to the literal
string, which the TSX already uses via `className={shared.page}`).
All other classes in the file remain hashed locally.

No collision risk: no other `.module.css` file in the codebase
defines a global `.page` or `.panel` selector (verified via grep).

---

## 3. Selectors that depend on inherited inline styles in TSX

The visual polish only edits CSS files. The TSX owns inline
attributes like `style={{ marginTop: 18 }}` on action wrappers and
`<h2 style={{ fontSize: 17 }}>` on inner headings. Where these
values conflict with the CSS rule (e.g. inline padding of `14px 8px`
on `<td>`), the CSS uses `!important` to override. Where the inline
value is reasonable, it is left as-is.

### 3.1 Now styled via `:global()` overrides (TSX untouched)

| Inline style (TSX) | Where | CSS rule (shared module) |
| --- | --- | --- |
| `<table style={{ width: '100%', borderCollapse: 'collapse' }}>` | `ResearcherSubmissions`, `AdminPaperSubmissions` | `.page table { ... }` (width + border-collapse already match; CSS only adds typography and rounding) |
| `<td style={{ padding: '14px 8px' }}>` | `ResearcherSubmissions` | `.page table tbody td { padding: 12px 14px !important; ... }` |
| `<td style={{ padding: '12px 8px' }}>` | `AdminPaperSubmissions` | Same rule (note: the override normalizes inconsistent inline paddings) |
| `<article style={{ borderBottom: '1px solid #e4e9f0', padding: '14px 0' }}>` | `ReviewerAssignments` | `.panel article { border-bottom: 1px solid var(--ars-network) !important; padding: 16px 0 !important; ... }` |
| `<h2 style={{ fontSize: 17 }}>` | `AdminPaperSubmissionDetail` | `.panel h2[style*="font-size"] { font-size: var(--font-size-lg); }` |
| `<h2 style={{ fontSize: 18 }}>` | `ReviewerAssignments` | `.panel article h2[style*="font-size"] { font-size: var(--font-size-lg); }` |
| `<input aria-label="Reviewer name">` (no `.field` wrapper) | `AdminPaperSubmissionDetail` | `.actions input[type="text"], .actions input:not([type])[aria-label] { ... }` |
| Bare `<p>`, `<strong>`, `<small>`, `<a>` inside `.panel` | Several pages | `.panel > p`, `.panel > p strong`, `.panel a:not([class*="button"]):not([class*="status"]) { ... }` |

### 3.2 Left as-is (intentional)

- `<div className={shared.actions} style={{ marginTop: 18 }}>` — the
  inline `marginTop: 18 ≈ var(--space-5)` is reasonable for
  after-form action groupings. The CSS does not override because it
  would only collapse the existing spacing.
- `<div className={shared.actions} style={{ alignItems: 'end' }}>` —
  inline aligns the inner action button to the bottom of the form
  field. The CSS would have been `.actionsEnd { align-items: flex-end }`
  if the TSX opted in.
- `style={{ width: '100%', marginTop: 16, borderCollapse: 'collapse' }}`
  on `AdminPaperSubmissions` filter+table — width/border-collapse
  match the CSS; `marginTop: 16 ≈ var(--space-4)` is small enough
  to keep visually.

### 3.3 Cannot be styled without TSX edits

These would benefit from a small TSX change but are **out of scope**
for this visual-only work:

1. **`<ResearcherSubmissionForm>` field hints use `shared.fieldHint`** —
   the new style is in place, but the form also wraps `actions` in
   `style={{ marginTop: 8 }}` and `style={{ marginTop: 18 }}` instead
   of using a class. Reusable if migrated to `.actionsStack` /
   `.actionsEnd` classes (also available in CSS).
2. **`<ResearcherSubmissionForm>` OpenAlex preview panel uses
   `<div className={shared.panel} style={{ marginTop: 8 }}>`** —
   this is an *inline-style + same-class* pattern that the global
   `.panel { ... }` rule already styles. The override is harmless.
3. **No `data-status` attribute on `<span className="status">`**
   pills — adding `data-status={paper.status}` to the TSX would
   let the CSS express per-status palette via attribute selectors
   without enumerating 14 modifier classes. Suggest adding this when
   the next TSX change touches the status pill, e.g.:
   ```css
   .status[data-status="PUBLISHED"] { background: var(--ars-success-bg); color: var(--ars-success); }
   .status[data-status="REVIEWER_RECOMMENDED_ACCEPT"] { ... }
   ```
4. **`AdminPaperSubmissionDetail` private reviewer section** is
   already visually identified by the new `.panel > section.panel`
   selector which gives it the reviewer-green background. If the
   TSX were ever refactored, renaming that inner section to a
   dedicated class (e.g. `reviewerCallout`) would make the styling
   intent clearer.
5. **`ResearcherSubmissionForm` step transitions (`idle` → `preview`
   → `confirmed`)** — could be progressively polished by adding a
   `.stepBar` class to the OpenAlex flow. Out of scope today.

---

## 4. Pre-existing test status (not caused by this work)

`tests/unit/publication/researcher/ResearcherSubmissionForm.test.tsx`
and `tests/unit/publication/admin/AdminPaperSubmissions.test.tsx`
have 3 pre-existing failures. Verified by stashing this work and
re-running: the same tests fail with the original CSS. The failures
are functional (form state machine, multi-role matches) and belong
to the TSX-owning agents (`agent-researcher-paper-submission`,
`agent-admin-publication-list`).

---

## 5. Design token compliance

- All colors via `var(--ars-*)` from `src/styles/ars-tokens.css`.
- No gradients, no orbs, no decorative imagery.
- Status pill palette respects ≥ 4.5:1 contrast against backgrounds.
- All interactive elements have explicit `:focus-visible` outlines.
- `prefers-reduced-motion: reduce` honored for the loading spinner
  and table-row transitions.

---

## 6. Visual contract for future TSX work

The visual polish is stable under the assumption that:

- Publication pages continue to mount `<section className={shared.page}>`.
- Panels continue to use `<div className={shared.panel}>` or
  `<section className={shared.panel}>`.
- Tables remain `<table>` (not `<Grid>`).
- Article lists remain `<article>` (ReviewerAssignments pattern).
- The hash for any local class differs from `.page` / `.panel`, which
  stay global.

If the TSX migrates away from `.page` or `.panel`, the global rules
must be re-targeted. The shared module is the single source of truth
for publication-feature styling.
