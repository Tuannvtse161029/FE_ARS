# ARS Role-Function Test Matrix

> Built from live inspection of `src/routes/paths.ts`, `RoleRouteGuard`, `SubscriptionRouteGuard`, and the MainLayout sidebar nav. Routes reflect the current ARS implementation.

## Legend

| Symbol | Meaning |
|---|---|
| ✅ | Route is accessible for this role |
| ❌ | Route is blocked (redirect to role landing or /login) |
| — | Route does not exist for this role |
| ⚠️ | Route accessible only when subscription is ACTIVE; otherwise redirects to `/subscription` |

## Role → Route Matrix

| Route | Admin | Reviewer | Graduate Student | Researcher | Lecturer | Guest |
|---|---|---|---|---|---|---|
| `/` (Landing) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/login` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/forum` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/home` (Discover Research) | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| `/admin` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `/admin/role-requests` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `/admin/paper-submissions` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `/admin/accounts` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `/admin/transactions` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `/admin/packages` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `/admin/annual-fees` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `/admin/audit-logs` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `/admin/published-papers` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `/admin/reviewer-assignments` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `/reviewer/assignments` | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `/reviewer/professional-profile` | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `/evaluation` | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `/papers` → `/researcher/submissions` | ❌ | ❌ | ❌ | ✅ ⚠️ | ❌ | ❌ |
| `/researcher/submissions` | ❌ | ❌ | ❌ | ✅ ⚠️ | ❌ | ❌ |
| `/researcher/submissions/new` | ❌ | ❌ | ❌ | ✅ ⚠️ | ❌ | ❌ |
| `/researcher/submissions/:id` | ❌ | ❌ | ❌ | ✅ ⚠️ | ❌ | ❌ |
| `/student/dashboard` | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| `/student/research-groups` | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| `/submit-report` | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| `/seminar-workspace` | ✅ | ✅ | ✅ | ✅ ⚠️ | ✅ ⚠️ | ❌ |
| `/research-group` | ❌ | ❌ | ❌ | ❌ | ✅ ⚠️ | ❌ |
| `/configure-milestones` | ❌ | ❌ | ❌ | ❌ | ✅ ⚠️ | ❌ |
| `/lecturer/evaluate-reports` | ❌ | ❌ | ❌ | ❌ | ✅ ⚠️ | ❌ |
| `/lecturer/phase-reports` | ❌ | ❌ | ❌ | ❌ | ✅ ⚠️ | ❌ |
| `/lecturer/guidance-projects` | ❌ | ❌ | ❌ | ❌ | ✅ ⚠️ | ❌ |
| `/lecturer/research-topics` | ❌ | ❌ | ❌ | ❌ | ✅ ⚠️ | ❌ |
| `/lecturer/learning-materials` | ❌ | ❌ | ❌ | ❌ | ✅ ⚠️ | ❌ |
| `/lecturer/shared-materials` | ❌ | ❌ | ❌ | ❌ | ✅ ⚠️ | ❌ |
| `/lecturer/groups/:groupId` | ❌ | ❌ | ❌ | ❌ | ✅ ⚠️ | ❌ |
| `/subscription` | — | — | — | ✅ | ✅ | ❌ |
| `/subscription/return` | — | — | — | ✅ | ✅ | ❌ |
| `/profile` | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| `/account-settings` | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| `/verify-email` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/complete-google-registration` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

## Notes

- **Subscription gate applies to:** Researcher, Lecturer only.
- **Subscription gate does NOT apply to:** Admin, Reviewer, Graduate Student, Guest.
- **Forum:** All roles including Guest can view Forum (read-only for Guest). Researcher/Lecturer with inactive subscription see read-only Forum (interaction disabled).
- **Guest:** Unauthenticated. Redirected to `/login` for any protected route. Can view Landing, Login, Forum (read-only), Verify Email.
- **`⚠️` routes:** Redirect to `/subscription` when subscription is inactive/expired/missing. The `/subscription` route itself is always accessible so users can renew.
- **BE enforcement:** Frontend guards are defense-in-depth. Backend must enforce `403 SUBSCRIPTION_EXPIRED` on protected endpoints.

## Safe Actions vs. Blocked Actions

| Action | Safe to Execute in E2E | Reason |
|---|---|---|
| Login | ✅ | Read-only auth flow |
| Navigate to protected route | ✅ | No data mutation |
| Check button visibility | ✅ | Read-only observation |
| Fill text fields | ✅ | No submission |
| Click "Proceed to Pay" (BE missing) | ❌ | Would fail; no BE contract |
| Submit approval/rejection | ❌ | Irreversible role change |
| Submit paper/recommendation | ❌ | Publishes content |
| Submit report | ❌ | Modifies state |
| Create topic/material/group | ❌ | Modifies state |
| PayOS QR payment | ❌ | Financial transaction |
| Wallet top-up / withdrawal | ❌ | Financial transaction |
| Upload PDF | ❌ | File creation |
| Delete content | ❌ | Destructive |

## Test File Coverage

| File | Roles | Focus |
|---|---|---|
| `specs/public.spec.ts` | Public | Landing, login, guard |
| `specs/admin.spec.ts` | Admin | Workspace, nav, role guard |
| `specs/researcher.spec.ts` | Researcher | Workspace, submission, subscription gate |
| `specs/lecturer.spec.ts` | Lecturer | Workspace, management, subscription gate |
| `specs/graduate-student.spec.ts` | Graduate Student | Dashboard, groups, guard |
| `specs/reviewer.spec.ts` | Reviewer | Assignments, profile, guard |
| `specs/subscription-access.spec.ts` | Researcher, Lecturer, Admin, Reviewer, Grad Student | Subscription gate, PayOS return, forum read-only |
