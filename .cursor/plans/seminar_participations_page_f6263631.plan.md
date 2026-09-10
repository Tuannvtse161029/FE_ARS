---
name: Seminar Participations Page
overview: Add a new Seminar Participations page for invited roles (Reviewer, Graduate Student, and Researcher-as-attendee) and add an in-page "My Participations" tab to the existing Seminar workspace for organizer roles (Lecturer, Researcher). All participation data flows through the existing live BE endpoints (GET /api/Seminar/my-invitations, POST /api/Seminar/{id}/feedback, PUT /api/SeminarParticipant/{id}) so no mocks are introduced.
todos:
  - id: t1-routes
    content: Add ROUTES.SEMINAR_PARTICIPATIONS constant in src/routes/paths.ts
    status: completed
  - id: t2-service
    content: Extend src/services/seminar.service.ts with acceptInvitation / declineInvitation PUT wrappers
    status: in_progress
  - id: t3-hook
    content: Create src/features/seminars/hooks/useSeminarParticipations.ts (search + filter + refetch)
    status: pending
  - id: t4-table
    content: Create src/features/seminars/components/ParticipationTable.tsx + .module.css (search bar, refresh, status filter tabs, table rows, action buttons, ConfirmModal hand-offs)
    status: pending
  - id: t5-page
    content: Create src/pages/Seminar/SeminarParticipationsPage.tsx + .module.css (PageHeader + ParticipationTable)
    status: pending
  - id: t6-workspace-tab
    content: Extend src/features/seminars/SeminarWorkspace.tsx with workspace-level tab strip ('manage' / 'participate') that swaps the body between SeminarList and ParticipationTable
    status: pending
  - id: t7-sidebar
    content: Add 'Seminar Participations' sidebar item in src/layouts/MainLayout.tsx for Lecturer / Researcher / Reviewer / Graduate Student
    status: pending
  - id: t8-app-route
    content: Register the new lazy route in src/App.tsx behind RoleRouteGuard + SubscriptionRouteGuard
    status: pending
  - id: t9-build
    content: Run npm run build and run lint to confirm no regressions
    status: pending
isProject: false
---

# Seminar Participations Feature Plan

## 1. Surface & Routing

### Two entry points

**A. Inside existing workspace (Lecturer + Researcher-as-organizer).**
Extend `src/features/seminars/SeminarWorkspace.tsx` with an in-page tab strip ("Manage Seminars" / "My Participations") — switching tabs swaps the toolbar + list without changing the route. The "My Participations" tab renders the same table component as the new dedicated page. Reuses the same URL (`/seminar-workspace`) so the existing sidebar link stays correct.

**B. New dedicated route (Reviewer + Graduate Student + Researcher-as-attendee).**
A new top-level page at `/seminar-participations` mounted behind a role guard for `['Reviewer', 'Graduate Student', 'Researcher', 'Lecturer']`. A new sidebar item "Seminar Participations" is added to those four roles in `src/layouts/MainLayout.tsx`. Lecturer/Researcher sees both the existing "Seminar" sidebar entry **and** the new "Seminar Participations" entry.

### New route constant (`src/routes/paths.ts`)

```ts
SEMINAR_PARTICIPATIONS: '/seminar-participations',
```

### New lazy route (`src/App.tsx`)

```tsx
const SeminarParticipationsPage = lazy(() =>
  import('./pages/Seminar/SeminarParticipationsPage').then((m) => ({
    default: m.SeminarParticipationsPage,
  }))
);

<Route element={<RoleRouteGuard allow={['Reviewer', 'Graduate Student', 'Researcher', 'Lecturer']} />}>
  <Route element={<SubscriptionRouteGuard />}>
    <Route path={ROUTES.SEMINAR_PARTICIPATIONS} element={<SeminarParticipationsPage />} />
  </Route>
</Route>
```

(The `SubscriptionRouteGuard` is included because Lecturer/Researcher cross through this surface; Reviewer/Graduate Student are not on paid plans but keep the gate consistent with the workspace.)

### Sidebar update (`src/layouts/MainLayout.tsx` — `getNavItemsByRole()`)

- Lecturer: append `SeminarParticipations` after the existing `SEMINAR_WORKSPACE` link.
- Researcher: append `SeminarParticipations` after the existing `SEMINAR_WORKSPACE` link.
- Reviewer: add `SeminarParticipations` (currently has no Seminar link).
- Graduate Student: add `SeminarParticipations`.
- Admin: no change (admin does not own seminars).

## 2. Files to Create / Modify

### New files

- `src/pages/Seminar/SeminarParticipationsPage.tsx` — full page, wraps the table.
- `src/pages/Seminar/SeminarParticipationsPage.module.css` — page chrome (header, section padding, empty states).
- `src/features/seminars/components/ParticipationTable.tsx` — the shared table.
- `src/features/seminars/components/ParticipationTable.module.css` — table styles.
- `src/features/seminars/hooks/useSeminarParticipations.ts` — fetch + state.

### Modified files

- `src/services/seminar.service.ts` — add `acceptInvitation` / `declineInvitation` (PUT to `/api/SeminarParticipant/{id}` with the `invitationStatus` field per user choice **q1a**).
- `src/features/seminars/SeminarWorkspace.tsx` — add in-page tab state + toolbar.
- `src/features/seminars/components/SeminarList.tsx` — no change; stays for organizer-side cards.
- `src/layouts/MainLayout.tsx` — append two new nav entries.
- `src/routes/paths.ts` — append `SEMINAR_PARTICIPATIONS`.
- `src/App.tsx` — register the new lazy route.

## 3. Data Hooks

### `useSeminarParticipations` (`src/features/seminars/hooks/useSeminarParticipations.ts`)

```ts
export interface UseSeminarParticipationsResult {
  rows: ParticipationRow[];
  invitations: ParticipationRow[];
  seminars: ParticipationRow[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

interface ParticipationRow {
  seminarId: number;
  title: string;
  detail: string;
  startTime: string;       // ISO
  endTime: string | null;
  onlineLink: string | null;
  organizerName: string | null;
  invitationStatus: 'PENDING' | 'INVITED' | 'SUBMITTED' | 'DECLINED';
  participantSubmitted: boolean;  // derived from feedbackSubmittedAt != null (ticket §19)
  feedbackJson: string | null;
}
```

Implementation reuses `seminarService.getMyInvitations()` (already calls `GET /api/Seminar/my-invitations`) plus `seminarParticipantService.getMySeminars()` and joins the two on `seminarId` to compute the display rows. `invitationStatus` is normalized via the existing `mapParticipantStatus()` helper from `src/services/seminar.service.ts`. All seminar `startTime`/`endTime` strings are routed through `parseApiDateTimeAsUtc` from `src/utils/datetime.ts` per the **Seminar Date/Time Handling** rule.

### `useAcceptInvitation` / `useDeclineInvitation`

Both call `seminarService` methods that wrap `PUT /api/SeminarParticipant/{id}` with body `{ invitationStatus: 'Accepted' | 'Declined' }` per the user's choice **q1a**. Mapping per the existing `mapParticipantStatus`:

- `'Accepted' | 'Confirmed' | 'Invited'` → UI status `INVITED`.
- `'Declined' | 'Rejected'` → UI status `DECLINED`.

After each mutation the hook calls `refetch()` so the table refreshes.

## 4. UI — ParticipationTable

A single table component (reused by both the new page and the workspace tab) with this structure.

### Toolbar (top)

- **Search input** — client-side filter over `title` (case-insensitive `includes`); bound to local state `searchQuery`. Debounced 200 ms.
- **Refresh button** — calls `refetch()`. Loading state shows a spinner.
- **Status filter tabs** — `All`, `Invitations`, `Upcoming`, `In Progress`, `Completed`. The "Invitations" tab filters rows where `invitationStatus === 'PENDING' || 'INVITED' && startTime >= now`; the other tabs reuse `deriveEffectiveStatus(status, endTime)` from `src/services/seminar.service.ts`.
- **Result count** — `Showing N of M seminars`.

### Table columns

| Col | Source | Notes |
| --- | --- | --- |
| Seminar Name | `title` | text-only cell |
| Detail | `detail` | truncated to 140 chars with ellipsis |
| Time Started | formatted via `formatDisplayDate` + `formatDisplayTime` after `parseApiDateTimeAsUtc` | local wall clock, locale-aware |
| Status | status pill matching existing palette | uses `deriveEffectiveStatus` |
| Actions | per-row stack of buttons (see below) |  |

### Action buttons (per row, mutually exclusive depending on row state)

| Row state | Primary action | Secondary action |
| --- | --- | --- |
| `invitationStatus === 'PENDING'` and `startTime > now` | **Accept** (`variant="primary"`, accepts the invitation, then refetches) | **Reject** (`variant="destructive"`, opens `ConfirmModal` per **No Native Browser Dialogs**) |
| `invitationStatus === 'INVITED'` and `startTime > now` | **Participate** → `window.open(onlineLink, '_blank', 'noopener')` (disabled until `now >= startTime`) | **Reject** (opens `ConfirmModal`, then sends `Declined` PUT) |
| `effectiveStatus === 'IN PROGRESS'` | **Participate** (enabled) | — |
| `effectiveStatus === 'COMPLETED'` and not submitted | **Submit Feedback** → opens `SeminarFeedbackModal` with `previewMode={false}`, `hasSubmittedBefore={false}` | — |
| `effectiveStatus === 'COMPLETED'` and already submitted | **View Feedback** → opens `SeminarFeedbackModal` in read-only mode (uses existing `previewMode` flag per user choice **q2a**) | — |

The Google Meet URL is **never** rendered as a clickable link in the UI per the user's instruction — the only way to join is the Participate button. `onlineLink` is passed straight to `window.open(...)` from the button's `onClick`.

### Disabled-state rule for "Participate"

The button is disabled while `now < startTime`. Implementation computes `now >= startTimeMs` (where `startTimeMs = parseApiDateTimeAsUtc(startTime)?.getTime() ?? Number.POSITIVE_INFINITY`). Tooltip on disabled state: "The seminar will start at {local start time}."

## 5. SeminarFeedbackModal reuse (per user choice **q2a**)

For "View Feedback" we reuse `src/components/seminar/SeminarFeedbackModal.tsx` and pass `previewMode={true}`. The modal already supports a read-only/preview state via its `previewMode` flag — the existing dynamic-question renderer (`DynamicQuestionRenderer`) honours `previewMode` by setting `disabled`.

For "Submit Feedback" / "Edit Feedback" we open the same modal with `previewMode={false}`; the modal's `hasSubmittedBefore` prop drives the "Submit Feedback" → "Edit Feedback" copy flip, and `existingDynamicAnswersRaw` is the participant's own `feedbackJson` decoded via `parseParticipantAnswers` (already implemented in the existing file).

After a successful submit the modal calls `onSuccess={refetch}` so the row badge flips to "View Feedback".

## 6. SeminarWorkspace in-page tab (organizer-side)

`src/features/seminars/SeminarWorkspace.tsx` gains:

```ts
type WorkspaceTab = 'manage' | 'participate';
const [activeWorkspaceTab, setActiveWorkspaceTab] = useState<WorkspaceTab>('manage');
```

A small tab strip above the existing toolbar swaps the body:

- `manage` → existing JSX (filter tabs + `<SeminarList ... />`).
- `participate` → `<ParticipationTable />` with the same hook state.

The "Create Seminar" button only renders when `activeWorkspaceTab === 'manage' && canModify`. The lecturer-side status tab strip stays inside the `manage` view; the `participate` view uses the dedicated Status filter tabs from §4.

## 7. Page chrome (`SeminarParticipationsPage.tsx`)

- `PageHeader` with eyebrow `WORKSPACE` and title `Seminar Participations` (consistent with existing header pattern; see `src/components/PageHeader.tsx`).
- `<ParticipationTable />` body.
- ErrorBanner if the BE call fails.
- No mock fallback; if BE returns [] the existing `EmptyState` is rendered instead.

CSS uses the Paper Day tokens (`--surface-raised`, `--accent-primary`, `--border-subtle`, `--font-family-serif` for the page heading, `--font-family-ui` for the controls) per the **ARS Paper Day Theme** rule. No hard-coded colours.

## 8. Datetime Rule Compliance

Every place the page reads `startTime` / `endTime` it uses `parseApiDateTimeAsUtc` from `src/utils/datetime.ts`. The booking is:

- Status comparison (`deriveEffectiveStatus` already does this internally).
- Display via `formatDisplayDate`, `formatDisplayTime`, `formatDisplayDateTime`.
- Disabled-state calculation for the Participate button.

No `new Date(startTime)` calls are introduced; no per-site `±7` offsets; the existing centralised helper is the only parser for these fields.

## 9. Auth / Storage Compliance

No new secrets; no new env vars; no new localStorage keys. The page reads the existing JWT from `useAuthStore` exactly like `SeminarWorkspace` does today.

## 10. Effort Distribution

Per the **Code Contribution Ratio** rule the user writes 75-80% of the actual code themselves; this plan provides the structure and the critical wiring decisions. AI-assisted portions are:

- The `ParticipationRow` interface shape and the column-to-source mapping.
- The Accept/Reject service methods (`acceptInvitation`, `declineInvitation`) wrapping the PUT contract.
- The disabled-state predicate for the Participate button.

The user writes the table JSX, the toolbar (search/refresh/filter) wiring, the modal hand-offs, and the workspace tab swap.

## 11. Out of Scope

- No backend changes.
- No notification triggers — accept/reject do not currently emit a notification; if needed it would be a separate ticket.
- No email reminders from this page — those are owned by the host-side `Send Invite Link` button.
- No analytics dashboards for participation history (future ticket if requested).
- No bulk Accept / Decline (one row at a time, per participant-owned invitation).

## Open Items / Risks

- The exact accepted status string the BE stores ("Accepted" vs "Confirmed" vs "Invited") will be confirmed after first integration. The wrapper tries `'Accepted'` first, falls back to the existing `mapParticipantStatus` output for `null` responses.
- The participation-tab on the workspace only shows rows for the current user — for the Lecturer this overlaps with the Manage tab. The two tabs are independent lists so there is no double-fetch risk: each tab calls its own hook.