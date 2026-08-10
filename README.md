# ARS Platform Frontend

Academic Research System - Frontend Application built with React + TypeScript + Vite

## Tech Stack

- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite 6
- **Routing**: React Router DOM 7
- **State Management**: Zustand
- **Form Handling**: React Hook Form + Yup
- **HTTP Client**: Axios
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
├── assets/          # Images, icons, fonts
├── components/      # Reusable components
│   ├── Button/
│   └── Input/
├── pages/           # Page components
│   └── Login/
├── layouts/         # Layout components
├── routes/          # Routing configuration
├── services/        # API services
├── context/         # React Context
├── store/           # Zustand store
├── types/           # TypeScript types
├── utils/           # Utility functions
├── styles/          # Global styles
├── config/          # App configuration
├── hooks/           # Custom hooks
└── lib/             # Library setup
```

## Features

- JWT-based authentication
- Responsive split-screen login layout
- Form validation with Yup
- Protected routes
- Error handling
- Loading states

## Backend Connection

The frontend expects the backend API to be running at `http://localhost:5000`. The following endpoints are used:

- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration

## Default Test Account

- **Username**: <admin@arsplatform.com>
- **Password**: Password123

(Configure in backend seed data)
