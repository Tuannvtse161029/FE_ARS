#!/usr/bin/env node
/**
 * scripts/sync-readme-tree.mjs
 * ─────────────────────────────
 * Drift checker for the `src/` project-structure tree inside `README.md`.
 *
 * Why this script exists
 *   The README's Project Structure section is intentionally hand-curated
 *   (each folder has an inline annotation like
 *   `# App bootstrap (main.tsx, App.tsx, firebase.ts)`). A blind
 *   regeneration would erase those annotations, so we deliberately do
 *   NOT overwrite the tree. Instead, this script:
 *
 *     1. Walks `src/` to a configurable depth and prints the *actual*
 *        top-level folders + their immediate children.
 *     2. Locates the `## Project Structure` block in `README.md`.
 *     3. Parses the existing ``` fenced tree block and diffs its folder
 *        names against the live filesystem.
 *     4. Prints a human-readable drift report and exits non-zero if the
 *        tree has drifted.
 *
 * Usage
 *   node scripts/sync-readme-tree.mjs                # default depth 2
 *   node scripts/sync-readme-tree.mjs --depth 3      # walk deeper
 *   node scripts/sync-readme-tree.mjs --write        # overwrite the
 *                                                     # fenced block with
 *                                                     # a plain (un-
 *                                                     # annotated) tree.
 *
 * Exit codes
 *   0 — no drift detected (or --write succeeded).
 *   1 — drift detected and --write was not passed.
 *
 * The script depends only on Node's built-in `fs` and `path` modules so
 * it works the same on Windows, macOS, and Linux without a transitive
 * dependency. This keeps the README tooling zero-install on CI.
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();
const README_PATH = path.join(ROOT, 'README.md');
const SRC_PATH = path.join(ROOT, 'src');
const MAX_DEPTH = 2;

// Folders that are not worth surfacing in a Project Structure tree.
const IGNORE = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  '.next',
  '.cache',
  'coverage',
]);

const argv = process.argv.slice(2);
const writeMode = argv.includes('--write');
const depthArgIdx = argv.indexOf('--depth');
const depth =
  depthArgIdx >= 0 ? Number.parseInt(argv[depthArgIdx + 1] ?? '', 10) || MAX_DEPTH : MAX_DEPTH;

/**
 * Walk a directory to a fixed depth and return an array of folder
 * names (relative to root) whose depth-from-root is `targetDepth`.
 *
 *   For depth=1 this returns the immediate children of `root`.
 *   For depth=2 it also returns their immediate children, flattened.
 */
const listFoldersAtDepth = async (root, targetDepth) => {
  const out = new Set();
  const walk = async (dir, currentDepth) => {
    if (currentDepth > targetDepth) return;
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (IGNORE.has(entry.name)) continue;
      if (entry.name.startsWith('.')) continue;
      if (!entry.isDirectory()) continue;
      const rel = path.relative(root, path.join(dir, entry.name));
      // `currentDepth` is the depth of `dir`. We want folders at the
      // target depth-from-root (1 = top-level, 2 = second-level).
      if (currentDepth + 1 <= targetDepth) {
        out.add(rel.split(path.sep).join('/'));
      }
      await walk(path.join(dir, entry.name), currentDepth + 1);
    }
  };
  await walk(root, 0);
  return [...out].sort();
};

/**
 * Parse the existing ``` fenced block in the Project Structure section
 * and pull out the folder names referenced (lines that look like
 * `├── foo/` or `└── foo/`).
 */
const extractFoldersFromReadme = async () => {
  const text = await fs.readFile(README_PATH, 'utf8');
  const sectionStart = text.indexOf('## Project Structure');
  if (sectionStart === -1) {
    throw new Error('Could not find `## Project Structure` section in README.md');
  }
  const after = text.slice(sectionStart);
  const fenceStart = after.indexOf('```');
  if (fenceStart === -1) {
    throw new Error('Could not find a code fence in the Project Structure section');
  }
  // Skip past the opening fence line.
  const blockStart = after.indexOf('\n', fenceStart) + 1;
  const fenceEnd = after.indexOf('```', blockStart);
  if (fenceEnd === -1) {
    throw new Error('Could not find the closing ``` fence');
  }
  const block = after.slice(blockStart, fenceEnd);

  const folders = new Set();
  for (const line of block.split('\n')) {
    // Match `├── foo/`, `└── foo/`, and any other `xxx foo/` shapes.
    const m = line.match(/(?:[├└]──\s+|│\s+├──\s+|│\s+└──\s+)([^\s][^\s]*)/);
    if (!m) continue;
    const raw = m[1].replace(/\/$/, ''); // strip trailing slash
    if (raw.includes('#')) continue; // inline comment follows
    // Skip file extensions that the README tree occasionally shows.
    if (/\.(ts|tsx|css|js|mjs|json|png|jpg|svg)$/.test(raw)) continue;
    folders.add(raw);
  }
  return { folders: [...folders].sort(), block, blockStart, fenceStart, sectionStart, after };
};

/**
 * Build an un-annotated tree dump suitable for splicing back into the
 * README. We deliberately keep this *plain* (no inline comments) so it
 * remains a mechanical output, not hand-curated prose.
 */
const buildPlainTree = (folders) => {
  const topLevel = folders.filter((f) => !f.includes('/'));
  const lines = ['src/'];
  for (const top of topLevel) {
    lines.push(`├── ${top}/`);
    const children = folders.filter((f) => f.startsWith(`${top}/`));
    children.forEach((child, idx) => {
      const name = child.split('/').slice(1).join('/');
      const isLast = idx === children.length - 1;
      const branch = isLast ? '└── ' : '├── ';
      lines.push(`│   ${branch}${name}/`);
    });
  }
  return lines.join('\n');
};

/**
 * Replace the ``` fenced block under Project Structure with a plain
 * regenerated tree.
 */
const splicePlainTree = async (treeText) => {
  const text = await fs.readFile(README_PATH, 'utf8');
  const ctx = await extractFoldersFromReadme();
  const { blockStart, fenceEnd } = ctx;
  const sectionStart = text.indexOf('## Project Structure');
  const fenceStartInText = sectionStart + ctx.fenceStart;
  const blockStartInText = sectionStart + ctx.blockStart;
  const fenceEndInText = sectionStart + fenceEnd;

  const before = text.slice(0, blockStartInText);
  const after = text.slice(fenceEndInText);
  const next = `${before}${treeText}\n${after}`;
  await fs.writeFile(README_PATH, next, 'utf8');
};

const main = async () => {
  if (!(await fs.stat(SRC_PATH).catch(() => null))) {
    console.error(`No src/ directory at ${SRC_PATH}. Run from project root.`);
    process.exit(2);
  }

  const live = await listFoldersAtDepth(SRC_PATH, depth);
  const { folders: readme } = await extractFoldersFromReadme();

  const liveSet = new Set(live);
  const readmeSet = new Set(readme);

  // An entry in the README tree counts as "covered" by the live tree
  // if it appears anywhere in the live path. This avoids false-
  // positive drift for nested names like `home` that legitimately live
  // under `features/publication/home/` — the README shows them under
  // the parent so they have no flat-name entry of their own.
  const isLivePathOrAncestor = (name) => {
    if (liveSet.has(name)) return true;
    return live.some((p) => p.endsWith(`/${name}`));
  };
  const isReadmePathOrAncestor = (name) => {
    if (readmeSet.has(name)) return true;
    return readme.some((p) => p.endsWith(`/${name}`));
  };

  const missingInReadme = live.filter((f) => {
    const last = f.split('/').pop();
    return !isReadmePathOrAncestor(last);
  });
  const staleInReadme = readme.filter((f) => {
    if (isLivePathOrAncestor(f)) return false;
    // Last-segment match also counts as covered.
    const last = f.split('/').pop();
    return !isLivePathOrAncestor(last);
  });

  if (missingInReadme.length === 0 && staleInReadme.length === 0) {
    console.log(`OK — README project structure is in sync with src/ at depth ${depth}.`);
    process.exit(0);
  }

  console.log(`README project structure has drifted from src/ (depth ${depth}).\n`);
  if (missingInReadme.length > 0) {
    console.log('Folders in src/ missing from README:');
    for (const f of missingInReadme) console.log(`  + ${f}`);
    console.log();
  }
  if (staleInReadme.length > 0) {
    console.log('Folders in README no longer in src/:');
    for (const f of staleInReadme) console.log(`  - ${f}`);
    console.log();
  }

  if (writeMode) {
    const tree = buildPlainTree(live);
    await splicePlainTree(tree);
    console.log('Wrote a plain (un-annotated) tree into README.md. Review the diff before committing.');
    process.exit(0);
  }

  console.log(
    'Re-run with --write to overwrite the README tree with a plain (un-annotated) version, or hand-edit to preserve the annotations.',
  );
  process.exit(1);
};

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(2);
});
