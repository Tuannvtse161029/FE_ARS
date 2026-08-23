// One-shot fix: rewrite stale 5-level relative imports to 4-level imports
// for test files that now sit under tests/ (instead of the previous src/tests/).
//
// Before the test folder move, files lived at e.g.:
//   src/tests/unit/pages/Admin/RoleRequests.test.tsx
// After the move:
//   tests/unit/pages/Admin/RoleRequests.test.tsx
//
// That changes the relative depth by one. Tests that were not updated still
// have an extra "../" at the start of their import specifiers. We rewrite
// the only valid pair: `'../../../../..//src/` -> `'../../../../src/`.
//
// The targeted pattern avoids accidentally touching anything else (e.g. plain
// `require('dotenv')`).

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.argv[2] || '.';
const TESTS_DIR = path.join(ROOT, 'tests');

const oldPrefix = "'../../../../../src/";
const newPrefix = "'../../../../src/";

const oldDoublePrefix = '"../../../../../src/';
const newDoublePrefix = '"../../../../src/';

let touched = 0;
let changes = 0;

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full);
      continue;
    }
    if (!/\.test\.(ts|tsx)$/.test(entry.name)) continue;
    touched++;

    const content = fs.readFileSync(full, 'utf8');
    let updated = content;
    updated = updated.split(oldPrefix).join(newPrefix);
    updated = updated.split(oldDoublePrefix).join(newDoublePrefix);

    if (updated !== content) {
      fs.writeFileSync(full, updated, 'utf8');
      const diff = (content.match(new RegExp(oldPrefix.replace(/[/]/g, '\\/'), 'g')) || []).length
        + (content.match(new RegExp(oldDoublePrefix.replace(/[/]/g, '\\/'), 'g')) || []).length;
      changes += diff;
      // eslint-disable-next-line no-console
      console.log(`fixed: ${path.relative(ROOT, full)}  (${diff} occurrences)`);
    }
  }
}

walk(TESTS_DIR);
// eslint-disable-next-line no-console
console.log(`\nScanned ${touched} test files. Rewrote ${changes} occurrences.`);
