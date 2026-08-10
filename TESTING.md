# ARS Platform Frontend — Testing Guide

## Test Commands

```bash
# Run unit tests only (no Firebase/storage calls — safe to run frequently)
npm run test:unit

# Run integration tests only (Firebase mocked, but must be run explicitly)
npm run test:integration

# Run ALL tests (unit + integration)
npm run test:all

# Run tests with coverage report
npm run test:coverage

# Run tests with interactive UI
npx vitest --ui
```

## Why Separate Test Commands?

Firebase Storage charges per upload/download. The integration tests mock Firebase but still import Firebase modules — to avoid any accidental real calls, they are **excluded from `npm run test`** and must be triggered explicitly with `npm run test:integration`.

| Command              | Scope                  | Firebase calls |
| -------------------- | ---------------------- | ------------- |
| `npm run test:unit`  | Unit tests only        | Never         |
| `npm run test:integration` | Integration tests only | Mocked only   |
| `npm run test:all`   | All tests              | Mocked only   |

## Test Structure

```
src/tests/
├── setup.ts              # Global test setup (cleanup, DOM globals)
├── utils/
│   └── mockFirebaseUpload.ts   # useFirebaseUpload mock utilities
│   └── mockPdfJs.ts            # pdfjs-dist mock utilities
├── fixtures/
│   └── research-paper-with-figures.pdf  # Sample PDF for integration tests
└── integration/
    └── pdfUploadView.integration.test.tsx  # Upload → Firebase → PdfViewer pipeline
```

## Integration Test Fixtures

A sample PDF (`src/tests/fixtures/research-paper-with-figures.pdf`) is used by integration tests. If the fixture is missing, tests fall back to a minimal valid PDF generated in-memory.

## Adding Integration Tests

1. Create a file in `src/tests/integration/`
2. It will automatically be included when running `npm run test:integration`
3. For unit tests, place files in `src/**/*.test.tsx` (outside `tests/integration/`)
