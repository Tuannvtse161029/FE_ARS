# ARS Platform Frontend

Academic Research System - Frontend Application built with React + TypeScript + Vite

## Tech Stack

- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite 6
- **Routing**: React Router DOM 7
- **State Management**: Zustand
- **Form Handling**: React Hook Form + Yup
- **HTTP Client**: Axios
- **PDF Rendering**: PDF.js (pdfjs-dist) and pdf-lib
- **File Storage**: Firebase Storage
- **Charts**: Recharts
- **Icons**: Lucide React
- **Styling**: CSS Modules

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Run lint checks
npm run lint

# Run unit tests
npm test

# Run integration tests
npm run test:integration

# Generate a coverage report
npm run test:coverage

# Build for production
npm run build

# Preview production build
npm run preview
```

### Environment Variables

Create a `.env.local` file in the root directory for local development. Do not commit this file.

```env
# Backend API (optional). When omitted, the app uses the deployed API.
# Set this only when developing against a local backend.
VITE_API_BASE_URL=http://localhost:5000

# Frontend origin, used for OAuth callbacks and absolute links.
VITE_APP_URL=http://localhost:3000

# Optional URL used by E2E tests.
VITE_E2E_BASE_URL=http://localhost:3000

# Firebase Storage configuration, required for PDF uploads.
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_MEASUREMENT_ID=
```

For production deployments, define the equivalent variables in your hosting
provider (e.g. Vercel project settings → Environment Variables):

| Variable              | Local dev                            | Production (Vercel + Render)            |
|-----------------------|--------------------------------------|-----------------------------------------|
| `VITE_API_BASE_URL`   | `http://localhost:5000`              | `https://arsplatform.onrender.com`      |
| `VITE_APP_URL`        | `http://localhost:3000`              | `https://your-app.vercel.app`           |

The backend's CORS configuration must allow the frontend origin. For Google OAuth,
set `VITE_APP_URL` to the exact frontend origin registered with the backend and
Google OAuth configuration. Never put Google client secrets, refresh tokens, API
keys, or real user credentials in frontend environment files that are committed to
the repository.

## Project Structure

```text
src/
├── assets/          # Images, icons, fonts, sample PDFs
├── components/      # Reusable, role-agnostic UI components
│   ├── Button/
│   ├── Input/
│   ├── Navbar/
│   ├── PdfViewer/   # PDF.js-based document viewer with thumbnail sidebar
│   └── workspace/   # Shared workspace header, metrics, and activity feed
├── pages/           # Page components — organised by role
│   ├── Admin/           # Admin landing page (DB-only role)
│   ├── Researcher/      # Researcher-only pages
│   │   ├── DiscoverReviewers.tsx
│   │   └── components/TopUpModal.tsx
│   ├── Reviewer/        # Reviewer-only pages
│   │   ├── AssignedReviews.tsx
│   │   ├── EvaluationDesk.tsx
│   │   ├── EarningsWallet.tsx
│   │   └── components/ScorecardModal.tsx
│   ├── Lecturer/        # Lecturer-only pages
│   │   ├── SeminarWorkspace.tsx
│   │   ├── ResearchGroup.tsx
│   │   └── ConfigureMilestones.tsx
│   ├── GraduateStudent/ # Graduate Student-only pages
│   │   ├── SubmitReport.tsx
│   │   └── StudentResearchGroups.tsx
│   ├── Dashboard/       # Shared (role-aware landing page)
│   ├── Forum/           # Shared discussion forum
│   ├── Papers/          # Shared paper listing (used by Researcher + Graduate Student)
│   ├── Profile/         # Shared profile page
│   ├── Login/           # Public password and Google OAuth entry points
│   ├── Register/        # Public registration flow
│   ├── CompleteGoogleRegistration/ # First-time Google-user onboarding
│   ├── GoogleCallback/  # Google OAuth callback handling
│   └── ResetPassword/   # Public password reset flow (Forgot / Verify / Reset)
├── layouts/         # Layout components (MainLayout, AuthLayout)
├── routes/          # Routing configuration, private routes, ROUTES constants
├── services/        # API services (auth, Google auth/OAuth, papers, reviews, seminars, users)
├── store/           # Zustand store (authSlice)
├── types/           # TypeScript types
├── utils/           # Utility functions (constants, validation, storage)
├── styles/          # Global styles
├── hooks/           # Custom hooks
├── tests/           # Test files (unit, integration)
├── firebase.ts      # Firebase configuration
└── App.tsx          # Root component
```

### Role-Based Page Organisation

Each role has its own folder under `src/pages/` whose name matches the role string
exactly (`Admin`, `Researcher`, `Reviewer`, `Lecturer`, `Graduate Student`).
Pages that are shared by multiple roles stay at the top level of `src/pages/`.

| Role                                   | Folder                                                        | Pages                                                                                   |
|----------------------------------------|---------------------------------------------------------------|-----------------------------------------------------------------------------------------|
| Admin                                  | `pages/Admin/`                                                | `AdminDashboard` (placeholder)                                                          |
| Researcher                             | `pages/Researcher/`                                           | `DiscoverReviewers` (+ `components/TopUpModal`)                                         |
| Reviewer                               | `pages/Reviewer/`                                             | `AssignedReviews`, `EvaluationDesk`, `EarningsWallet` (+ `components/ScorecardModal`)   |
| Lecturer                               | `pages/Lecturer/`                                             | `SeminarWorkspace`, `ResearchGroup`, `ConfigureMilestones`                              |
| Graduate Student                       | `pages/GraduateStudent/`                                      | `SubmitReport`, `StudentResearchGroups`                                                 |
| Shared (all roles)                     | `pages/Dashboard/`, `pages/Forum/`, `pages/Profile/`          |                                                                                         |
| Shared (Researcher + Graduate Student) | `pages/Papers/`                                               |                                                                                         |
| Public                                 | `pages/Login/`, `pages/Register/`, `pages/ResetPassword/`     |                                                                                         |

The four self-registerable roles are listed in `src/types/auth.ts` as `UserRole`.
`Admin` is a DB-only role (no self-registration); users with this role land on
`/admin` after login. The full list of routes is in `src/routes/paths.ts`.

## Features

- JWT-based authentication with session/local storage (Remember Me)
- Email/password login, password reset with OTP verification, and backend-driven Google OAuth login
- First-time Google-user onboarding with role-request proof upload
- Protected routes with auth guards
- Role-based sidebar navigation and role-aware landing pages
- Responsive split-screen login layout
- Form validation with Yup
- Research paper upload with PDF preview (drag-and-drop)
- PDF viewer with thumbnail sidebar navigation
- Discussion forum
- Workspace headers, activity feeds, and metric cards
- Admin role-request, account, transaction, report, package, and audit-log views
- Error handling and loading states
- Unit, integration, and E2E test support with Vitest and Playwright

## API Documentation

The backend API documentation is available at:

**<https://arsplatform.onrender.com/swagger/index.html>**
