#!/usr/bin/env node
//
// scripts/run-affected-tests.mjs — deterministic affected-test selection.
//
// Why this exists:
//   vitest --changed origin/main and vitest related <path> exist but
//   they have operational gotchas in the repo:
//     - The repo's git history does NOT always contain origin/main in a
//       CI runner's shallow checkout. vitest --changed then errors out
//       or silently selects nothing.
//     - vitest related requires Vitest 4+ and a watched file list. If
//       the commit list is empty it errors before reporting 0 tests
//       selected, which means a CI job that should run no tests
//       instead errors out.
//
// This script reads the actual git diff between the merge-base of the
// current branch and the requested base (main by default), filters the
// changes to tracked files inside src/, tests/, and config files Vitest /
// Vite / Playwright actually load, and hands the resulting file list to
// vitest related so a single vitest invocation owns test discovery.
//
// The script also recognises a curated list of shared-file globs that
// always pull in the wider affected suite — even one touched file. For
// example, touching src/utils/validationRules.ts forces all suites that
// import from validationRules to run, and the script does that
// explicitly.
//
// Usage:
//   node scripts/run-affected-tests.mjs                       (diff vs origin/main)
//   BASE_REF=main node scripts/run-affected-tests.mjs         (diff vs main)
//   BASE_REF=HEAD~1 node scripts/run-affected-tests.mjs       (diff vs previous commit)
//   FORCE_FULL=1 node scripts/run-affected-tests.mjs          (run the full unit suite)
//
// Exit codes:
//   0 - tests selected and passed
//   1 - tests selected but vitest reported failure
//   2 - no tests selected AND changes touched tracked source/test files
//       (this is the failure mode required by the PR workflow)
//   3 - no test-relevant changes anywhere (pure docs / CI / comments)
//
// The PR workflow surfaces codes 1 and 2 as red; code 3 as a deliberate
// success because the diff really did not touch anything test-relevant.
//

import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Shared-file globs that, when touched, force the WIDER suite to run.
// Mirrors the rules in docs/TESTING_STRATEGY.md §4 (Shared-file impact rules).
const SHARED_HIGH_IMPACT = [
  /^src\/routes\//,
  /^src\/layouts\//,
  /^src\/context\//,
  /^src\/store\//,
  /^src\/services\/axios\./,
  /^src\/services\/auth\.service\./,
  /^src\/services\/googleAuth\.service\./,
  /^src\/services\/payment\.service\./,
  /^src\/services\/wallet\./,
  /^src\/utils\/validationRules?\./,
  /^src\/utils\/validation\//,
  /^src\/types\/(dto|shared|common)\//,
  /^vitest\.config\.ts$/,
  /^vitest\.unit\.config\.ts$/,
  /^vitest\.integration\.config\.ts$/,
  /^vite\.config\.ts$/,
  /^tests\/setup\.ts$/,
];

const ALWAYS_IGNORED = [
  /^docs\//,
  /^\.github\//,
  /^\.vscode\//,
  /^scripts\//,
  /\.(md|mdx|txt|log)$/,
  /^\.env($|\.)/,
];

function isTestRelevant(file) {
  if (ALWAYS_IGNORED.some((re) => re.test(file))) return false;
  return (
    file.startsWith('src/') ||
    file.startsWith('tests/') ||
    file === 'package.json' ||
    file === 'tsconfig.json' ||
    file === 'tsconfig.app.json' ||
    file === 'tsconfig.node.json' ||
    /^vitest.*\.config\.ts$/.test(file) ||
    /^playwright.*\.config\.ts$/.test(file) ||
    /^vite\.config\.ts$/.test(file)
  );
}

function gitChangedFiles(baseRef) {
  let mergeBase;
  try {
    mergeBase = execFileSync('git', ['merge-base', baseRef, 'HEAD'], {
      cwd: ROOT,
      encoding: 'utf8',
    }).trim();
  } catch {
    try {
      execFileSync('git', ['rev-parse', '--verify', 'HEAD~1'], { cwd: ROOT });
      mergeBase = 'HEAD~1';
    } catch {
      return { files: [], baseResolved: null, error: 'no-merge-base' };
    }
  }
  try {
    const out = execFileSync(
      'git',
      ['diff', '--name-only', '--diff-filter=ACMRT', mergeBase, '--'],
      { cwd: ROOT, encoding: 'utf8' },
    );
    return {
      files: out.split('\n').map((f) => f.trim()).filter(Boolean),
      baseResolved: mergeBase,
      error: null,
    };
  } catch (err) {
    return { files: [], baseResolved: mergeBase, error: err.message };
  }
}

function runVitestRelated(files) {
  // vitest related <files...> runs only tests related to the given files.
  // We pair with vitest.unit.config.ts so integration tests stay out of
  // PR-time affected runs.
  const args = [
    'related',
    ...files,
    '--run',
    '--config',
    'vitest.unit.config.ts',
  ];
  return new Promise((resolve, reject) => {
    const child = spawn('npx', ['vitest', ...args], {
      cwd: ROOT,
      stdio: 'inherit',
      env: process.env,
      shell: process.platform === 'win32',
    });
    child.on('error', reject);
    child.on('exit', (code) => resolve(code ?? 1));
  });
}

function runFullUnit() {
  return new Promise((resolve, reject) => {
    const child = spawn('npx', ['vitest', 'run', '--config', 'vitest.unit.config.ts'], {
      cwd: ROOT,
      stdio: 'inherit',
      env: process.env,
      shell: process.platform === 'win32',
    });
    child.on('error', reject);
    child.on('exit', (code) => resolve(code ?? 1));
  });
}

async function main() {
  const baseRef = process.env.BASE_REF || 'origin/main';
  const forceFull = process.env.FORCE_FULL === '1';

  if (forceFull) {
    console.log('[affected] FORCE_FULL=1 - running the full unit suite.');
    const code = await runFullUnit();
    process.exit(code || 1);
  }

  const { files, baseResolved, error } = gitChangedFiles(baseRef);
  if (error === 'no-merge-base') {
    console.error(
      '[affected] Unable to resolve merge-base for ' + baseRef +
        ' and no HEAD~1 available. ' +
        'vitest --changed would also fail here. Falling back to running the full unit suite.',
    );
    const code = await runFullUnit();
    process.exit(code || 1);
  }

  const relevant = files.filter(isTestRelevant);
  const highImpact = relevant.filter((f) => SHARED_HIGH_IMPACT.some((re) => re.test(f)));

  console.log('[affected] base=' + baseRef + ' resolved=' + (baseResolved || '(none)'));
  console.log('[affected] diff touched ' + files.length + ' tracked file(s); ' + relevant.length + ' test-relevant.');
  if (highImpact.length) {
    console.log(
      '[affected] HIGH-IMPACT shared-file match — forcing the full unit suite (' +
        highImpact.join(', ') +
        ').',
    );
    const code = await runFullUnit();
    process.exit(code || 1);
  }

  if (relevant.length === 0) {
    console.log(
      '[affected] No test-relevant changes in the diff — exiting 3 (no tests, no failure).',
    );
    process.exit(3);
  }

  console.log('[affected] running vitest related for:', relevant);
  const code = await runVitestRelated(relevant);
  process.exit(code === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('[affected] unexpected error:', err);
  process.exit(1);
});
