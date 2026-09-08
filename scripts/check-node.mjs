#!/usr/bin/env node
/**
 * check-node.mjs — verify the running Node matches `.nvmrc` (or the
 * `engines.node` field in `package.json`). Used by CI / `npm run node:check`.
 *
 * Exit codes:
 *   0 — match
 *   1 — version mismatch (printed to stderr)
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');

function readExpectedMajor() {
  const nvmrcPath = join(projectRoot, '.nvmrc');
  if (existsSync(nvmrcPath)) {
    const raw = readFileSync(nvmrcPath, 'utf8').trim();
    const major = parseInt(raw, 10);
    if (Number.isFinite(major)) return { major, source: '.nvmrc' };
  }
  const pkgPath = join(projectRoot, 'package.json');
  if (existsSync(pkgPath)) {
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
    const engines = pkg?.engines?.node;
    if (engines) {
      const match = engines.match(/(\d+)/);
      if (match) return { major: parseInt(match[1], 10), source: 'package.json#engines.node' };
    }
  }
  return null;
}

const expected = readExpectedMajor();
if (!expected) {
  console.log('\u2713 No Node version pin found in .nvmrc or package.json — nothing to check.');
  process.exit(0);
}

const actual = process.versions.node;
const actualMajor = parseInt(actual.split('.')[0], 10);

if (actualMajor === expected.major) {
  console.log(`\u2713 Node ${actual} matches ${expected.source} (${expected.major}.x).`);
  process.exit(0);
}

console.error(
  `\u274c Node ${actual} does not match ${expected.source} (expected major ${expected.major}).\n` +
    `   Run \`nvm use\` or install Node ${expected.major}.x.`,
);
process.exit(1);
