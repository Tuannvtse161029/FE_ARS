---
name: Role-Unique Public Profiles
overview: Redesign /profile/:userId to render a distinct, role-specific public profile for Reviewer, Researcher, Lecturer, and Graduate Student. Each role uses its own layout and section set sourced from the BE, while the existing owner-edit form and tabbed extras (Forum / Publications / Badges) are preserved.
todos:
  - id: shared-components
    content: Add PublicSectionShell, MetricTile, BarStreamChart, ContributionYearStream, RoleBadgeChip shared components
    status: completed
  - id: data-hook
    content: Implement usePublicProfileData hook with role-conditional data loading
    status: completed
  - id: reviewer-view
    content: Build ReviewerPublicView with contribution card, expertise chips, and privacy footnote
    status: in_progress
  - id: researcher-view
    content: Build ResearcherPublicView with publication register table and year-stream chart
    status: pending
  - id: lecturer-view
    content: Build LecturerPublicView with academic calendar and public groups list
    status: pending
  - id: gradstudent-view
    content: Build GraduateStudentPublicView with research path milestones and contribution markers
    status: pending
  - id: wire-profile-page
    content: Wire Profile.tsx to dispatch role-specific views while preserving edit form and tabbed extras
    status: pending
  - id: i18n-keys
    content: Add bilingual i18n keys under profile.publicView.* in EN and VI dictionaries
    status: pending
  - id: verification
    content: "Visual verification: desktop + mobile, light + dark, owner-read vs visitor vs edit mode"
    status: pending
isProject: false
---

# Role-Unique Public Profiles

## Goal

Replace the single generic `ProfileView` rendering with **four distinct public-profile layouts** — one per role — that surface the data that role actually owns on the ARS platform. Owner self-view (read-mode) and visitor view both render the new role-specific layout; the existing edit form keeps working unchanged.

## Design Direction

Each role gets its own visual world within the ARS Paper Day system, anchored to its existing accent token (already in [`src/styles/ars-tokens.css`](src/styles/ars-tokens.css)):

| Role | Accent token | Visual world |
|---|---|---|
| Reviewer | `--ars-reviewer` (#065f46 forest green) | Trust ledger: certification, contribution counts, expertise chips |
| Researcher | `--ars-researcher` (#b45309 amber ochre) | Publication index: register table, citation metrics, year-stream chart |
| Lecturer | `--ars-lecturer` (#7c2d12 deep burgundy) | Academic coordination board: seminar calendar, group roster, materials counts |
| Graduate Student | `--ars-gradstudent` (#1e3a8a slate blue) | Journey log: identity → research group → milestones → activity timeline |

Shared chrome (identity card, follower counts, OrcidIdentityPanel, follow modal, tabbed extras, TrialCountdownCard for owner) stays in `src/pages/Profile/Profile.tsx` — only the `<ProfileView />` between identity and tabs gets swapped per role.

## File Layout

Create a new directory for the role-specific public views, then wire `Profile.tsx` to dispatch to the right one.

```
src/components/profile/publicViews/
├── ReviewerPublicView.tsx           + .module.css
├── ResearcherPublicView.tsx        + .module.css
├── LecturerPublicView.tsx          + .module.css
├── GraduateStudentPublicView.tsx   + .module.css
└── shared/
    ├── PublicSectionShell.tsx      + .module.css   // consistent section card
    ├── MetricTile.tsx              + .module.css   // big-number tile with eyebrow + sublabel
    ├── RoleBadgeChip.tsx           + .module.css   // uppercase mono ID/code chip
    ├── BarStreamChart.tsx          + .module.css   // year→count horizontal bar list
    └── ContributionYearStream.tsx  + .module.css   // thin academic-stream chart
```

Update `src/pages/Profile/Profile.tsx` and its CSS module to dispatch by `roleName` between the four public views, while keeping the `ProfileEditForm` path unchanged.

## Data Sources (per role — all live BE endpoints, no fabrication)

Reuse the existing hook / service surface — only add what's missing. Each new view receives a `data` prop typed by the role; a single `usePublicProfileData(role, userId)` hook fans out to the existing services (no new endpoints, no invented fields).

| Role | Sections that map to existing data |
|---|---|
| Reviewer | `Profile` (fullName, academicTitle, institution, bio, keywords, orcidId, majorFieldName, subFieldName, isOrcidVerified) · `ProfessionalProfile` (hindex, totalCitations, publicationCount, isAvailable, updatedAt) · `useProfileExtras` (publications + forum posts) |
| Researcher | `Profile` + `ProfessionalProfile` (same fields as Reviewer) · `useProfileExtras` for the publication register · `majorFieldName` / `subFieldName` for "Research Areas" chips |
| Lecturer | `Profile` · `researchGroupService.getAll()` filtered client-side by leader/studentId — visible research groups only (private membership hidden) · `seminarService.getAll()` filtered by `hostLecturerId` for upcoming public seminars · `learningMaterialService` count of public materials. **Public groups, public seminars, public materials only** — private student data, feedback, evaluations stay hidden per the existing privacy contract. |
| Graduate Student | `Profile` · `groupMemberService.getAll()` filtered by `studentId` for research group membership · `phasedReportService.getAll()` filtered by `studentId` for submitted reports (becomes the "Current Research Path" milestones) · `seminarService` participation data filtered by user id for "seminars attended" count · `useProfileExtras` for forum posts |

### Data fidelity — explicitly omitted (system has no source)

The ASCII designs include elements the BE does not expose. These are **not** invented; they are omitted or rendered as honest "not yet tracked" states:

- "Reviewer Level 03 / Trusted Reviewer" — no such field exists. Reviewer view shows the **actual** signals we have: h-index, citation count, publication count, active expertise.
- "On-time Completion 092%" — no reviewer timeliness metric is exposed.
- "Active Review Areas 004" — derived from `subFieldName` / `keywords` count, capped honestly.
- "Earned Records / Verified Peer Review Contribution" — no reviewer-record entity exists.
- "Citations* (only if sourced from approved external integration)" — the Reviewer/Researcher metrics come from `ProfessionalProfile` (Admin-managed). The footnote in the ASCII is preserved as a UI hint where useful.
- "Next Academic Goal" / "Literature → Methods → Current → Next" timeline — replaced by the actual submitted-report milestone list, with an honest "future milestone not yet scheduled" state where the system has no data.

The Graduate Student "Public Project" link is wired to the student's primary research group's detail page (when a public one exists); otherwise the entry is hidden.

## Per-Role Layout

Each view is a vertical stack of section shells, all keyed by `roleName`. Owner-only fields (phone, address, DOB, gender, email) appear in a single compact "Account contact" strip **only when `isOwner === true`**; visitors never see them.

### 1. Reviewer — `ReviewerPublicView.tsx`

Eyebrow: `REVIEWER WORKSPACE` (visitors) / role tag per token. Distinct visual moves:

- **Identity strip** with verified-reviewer badge, ORCID block (`OrcidIdentityPanel` reused), current `isAvailable` state pill.
- **Contribution card** (replaces generic ProfileView grid): a bordered ledger with `H-Index`, `Total Citations`, `Publication Count` as `MetricTile`s, plus `Major Field` / `Subfield` expertise chips and `Keywords` keyword chips.
- **Expertise areas** — a separate section listing `majorFieldName`, `subFieldName`, and `keywords[]` as small monochrome chips inside a section shell.
- **Publication stream** — reuse `ProfilePublicationsSection` from `src/components/profile/ProfilePublicationsSection.tsx` (already wired by authorId).
- **Forum posts** — reuse `ProfileForumSection` from `src/components/profile/ProfileForumSection.tsx`.
- **Privacy footnote** — visible to viewers only, e.g. "Manuscript titles, authors, and review comments are never displayed on this public record."

### 2. Researcher — `ResearcherPublicView.tsx`

Eyebrow: `RESEARCHER WORKSPACE`. Distinct visual moves:

- **Identity strip** with verified-researcher badge, ORCID block, academic title + institution in serif heading.
- **Publication register** — a true table (not a card list): columns `ID / YEAR / TYPE / TITLE / STATUS`. Pulls up to 6 entries from `useProfileExtras`, type inferred from `paper.type` / `paper.venue` (Article vs Journal default-fallback). Status pill from existing status palette.
- **Research record tiles** — `Published Papers`, `H-Index`, `Total Citations`, `Active Since` (year extracted from `user.createdAt`).
- **Publication stream chart** — `ContributionYearStream`: per-year horizontal bars, computed from publication `publishedAt` / `updatedAt`. Counts only.
- **Research areas** — chips for `majorFieldName`, `subFieldName`, `keywords[]`.
- **Forum posts** — reused as a smaller section.
- **Footnote** — "Drafts, private reviews, and rejected submissions stay private."

### 3. Lecturer — `LecturerPublicView.tsx`

Eyebrow: `LECTURER WORKSPACE` / `ACADEMIC COORDINATION BOARD`. Distinct visual moves:

- **Identity strip** with lecturer badge, faculty + institution large, no availability indicator (lecturers don't accept reviews).
- **Academic calendar** — table of upcoming public seminars (filtered `seminarService.getAll()` by `hostLecturerId`, then by `effectiveStatus === 'Upcoming'`). Columns: `DATE / EVENT / STATE`. State comes from existing `mapSeminarStatus` / `effectiveStatus`. Only include seminars where `visibility === 'Public'` (or the equivalent status the BE exposes; if no visibility flag, fall back to all upcoming seminars and label as "public schedule").
- **Coordination record tiles** — three `MetricTile`s: `Seminars Hosted`, `Research Groups`, `Materials` (count via `learningMaterialService`).
- **Public groups list** — list of research groups the lecturer leads, filtered client-side from `researchGroupService.getAll()`. Each row shows group name, member count, status pill (`Active`/`Archived`). The list is the public surface only — private members and feedback are hidden.
- **Footnote** — "Private group membership, student reports, feedback, and milestone evaluations are visible only to authorized members."

### 4. Graduate Student — `GraduateStudentPublicView.tsx`

Eyebrow: `GRADUATE STUDENT WORKSPACE` / `RESEARCH JOURNEY LOG`. Distinct visual moves:

- **Identity strip** with student badge, ORCID (if any), primary research group name.
- **Current research path** — a horizontal phase strip computed from submitted reports via `phasedReportService.getAll()` filtered by `studentId`. Each phase shows the milestone name + status (Waiting / Submitted / Evaluated / Rejected) drawn from the existing status palette. Phases with no data render as muted "Not yet scheduled" with a dash — **never fabricated**.
- **Public activity card** — research group membership (from `groupMemberService`), seminars attended count (from seminar participation), research interests (chips), public project link (their primary research group, only if public).
- **Contribution markers** — derived honestly from real signals:
  - "Research Group Member" — exists if `groupMemberService` returns ≥1 row.
  - "Seminar Participant" — exists if participation count > 0.
  - "Forum Contributor" — exists if `forumPosts.length > 0`.
  Each shows the literal count next to it.
- **Academic snapshot** — minimal: `Joined year` (from `user.createdAt`), `Reports submitted` count, `Seminars attended` count.
- **Footnote** — "Draft reports, supervisor feedback, grades, private milestones, and group details remain private by default."

## Shared Components

### `PublicSectionShell.tsx`

Section card with eyebrow, optional title, optional action, body slot. Eyebrow uses `font-family-mono` uppercase tracked, per the existing `SectionMarker` convention. Accent left rule uses the per-role accent token.

### `MetricTile.tsx`

Big-number tile: eyebrow label, large serif numeral, optional sublabel, optional trailing icon. Uses `--font-family-serif` for the number to give each role a coordinated editorial feel. Roles can pass `tone` for negative/positive.

### `BarStreamChart.tsx`

Year→count horizontal bar list, year labels in mono, bar height 8px, fill uses `currentColor` so each role can recolor via parent. Used by Researcher and Reviewer for the publication/contribution stream.

### `RoleBadgeChip.tsx`

Uppercase mono badge used in identity strips (e.g., `REVIEWER`, `RESEARCHER`). Reads role accent.

## Wire-up in `Profile.tsx`

In [`src/pages/Profile/Profile.tsx`](src/pages/Profile/Profile.tsx):

1. Resolve `roleName` (existing logic is correct — owner path uses `user.role`, visitor path uses `/api/User/{id}`).
2. Build a `dataBundle` per role via a new hook `usePublicProfileData(roleName, targetUserId)` that:
   - For all roles: calls `useProfile`, `useProfileExtras`, `useAuthorFlair`, `useFollowCounts`.
   - For Lecturer additionally: calls `researchGroupService.getAll()`, `seminarService.getAll()`, `learningMaterialService.getAll()` (all client-side filtered — same pattern as `profileExtras.service.ts`).
   - For Graduate Student additionally: calls `groupMemberService.getAll()`, `phasedReportService.getAll()`, `seminarParticipantService.getAll()` filtered by user id.
3. Pass `dataBundle` into the matching `RolePublicView` component.
4. `ProfileEditForm` and tabbed extras (Forum / Publications / Badges) stay exactly as they are today — only the read-mode `<ProfileView />` slot is replaced.
5. Page header eyebrow / title for visitors switches per role (e.g., "Public Profile — Dr. Maya Tran / Verified Reviewer").

In [`src/pages/Profile/Profile.module.css`](src/pages/Profile/Profile.module.css):

- Keep `.identityCard`, `.followRow`, `.roleBadge`, `.flairRow`, `.emptyBadge`, `.spinner` as-is (used by the shell).
- Remove or reduce the generic `.viewCard` / `.viewGrid` since they are only used by the old `<ProfileView />`. Replace usage with role-specific views that ship their own CSS modules.
- TrialCountdownCard styling unchanged.
- Add `.publicView` wrapper class to give role views a consistent max-width and spacing token (consistent with `.viewCard`).

## Hook Surface

`src/hooks/usePublicProfileData.ts` (new):

```ts
export type PublicProfileRole = 'Reviewer' | 'Researcher' | 'Lecturer' | 'Graduate Student';

export interface PublicProfileData {
  profile: Profile | null;
  extras: { publications: ProfilePublicationPreview[]; forumPosts: ProfileForumPostPreview[] };
  // Role-specific bundles, populated only for the matching role:
  reviewer?: {
    isAvailable: boolean | null;
    hindex: number | null;
    totalCitations: number | null;
    publicationCount: number | null;
    majorFieldName: string | null;
    subFieldName: string | null;
    expertiseChips: string[];
  };
  researcher?: {
    hindex: number | null;
    totalCitations: number | null;
    publicationCount: number | null;
    activeSince: string | null;
    publications: Array<PublicationRow & { year: number; type: string; status: string }>;
    yearStream: Array<{ year: number; count: number }>;
  };
  lecturer?: {
    upcomingSeminars: PublicSeminarRow[];
    seminarsHostedCount: number;
    publicGroups: PublicGroupRow[];
    materialsCount: number;
  };
  graduateStudent?: {
    primaryGroup: PublicGroupRow | null;
    groups: PublicGroupRow[];
    reportMilestones: ReportMilestoneRow[];
    seminarsAttendedCount: number;
    reportsSubmittedCount: number;
    joinedYear: number | null;
  };
}

export function usePublicProfileData(
  role: PublicProfileRole | null,
  userId: number | null,
): PublicProfileData;
```

The hook is a thin orchestrator over the existing services — no new endpoints, no BE contract changes.

## Bilingual Copy

Add new i18n keys under `profile.publicView.*` in both [`src/i18n/dictionaries/en.ts`](src/i18n/dictionaries/en.ts) and [`src/i18n/dictionaries/vi.ts`](src/i18n/dictionaries/vi.ts), following the existing `split-translations.mjs` flow. Keys include:

- `profile.publicView.eyebrow.{reviewer,researcher,lecturer,gradStudent}`
- `profile.publicView.section.{expertise,contribution,publicationRegister,calendar,groups,activity,path}`
- `profile.publicView.footnote.{reviewer,researcher,lecturer,gradStudent}`
- `profile.publicView.metric.{seminarsHosted,researchGroups,materials,activeSince,publishedPapers,reportsSubmitted,seminarsAttended,joinedYear}`
- `profile.publicView.table.column.{id,year,type,title,status,date,event,state}`
- `profile.publicView.privacy.reviewer`, `…researcher`, `…lecturer`, `…gradStudent`

Each string is translated for both EN and VI.

## Acceptance & Verification

Run after implementation:

1. TypeScript build (`tsc -b`) clean — no `any` casts, no unused locals.
2. Open each role's profile in a local browser session and screenshot:
   - `/profile/<reviewerId>` → forest-green identity, contribution tiles, publication stream.
   - `/profile/<researcherId>` → amber identity, publication register table, year chart.
   - `/profile/<lecturerId>` → burgundy identity, academic calendar, public groups list.
   - `/profile/<gradStudentId>` → slate-blue identity, milestone path strip, contribution markers.
3. Same role viewed by the owner (read mode) renders the same layout, with a thin "Account contact" strip showing the existing owner-only fields (phone, address, DOB, gender, email) above the role view — visitors never see this strip.
4. Switching to edit mode renders the existing `ProfileEditForm` unchanged.
5. Empty states: each section card has an honest empty state (no fabricated values). E.g. Lecturer with no upcoming seminars renders "No upcoming seminars." with the burgundy section shell.
6. Loading and error states copy the existing pattern from `ProfileView` (skeleton rows + retry banner).
7. Light + dark theme — both render correctly (uses existing semantic tokens, no hard-coded colors).
8. Mobile 320px+ — section cards collapse gracefully (uses the same `1fr → 1fr` breakpoint as `.formGrid`).
9. `prefers-reduced-motion` respected — no new motion introduced beyond what already exists in the page.
10. Verify Swagger contract unchanged: no new endpoints, no new fields on `ProfileUpdateRequest`. The Profile page still sends only the keys declared in `PROFILE_UPDATE_KEYS`.

## Out of Scope (explicit)

- New BE endpoints (`by-author`, `by-host`, `by-student`) — current implementation filters client-side per the existing pattern in `profileExtras.service.ts`. A separate BE ticket is the right path.
- Admin public profile — ASCII did not include it. Admin self-view continues to render the current `ProfileView` until a separate design pass.
- Animations beyond existing transition tokens — no new motion is added unless the role view requires a meaningful cue (e.g. a year-stream fill animation), and then only with `prefers-reduced-motion` honored.
- Real "next academic goal" / "earned records" data — these are intentionally omitted; the system has no source.