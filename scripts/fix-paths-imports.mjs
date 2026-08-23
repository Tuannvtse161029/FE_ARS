// One-shot fix: rewrite stale relative imports that point to `routes/paths`
// from test files. The ROUTES path lives at `src/routes/paths.ts`; tests
// under `tests/unit/...` must walk to the workspace root and back into
// `src/routes/paths`. Old import used `../../routes/paths` (which assumed
// the prior `src/tests/` location); we rewrite to `../../../src/routes/paths`.

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.argv[2] || '.';
const TESTS_DIR = path.join(ROOT, 'tests');

const pairs = [
  [`from '../../routes/paths'`, `from '../../../src/routes/paths'`],
  [`from "../../routes/paths"`, `from "../../../src/routes/paths"`],
];

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

    let content = fs.readFileSync(full, 'utf8');
    let original = content;
    for (const [from, to] of pairs) {
      const re = new RegExp(from.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&'), 'g');
      const n = (content.match(re) || []).length;
      if (n) {
        content = content.replace(re, to);
        changes += n;
      }
    }
    if (content !== original) {
      fs.writeFileSync(full, content, 'utf8');
      // eslint-disable-next-line no-console
      console.log(`fixed: ${path.relative(ROOT, full)}`);
    }
  }
}

walk(TESTS_DIR);
// eslint-disable-next-line no-console
console.log(`\nScanned ${touched} files. Rewrote ${changes} paths.`);
