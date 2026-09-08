#!/usr/bin/env node
/**
 * run-dev.mjs — project-wide dev runner.
 *
 * Why this script exists instead of `vite` directly:
 *
 *   1. Enforce the Node version pinned in `.nvmrc` (24) so contributors
 *      don't silently run a version that breaks ESM/CJS interop or Vite
 *      internals. Without this, devs can `nvm use 18 && npm run dev` and
 *      lose an afternoon to module-resolution mysteries.
 *   2. Load `.env.local` → `.env` automatically BEFORE Vite starts so the
 *      Vite proxy can read `VITE_API_BASE_URL` etc. We use the built-in
 *      `node:fs` path rather than `dotenv` to keep the dev runner
 *      dependency-free (one less transitive dep to audit).
 *   3. Kill any stale Vite / `npm run dev` processes before re-launching
 *      so port 3000 (`strictPort: true` in `vite.config.ts`) is freed
 *      deterministically. Without this, the second `npm run dev` on the
 *      same machine throws EADDRINUSE.
 *   4. Hand stdio straight through to the spawned `vite` so colors /
 *      Ctrl-C / HMR logs all behave exactly as if you ran `vite` directly.
 *
 * If anything fails the script exits with a non-zero code so the npm
 * pipeline surfaces the failure in CI the same way it would surface a
 * Vite crash.
 */
import { spawn } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

// ── 1. Node version gate ────────────────────────────────────────────────────
// `.nvmrc` is the source of truth for "which major is this project on".
// We fail loudly when the running Node doesn't match — devs on a wrong
// version waste hours on cryptic errors otherwise.
function readExpectedMajor() {
  const nvmrcPath = join(projectRoot, '.nvmrc');
  if (!existsSync(nvmrcPath)) return null;
  const raw = readFileSync(nvmrcPath, 'utf8').trim();
  const major = parseInt(raw, 10);
  return Number.isFinite(major) ? major : null;
}

function assertNodeVersion() {
  const expected = readExpectedMajor();
  if (!expected) return; // no pin → don't gate
  const actual = parseInt(process.versions.node.split('.')[0], 10);
  if (actual !== expected) {
    console.error(
      `\u274c Node ${expected}.x is required (you have ${process.versions.node}).\n` +
        `   Run \`nvm use\` or install Node ${expected}.x before \`npm run dev\`.\n`,
    );
    process.exit(1);
  }
}

// ── 2. Load `.env.local` → `.env` ───────────────────────────────────────────
// Vite loads `.env*` automatically — but only for client-bundled vars.
// The proxy in `vite.config.ts` uses `process.env.VITE_API_BASE_URL` to
// point `/api` at the BE, and that runs in Node (the Vite dev server)
// BEFORE Vite's own loader kicks in. So we mirror a tiny subset here.
function loadDotenv() {
  const envLocalPath = join(projectRoot, '.env.local');
  const envPath = join(projectRoot, '.env');
  for (const path of [envLocalPath, envPath]) {
    if (!existsSync(path)) continue;
    const raw = readFileSync(path, 'utf8');
    for (const rawLine of raw.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;
      const eq = line.indexOf('=');
      if (eq <= 0) continue;
      const key = line.slice(0, eq).trim();
      let value = line.slice(eq + 1).trim();
      // strip surrounding quotes if any
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = value;
    }
  }
}

// ── 3. Stale-process cleanup ────────────────────────────────────────────────
// Best-effort. On Windows, port 3000 stays held by orphaned `node.exe`
// children when the parent shell got killed but the child survived. We
// use `tasklist` + `taskkill` here instead of `lsof`/`pkill` because
// Windows has neither.
function killStaleVite() {
  if (process.platform !== 'win32') return;
  try {
    const { execSync } = require('node:child_process');
    // `imageName eq "node.exe"` is the WMI-equivalent filter that ships
    // with `tasklist` on every Windows install — no extra deps required.
    const out = execSync(
      'tasklist /FI "IMAGENAME eq node.exe" /FO CSV /NH',
      { stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true },
    )
      .toString()
      .trim();
    if (!out) return;
    const pids = [];
    for (const row of out.split(/\r?\n/)) {
      const cols = row.split('","').map((s) => s.replace(/^"|"$/g, ''));
      const pid = cols[1];
      if (pid && /^\d+$/.test(pid)) pids.push(pid);
    }
    if (pids.length === 0) return;
    try {
      execSync(`taskkill /F /PID ${pids.join(' /PID ')}`, {
        stdio: 'ignore',
        windowsHide: true,
      });
      console.log(
        `\u26A0 Killed ${pids.length} stale node.exe process(es) to free port 3000.`,
      );
    } catch {
      // Permission denied is fine — another dev server is still running
      // and the user will see the EADDRINUSE error below.
    }
  } catch {
    // best-effort, never crash the dev runner
  }
}

// ── 4. Hand off to vite ─────────────────────────────────────────────────────
// `stdio: 'inherit'` keeps Ctrl-C, colours, and HMR logs intact. We
// forward vite's exit code so npm surfaces failures in the same way as
// a direct `vite` invocation.
function runVite() {
  const viteBin = join(projectRoot, 'node_modules', 'vite', 'bin', 'vite.js');
  if (!existsSync(viteBin)) {
    console.error(
      '\u274c vite is not installed. Run `npm install` before `npm run dev`.',
    );
    process.exit(1);
  }
  const child = spawn(
    process.execPath,
    [viteBin, ...process.argv.slice(2)],
    {
      stdio: 'inherit',
      cwd: projectRoot,
      env: process.env,
    },
  );
  // Forward Ctrl-C / kill so the user can stop the dev server cleanly.
  const forward = (signal) => () => {
    if (!child.killed) child.kill(signal);
  };
  process.on('SIGINT', forward('SIGINT'));
  process.on('SIGTERM', forward('SIGTERM'));
  child.on('exit', (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }
    process.exit(code ?? 0);
  });
}

assertNodeVersion();
loadDotenv();
killStaleVite();
runVite();
