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
├── components/      # Reusable components
│   ├── Button/
│   ├── Input/
│   ├── Navbar/
│   └── PdfViewer/    # PDF.js-based document viewer with thumbnail sidebar
├── pages/           # Page components
│   ├── Login/
│   ├── Register/
│   ├── Papers/      # Research papers listing with PDF viewer
│   ├── Forum/       # Discussion forum
│   └── ResetPassword/
├── layouts/         # Layout components (MainLayout, AuthLayout)
├── routes/          # Routing configuration, private routes
├── services/        # API services (auth, paper)
├── store/           # Zustand store (authSlice)
├── types/           # TypeScript types
├── utils/           # Utility functions
├── styles/          # Global styles
├── hooks/           # Custom hooks
├── tests/           # Test files (unit, integration, e2e)
├── firebase.ts      # Firebase configuration
└── App.tsx          # Root component
```

## Features

- JWT-based authentication with session/local storage (Remember Me)
- Protected routes with auth guards
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
