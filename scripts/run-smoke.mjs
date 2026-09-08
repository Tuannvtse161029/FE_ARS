#!/usr/bin/env node
/**
 * run-smoke.mjs — fast end-to-end smoke suite.
 *
 * Runs the unit-test slice tagged `smoke` (or the equivalent config
 * file) so contributors can do a 30-second sanity check after a fresh
 * checkout, a non-trivial merge, or a dependency bump — without
 * waiting for the full test pipeline.
 *
 * Forwards stdio so jest output stays visible.
 */
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');

// Prefer a dedicated `vitest.smoke.config.ts` if present; otherwise
// fall back to the unit config with a `--testNamePattern` that
// matches tests tagged `@smoke`. We pick the dedicated config when
// it exists because the suite author is best positioned to decide
// which tests earn the `smoke` tag.
const candidates = [
  join(projectRoot, 'vitest.smoke.config.ts'),
  join(projectRoot, 'vitest.unit.config.ts'),
];
const configPath = candidates.find((p) => {
  try {
    // `fs.existsSync` would require an import — use stat via child_process.
    const { execSync } = require('node:child_process');
    execSync(`node -e "require('fs').accessSync('${p.replace(/\\/g, '/')}')"`, {
      stdio: 'ignore',
    });
    return true;
  } catch {
    return false;
  }
}) ?? candidates[1];

const vitestBin = join(projectRoot, 'node_modules', 'vitest', 'vitest.mjs');
const child = spawn(
  process.execPath,
  [vitestBin, 'run', '--config', configPath, '--testNamePattern', 'smoke'],
  { stdio: 'inherit', cwd: projectRoot, env: process.env },
);
child.on('exit', (code) => process.exit(code ?? 0));
