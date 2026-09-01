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
//     - session cleanup, OAuth URL, route registration, and verified guard
//     - current publication catalog/reviewer policy helpers
//     - dedicated notification, research workflow, and forum API contracts
//     - withdrawal feature gate and payment confirmation
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
  'tests/unit/context/AuthContext.logout.test.tsx',
  'tests/unit/routes/googleAuthRoutes.test.ts',
  'tests/unit/hooks/useVerifiedGuard.test.ts',
  'tests/unit/services/googleOAuth.service.test.ts',
  'tests/unit/utils/registrationRoles.test.ts',

  // Publication and reviewer policy
  'tests/unit/publication/home/HomeResearchCatalog.authorLinks.test.tsx',
  'tests/unit/publication/home/publicationLinks.test.ts',
  'tests/unit/publication/reviewer/reviewerCriteria.test.ts',

  // Current dedicated API contracts
  'tests/unit/services/emailVerification.service.test.ts',
  'tests/unit/services/notification.service.test.ts',
  'tests/unit/services/forumPost.service.test.ts',
  'tests/unit/services/report.service.test.ts',
  'tests/unit/services/profile.service.test.ts',
  'tests/unit/services/field.service.test.ts',
  'tests/unit/services/admin.endpointContract.test.ts',

  // Lecturer and Graduate Student research workflow
  'tests/unit/services/researchGroup.service.test.ts',
  'tests/unit/services/researchTopic.service.test.ts',
  'tests/unit/services/groupMembership.service.test.ts',
  'tests/unit/services/guidanceProject.service.test.ts',
  'tests/unit/services/learningMaterial.service.test.ts',
  'tests/unit/services/phasedReport.service.test.ts',
  'tests/unit/services/phasedReport.service.sentinel.test.ts',
  'tests/unit/services/researchWorkflowDtos.test.ts',

  // Payment/withdrawal safety; no live payment is performed
  'tests/unit/pages/withdrawalGate.test.tsx',
  'tests/unit/hooks/useConfirmPayment.test.ts',
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
