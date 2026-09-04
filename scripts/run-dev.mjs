#!/usr/bin/env node
//
// scripts/run-dev.mjs — safe `npm run dev` wrapper.
//
// Three things happen before Vite starts:
//
//   1. Clean up stale Node processes from previous runs. Duplicated
//      dev servers / lingering test workers are the #1 source of
//      "Node is using 6 GB of RAM" complaints on this project.
//
//   2. Apply a hard memory cap to Vite via `--max-old-space-size`.
//      Without a cap, Vite's optimizer + module graph can grow past
//      2.3 GB per instance.
//
//   3. Apply Vite's recommended Node CLI flags for dev (--no-warnings,
//      `NODE_OPTIONS=--max-old-space-size=1536`). 1536 MB is enough
//      for a clean cold-start of this project's dep graph; raise it
//      locally if you need it for diagnostics.
//
// Usage:
//   npm run dev                 # uses this wrapper (default)
//   npm run dev:raw             # bypasses cleanup + memory cap (legacy)
//
// Why not just put the env vars in the script?
//   We want to keep `npm run dev:raw` reproducing the old behaviour
//   byte-for-byte (helps triage which of the two changes fixed an issue).

import { spawn } from 'node:child_process';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..');

// 1. Kill stale dev servers / orphan test runners before starting.
//    `--yes` is passed so this is fully non-interactive; failures are
//    logged but never block Vite from starting.
console.log('[run-dev] cleaning stale node processes...');
const cleanRes = spawn(
  process.execPath,
  [path.join(HERE, 'kill-stale-node.mjs'), '--yes'],
  { stdio: 'inherit', cwd: REPO_ROOT },
);
cleanRes.on('exit', (code) => {
  if (code !== 0 && code !== null) {
    console.warn(
      `[run-dev] stale-node cleanup returned exit ${code}; continuing anyway`,
    );
  }
  startVite();
});

function startVite() {
  // 2. Apply a hard heap cap. 1536 MB is enough for normal dev; if you
  // need more for a specific session, use `npm run dev:raw`.
  const env = { ...process.env };
  env.NODE_OPTIONS = [
    env.NODE_OPTIONS,
    '--max-old-space-size=1536',
  ]
    .filter(Boolean)
    .join(' ');

  // 3. Delegate to Vite's CLI (we intentionally bypass `npx` so we can
  // control argv exactly and avoid any PATH quirks on Windows).
  const viteBin = path.join(
    REPO_ROOT,
    'node_modules',
    'vite',
    'bin',
    'vite.js',
  );
  console.log(`[run-dev] starting vite (max-old-space-size=1536)`);
  const child = spawn(process.execPath, [viteBin], {
    stdio: 'inherit',
    cwd: REPO_ROOT,
    env,
  });

  const shutdown = (sig) => () => {
    if (!child.killed) child.kill(sig);
  };
  process.on('SIGINT', shutdown('SIGINT'));
  process.on('SIGTERM', shutdown('SIGTERM'));
  process.on('exit', shutdown('SIGTERM'));

  child.on('exit', (code, signal) => {
    if (signal) process.kill(process.pid, signal);
    process.exit(code ?? 0);
  });
}
