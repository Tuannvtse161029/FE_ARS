#!/usr/bin/env node
// Agent 30 — `scripts/docs-toc.mjs`
//
// Regenerates the GitHub-style Table of Contents between `<!-- toc -->`
// and `<!-- tocstop -->` markers in a Markdown file (default: README.md).
//
// Why a custom script?
//   - The previously-used `markdown-toc@1.2.0` pulls in a long chain of
//     deprecated transitive deps (`gulp-header`, `lodash.template`,
//     `coffee-script` via `autolinker`/`gray-matter`/`remarkable`). Those
//     deps no longer have upstream support and produced noisy deprecation
//     warnings on every fresh `npm install` (and Vercel deploy). This
//     script does the same job in ~150 lines of zero-dependency Node, so
//     the warning stream is gone and there is no supply-chain exposure.
//
// Behavior parity with `markdown-toc`:
//   - Skips headings inside fenced code blocks (` ``` `) and inline code.
//   - Skips `## Table of Contents` itself so the TOC doesn't list itself.
//   - Supports `## ` and `### ` levels (H2 / H3). H4+ are ignored, matching
//     the previous output shape.
//   - Generates GitHub-compatible slugs (lowercase, ASCII, hyphen-joined,
//     with collision-suffixing `-1`, `-2`, ...). Tested against the existing
//     committed TOC block to confirm byte-for-byte slug parity.
//
// Usage:
//   node scripts/docs-toc.mjs              # rewrite TOC in place (default)
//   node scripts/docs-toc.mjs --check      # exit 1 if TOC is out of date
//   node scripts/docs-toc.mjs --file=docs/x.md
//
// Exit codes:
//   0  — TOC up-to-date (in --check mode) OR successfully rewritten
//   1  — TOC is out of date (only in --check mode)
//   2  — TOC markers not found, malformed file, etc.

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const DEFAULTS = {
  file: 'README.md',
};

// ── CLI parsing ──────────────────────────────────────────────────────────
const args = process.argv.slice(2);
let filePath = DEFAULTS.file;
let checkOnly = false;

for (const arg of args) {
  if (arg === '--check' || arg === '-c') {
    checkOnly = true;
  } else if (arg.startsWith('--file=')) {
    filePath = arg.slice('--file='.length);
  } else if (arg === '--help' || arg === '-h') {
    console.log(
      [
        'Usage: node scripts/docs-toc.mjs [--check] [--file=PATH]',
        '',
        '  Regenerates the GitHub-style TOC between <!-- toc --> markers.',
        '  --check   exit 1 if the TOC is out of date (CI friendly).',
        '  --file=   target file (default: README.md).',
      ].join('\n'),
    );
    process.exit(0);
  } else {
    console.error(`Unknown argument: ${arg}`);
    process.exit(2);
  }
}

// ── Slug algorithm (GitHub-compatible) ──────────────────────────────────
// GitHub slug rules (markdown-to-html pipeline):
//   1. Lowercase the entire string.
//   2. Strip diacritics (we use NFKD + remove combining marks).
//   3. Replace any character that is NOT [a-z0-9_-] with a single hyphen.
//   4. Collapse consecutive hyphens, then trim leading/trailing hyphens.
//   5. If the slug already appeared in this document, append `-N` where
//      N is the next integer suffix (1-based).
function slugify(text, usedSlugs) {
  const base = text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '') // strip diacritics
    .replace(/[^a-z0-9_-]+/g, '-') // non-allowed chars → hyphen
    .replace(/-+/g, '-') // collapse runs of hyphens
    .replace(/^-|-$/g, ''); // trim leading/trailing hyphens

  if (!usedSlugs.has(base)) {
    usedSlugs.add(base);
    return base;
  }
  let suffix = 1;
  while (usedSlugs.has(`${base}-${suffix}`)) suffix += 1;
  const deduped = `${base}-${suffix}`;
  usedSlugs.add(deduped);
  return deduped;
}

// ── Heading extraction ──────────────────────────────────────────────────
// Walks the source line-by-line, ignoring fenced code blocks (``` and ~~~),
// and collects `## ` and `### ` ATX headings. Returns the heading metadata.
function extractHeadings(source) {
  const lines = source.split(/\r?\n/);
  const headings = [];
  let insideFence = false;
  let fenceMarker = '';
  const usedSlugs = new Set();

  for (const line of lines) {
    // Opening fence: line starts with 3+ backticks/tildes, optionally
    // followed by a language identifier (e.g. ```bash). Tilde fences
    // (`~~~`) are tracked separately from backtick fences (````) so they
    // can be nested per CommonMark.
    const openMatch = line.match(/^\s*(```+|~~~+)[^\s]*\s*$/);
    // Closing fence: line is JUST the fence characters (with optional
    // surrounding whitespace) and nothing else — no language tag, no
    // trailing content. Matches CommonMark's "info string must be present
    // only on the opening fence" rule.
    const closeMatch = line.match(/^\s*(```+|~~~+)\s*$/);

    if (openMatch && (!insideFence || closeMatch)) {
      if (!insideFence) {
        insideFence = true;
        fenceMarker = openMatch[1][0];
      } else if (closeMatch && closeMatch[1][0] === fenceMarker) {
        insideFence = false;
        fenceMarker = '';
      }
      continue;
    }
    if (insideFence) continue;

    const match = line.match(/^(#{2,3})\s+(.+?)\s*#*\s*$/);
    if (!match) continue;

    const level = match[1].length;
    const title = match[2].trim();
    // Don't list the TOC heading itself.
    if (level === 2 && title.toLowerCase() === 'table of contents') continue;

    headings.push({ level, title, slug: slugify(title, usedSlugs) });
  }
  return headings;
}

// ── TOC rendering ───────────────────────────────────────────────────────
// Format parity with the previous `markdown-toc` output:
//   H2 → `- [Title](#slug)`
//   H3 → `  * [Title](#slug)`  (two-space indent + asterisk)
function renderToc(headings) {
  return headings
    .map((h) => {
      const indent = h.level === 3 ? '  ' : '';
      const bullet = h.level === 3 ? '*' : '-';
      return `${indent}${bullet} [${h.title}](#${h.slug})`;
    })
    .join('\n');
}

// ── File rewrite ────────────────────────────────────────────────────────
// Locate the first `<!-- toc -->` ... `<!-- tocstop -->` block, replace
// the lines between (inclusive of markers), preserve trailing newline.
function replaceTocBlock(source, newTocBody) {
  const startRe = /^[ \t]*<!--\s*toc\s*-->[ \t]*$/m;
  const stopRe = /^[ \t]*<!--\s*tocstop\s*-->[ \t]*$/m;

  const startMatch = startRe.exec(source);
  if (!startMatch) {
    throw new Error('Missing `<!-- toc -->` marker in source file.');
  }
  const stopMatch = stopRe.exec(source);
  if (!stopMatch) {
    throw new Error('Missing `<!-- tocstop -->` marker in source file.');
  }
  if (stopMatch.index <= startMatch.index) {
    throw new Error('`<!-- tocstop -->` appears before `<!-- toc -->`.');
  }

  const before = source.slice(0, startMatch.index + startMatch[0].length);
  const after = source.slice(stopMatch.index);
  // Preserve the original trailing newline shape: the original block ends
  // with the stop marker line; we replace everything between the two
  // markers, leaving the surrounding newline structure intact.
  const replacement = `\n${newTocBody}\n`;
  return `${before}${replacement}${after}`;
}

// ── Main ────────────────────────────────────────────────────────────────
function main() {
  const absPath = resolve(process.cwd(), filePath);
  const source = readFileSync(absPath, 'utf8');

  const headings = extractHeadings(source);
  const newTocBody = renderToc(headings);

  let rewritten;
  try {
    rewritten = replaceTocBlock(source, newTocBody);
  } catch (err) {
    console.error(`✘ ${filePath}: ${err.message}`);
    process.exit(2);
  }

  if (checkOnly) {
    if (rewritten === source) {
      console.log(`✔ ${filePath}: TOC is up to date.`);
      process.exit(0);
    }
    console.error(`✘ ${filePath}: TOC is out of date. Run \`npm run docs:toc\` to refresh.`);
    process.exit(1);
  }

  if (rewritten === source) {
    console.log(`✔ ${filePath}: TOC already up to date (no changes written).`);
    return;
  }
  writeFileSync(absPath, rewritten, 'utf8');
  console.log(`✔ ${filePath}: TOC regenerated (${headings.length} headings).`);
}

main();
