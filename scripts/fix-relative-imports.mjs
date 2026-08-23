// Targeted rewrites for stale relative imports in tests/.
//
// `tests/` was moved from `src/tests/`, so many test files still use
// `../../routes/<x>` (pointing to `tests/routes/<x>` under the new layout)
// instead of `../../../src/routes/<x>`. We fix this by detecting any
// relative import that does NOT resolve to a real file and rewriting it
// to a working alternative.

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.argv[2] || '.';
const TESTS_DIR = path.join(ROOT, 'tests');

const PROJECT_DIRS = new Set([
  'routes', 'services', 'store', 'components', 'pages',
  'context', 'hooks', 'layouts', 'utils', 'types', 'config',
  'assets', 'firebase.ts', 'App', 'main',
]);

function upCount(rel) {
  rel = rel.split('\\').join('/');
  // Match leading "../" segments, including when they're separated by parts.
  // The simpler `^\.\.\//g` skips one per match; using a lookahead-free
  // explicit check is more robust: walk the string segment-by-segment.
  let count = 0;
  let pos = 0;
  while (rel.startsWith('..', pos) && (rel[pos + 2] === '/' || rel[pos + 2] === undefined)) {
    count++;
    pos += 2;
    if (rel[pos] === '/') pos++;
  }
  return count;
}

function pathLooksProjectRel(rel) {
  rel = rel.split('\\').join('/');
  const u = upCount(rel);
  const tail = rel.split('/').slice(u);
  const first = tail[0] || '';
  return PROJECT_DIRS.has(first.replace(/\.tsx?$/, ''));
}

function resolveRel(fromDir, rel) {
  rel = rel.split('\\').join('/');
  // `fromDir` is already absolute; path.resolve handles `../` correctly.
  return path.resolve(fromDir, rel);
}

function existsAsFileOrExt(p) {
  if (fs.existsSync(p)) return true;
  for (const ext of ['.tsx', '.ts', '.js', '.jsx']) {
    if (fs.existsSync(p + ext)) return true;
    if (fs.existsSync(path.join(path.dirname(p), 'index' + ext)) && path.basename(p) !== 'index') {
      // Allow directory imports.
      if (fs.existsSync(path.dirname(p))) {
        const idxPath = path.join(path.dirname(p), 'index' + ext);
        if (fs.existsSync(idxPath)) return true;
      }
    }
  }
  return false;
}

function tryFix(fromDir, rel) {
  // 1. Does it resolve as-is? Yes → no fix needed.
  if (existsAsFileOrExt(resolveRel(fromDir, rel))) return null;

  // 2. Try one extra ../.
  const bumped = '../' + rel;
  if (existsAsFileOrExt(resolveRel(fromDir, bumped))) return bumped;

  // 3. Try with `src/` injected after the up-segments.
  const u = upCount(rel);
  const upSegs = '../'.repeat(u + 1);
  const withSrc = upSegs + 'src/' + rel.split('/').slice(u).join('/');
  if (existsAsFileOrExt(resolveRel(fromDir, withSrc))) return withSrc;

  // 4. Try one more extra ../ on top of step 3.
  const withSrcPlusOne = '../' + withSrc;
  if (existsAsFileOrExt(resolveRel(fromDir, withSrcPlusOne))) return withSrcPlusOne;

  return null;
}

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
    const original = content;

    // Match import lines that contain a relative path. We avoid touching
    // anything that isn't a relative path.
    content = content.replace(
      /(from\s+|import\s+|\(\s*)\s*['"]([^'"]+)['"]/g,
      (match, prefix, rel) => {
        if (!rel.startsWith('.')) return match;
        if (rel.startsWith('..') && !rel.startsWith('../')) return match;

        if (!pathLooksProjectRel(rel)) return match;

        const testDir = path.dirname(full);
        const newRel = tryFix(testDir, rel);
        if (!newRel || newRel === rel) return match;
        changes++;
        // eslint-disable-next-line no-console
        console.log(`  ${path.relative(ROOT, full)}: ${rel} -> ${newRel}`);
        return match.replace(rel, newRel);
      }
    );

    if (content !== original) {
      fs.writeFileSync(full, content, 'utf8');
      // eslint-disable-next-line no-console
      console.log(`fixed: ${path.relative(ROOT, full)}`);
    }
  }
}

walk(TESTS_DIR);
// eslint-disable-next-line no-console
console.log(`\nScanned ${touched}. Rewrote ${changes}.`);
