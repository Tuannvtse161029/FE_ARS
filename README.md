# ARS Platform Frontend

Academic Research System - Frontend Application built with React + TypeScript + Vite

## Tech Stack

- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite 6
- **Routing**: React Router DOM 7
- **State Management**: Zustand
- **Form Handling**: React Hook Form + Yup
- **HTTP Client**: Axios
- **PDF Rendering**: PDF.js (pdfjs-dist)
- **File Storage**: Firebase Storage
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

# Build for production
npm run build

# Preview production build
npm run preview
```

### Environment Variables

Create a `.env` file in the root directory:

```env
VITE_API_BASE_URL=http://localhost:5000
VITE_APP_URL=http://localhost:3000
```

## Project Structure

```text
src/
├── assets/          # Images, icons, fonts, sample PDFs
├── components/      # Reusable, role-agnostic UI components
│   ├── Button/
│   ├── Input/
│   ├── Navbar/
│   └── PdfViewer/   # PDF.js-based document viewer with thumbnail sidebar
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
│   ├── Login/           # Public auth flow
│   ├── Register/        # Public registration flow
│   └── ResetPassword/   # Public password reset flow (Forgot / Verify / Reset)
├── layouts/         # Layout components (MainLayout, AuthLayout)
├── routes/          # Routing configuration, private routes, ROUTES constants
├── services/        # API services (auth, paper, reviewer, reviewRequest, user)
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

| Role              | Folder                       | Pages                                                                                                            |
|-------------------|------------------------------|------------------------------------------------------------------------------------------------------------------|
| Admin             | `pages/Admin/`               | `AdminDashboard` (placeholder)                                                                                   |
| Researcher        | `pages/Researcher/`          | `DiscoverReviewers` (+ `components/TopUpModal`)                                                                  |
| Reviewer          | `pages/Reviewer/`            | `AssignedReviews`, `EvaluationDesk`, `EarningsWallet` (+ `components/ScorecardModal`)                            |
| Lecturer          | `pages/Lecturer/`            | `SeminarWorkspace`, `ResearchGroup`, `ConfigureMilestones`                                                       |
| Graduate Student  | `pages/GraduateStudent/`     | `SubmitReport`, `StudentResearchGroups`                                                                          |
| Shared (all roles)| `pages/Dashboard/`, `pages/Forum/`, `pages/Profile/`                                                          |
| Shared (Researcher + Graduate Student) | `pages/Papers/`                                              |
| Public            | `pages/Login/`, `pages/Register/`, `pages/ResetPassword/`                                                      |

The four self-registerable roles are listed in `src/types/auth.ts` as `UserRole`.
`Admin` is a DB-only role (no self-registration); users with this role land on
`/admin` after login. The full list of routes is in `src/routes/paths.ts`.

## Features

- JWT-based authentication with session/local storage (Remember Me)
- Protected routes with auth guards
- Role-based sidebar navigation and role-aware landing pages
- Responsive split-screen login layout
- Form validation with Yup
- Research paper upload with PDF preview (drag-and-drop)
- PDF viewer with thumbnail sidebar navigation
- Discussion forum
- Password reset flow with OTP verification
- Error handling and loading states
- Comprehensive test coverage (Vitest)

## API Documentation

The backend API documentation is available at:

**<https://arsplatform.onrender.com/swagger/index.html>**

## Default Test Account

- **Email**: <admin@arsplatform.com>
- **Password**: Password123

(Configure in backend seed data)
