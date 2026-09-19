# ARS Platform — Frontend

> Academic Research Sharing (ARS) — the web client for managing research papers, peer reviews, seminars, research groups, and student supervision in a multi-role academic environment.

## Table of Contents

- [What is ARS?](#what-is-ars)
- [Repository Scope](#repository-scope)
- [Business Scope & Roles](#business-scope--roles)
- [Role-Driven Feature Map](#role-driven-feature-map)
  - [System Admin](#system-admin)
  - [Lecturer](#lecturer)
  - [Researcher](#researcher)
  - [Reviewer](#reviewer)
  - [Graduate Student](#graduate-student)
- [Tech Stack](#tech-stack)
- [Frontend Design & Localization Rule](#frontend-design--localization-rule)
- [Quick Start](#quick-start)
- [Prerequisites](#prerequisites)
- [Environment Variables](#environment-variables)
- [Available Scripts](#available-scripts)
- [Project Structure](#project-structure)
- [Barrel Files](#barrel-files)
- [Internationalization](#internationalization)
- [API Reference](#api-reference)
- [Project Integration](#project-integration)
- [API integration surface](#api-integration-surface)
- [Service layer](#service-layer)
- [Third-party libraries](#third-party-libraries)
- [Recent incident reports](#recent-incident-reports)
- [Testing](#testing)
- [Contributing](#contributing)
- [License](#license)
- [Related Repositories](#related-repositories)

---

## What is ARS?

The **Academic Research Sharing Platform** is a capstone-grade academic collaboration tool that connects five user roles — **System Admins**, **Lecturers**, **Researchers**, **Reviewers**, and **Graduate Students** in a shared academic workflow. It supports paper discovery, research collaboration, review lifecycle management, seminar coordination, role switching, and community moderation across a single production-grade frontend shell.

This repository hosts the **frontend web client** built with React, TypeScript, and Vite. It talks to a separate .NET Core REST backend (MySQL + Firebase Cloud Storage) over JSON.

---

## Repository Scope

This repo is the **frontend only**. We deliberately keep the following out of scope — they live in separate repos or are owned by the backend team:

- Database schema, migrations, and ORM code
- ASP.NET Core controllers, business logic, JWT issuance
- Firebase Admin SDK (this client uploads PDFs to Storage via the public web SDK)
- CI / CD pipelines, Dockerfiles, server infra
- API contract definitions (we **consume** the Swagger contract — we do not author it)

If you find yourself reaching for one of the above, double-check before you do.

---

## Tech Stack

| Concern              | Tech Stack Used                            |
| -------------------- | ------------------------------------------ |
| UI Framework         | React 18                                   |
| Language             | TypeScript 5.6 (strict)                    |
| Build Tool           | Vite 6                                     |
| Routing              | React Router DOM 7                         |
| State Management     | Zustand                                    |
| Forms                | React Hook Form + Yup                      |
| HTTP                 | Axios                                      |
| PDF Rendering        | PDF.js, pdf-lib                            |
| File Storage         | Firebase Cloud Storage (browser SDK)       |
| Charts               | Recharts                                   |
| Icons                | Lucide React                               |
| Styling              | CSS Modules (no global utility framework)  |
| Unit Tests           | Vitest + Testing Library                   |
| E2E Tests            | Playwright                                 |

---

## Frontend Design & Localization Rule

This rule is mandatory for every new or modified UI component, page, modal, notification, empty state, and form in the ARS frontend.

Before changing UI code, inspect the existing project theme tokens, typography styles, localization setup, and installed dependencies. Reuse them; do not create a parallel design system.

### 1. Theme and color system

- ARS uses a yellow, white, and black/charcoal visual identity.
- Use the project’s existing CSS variables, tokens, shared components, and approved color variants.
- Do not hardcode arbitrary hex colors when an existing token or component variant exists.
- Do not introduce unrelated palettes, gradients, neon colors, or inconsistent button colors.
- Preserve accessible contrast in all normal, hover, focus-visible, active, disabled, loading, light-mode, and dark-mode states.
- For dark/yellow filled buttons, ensure text and icons remain readable; use the project-approved white foreground when appropriate.

### 2. Icons

- Use the existing `lucide-react` icon library already implemented in the project.
- Reuse existing shared icon wrappers and icon conventions where available.
- Do not use emoji, Unicode symbols, random SVG files, Font Awesome, Material Icons, image icons, or a new icon library unless the project owner explicitly approves it.
- Use icons that accurately describe the action and include accessible labels/tooltips where required.

### 3. Language and localization

- Every application-controlled user-facing string must match the currently selected system language.
- When the locale is English, do not show Vietnamese labels, placeholders, validation messages, button text, status labels, modal text, empty states, success/error toasts, or help text.
- When the locale is Vietnamese, use Vietnamese translations consistently.
- Use the project’s translation mechanism and translation keys; do not hardcode new English or Vietnamese strings directly inside components.
- Keep user-generated content, paper titles, abstracts, names, uploaded documents, and external source metadata in their original language.
- After modifying a page, check the full screen for mixed-language UI text.

### 4. Typography

- Use the project’s existing font stack and typography tokens, including Roboto and any established editorial-heading font.
- Do not introduce a new web font, inline `font-family`, or unrelated typography style without approval.
- Reuse shared text, heading, label, table, button, and form styles.
- Keep font size, weight, line height, and spacing consistent with nearby ARS screens.

### 5. Required completion check

Before declaring UI work complete:

1. Confirm colors use existing ARS theme tokens/components.
2. Confirm all icons come from `lucide-react`.
3. Test the page in English and Vietnamese and remove mixed-language interface text.
4. Confirm typography uses existing project styles.
5. Check hover/focus/disabled states and responsive layout.
6. Report any missing theme token, icon, translation key, or font rule instead of inventing a new pattern.

> If an existing screen violates this rule, preserve the rule for all new work and flag the inconsistency for a separate, scoped cleanup task.

---

## Quick Start

```bash
# 1. Clone
git clone <repository-url>
cd ARS_FE

# 2. Install dependencies
npm install

# 3. Configure environment (see Environment Variables below)
cp .env.example .env.local
# …then edit .env.local with your local values

# 4. Start the dev server
npm run dev

# 5. Visit the printed URL (default: http://localhost:3000)
```

You will need a reachable backend (or a local mock). The default `VITE_API_BASE_URL` points at the public Swagger host — see [API Reference](#api-reference).

### Prerequisites

- **Node.js** 24 LTS (or newer)
- **npm** ≥ 11 (or pnpm / yarn with equivalent lockfiles)

---

## Environment Variables

All env vars are **public** values consumed at build time via `import.meta.env.VITE_*`. No real secrets should ever be committed — the `.env.example` file documents every key with empty placeholders; fill in local overrides in `.env.local`.

| Variable | Required | Purpose |
| --- | --- | --- |
| `VITE_API_BASE_URL` | ✅ | Backend REST root (e.g. `https://arsplatform.onrender.com`) |
| `VITE_FIREBASE_API_KEY` | ✅ | Firebase web SDK API key |
| `VITE_FIREBASE_AUTH_DOMAIN` | ✅ | Firebase auth domain |
| `VITE_FIREBASE_PROJECT_ID` | ✅ | Firebase project id |
| `VITE_FIREBASE_STORAGE_BUCKET` | ✅ | Firebase Storage bucket |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | ✅ | Firebase messaging sender id |
| `VITE_FIREBASE_APP_ID` | ✅ | Firebase app id |
| `VITE_GOOGLE_CLIENT_ID` | ⚠️ | Google OAuth (only if Google sign-in is enabled) |

> **Never** commit `.env.local`, `.env.*.local`, `appsettings.Development.json`, or any file containing real credentials. See [SECURITY](docs/local-only/SECURITY.md) (if present locally) for the local-only security guidance.

---

## Available Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the dev server with memory-optimized settings |
| `npm run dev:raw` | Start raw Vite dev server (no memory helpers) |
| `npm run build` | Production build → `dist/` |
| `npm run preview` | Preview the production build locally |
| `npm run lint` | ESLint over the project |
| `npm test` | Vitest unit tests |
| `npm run test:integration` | Integration test suite |
| `npm run test:coverage` | Generate coverage report |
| `npm run test:e2e` | Playwright end-to-end tests |
| `npm run node:check` | List Node processes and memory |
| `npm run node:clean` | Dry-run stale-process cleanup |
| `npm run node:clean:apply` | Kill stale Node processes |
| `npm run docs:toc` | Refresh the README table of contents in place |
| `npm run docs:tree:check` | Report drift between the README tree and `src/` |
| `npm run docs:tree:write` | Overwrite the README tree with a plain (un-annotated) regeneration |
| `npm run docs:sync` | Run `docs:toc` then `docs:tree:check` |

---

## Project Structure

```bash
# ARS Platform — Frontend
src/
├── assets/
│   ├── badges/
│   ├── icons/
│   ├── images/
│   ├── logo/
│   ├── pdf/
│   ├── pdf_sample/
│   └── videos/
├── components/
│   ├── Button/
│   ├── FieldError/
│   ├── InlineNotice/
│   ├── Input/
│   ├── LoadingTaskWidget/
│   ├── PdfViewer/
│   ├── RoleExploreModal/
│   ├── WelcomeBackBanner/
│   ├── admin/
│   ├── auth/
│   ├── common/
│   ├── forum/
│   ├── gradstudent/
│   ├── i18n/
│   ├── identity/
│   ├── lecturer/
│   ├── medals/
│   ├── notification/
│   ├── openalex/
│   ├── orcid/
│   ├── profile/
│   ├── research/
│   ├── researcher/
│   ├── reviewer/
│   ├── seminar/
│   ├── shortcuts/
│   ├── subscription/
│   ├── table/
│   └── workspace/
├── config/
├── context/
├── features/
│   ├── admin/
│   ├── guidance/
│   ├── publication/
│   └── seminars/
├── hooks/
├── i18n/
│   └── dictionaries/
├── layouts/
├── lib/
├── pages/
│   ├── Admin/
│   ├── Auth/
│   ├── CompleteGoogleRegistration/
│   ├── Forum/
│   ├── GoogleCallback/
│   ├── GraduateStudent/
│   ├── Landing/
│   ├── Lecturer/
│   ├── Legal/
│   ├── Login/
│   ├── Notifications/
│   ├── OrcidCallback/
│   ├── Profile/
│   ├── Register/
│   ├── ResetPassword/
│   ├── Reviewer/
│   ├── Seminar/
│   └── Subscription/
├── routes/
├── scrollcraft/
├── services/
├── store/
├── styles/
├── types/
├── utils/
```

---

## Barrel Files

The following folders maintain index barrel files for clean re-exports:

| Folder | Barrel | Purpose |
| -------- | -------- | --------- |
| `src/hooks/` | `index.ts` | Re-exports all hooks |
| `src/store/` | `index.ts` | Re-exports store slices |
| `src/components/Button/` | `index.ts` | Button component exports |
| `src/components/Input/` | `index.ts` | Input component exports |
| `src/components/PdfViewer/` | `index.ts` | PDF viewer exports |
| `src/components/FieldError/` | `index.ts` | FieldError exports |
| `src/components/workspace/` | `index.ts` | Workspace component exports |
| `src/pages/Forum/` | `index.ts` | Forum page re-export |
| `src/pages/Landing/` | `index.ts` | Landing page re-export |
| `src/pages/Login/` | `index.ts` | Login page re-export |
| `src/pages/Register/` | `index.ts` | Register page re-export |
| `src/pages/GoogleCallback/` | `index.ts` | Google callback re-export |
| `src/assets/icons/` | `index.ts` | Icon re-exports |
| `src/assets/badges/` | `index.ts` | Badge re-exports |

> **Note**: Most folders intentionally do NOT have barrel files (e.g., `src/components/`, `src/pages/`, `src/services/`) to enable better tree-shaking and explicit imports.

---

## Business Scope & Roles

ARS exists to give a single multi-role academic team a complete workspace for the full life cycle of a research paper, a semester of student supervision, and a community of practice. The platform deliberately keeps **five user roles** plus a transient **Guest** state in the same shell and gates every page server-side via the BE JWT claims, so a user can hold multiple roles and switch between them without losing state. The role mapping, route guards, and effective-time states live in `src/types/auth.ts` (`BusinessRole`, `EffectiveRole`), and the per-role sidebar rails are defined in `src/layouts/MainLayout.tsx`.

The deeper reference (which role can do what, with which API, on which route, behind which guard) lives in **[`docs/PROJECT_BUSINESS_SCOPE.md`](docs/PROJECT_BUSINESS_SCOPE.md)**. Treat that document as the canonical "what is the system for?" file when you onboard, plan, or design a new feature.

### Role-Driven Feature Map

The five roles split cleanly into three concerns: **platform stewardship** (Admin), **academic production** (Lecturer + Researcher), and **academic quality + community** (Reviewer + Graduate Student). Each role gets its own sidebar rail, its own landing route, its own service-layer wrappers, and (where it makes sense) its own payment and badge tier.

#### System Admin

**Business purpose**: keep the platform safe, fair, and monetised. Admins are not academic participants — they are the operational steward who decides who gets in, who stays out, and what gets published.

| Capability | Primary route(s) | Key BE endpoints | Notes |
| --- | --- | --- | --- |
| Verify new and upgrade-role applications | `/admin/role-requests` | `GET /api/RoleRequest`, `POST /api/RoleRequest/{id}/approve|reject` | Drives the verification state machine (`Pending → Accepted/Rejected`) |
| Moderation of all user accounts | `/admin/accounts` | `GET/POST /api/Account`, `POST /api/Account/{id}/suspend|unsuspend` | Admin cannot suspend themselves |
| Subscription plan CRUD (Researcher + Lecturer paid plans) | `/admin/annual-fees` | `GET/POST/PUT/PATCH/DELETE /api/AnnualFees`, `/api/AnnualFees/{id}/toggle` | Plans with active subscribers cannot be deactivated |
| Editorial pipeline — paper submissions, reviewer assignment, published catalog | `/admin/paper-submissions`, `/admin/reviewer-assignments`, `/admin/published-papers` | `GET /api/Paper`, `POST /api/Paper/{id}/assign-reviewers[-manual]`, `PUT /api/Paper/{id}/verify-authorship` | Owns the full `SUBMITTED → ADMIN_SCREENING → READY_FOR_REVIEWER → ... → PUBLISHED` state machine |
| Reports / violation queue | `/admin/reports` | `GET /api/ViolationReport`, `POST /api/ViolationReport/{id}/resolve` | Surfaces content reports from any role |
| Transactions and revenue analytics | `/admin/transactions` | `/api/Transactions`, `/api/Analytics/summary`, `/api/Analytics/timeseries` | Charts via Recharts; daily / weekly / monthly / yearly ranges |
| Audit log CSV export | `/admin/audit-logs` | `GET /api/AuditLog`, `GET /api/AuditLog/export` | Compliance trail |
| Policy documents (Privacy / ToS / Researcher + Reviewer responsibilities) | `/admin/policies` | Direct Firestore reads (`policyService`) | No `/api/Policy` endpoint by design |
| Per-SubField grading rubric templates | `/admin/grading-rubric` | `GET /api/SubField`, `PATCH /api/SubField/{id}/rubric` | Drives reviewer scoring |
| Academic medal catalog (tiers, artwork, criteria, recipients) | `/admin/medals` | `GET /api/Medal`, `POST /api/Medal/grant`, `PATCH /api/Medal/admin/user-medal/{userMedalId}/status` | Currently uses the `/api/Medal/*` surface — see ticket for the planned migration to `/api/admin/medals/*` |

#### Lecturer

**Business purpose**: own a research group, run a semester of supervision, and lead the live seminar programme. Lecturers are paid via the annual-fee plan (`/subscription`), gated by `SubscriptionRouteGuard`.

| Capability | Primary route(s) | Key BE endpoints | Notes |
| --- | --- | --- | --- |
| Create and supervise research groups, invite students, accept / reject join requests | `/research-group`, `/lecturer/groups/:groupId` | `GET/POST/PUT/DELETE /api/ResearchGroup`, `POST /api/ResearchGroup/{id}/invite`, `/api/GroupMember/{id}/set-leader`, `/api/lecturer/research-groups/{groupId}/join-requests/{id}/accept|reject` | Delete is blocked while the group has members |
| Research Topics CRUD (open → assigned → completed) | `/lecturer/research-topics` | `GET /api/ResearchTopic/my-topics`, `POST /api/ResearchTopic`, `PUT /api/ResearchTopic/{id}` | Frontend filters to the lecturer's own `userId` |
| Phase / milestone configuration per topic | `/configure-milestones?topicId=…` | `GET /api/PhasedReport/topic-milestones`, `POST /api/PhasedReport` | Topic-scoped deep link `/lecturer/research-topics/:topicId/milestones` redirects here |
| Evaluate phased reports submitted by Graduate Students | `/lecturer/evaluate-reports`, `/lecturer/phase-reports` | `GET /api/PhasedReport`, `POST /api/PhasedReport/{id}/evaluate`, `POST /api/PhasedReport/{id}/extend-deadline` | `Overdue` status derived locally when a deadline lapses |
| Learning + Shared Materials library (per topic + cross-lecturer) | `/lecturer/materials` (cards + table views) | `GET/POST/PUT/DELETE /api/LearningMaterial`, `/api/SharedMaterial`, `/api/PhaseMaterial`, `/api/ResearchTopic/{id}/learning-materials/{materialId}` | Old `/lecturer/learning-materials` and `/lecturer/shared-materials` redirect here |
| Schedule and host seminars (Google Meet generation, feedback collection, AI summaries) | `/seminar-workspace` | `GET/POST/PUT/DELETE /api/Seminar`, `POST /api/Seminar/{id}/feedback-form`, `POST /api/Seminar/{id}/summarize-feedback`, `POST /api/Seminar/{id}/summarize-audio` | Owner-only; participants see the lecturer surface from `/seminar-participations` |
| Annual subscription / PayOS payment | `/subscription` | `POST /api/AnnualFees/{id}/purchase`, `/api/AnnualFees/payos-webhook` | Bounced here by `SubscriptionRouteGuard` if missing / expired |

#### Researcher

**Business purpose**: produce and own scholarly output. Researchers submit papers, track revisions, and (in their capacity as host) run seminars for the academic community.

| Capability | Primary route(s) | Key BE endpoints | Notes |
| --- | --- | --- | --- |
| Authenticated research catalog (browse published papers) | `/home` | `GET /api/Paper`, `GET /api/OpenAlex/works/{workId}` | All four non-Admin roles share this catalog |
| Submit a new manuscript | `/researcher/submissions/new` | `POST /api/Paper`, Firebase Storage direct upload for `pdfUrl` | Researcher submitts metadata + uploads PDF; BE stores the URL |
| Track submission through the editorial state machine | `/researcher/submissions`, `/researcher/submissions/:id` | `GET /api/Paper/by-researcher`, `PUT /api/Paper/{id}` | Same `PUBLISHED / DRAFT / REVISION_REQUIRED / WITHDRAWN` machine |
| Authorship verification (ORCID + Semantic Scholar + OpenAlex) | (inline on submission detail) | `POST /api/Paper/{id}/verify-authorship`, ORCID OAuth callback `/auth/orcid/callback` | Restricted to ORCID-eligible roles (Researcher / Reviewer / Lecturer) |
| Host a seminar (for Researcher-as-organiser) | `/seminar-workspace` | Same `/api/Seminar/*` set | The Researcher-as-organiser flow shares the Lecturer surface; `SubscriptionRouteGuard` applies |
| Annual subscription / PayOS payment | `/subscription` | `/api/AnnualFees` | Same gate as Lecturer |

#### Reviewer

**Business purpose**: provide independent peer-review of manuscripts, get paid for it, and stay discoverable to admins who need to assign reviewers. Reviewers do **not** publish, assign, or supervise.

| Capability | Primary route(s) | Key BE endpoints | Notes |
| --- | --- | --- | --- |
| Open assigned manuscripts, read the PDF in-app, evaluate against the rubric | `/reviewer/assignments`, `/reviewer/assignments/:id` | `GET /api/ReviewRequest`, `POST /api/DetailedEvaluation`, `POST /api/ReviewRequest/{id}` | PDF rendered via `LazyPdfViewer` (pdf.js) — Firebase `X-Frame-Options` blocked the previous iframe viewer |
| Mark self as available / unavailable for new assignments | Header availability toggle (`MainLayout.tsx`) | `PUT /api/ProfessionalProfile/{id}/availability` | Surfaced only for Reviewer role |
| Edit own professional profile (used as the Admin assignment card) | `/profile?tab=professional` | `GET/PUT /api/ProfessionalProfile`, `GET /api/ProfessionalProfile/{id}` | Replaces the legacy `/reviewer/professional-profile` route |
| Withdraw earned wallet balance to a bank account | `/profile` (wallet section) | `POST /api/WithdrawalRequest`, `GET /api/Wallet/{userId}` | Driven by the `WithdrawalRequest` schema |
| Accept seminar invitations as an academic attendee | `/seminar-participations` | `GET /api/Seminar/my-invitations`, `PUT /api/SeminarParticipant/{id}` | Reviewer is the canonical invited role; feedback window is `SEMINAR_FEEDBACK_WINDOW_HOURS` |

#### Graduate Student

**Business purpose**: do the research. Graduate Students are the **base tier** of the platform — they cannot request a role upgrade from this position and other roles cannot be downgraded into it. They submit phased reports, track deadlines, and consume the materials their lecturers publish.

| Capability | Primary route(s) | Key BE endpoints | Notes |
| --- | --- | --- | --- |
| Browse research groups, send a join request, accept an invitation | `/student/research-groups` | `GET /api/ResearchGroup`, `POST /api/ResearchGroup/{groupId}/join-requests`, `GET /api/GroupMember/by-status` | Banner surfaces pending invitations + lecturer rejection feedback |
| Track daily / weekly research journey | `/student/dashboard` | `GET /api/GroupMember/by-status`, `GET /api/PhasedReport/group/{id}` | Primary CTA nudges group leaders to the dedicated tab |
| Submit phased reports against lecturer-configured milestones; resubmit after rejection | `/submit-report?groupId=…` | `POST /api/PhasedReport/submit`, `GET /api/PhasedReport/topic/{topicId}` | Shows lecturer score + rejection reason; leader-only actions guarded |
| Track which group you lead and reassign leadership | `/student/research-groups` (leader badge) | `POST /api/GroupMember/{id}/set-leader`, `/api/GroupMember/{id}/remove-leader` | Only group leaders see the badge and the leader-only actions |
| Consume materials + submit feedback as a seminar attendee | `/seminar-participations` | `/api/Seminar/my-invitations`, `POST /api/Seminar/{id}/feedback` | Feedback window matches the Lecturer-side `SEMINAR_FEEDBACK_WINDOW_HOURS` |

#### Shared (cross-role)

| Capability | Primary route(s) | Notes |
| --- | --- | --- |
| Public project landing (signed-out) | `/` | Outside `PublicRoute` so returning users can also visit it |
| Login + register (incl. Google and ORCID OAuth) | `/login`, `/register`, `/auth/google/callback`, `/auth/orcid/callback`, `/complete-google-registration` | See `src/utils/registrationRoles.ts` for the requestable role list |
| Forum | `/forum` | Open to all authenticated roles (unverified `Guest` included) |
| Personal profile (Account / Professional / Public tabs) | `/profile` | Professional tab is the legacy Reviewer deep-link target |
| Notification inbox | `/notifications` | Per-role notification-type routing via `resolveNotificationRoute` |
| Legal pages (Privacy / ToS) | `/privacy-policy`, `/terms-of-service` | Public |

> **For deeper per-role behaviour, per-route guard rules, role-eligibility for ORCID and academic identifiers, and the persisted-vs-effective role state machine, read [`docs/PROJECT_BUSINESS_SCOPE.md`](docs/PROJECT_BUSINESS_SCOPE.md).** It is the single source of truth when a future task needs to know "what is this role supposed to do, and why?".

---

## Internationalization

Two dictionaries live in `src/i18n/dictionaries/` — `vi.ts` and `en.ts`. Each one is a separate Vite chunk, lazy-loaded on demand so the entry bundle never carries both at once (English is the default to keep the initial render lightweight while Vietnamese can be loaded on demand).

```tsx
import { useI18n } from '@/i18n/I18nContext';

const { t, locale, toggleLocale } = useI18n();

t('common.save');                                   // → "Lưu" (vi) / "Save" (en)
t('materials.usage', 'Fallback', { count: 3 });     // → "Used by 3 items" with {count} interpolation
```

`translate()` supports `{placeholder}` interpolation — missing keys are left untouched rather than throwing.

---

## API Reference

The backend is documented via Swagger:

**<https://arsplatform.onrender.com/swagger/index.html>**

Always cross-check the database schema in `docs/local-only/erd-schema-reference.md` (kept out of git) before assuming an endpoint payload is final. When Swagger and the DB diverge, **flag it** in the issue or PR and confirm the frontend contract before wiring a screen to the API.

Authentication is JWT-based. Tokens are stored in `sessionStorage` by default (cleared on tab close); if the user ticks **Remember Me**, they are persisted to `localStorage`. Logout clears both.

---

## Project Integration

<!-- INTEGRATIONS:START -->
> Last refreshed: 2026-09-08 — auto-generated by `scripts/update-readme-integrations.mjs`.
> Do not edit this block by hand; the next workflow run will overwrite it.

### API integration surface

Top-level endpoint groups defined in `src/utils/constants.ts`:

| Group | Endpoints | Source |
| --- | ---: | --- |
| `AUTH` | 17 | src/utils/constants.ts:14 |
| `ROLE` | 1 | src/utils/constants.ts:45 |
| `USER` | 5 | src/utils/constants.ts:48 |
| `PAPER` | 9 | src/utils/constants.ts:55 |
| `OPEN_ALEX` | 1 | src/utils/constants.ts:67 |
| `PROFESSIONAL_PROFILE` | 4 | src/utils/constants.ts:70 |
| `PROFILE` | 5 | src/utils/constants.ts:76 |
| `REVIEW_REQUEST` | 6 | src/utils/constants.ts:83 |
| `DETAILED_EVALUATION` | 3 | src/utils/constants.ts:91 |
| `SEMINAR` | 18 | src/utils/constants.ts:96 |
| `SEMINAR_PARTICIPANT` | 9 | src/utils/constants.ts:116 |
| `FOLLOWER` | 10 | src/utils/constants.ts:127 |
| `NOTIFICATION` | 10 | src/utils/constants.ts:139 |
| `USER_ROLE` | 6 | src/utils/constants.ts:151 |
| `MAJOR_FIELD` | 6 | src/utils/constants.ts:159 |
| `SUB_FIELD` | 6 | src/utils/constants.ts:167 |
| `COMMENT_VOTE` | 5 | src/utils/constants.ts:175 |
| `FORUM_POST` | 6 | src/utils/constants.ts:182 |
| `FORUM_COMMENT` | 8 | src/utils/constants.ts:190 |
| `ADMIN` | 25 | src/utils/constants.ts:203 |
| `ANALYTICS` | 2 | src/utils/constants.ts:244 |
| `RESEARCH_WORKFLOW` | 53 | src/utils/constants.ts:251 |

### Service layer

Each entry below is a live API client wrapper in `src/services/`:

| Service | Purpose |
| --- | --- |
| `admin.service` | Backend integration for Admin |
| `adminAuxiliary.service` | Backend integration for Admin auxiliary |
| `adminUser.service` | Backend integration for Admin user |
| `annualFee.service` | Backend integration for Annual fee |
| `auth.service` | Backend integration for Auth |
| `commentVote.service` | Backend integration for Comment vote |
| `detailedEvaluation.service` | Backend integration for Detailed evaluation |
| `emailVerification.service` | Backend integration for Email verification |
| `field.service` | Backend integration for Field |
| `follower.service` | Backend integration for Follower |
| `forumComment.service` | Backend integration for Forum comment |
| `forumPost.service` | Backend integration for Forum post |
| `googleAuth.service` | Backend integration for Google auth |
| `googleOAuth.service` | Backend integration for Google oauth |
| `groupMember.service` | Backend integration for Group member |
| `groupMembership.service` | Backend integration for Group membership |
| `guidanceProject.service` | Backend integration for Guidance project |
| `learningMaterial.service` | Backend integration for Learning material |
| `lecturerLookup.service` | Backend integration for Lecturer lookup |
| `medal.service` | Backend integration for Medal |
| `notification.service` | Backend integration for Notification |
| `orcid.service` | Backend integration for Orcid |
| `paper.service` | Backend integration for Paper |
| `phaseMaterial.service` | Backend integration for Phase material |
| `phasedReport.service` | Backend integration for Phased report |
| `policy.service` | Backend integration for Policy |
| `profile.service` | Backend integration for Profile |
| `profileExtras.service` | Backend integration for Profile extras |
| `report.service` | Backend integration for Report |
| `researchGroup.service` | Backend integration for Research group |
| `researchTopic.service` | Backend integration for Research topic |
| `researchTopicPhase.service` | Backend integration for Research topic phase |
| `reviewRequest.service` | Backend integration for Review request |
| `reviewer.service` | Backend integration for Reviewer |
| `role.service` | Backend integration for Role |
| `roleRequest.service` | Backend integration for Role request |
| `seminar.service` | Backend integration for Seminar |
| `seminarAudio.service` | Backend integration for Seminar audio |
| `sharedMaterial.service` | Backend integration for Shared material |
| `subscription.service` | Backend integration for Subscription |
| `user.service` | Backend integration for User |
| `userRole.service` | Backend integration for User role |

### Third-party libraries

| Library | Version | Role |
| --- | --- | --- |
| `Axios HTTP client` | ^1.20.0 | dependencies |
| `Firebase Cloud Storage` | ^12.18.0 | dependencies |
| `Lucide icons` | ^1.39.0 | dependencies |
| `PDF generation (pdf-lib)` | ^1.17.1 | dependencies |
| `PDF.js viewer` | ^4.10.38 | dependencies |
| `React Hook Form` | ^7.87.0 | dependencies |
| `Recharts analytics` | ^3.10.1 | dependencies |
| `Yup validation` | ^1.7.1 | dependencies |
| `Zustand state` | ^5.0.15 | dependencies |

### Recent incident reports

- [LECTURER_RESEARCH_WORKFLOW_COMPLETION_REPORT.md](docs/LECTURER_RESEARCH_WORKFLOW_COMPLETION_REPORT.md)
- [PUBLICATION_MAIN_FLOW_INCIDENT_REPORT.md](docs/PUBLICATION_MAIN_FLOW_INCIDENT_REPORT.md)

<!-- INTEGRATIONS:END -->

---

## Testing

- **Unit** — Vitest with Testing Library. Mocked services per module. Run with `npm test`.
- **Integration** — `npm run test:integration`.
- **E2E** — Playwright. `npm run test:e2e`. Configure the local backend URL before running.
- **Coverage** — `npm run test:coverage` writes to `coverage/`.

A 20-minute manual smoke pass is expected before every PR. Keep that window tight — CI catches the rest.

---

## Contributing

1. Fork the repo and create a feature branch (`git checkout -b feature/<short-summary>`).
2. Write the code — remember: **humans own ~75–80 % of the code**, AI assists with snippets, explanations, and review.
3. Run `npm run lint && npm test` locally.
4. Do **NOT** commit secrets, real `.env` files, or generated artefacts (`dist/`, `coverage/`).
5. Open a PR with a clear summary, the role(s) affected, and screenshots for visual changes.
6. Sign off the checklist in the PR template.

> **Frontend-only rule**: do not write backend code in this repo. If a task spans both ends, ship the FE portion here and request the BE team to handle the rest.

---

## License

This project is **proprietary** and confidential. See the `LICENSE` file at the root for the full terms. Do not redistribute source or screenshots without written permission.

---

## Related Repositories

- **Backend API** — `ars-platform-be` (private, .NET Core + MySQL)
- **Mobile client** — _not yet published_
- **Architecture docs** — `docs/local-only/` (kept out of git; check with the maintainers)
- **Business-scope deep dive** — [`docs/PROJECT_BUSINESS_SCOPE.md`](docs/PROJECT_BUSINESS_SCOPE.md). The canonical "what is each role supposed to do, on which route, with which API?" reference for onboarding, planning, and future feature work.

---

For questions, please open an issue or contact the maintainers directly.
