# ARS Platform — Frontend

> Academic Research Sharing (ARS) — the web client for managing research papers, peer reviews, seminars, research groups, and student supervision in a multi-role academic environment.

[![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Vite](https://img.shields.io/badge/Vite-6-646CFF?style=flat-square&logo=vite&logoColor=white)](https://vitejs.dev)
[![License](https://img.shields.io/badge/License-Proprietary-orange?style=flat-square)](LICENSE)
[![Status](https://img.shields.io/badge/Status-Active-success?style=flat-square)]()

---

## Table of Contents

- [What is ARS?](#what-is-ars)
- [Repository Scope](#repository-scope)
- [Tech Stack](#tech-stack)
- [Quick Start](#quick-start)
- [Environment Variables](#environment-variables)
- [Available Scripts](#available-scripts)
- [Project Structure](#project-structure)
- [Feature Surfaces by Role](#feature-surfaces-by-role)
- [Internationalization](#internationalization)
- [API Reference](#api-reference)
- [Project Integration](#project-integration)
- [Testing](#testing)
- [Contributing](#contributing)
- [License](#license)
- [Related Repositories](#related-repositories)

---

## What is ARS?

The **Academic Research Sharing Platform** is a capstone-grade academic collaboration tool that connects five user roles — **System Admins**, **Lecturers**, **Researchers**, **Reviewers**, and **Graduate Students** — around the lifecycle of a research paper: from manuscript submission, through peer review, to a defended seminar and follow-up research group work.

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

| Concern | Choice |
| --- | --- |
| UI framework | React 18 |
| Language | TypeScript 5.6 (strict) |
| Build tool | Vite 6 |
| Routing | React Router DOM 7 |
| State management | Zustand |
| Forms | React Hook Form + Yup |
| HTTP | Axios |
| PDF rendering | PDF.js, pdf-lib |
| File storage | Firebase Cloud Storage (browser SDK) |
| Charts | Recharts |
| Icons | Lucide React |
| Styling | CSS Modules (no global utility framework) |
| Unit tests | Vitest + Testing Library |
| E2E tests | Playwright |

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

# 5. Visit the printed URL (default: http://localhost:5173)
```

You will need a reachable backend (or a local mock). The default `VITE_API_BASE_URL` points at the public Swagger host — see [API Reference](#api-reference).

### Prerequisites

- **Node.js** 24 LTS (or newer)
- **npm** ≥ 11 (or pnpm / yarn with equivalent lockfiles)

---

## Environment Variables

All env vars are **public** values consumed at build time via `import.meta.env.VITE_*`. No real secrets should ever be committed — the `.env.example` file documents every key with empty placeholders.

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

> **Never** commit `.env.local`, `.env.*.local`, `appsettings.Development.json`, or any file containing real credentials. See [SECURITY](docs/local-only/SECURITY.md) (if present locally) for the credential-handling checklist.

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

---

## Project Structure

```
src/
├── app/                  # App bootstrap (main.tsx, App.tsx, firebase.ts)
├── assets/               # Static assets
│   ├── icons/           # Lucide icon re-exports and custom icons
│   ├── badges/          # Badge assets and definitions
│   ├── logo/            # Logo images (ARS, OpenAlex)
│   └── videos/          # Video assets
├── components/          # Reusable UI components (organized by feature/domain)
│   ├── Button/          # Primary button primitive with variants
│   ├── Input/           # Form input primitives
│   ├── FieldError/      # Field-level error display
│   ├── InlineNotice/    # Inline notice/warning component
│   ├── PdfViewer/       # PDF viewer with thumbnails and lazy loading
│   ├── SkeletonRow/     # Loading skeleton placeholder
│   ├── EmptyState/      # Empty list placeholder
│   ├── ErrorBanner/     # Inline error display
│   ├── PageHeader/      # Page title and description
│   ├── GlobalLoadingOverlay/   # Global loading overlay
│   ├── DelayedLoadingOverlay/  # Delayed loading indicator
│   ├── BackendGapBanner/      # Backend unavailable notice
│   ├── WelcomeBackBanner/     # Returning user banner
│   ├── admin/           # Admin-specific components
│   ├── auth/            # Authentication components (Google Sign-In)
│   ├── forum/           # Forum post and comment components
│   ├── gradstudent/     # Graduate student components
│   ├── identity/        # ORCID identity components
│   ├── i18n/            # Language toggle
│   ├── lecturer/        # Lecturer-specific components
│   ├── medals/          # Medal/flair badge components
│   ├── notification/    # Notification center
│   ├── openalex/        # OpenAlex brand logo
│   ├── orcid/           # ORCID brand components
│   ├── profile/         # Profile section components
│   ├── research/        # Research workflow components (milestones, timelines)
│   ├── researcher/      # Researcher-specific components
│   ├── reviewer/        # Reviewer-specific components
│   ├── seminar/         # Seminar components (feedback, audio, Google Meet)
│   ├── shortcuts/       # Keyboard shortcuts help modal
│   ├── subscription/    # Subscription access guard
│   ├── table/           # Table components (toolbar, pagination, sortable header)
│   └── workspace/       # Workspace header and activity components
├── config/              # Application configuration
│   ├── app.ts           # Feature flags and app config
│   ├── env.ts           # Environment variable helpers
│   └── featureFlags.ts # Feature flag definitions
├── context/             # React context providers
│   └── AuthContext.tsx  # Authentication context
├── features/            # Feature modules (co-located by domain)
│   └── publication/     # Publication workflow feature
│       ├── admin/       # Admin publication management
│       ├── api/         # API adapters and transformers
│       ├── components/   # Shared publication components
│       ├── demo/        # Demo/mock data
│       ├── home/        # Public research catalog
│       ├── researcher/  # Researcher submission workflow
│       ├── reviewer/    # Reviewer assignment workflow
│       └── types/       # Publication-specific types
├── hooks/               # Custom React hooks
│   └── index.ts        # Hooks barrel export
├── i18n/                # Internationalization
│   ├── I18nContext.tsx # i18n provider and hooks
│   ├── translations.ts  # Locale metadata + translator (no inline dicts)
│   └── dictionaries/   # Per-locale lazy chunks (`en.ts`, `vi.ts`)
├── layouts/             # App layout components
│   ├── AuthLayout.tsx  # Auth pages layout (login, register)
│   └── MainLayout.tsx  # Main app layout with sidebar/header
├── lib/                 # Library utilities
│   └── queryClient.tsx  # React Query client configuration
├── pages/               # Route-level pages (organized by route domain)
│   ├── Admin/          # Admin dashboard and management pages
│   ├── Auth/           # Email verification landing
│   ├── CompleteGoogleRegistration/  # Google onboarding
│   ├── Forum/          # Discussion forum
│   ├── GoogleCallback/ # Google OAuth callback
│   ├── GraduateStudent/ # Student dashboard and reports
│   ├── Landing/        # Public landing page
│   ├── Lecturer/       # Lecturer workspace
│   ├── Legal/          # Privacy policy, terms of service
│   ├── Login/          # Sign-in page
│   ├── OrcidCallback/  # ORCID OAuth callback
│   ├── Profile/        # User profile
│   ├── Register/       # Sign-up page
│   ├── ResetPassword/  # Password reset flow
│   ├── Reviewer/       # Reviewer professional profile
│   └── Subscription/   # Subscription management
├── routes/              # Routing configuration
│   ├── paths.ts        # Route constants and types
│   ├── PrivateRoute.tsx    # Authentication guard
│   ├── RoleRouteGuard.tsx  # Role-based access control
│   └── SubscriptionRouteGuard.tsx  # Subscription gate
├── services/            # API service modules (one per resource)
├── store/              # Zustand state stores
│   ├── authSlice.ts    # Auth state slice
│   ├── welcomeSignal.ts # Welcome banner signal
│   └── index.ts        # Store barrel export
├── styles/             # Global styles
│   ├── ars-tokens.css # Design tokens (Paper Day theme)
│   ├── globals.css     # Global styles
│   ├── variables.css   # CSS custom properties
│   └── reset.css       # CSS reset
├── types/               # TypeScript domain types
├── utils/               # Pure utility functions
├── firebase.ts          # Firebase web SDK initialization
└── App.tsx             # Root component
```

### Barrel Files

The following folders maintain index barrel files for clean re-exports:

| Folder | Barrel | Purpose |
|--------|--------|---------|
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

## Feature Surfaces by Role

| Role | Highlights |
| --- | --- |
| **Admin** | User moderation, payout clearance, audit log CSV export, accounts management, content reports |
| **Lecturer** | Seminar scheduling with Google Meet generation, research group supervision, topic + phase planning, material library, shared materials with other lecturers, peer review of phased reports |
| **Researcher** | Manuscript submission, revision tracking, status pipeline |
| **Reviewer** | Peer review desk, DOI/PDF upload, feedback composer, wallet + withdrawals |
| **Graduate Student** | Phased report submission, research group access |

The common shell includes:

- **Role-aware workspace header** — `POST /api/auth/switch-role` is called when the user changes active role, updating JWT claims without forcing logout.
- **Vietnamese + English** translation toggle, persisted to local storage.
- **ARS Paper Day design tokens** in `src/styles/ars-tokens.css` — every screen pulls colors, spacing, and typography from this file. Hard-coded hex literals are flagged in review.

---

## Internationalization

Two dictionaries live in `src/i18n/dictionaries/` — `vi.ts` and `en.ts`. Each one is a separate Vite chunk, lazy-loaded on demand so the entry bundle never carries both at once (English is the default and is preloaded; Vietnamese is fetched the first time the user picks it). The provider lives in `src/i18n/I18nContext.tsx` and keeps both dictionaries in memory once loaded. Use the `useI18n()` hook:

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

**https://arsplatform.onrender.com/swagger/index.html**

Always cross-check the database schema in `docs/local-only/erd-schema-reference.md` (kept out of git) before assuming an endpoint payload is final. When Swagger and the DB diverge, **flag it** in your PR and ask the backend team.

Authentication is JWT-based. Tokens are stored in `sessionStorage` by default (cleared on tab close); if the user ticks **Remember Me**, they are persisted to `localStorage`. Logout clears both.

---

## Project Integration

<!-- INTEGRATIONS:START -->
> Last refreshed: 2026-09-07 — auto-generated by `scripts/update-readme-integrations.mjs`.
> Do not edit this block by hand; the next workflow run will overwrite it.

### API integration surface

Top-level endpoint groups defined in `src/utils/constants.ts`:

| Group | Endpoints | Source |
| --- | ---: | --- |
| `AUTH` | 17 | src/utils/constants.ts:14 |
| `ROLE` | 1 | src/utils/constants.ts:45 |
| `USER` | 5 | src/utils/constants.ts:48 |
| `PAPER` | 8 | src/utils/constants.ts:55 |
| `OPEN_ALEX` | 1 | src/utils/constants.ts:66 |
| `PROFESSIONAL_PROFILE` | 4 | src/utils/constants.ts:69 |
| `PROFILE` | 5 | src/utils/constants.ts:75 |
| `REVIEW_REQUEST` | 6 | src/utils/constants.ts:82 |
| `DETAILED_EVALUATION` | 3 | src/utils/constants.ts:90 |
| `SEMINAR` | 18 | src/utils/constants.ts:95 |
| `SEMINAR_PARTICIPANT` | 9 | src/utils/constants.ts:115 |
| `FOLLOWER` | 10 | src/utils/constants.ts:126 |
| `NOTIFICATION` | 10 | src/utils/constants.ts:138 |
| `USER_ROLE` | 6 | src/utils/constants.ts:150 |
| `MAJOR_FIELD` | 6 | src/utils/constants.ts:158 |
| `SUB_FIELD` | 6 | src/utils/constants.ts:166 |
| `COMMENT_VOTE` | 5 | src/utils/constants.ts:174 |
| `FORUM_POST` | 6 | src/utils/constants.ts:181 |
| `FORUM_COMMENT` | 8 | src/utils/constants.ts:189 |
| `ADMIN` | 25 | src/utils/constants.ts:202 |
| `ANALYTICS` | 2 | src/utils/constants.ts:243 |
| `RESEARCH_WORKFLOW` | 52 | src/utils/constants.ts:250 |

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

### Internationalization

Active locales: `en`, `vi` (2).

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

- [LECTURER_RESEARCH_WORKFLOW_COMPLETION_REPORT.md](docs\LECTURER_RESEARCH_WORKFLOW_COMPLETION_REPORT.md)
- [PUBLICATION_MAIN_FLOW_INCIDENT_REPORT.md](docs\PUBLICATION_MAIN_FLOW_INCIDENT_REPORT.md)

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

---

For questions, please open an issue or contact the maintainers directly.
