#!/usr/bin/env node
/**
 * run-affected-tests.mjs — run only the test files that are affected
 * by the current diff vs the base branch.
 *
 * Strategy:
 *   1. Find the merge-base against `origin/main` (or whatever the
 *      `BASE_BRANCH` env var holds). Fall back to `HEAD~1` when the
 *      repo is local-only (no remote / first commit).
 *   2. Diff against the merge-base with `git diff --name-only` to list
 *      changed files.
 *   3. Map each changed source file to the nearest co-located test:
 *         src/foo/bar.ts  → tests/unit/foo/bar.test.tsx
 *      If the diff already touches a `*.test.*` file, run it as-is.
 *   4. If no tests are touched (e.g. doc-only change) and the caller
 *      didn't pass `--all`, exit 0 with a hint.
 *
 * Why this matters: the full Vitest suite takes ~1 minute to settle
 * and most contributions touch a tiny subset of the codebase. Running
 * only the affected tests cuts the inner-loop time ~10x.
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');

function run(cmd, args) {
  return spawnSync(cmd, args, {
    cwd: projectRoot,
    encoding: 'utf8',
    shell: false,
  });
}

function findMergeBase() {
  const base = process.env.BASE_BRANCH || 'origin/main';
  const probe = run('git', ['merge-base', 'HEAD', base]);
  if (probe.status === 0) return probe.stdout.trim();
  // No origin/main — try main, master, then HEAD~1.
  for (const fallback of ['main', 'master']) {
    const p = run('git', ['merge-base', 'HEAD', fallback]);
    if (p.status === 0) return p.stdout.trim();
  }
  const prev = run('git', ['rev-parse', 'HEAD~1']);
  if (prev.status === 0) return prev.stdout.trim();
  return null;
}

const mergeBase = findMergeBase();
if (!mergeBase) {
  console.error(
    '\u274c No merge-base found. Run `git fetch` or pass BASE_BRANCH=main.',
  );
  process.exit(1);
}

const diff = run('git', ['diff', '--name-only', mergeBase, 'HEAD']);
if (diff.status !== 0) {
  console.error(`\u274c git diff failed: ${diff.stderr}`);
  process.exit(1);
}

const changed = diff.stdout.split(/\r?\n/).filter(Boolean);
const testsToRun = new Set();

for (const file of changed) {
  // If the diff already contains a test file, just run it directly.
  if (/\.test\.(ts|tsx|js|jsx|mjs)$/.test(file) && existsSync(join(projectRoot, file))) {
    testsToRun.add(file);
    continue;
  }
  // Map source files → co-located test via the conventional
  // `src/…` ↔ `tests/unit/…` layout used by this project.
  if (file.startsWith('src/')) {
    const inferred = file
      .replace(/^src\//, 'tests/unit/')
      .replace(/\.(ts|tsx|js|jsx)$/, '.test.$1');
    if (existsSync(join(projectRoot, inferred))) {
      testsToRun.add(inferred);
      continue;
    }
    // Fall back to a sibling test file with the same stem.
    const stem = file.replace(/\.(ts|tsx|js|jsx)$/, '');
    const siblingTest = `${stem}.test.${file.endsWith('tsx') ? 'tsx' : 'ts'}`;
    if (existsSync(join(projectRoot, siblingTest))) {
      testsToRun.add(siblingTest);
    }
  }
}

if (testsToRun.size === 0) {
  console.log('\u2728 No test files affected by this diff. (Docs / config only?)');
  console.log('   Pass --all to force the full suite.');
  if (!process.argv.includes('--all')) process.exit(0);
}

const files = Array.from(testsToRun);
console.log(`\u25B6 Running ${files.length} affected test file(s):`);
for (const f of files) console.log(`  - ${f}`);

const vitestBin = join(projectRoot, 'node_modules', 'vitest', 'vitest.mjs');
const child = spawnSync(
  process.execPath,
  [vitestBin, 'run', '--config', join(projectRoot, 'vitest.config.ts'), ...files],
  { stdio: 'inherit', cwd: projectRoot, env: process.env },
);
process.exit(child.status ?? 0);
