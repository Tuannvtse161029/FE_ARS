#!/usr/bin/env node
/**
 * scripts/run-all-tests.mjs — orchestrates every required test layer.
 *
 * Used by `npm run test:full`. Runs each layer in sequence so a failure in
 * the unit suite halts the pipeline before slow e2e suites are even loaded.
 *
 * Order: unit → integration → e2e → coverage.
 *
 * The CI release-verify workflow depends on this orchestrator to keep the
 * matrix of jobs reproducible. Local devs can also invoke it for a one-shot
 * pre-release dry-run.
 *
 * Cross-platform: this is plain Node, not a chained shell command. It
 * works identically on Windows PowerShell and POSIX shells.
 */

import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const shell = process.platform === 'win32';

function run(cmd, args, env = process.env) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd: ROOT,
      stdio: 'inherit',
      env,
      shell,
    });
    child.on('error', reject);
    child.on('exit', (code) => resolve(code ?? 1));
  });
}

const steps = [
  ['unit', ['run', 'test:unit']],
  ['integration', ['run', 'test:integration']],
  // e2e is optional at the script level — release.yml gates it explicitly.
  // We attempt it here so `test:full` mirrors a full release locally.
  ['e2e', ['run', 'test:e2e']],
  ['coverage', ['run', 'test:coverage']],
];

for (const [name, args] of steps) {
  console.log(`\n[test:full] step "${name}" — npm ${args.join(' ')}\n`);
  const code = await run('npm', args);
  if (code !== 0) {
    console.error(`[test:full] step "${name}" failed with exit ${code}.`);
    process.exit(code);
  }
}

console.log('[test:full] ALL steps completed.');
