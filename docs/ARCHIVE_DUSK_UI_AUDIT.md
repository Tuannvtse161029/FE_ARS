# Archive Dusk UI Audit

## Scope

This audit covers the authenticated ARS application, Forum, Landing, Login,
Register, shared controls, and representative Admin tables. It was performed
before the Archive Dusk theme implementation.

## Current Visual System

- `src/styles/ars-tokens.css` is the active token source.
- `src/styles/variables.css` is a dormant compatibility file.
- The default theme is warm parchment with navy text and bright ARS blue.
- The alternate theme is named `night` and uses slate-blue surfaces
  (`#0f172a`, `#1e293b`) rather than an ARS-specific dark identity.
- `MainLayout.tsx` persists `light | night` under `ars_theme` and duplicates
  theme styling through component-level `[data-theme='night']` selectors.

## Dark-Mode Contrast Problems

1. Legacy aliases such as `--ars-ink`, `--color-text-primary`, and
   `--color-primary-dark` remain navy even when semantic dark tokens change.
   Components using those aliases can render dark navy text on a dark canvas.
2. Many modules use direct navy, blue, white, and slate hex values, bypassing
   theme tokens entirely.
3. Dropdowns, modals, badges, and table rows frequently use light-only local
   colors and require per-component night overrides.
4. The current night palette reads like a generic SaaS slate theme and lacks
   separation between canvas, raised surface, paper surface, and discussion
   surfaces.
5. Status colors are tuned for pale light backgrounds and are incomplete in
   dark mode.

## Direct Color Hotspots

Highest direct-hex volumes at audit time:

- `src/components/PdfViewer/PdfViewer.module.css`
- `src/pages/Lecturer/GuidanceProjects.module.css`
- `src/components/wallet/WalletTopUpModal.module.css`
- `src/components/gradstudent/SubmitReportModal.module.css`
- `src/pages/Reviewer/EarningsWallet.module.css`
- `src/components/notification/NotificationCenter.module.css`
- `src/features/publication/components/PublicationShared.module.css`
- `src/pages/Landing/Landing.module.css`
- `src/pages/Forum/Forum.module.css`
- `src/pages/Register/Register.module.css`

Priority migration will focus on the theme layer, shared controls,
MainLayout, Forum, Landing/Auth, and Admin tables. PDF and low-frequency legacy
modal modules remain future token-migration work unless visual QA finds a
critical contrast defect.

## Sidebar and Header Problems

- Flat navy sidebar and header create one large undifferentiated block.
- Navigation lacks grouped research-workspace context.
- Active states rely on generic blue rather than a scholarly ARS accent.
- User/account controls visually compete with global actions.
- Component-level night overrides duplicate token responsibilities.
- The mobile/navigation structure needs clearer hierarchy and quieter hover.

## Forum Hierarchy Problems

- Posts, comments, replies, and composer share similar pale-card treatment.
- Post metadata, engagement actions, and content compete for attention.
- Replies rely too heavily on spacing rather than an explicit thread rule.
- Filter/search utilities visually merge with feed content.
- Selected/open discussion state is not sufficiently distinct.
- Composer needs a document-writing surface and dedicated action bar.

## Table Problems

- Table headers are visually weak and inconsistent across Admin pages.
- Alternating rows and selected/hover states are not system-wide.
- Status chips use page-local colors rather than shared semantic tokens.
- Responsive overflow patterns vary by page.
- Search/filter toolbars do not feel connected to the table they control.

## White-Dominant or Light-Only Surfaces

- Landing uses a separate blue/white palette.
- Login/Register depend on parchment aliases that do not intentionally map to
  both themes.
- Several dialogs and form fields still use white or near-white direct values.
- Admin queues and publication cards often assume a light canvas.

## Files Planned for This Recovery

Theme foundation:

- `src/styles/ars-tokens.css`
- `src/styles/globals.css`
- `src/layouts/MainLayout.tsx`
- `src/layouts/MainLayout.module.css`

Shared controls:

- `src/components/Button/Button.module.css`
- `src/components/Input/Input.module.css`
- `src/components/table/TableToolbar.module.css`
- `src/components/table/TablePagination.module.css`
- shared page headers, status, empty/error/loading components as needed

Forum:

- `src/pages/Forum/Forum.module.css`
- `src/components/forum/ForumPostCard.module.css`
- `src/components/forum/CommentSection.module.css`
- engagement, follow, and report component styles as needed

Landing/Auth:

- `src/pages/Landing/Landing.module.css`
- `src/layouts/AuthLayout.module.css`
- `src/pages/Login/Login.module.css`
- `src/pages/Register/Register.module.css`

Tables/queues:

- shared table components
- representative Admin queue CSS modules where shared tokens are insufficient

## Constraints

- Preserve APIs, routes, permissions, form validation, Firebase upload,
  publication privacy, payment confirmation, and feature flags.
- Do not invent data or backend behavior.
- No blind global color replacement.
- No new arbitrary colors outside the token layer.
- Respect `prefers-reduced-motion`.
- Keep the working branch `phuongpdse140481_FE`; do not merge into `main`.

## Visual System Decision

The replacement system is **Archive Dusk** with two intentional themes:

- `archive-dusk`: deep olive-umber canvas, ink sidebar, brass/ochre actions,
  warm elevated surfaces, and parchment document panels.
- `paper-day`: aged wheat canvas, muted parchment surfaces, deep ink text,
  and the same brass/ochre interaction language.

Semantic tokens own all primary surfaces, text, borders, controls, tables,
discussion hierarchy, status, focus, and shadows.
