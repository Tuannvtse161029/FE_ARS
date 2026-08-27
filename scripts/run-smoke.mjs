#!/usr/bin/env node
//
// scripts/run-smoke.mjs — curated smoke-test runner.
//
// Why this exists:
//   Selecting the smoke suite by a filename glob such as
//   tests/unit/**/auth*.test.ts is unsafe — it can sweep in slow,
//   unrelated tests if a filename happens to match. The smoke suite is a
//   hand-curated, file-by-file enumeration of tests that gate critical
//   user journeys:
//     - Auth / route guards (AuthContext.loginWithGoogle, PublicRoute, logout)
//     - Registration (Register form validation, Register.consent)
//     - Google OAuth callback / first-time onboarding (googleOnboarding.* tests)
//     - Email workflow service (emailWorkflow, emailVerification.service)
//     - Password reset / OTP (validationRules, VerifyOtp.dedupe)
//     - Main navigation (MainLayout guest/admin/lecturer/reviewer gradients)
//     - Payment / wallet protection (EarningsWallet, useConfirmPayment)
//     - Paper submission validation (Papers.taxonomy, ValidatePapers)
//
// Usage:
//   node scripts/run-smoke.mjs            # runs the curated smoke list
//
// Exit codes:
//   0 - all curated tests passed
//   1 - one or more curated tests failed OR a file in the list is missing
//
// The PR workflow surfaces anything non-zero as red. Failures are real,
// not warnings.
//

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Curated list of stable critical tests.
 *
 * File paths are REPO-ROOT-relative. Use forward slashes on every OS
 * (Vitest normalizes them internally). The order is intentional — it
 * roughly mirrors the priority order in docs/TESTING_STRATEGY.md §5
 * (Smoke Command). To add a test, append it. To remove a test (because
 * it became flaky, slow, or its behavior moved into integration), edit
 * the list and update the strategy doc.
 */
const SMOKE_LIST = Object.freeze([
  // Auth / route guards
  'tests/unit/context/AuthContext.loginWithGoogle.test.tsx',
  'tests/unit/context/AuthContext.logout.test.tsx',
  'tests/unit/routes/PublicRoute.admin.test.tsx',
  'tests/unit/routes/googleAuthRoutes.test.ts',
  'tests/unit/App.routes.premium.test.tsx',
  'tests/unit/hooks/useVerifiedGuard.test.ts',

  // Registration (includes consent + inline errors)
  'tests/unit/pages/Register.test.tsx',
  'tests/unit/pages/Register.consent.test.tsx',
  'tests/unit/pages/Register.inlineErrors.test.tsx',
  'tests/unit/utils/registrationRoles.test.ts',

  // Google OAuth callback / onboarding (Agent 30 invariants)
  'tests/unit/agent30/googleLoginGuard.test.ts',
  'tests/unit/agent30/googleOnboarding.focused.test.ts',
  'tests/unit/agent30/googleOnboarding.regression.test.tsx',
  'tests/unit/agent30/noForbiddenCalls.test.ts',
  'tests/unit/agent30/usePermissions.null.test.ts',
  'tests/unit/agent31/googleOnboarding.payloadRegression.test.tsx',
  'tests/unit/agent32/googleStateMachine.focused.test.ts',
  'tests/unit/pages/GoogleCallback.test.tsx',
  'tests/unit/pages/CompleteGoogleRegistration.onboarding.test.tsx',
  'tests/unit/pages/CompleteGoogleRegistration.routingRegression.test.tsx',
  'tests/unit/services/googleAuth.service.test.ts',

  // Email workflow service (verification + workflow)
  'tests/unit/services/emailVerification.service.test.ts',
  'tests/unit/services/emailWorkflow.test.ts',
  'tests/unit/pages/EmailVerificationLanding.test.tsx',
  'tests/unit/hooks/useEmailVerification.test.ts',

  // Password reset / OTP (validationRules also covers registration)
  'tests/unit/utils/validationRules.test.ts',
  'tests/unit/utils/postAuthRoute.test.ts',
  'tests/unit/pages/VerifyOtp.dedupe.test.tsx',

  // Main navigation (sidebar layouts for every role)
  'tests/unit/layouts/MainLayout.guestSidebar.test.tsx',
  'tests/unit/layouts/MainLayout.adminSidebar.test.tsx',
  'tests/unit/layouts/MainLayout.lecturerNavigation.test.tsx',
  'tests/unit/layouts/MainLayout.graduateStudentNav.test.tsx',
  'tests/unit/layouts/MainLayout.reviewerAvailability.test.tsx',
  'tests/unit/layouts/MainLayout.notificationCenter.test.tsx',
  'tests/unit/layouts/MainLayout.premiumRoute.test.tsx',

  // Payment / wallet protection (read-side; no live payment)
  'tests/unit/pages/EarningsWallet.test.tsx',
  'tests/unit/pages/withdrawalGate.test.tsx',
  'tests/unit/hooks/useConfirmPayment.test.ts',
  'tests/unit/pages/CheckoutReturn.test.tsx',

  // Paper submission validation
  'tests/unit/pages/Papers.taxonomy.test.tsx',
]);

const missing = SMOKE_LIST.filter((rel) => {
  const abs = path.join(ROOT, rel);
  return !existsSync(abs);
});

if (missing.length) {
  console.error('[smoke] FAIL — the following curated files are missing on disk:');
  for (const m of missing) console.error('  - ' + m);
  console.error(
    '[smoke] Update both scripts/run-smoke.mjs and docs/TESTING_STRATEGY.md §5.',
  );
  process.exit(1);
}

const absoluteList = SMOKE_LIST.map((rel) => path.join(ROOT, rel));

console.log('[smoke] running ' + SMOKE_LIST.length + ' curated test files');

const forwardSlash = (p) => p.split(path.sep).join('/');
const positional = absoluteList.map(forwardSlash);

const child = spawn(
  'npx',
  [
    'vitest',
    'run',
    '--config',
    'vitest.unit.config.ts',
    ...positional,
  ],
  {
    cwd: ROOT,
    stdio: 'inherit',
    env: process.env,
    shell: process.platform === 'win32',
  },
);

child.on('error', (err) => {
  console.error('[smoke] failed to spawn vitest:', err);
  process.exit(1);
});
child.on('exit', (code) => {
  process.exit(code ?? 1);
});
