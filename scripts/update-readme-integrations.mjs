#!/usr/bin/env node
/**
 * update-readme-integrations.mjs
 *
 * Auto-update the "Project Integration" section of README.md so it stays
 * in sync with the live codebase. Scans:
 *
 *   - `src/utils/constants.ts`   → API endpoint groups (`API_ENDPOINTS.*`)
 *   - `src/services/*.service.ts` → service integrations
 *   - `src/i18n/dictionaries/*.ts` → locale coverage
 *   - `package.json` dependencies  → installed integrations
 *   - `docs/PUBLICATION_MAIN_FLOW_INCIDENT_REPORT.md` → recent incident
 *
 * Writes the rendered block between two sentinel markers in README.md:
 *
 *   <!-- INTEGRATIONS:START -->
 *   ...auto-generated...
 *   <!-- INTEGRATIONS:END -->
 *
 * The block is regenerated on every run. Any manual content outside the
 * sentinels is preserved verbatim. A short git-friendly note is written
 * to stdout so the caller (a GitHub Action) can decide whether to
 * commit the change.
 *
 * Usage:
 *   node scripts/update-readme-integrations.mjs [--check] [--write]
 *
 *   --check   exit 0 if README is up to date, exit 1 if it drifted (auto-fixable),
 *             exit 2 if markers are missing (cannot auto-fix)
 *   --write   (default) rewrite the README in place; exits 2 on missing markers,
 *             0 otherwise
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { resolve, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');
const README_PATH = resolve(REPO_ROOT, 'README.md');
const CONSTANTS_PATH = resolve(REPO_ROOT, 'src/utils/constants.ts');
const SERVICES_DIR = resolve(REPO_ROOT, 'src/services');
const DICT_DIR = resolve(REPO_ROOT, 'src/i18n/dictionaries');
const PACKAGE_JSON = resolve(REPO_ROOT, 'package.json');
const DOCS_DIR = resolve(REPO_ROOT, 'docs');

const START_MARKER = '<!-- INTEGRATIONS:START -->';
const END_MARKER = '<!-- INTEGRATIONS:END -->';

// ─────────────────────────────────────────────────────────────────────────
// CLI flags
// ─────────────────────────────────────────────────────────────────────────

const args = new Set(process.argv.slice(2));
const CHECK_ONLY = args.has('--check');
const FORCE_WRITE = args.has('--write') || !CHECK_ONLY;

// ─────────────────────────────────────────────────────────────────────────
// Discovery helpers
// ─────────────────────────────────────────────────────────────────────────

function safeReadText(filePath) {
  if (!existsSync(filePath)) return '';
  return readFileSync(filePath, 'utf8');
}

function listFilesRecursive(dir, predicate) {
  if (!existsSync(dir)) return [];
  const results = [];
  for (const entry of readdirSync(dir)) {
    const full = resolve(dir, entry);
    const stats = statSync(full);
    if (stats.isDirectory()) {
      results.push(...listFilesRecursive(full, predicate));
    } else if (predicate(full)) {
      results.push(full);
    }
  }
  return results;
}

function relativeToRepo(filePath) {
  return filePath.replace(REPO_ROOT + '\\', '').replace(REPO_ROOT + '/', '');
}

// ─────────────────────────────────────────────────────────────────────────
// API_ENDPOINTS scan
// ─────────────────────────────────────────────────────────────────────────

/**
 * Read `API_ENDPOINTS` from `src/utils/constants.ts` and surface the
 * top-level groups with their endpoint counts. We deliberately do NOT
 * inline the full endpoint list — the auto-generated table is a
 * discoverability index, not a contract document.
 *
 * Implementation notes: the file uses 2-space indentation. We slice out
 * the `export const API_ENDPOINTS = { ... }` block first (matching
 * braces), then enumerate the immediate children. This is robust
 * against nested groups like `ADMIN.AUDIT_LOGS.BASE` which would
 * otherwise be mis-counted as a top-level group.
 */
function scanApiEndpoints() {
  const text = safeReadText(CONSTANTS_PATH);
  if (!text) return [];

  // 1. Locate `export const API_ENDPOINTS = {` and walk braces to its end.
  const startMatch = text.match(/export\s+const\s+API_ENDPOINTS\s*=\s*\{/);
  if (!startMatch || startMatch.index === undefined) return [];
  let depth = 1;
  let cursor = startMatch.index + startMatch[0].length;
  while (cursor < text.length && depth > 0) {
    const ch = text[cursor];
    if (ch === '{') depth++;
    else if (ch === '}') depth--;
    cursor++;
  }
  const blockBody = text.slice(startMatch.index + startMatch[0].length, cursor - 1);
  const blockStartLine = text.slice(0, startMatch.index).split('\n').length - 1;

  // 2. Iterate immediate children. Each child is a `<NAME>: { ... }`
  //    at depth 1; nested groups at depth 2+ are ignored.
  const groups = [];
  const childRegex = /^\s{2}([A-Z_][A-Z0-9_]*):\s*\{/gm;
  let m;
  while ((m = childRegex.exec(blockBody)) !== null) {
    const startIndex = m.index;
    const groupName = m[1];
    let innerDepth = 1;
    let i = m.index + m[0].length;
    while (i < blockBody.length && innerDepth > 0) {
      const ch = blockBody[i];
      if (ch === '{') innerDepth++;
      else if (ch === '}') innerDepth--;
      i++;
    }
    const body = blockBody.slice(m.index + m[0].length, i - 1);
    // Count leaf endpoints at this level (any `KEY:` line that is itself
    // not a nested object). A line that ends with `{` is a nested group,
    // not an endpoint — skip it from the count.
    const entries = body
      .split('\n')
      .filter((line) => {
        const trimmed = line.trim();
        if (!trimmed) return false;
        // Skip nested object declarations; their endpoints will be
        // visible inside the parent's count via the total entry count.
        if (/\{\s*$/.test(trimmed)) return false;
        // Skip comments.
        if (trimmed.startsWith('//') || trimmed.startsWith('*')) return false;
        return /^[A-Z0-9_]+:/.test(trimmed);
      }).length;
    groups.push({
      name: groupName,
      count: entries,
      lineNumber: blockStartLine + blockBody.slice(0, startIndex).split('\n').length,
    });
  }
  return groups;
}

// ─────────────────────────────────────────────────────────────────────────
// Service integrations scan
// ─────────────────────────────────────────────────────────────────────────

function scanServices() {
  if (!existsSync(SERVICES_DIR)) return [];
  const services = listFilesRecursive(SERVICES_DIR, (f) => f.endsWith('.service.ts'));
  return services
    .map((file) => basename(file, '.service.ts'))
    .sort();
}

// ─────────────────────────────────────────────────────────────────────────
// i18n dictionary scan
// ─────────────────────────────────────────────────────────────────────────

function scanDictionaries() {
  if (!existsSync(DICT_DIR)) return [];
  const dicts = readdirSync(DICT_DIR).filter((f) => f.endsWith('.ts') && !f.startsWith('types'));
  return dicts.map((f) => basename(f, '.ts')).sort();
}

// ─────────────────────────────────────────────────────────────────────────
// package.json integration signals
// ─────────────────────────────────────────────────────────────────────────

const INTEGRATION_KEYWORDS = [
  ['firebase', 'Firebase Cloud Storage'],
  ['axios', 'Axios HTTP client'],
  ['react-router', 'React Router'],
  ['lucide-react', 'Lucide icons'],
  ['pdfjs-dist', 'PDF.js viewer'],
  ['pdf-lib', 'PDF generation (pdf-lib)'],
  ['recharts', 'Recharts analytics'],
  ['zustand', 'Zustand state'],
  ['react-hook-form', 'React Hook Form'],
  ['yup', 'Yup validation'],
];

function scanDependencies() {
  const text = safeReadText(PACKAGE_JSON);
  if (!text) return [];
  const pkg = JSON.parse(text);
  const found = new Map();
  const sources = {
    dependencies: pkg.dependencies ?? {},
    devDependencies: pkg.devDependencies ?? {},
  };
  for (const [src, deps] of Object.entries(sources)) {
    for (const keyword of Object.keys(deps)) {
      for (const [needle, label] of INTEGRATION_KEYWORDS) {
        if (keyword === needle || keyword.startsWith(`${needle}/`)) {
          if (!found.has(needle)) {
            found.set(needle, { label, version: deps[keyword], source: src });
          }
        }
      }
    }
  }
  return Array.from(found.values());
}

// ─────────────────────────────────────────────────────────────────────────
// Incident / report markers
// ─────────────────────────────────────────────────────────────────────────

function scanIncidentReports() {
  if (!existsSync(DOCS_DIR)) return [];
  const docs = listFilesRecursive(DOCS_DIR, (f) => /INCIDENT_REPORT|REPORT\.md$/i.test(f));
  return docs
    .filter((f) => !f.includes('local-only') && !f.includes('reports'))
    .map((f) => relativeToRepo(f));
}

// ─────────────────────────────────────────────────────────────────────────
// Render the auto block
// ─────────────────────────────────────────────────────────────────────────

function renderIntegrationsBlock() {
  const groups = scanApiEndpoints();
  const services = scanServices();
  const dicts = scanDictionaries();
  const deps = scanDependencies();
  const reports = scanIncidentReports();

  const now = new Date().toISOString().slice(0, 10);

  const lines = [];
  lines.push(`> Last refreshed: ${now} — auto-generated by \`scripts/update-readme-integrations.mjs\`.`);
  lines.push(`> Do not edit this block by hand; the next workflow run will overwrite it.`);
  lines.push('');

  // API integrations
  lines.push('### API integration surface');
  lines.push('');
  if (groups.length === 0) {
    lines.push('- _No API endpoint groups detected._');
  } else {
    lines.push('Top-level endpoint groups defined in `src/utils/constants.ts`:');
    lines.push('');
    lines.push('| Group | Endpoints | Source |');
    lines.push('| --- | ---: | --- |');
    for (const group of groups) {
      lines.push(`| \`${group.name}\` | ${group.count} | src/utils/constants.ts:${group.lineNumber} |`);
    }
  }
  lines.push('');

  // Service integrations
  lines.push('### Service layer');
  lines.push('');
  if (services.length === 0) {
    lines.push('- _No service modules detected._');
  } else {
    lines.push('Each entry below is a live API client wrapper in `src/services/`:');
    lines.push('');
    lines.push('| Service | Purpose |');
    lines.push('| --- | --- |');
    for (const name of services) {
      lines.push(`| \`${name}.service\` | Backend integration for ${humanize(name)} |`);
    }
  }
  lines.push('');

  // i18n
  lines.push('### Internationalization');
  lines.push('');
  if (dicts.length === 0) {
    lines.push('- _No dictionaries detected._');
  } else {
    lines.push(`Active locales: ${dicts.map((d) => `\`${d}\``).join(', ')} (${dicts.length}).`);
  }
  lines.push('');

  // npm integration signals
  lines.push('### Third-party libraries');
  lines.push('');
  if (deps.length === 0) {
    lines.push('- _No tracked third-party integrations._');
  } else {
    lines.push('| Library | Version | Role |');
    lines.push('| --- | --- | --- |');
    for (const dep of deps) {
      lines.push(`| \`${dep.label}\` | ${dep.version} | ${dep.source} |`);
    }
  }
  lines.push('');

  // Incident reports
  if (reports.length > 0) {
    lines.push('### Recent incident reports');
    lines.push('');
    for (const report of reports) {
      lines.push(`- [${basename(report)}](${report})`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

function humanize(name) {
  return name
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[-_]/g, ' ')
    .toLowerCase()
    .replace(/^\w/, (c) => c.toUpperCase());
}

// ─────────────────────────────────────────────────────────────────────────
// README patch
// ─────────────────────────────────────────────────────────────────────────

function buildUpdatedReadme(current) {
  if (!current.includes(START_MARKER) || !current.includes(END_MARKER)) {
    return {
      content: null,
      message: 'Sent markers not found in README.md — refusing to modify.',
    };
  }
  const before = current.slice(0, current.indexOf(START_MARKER));
  const afterStart = current.indexOf(START_MARKER) + START_MARKER.length;
  const endIndex = current.indexOf(END_MARKER, afterStart);
  const after = current.slice(endIndex + END_MARKER.length);
  const block = renderIntegrationsBlock();
  const rebuilt = `${before}${START_MARKER}\n${block}\n${END_MARKER}${after}`;
  return { content: rebuilt, message: 'OK' };
}

// ─────────────────────────────────────────────────────────────────────────
// Entrypoint
// ─────────────────────────────────────────────────────────────────────────

function main() {
  const current = safeReadText(README_PATH);
  if (!current) {
    console.error(`❌ Could not read ${README_PATH}`);
    process.exit(1);
  }
  const { content, message } = buildUpdatedReadme(current);
  if (content === null) {
    // Missing markers is unrecoverable from this script's perspective.
    // Use a distinct exit code so callers can decide how to react:
    //   - exit 2 → hard fail ("a human must restore the markers")
    //   - exit 1 → drift ("the next --write step will regenerate the block")
    console.error(`❌ ${message}`);
    console.error(`Add the following markers to README.md to enable auto-update:`);
    console.error(`  ${START_MARKER}`);
    console.error(`  ${END_MARKER}`);
    process.exit(2);
  }
  const changed = content !== current;
  if (!changed) {
    console.log('✅ README integration block is already up to date.');
    if (CHECK_ONLY) process.exit(0);
    return;
  }
  if (CHECK_ONLY) {
    console.log('❌ README integration block is out of date.');
    console.log('Run `node scripts/update-readme-integrations.mjs` locally and commit the diff.');
    process.exit(1);
  }
  writeFileSync(README_PATH, content, 'utf8');
  console.log(`✅ Updated ${relativeToRepo(README_PATH)} (${content.length} bytes).`);
}

main();