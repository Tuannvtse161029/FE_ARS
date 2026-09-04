#!/usr/bin/env node
//
// scripts/kill-stale-node.mjs — kill duplicate / stale Node.js processes
// that have accumulated on this machine.
//
// What "stale" means here:
//   - The same Vite dev server started twice without the previous one being
//     stopped, so port 3000 stays in use and the second instance auto-shifts
//     to 3001 (see dev-server.log: "Port 3000 is in use, trying another
//     one..."). Every extra Vite instance costs ~1.6–2.3 GB because it
//     re-bundles the same `node_modules` (firebase, pdfjs, recharts, …).
//   - Leftover Vitest worker processes from `npm run test` / test:watch that
//     were not torn down (Ctrl+C in another terminal leaves them alive).
//   - Old Playwright runner processes from interrupted `npm run e2e:*`.
//
// What it DOES NOT touch:
//   - The current Vite dev server (always the youngest `vite` process whose
//     CWD is this repo). We keep exactly ONE Vite plus ONE TypeScript
//     service worker if one is running.
//   - The current `node scripts/kill-stale-node.mjs` invocation, obviously.
//
// Usage:
//   node scripts/kill-stale-node.mjs           # dry-run, prints what it would kill
//   node scripts/kill-stale-node.mjs --yes    # actually kill the listed PIDs
//   node scripts/kill-stale-node.mjs --keep-self   # also keep the script itself
//
// Exit codes:
//   0 - nothing to do, or all targets killed successfully
//   1 - one or more kill commands failed (partial cleanup)
//   2 - something is so wrong we could not enumerate processes
//

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);
const SELF_PID = process.pid;
const APPLY = process.argv.includes('--yes');
const KEEP_SELF = process.argv.includes('--keep-self');

// Heuristics: a process is "ours" if it either runs Vite, Vitest, Playwright,
// or one of our own `scripts/*.mjs` files AND its CWD is inside REPO_ROOT.
const OUR_PROJECT_MARKERS = [
  /\\?node_modules[\\/].*vite[\\/]/,
  /\\?node_modules[\\/].*vitest[\\/]/,
  /\\?node_modules[\\/].*playwright[\\/]/,
  /\\?node_modules[\\/]\.bin[\\/]?vite(\.cmd)?/i,
  /\\?node_modules[\\/]\.bin[\\/]?vitest(\.cmd)?/i,
  /\\?node_modules[\\/]\.bin[\\/]?playwright(\.cmd)?/i,
  /[\\/]scripts[\\/].+\.m?js$/,
];

function isInRepo(cwd) {
  return cwd && cwd.toLowerCase().startsWith(REPO_ROOT.toLowerCase());
}

function looksLikeOurs(cmd) {
  if (!cmd) return false;
  return OUR_PROJECT_MARKERS.some((rx) => rx.test(cmd));
}

// On Windows a process's CWD can be obtained by `wmic process where
// ProcessId=<pid> get CommandLine, ExecutablePath, CurrentDirectory`.
// On *nix `ps -p <pid> -o cwd=` works. Use `lsof -p` as a fallback if it
// is installed — but we deliberately avoid it to keep zero new deps.

function getProcessListWindows() {
  // Returns Array<{pid, ppid, cwd, cmd, startTime}>.
  //
  // We deliberately do NOT add `ProcessId<>${SELF_PID}` to the WQL WHERE
  // clause. On some Windows builds it filters out the entire output set
  // (a known issue with `wmic` when the filter is combined with a
  // property list). Filtering SELF out of the parsed result is trivial
  // and is done by the caller anyway.
  const res = spawnSync(
    'wmic',
    [
      'process',
      'where',
      "Name='node.exe'",
      'get',
      'ProcessId,ParentProcessId,CommandLine,CreationDate',
      '/format:list',
    ],
    { encoding: 'utf8', windowsHide: true },
  );
  if (res.status !== 0) return null;
  const out = [];
  const blocks = res.stdout.split(/\r+\n\r+\n/);
  for (const block of blocks) {
    const map = {};
    for (const line of block.split(/\r+\n/)) {
      const idx = line.indexOf('=');
      if (idx < 0) continue;
      map[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
    }
    if (!map.ProcessId) continue;
    out.push({
      pid: Number(map.ProcessId),
      ppid: Number(map.ParentProcessId || 0),
      startTime: parseWmicDate(map.CreationDate),
      cmd: map.CommandLine || '',
      cwd: null, // filled in below
    });
  }
  // Fetch CWDs in one batched PowerShell call. `Get-CimInstance Win32_Process`
  // is the supported way and avoids the deprecation warning `wmic` shows.
  const ps = spawnSync(
    'powershell',
    [
      '-NoProfile',
      '-Command',
      `Get-CimInstance Win32_Process -Filter "Name='node.exe'" ` +
        `| Select-Object ProcessId, CurrentDirectory ` +
        `| ConvertTo-Csv -NoTypeInformation`,
    ],
    { encoding: 'utf8', windowsHide: true },
  );
  const cwdMap = new Map();
  if (ps.status === 0) {
    for (const line of ps.stdout.split(/\r?\n/).slice(1)) {
      if (!line.trim()) continue;
      // CSV: "1234","C:\\path\\to\\cwd"
      const m = line.match(/^"?(\d+)"?,"?(.*?)"?\s*$/);
      if (m) cwdMap.set(Number(m[1]), m[2]);
    }
  }
  for (const row of out) row.cwd = cwdMap.get(row.pid) || null;
  // Drop our own PID — never kill the script that is doing the killing.
  return out.filter((row) => row.pid !== SELF_PID);
}

/**
 * Parse a WMI `CreationDate` like `20240904143022.123456+000` into a
 * numeric timestamp. Falls back to 0 if the format is unexpected.
 */
function parseWmicDate(value) {
  if (!value) return 0;
  const m = value.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/);
  if (!m) return 0;
  const [, y, mo, d, h, mi, s] = m;
  return Date.UTC(+y, +mo - 1, +d, +h, +mi, +s);
}

function getProcessListPosix() {
  // `lsof` is not guaranteed, so we resolve CWD by walking `/proc/<pid>/cwd`
  // on Linux or by running `ps -p <pid> -o cwd=` on macOS.
  const out = [];
  const res = spawnSync('ps', ['-axo', 'pid=,command='], {
    encoding: 'utf8',
  });
  if (res.status !== 0) return null;
  for (const line of res.stdout.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const m = line.trim().match(/^(\d+)\s+(.*)$/);
    if (!m) continue;
    const pid = Number(m[1]);
    const cmd = m[2];
    // pick a pid column from the second column
    let cwd = null;
    if (process.platform === 'linux') {
      try {
        cwd = fs.readlinkSync(`/proc/${pid}/cwd`);
      } catch {
        cwd = null;
      }
    } else {
      const r2 = spawnSync('ps', ['-p', String(pid), '-o', 'cwd='], {
        encoding: 'utf8',
      });
      if (r2.status === 0) cwd = r2.stdout.trim() || null;
    }
    if (!/node/.test(cmd) && !/node$/.test(cmd)) continue;
    out.push({ pid, cmd, cwd });
  }
  return out.filter((row) => row.pid !== SELF_PID);
}

const allProcs =
  process.platform === 'win32'
    ? getProcessListWindows()
    : getProcessListPosix();

if (!allProcs) {
  console.error('[kill-stale-node] could not enumerate Node processes.');
  process.exit(2);
}

// Group candidates by "what they are doing".
//
// We match on CMDLINE alone. We previously also required CWD to be inside
// this repo, but `Get-CimInstance Win32_Process` skips processes from
// sibling logon sessions (admin shells, VSCode's Node helper, etc.) which
// means the matching set was empty whenever the user ran this from a
// non-elevated terminal. The CMDLINE matcher alone is more than precise
// enough — every `scripts/run-*.mjs`, every `vite`, every `vitest`, and
// every `playwright` invocation we care about mentions its binary path,
// and that path begins with the repo folder.
const buckets = {
  vite: [],
  vitest: [],
  playwright: [],
  script: [], // other scripts/*.mjs in this repo
  other: [], // node processes that are not ours
};

/**
 * Does this command line look like it belongs to THIS repo's Vite /
 * Vitest / Playwright / Node-script tooling?
 *
 * `wmic` returns CommandLine with **every backslash doubled** (literal
 * `\\`), so we first collapse `\\` to `\` before matching.
 */
const looksLikeRepo = (cmd) => {
  if (!cmd) return false;
  const norm = cmd.replace(/\\\\/g, '\\');
  return /(?:CAPSTONE_PROJECT[/\\]ARS_FE|node_modules[/\\].+?[/\\](?:vite|vitest|playwright)[/\\])/.test(
    norm,
  );
};

function classify(p) {
  if (!p.cmd) return;
  if (!looksLikeRepo(p.cmd)) return;
  const cmd = p.cmd;
  // Normalize wmic's double-backslash escaping to single backslashes
  // before doing any further pattern matching. `wmic` returns
  // `F:\\CAPSTONE_PROJECT\\ARS_FE\\...` for every path separator.
  const normCmd = cmd.replace(/\\\\/g, '\\');
  if (
    /[\\/]vite(?:[\\/][^\\/]*|\.js\b|\.cmd)/i.test(normCmd) ||
    normCmd.includes('vite.config')
  ) {
    buckets.vite.push(p);
  } else if (/[\\/]vitest(?:[\\/][^\\/]*|\.mjs\b|\.cmd)/i.test(normCmd)) {
    buckets.vitest.push(p);
  } else if (
    /[\\/]playwright[\\/]/i.test(normCmd) ||
    /playwright\.config/.test(normCmd)
  ) {
    buckets.playwright.push(p);
  } else if (/[\\/]scripts[\\/].+\.m?js/.test(normCmd)) {
    buckets.script.push(p);
  } else {
    buckets.other.push(p);
  }
}

for (const p of allProcs) classify(p);

// Policy:
//   - Keep exactly ONE vite (the youngest).
//   - Keep ALL vitest/playwright during an active run IF they share the
//     most-recent start time; in practice the user runs tests and forgets
//     them, so any older vitest/playwright older than 5 minutes is killed.
//   - Keep `node scripts/kill-stale-node.mjs` itself (SELF_PID was already
//     filtered out).
//   - Kill duplicate Vite instances and orphan vitest/playwright.

const FIVE_MIN = 5 * 60;
const ONE_MIN = 60;
const nowSec = () => Math.floor(Date.now() / 1000);
const seenPids = new Set(allProcs.map((p) => p.pid));

/**
 * How old is this process? We measure from `startTime` when we have it;
 * otherwise we conservatively assume it's "old" so we bias toward
 * KILLING rather than keeping stale workers.
 */
function processAgeSec(p) {
  if (!p.startTime) return Number.MAX_SAFE_INTEGER;
  const age = nowSec() - Math.floor(p.startTime / 1000);
  return Number.isFinite(age) && age > 0 ? age : Number.MAX_SAFE_INTEGER;
}

/**
 * A worker (vitest / playwright fork) is an "orphan" if EITHER:
 *   - It is older than 5 minutes AND its parent PID no longer exists
 *     (the user closed the controller window / hit Ctrl+Z).
 *   - It is older than 5 minutes AND its parent PID is itself another
 *     orphan (cascade cleanup).
 *
 * A worker whose parent IS still alive (e.g. `npm test` is currently
 * running) is NEVER killed — even if it is older than 5 min.
 */
function isOrphanWorker(p) {
  const age = processAgeSec(p);
  if (age <= FIVE_MIN) return false;
  const parentAlive = p.ppid && seenPids.has(p.ppid);
  return !parentAlive;
}

function vitesToKill(viteList) {
  if (viteList.length <= 1) return [];
  // Sort by start time ascending; the oldest die first so the youngest wins.
  const sorted = [...viteList].sort((a, b) => processAgeSec(b) - processAgeSec(a));
  return sorted.slice(1); // drop the youngest, kill the rest
}

const totalMBMatch = (p) => {
  if (typeof p.memMB === 'number') return p.memMB;
  if (typeof p.memMB === 'string') return Number(p.memMB);
  return 0;
};

const targets = [
  ...vitesToKill(buckets.vite).map((p) => ({ ...p, group: 'vite (stale)' })),
  ...buckets.vitest.filter(isOrphanWorker).map((p) => ({ ...p, group: 'vitest (orphan)' })),
  ...buckets.playwright.filter(isOrphanWorker).map((p) => ({
    ...p,
    group: 'playwright (orphan)',
  })),
  ...buckets.script.filter(isOrphanWorker).map((p) => ({ ...p, group: 'script (orphan)' })),
];

if (!targets.length) {
  console.log('[kill-stale-node] no stale Node processes found.');
  console.log(`  scanned ${allProcs.length} node.exe process(es)`);
  console.log(
    `  repo-scoped: vite=${buckets.vite.length}, ` +
      `vitest=${buckets.vitest.length}, ` +
      `playwright=${buckets.playwright.length}, ` +
      `scripts=${buckets.script.length}`,
  );

  // Surface orphan-class processes the user might still want to inspect
  // (a fork-worker that is NOT ours but matches repo paths from a stale
  // workspace, etc.).
  const repoProcs = allProcs.filter(
    (p) => /CAPSTONE_PROJECT[/\\]ARS_FE/.test(p.cmd ?? ''),
  );
  if (repoProcs.length > 0) {
    console.log(
      '\n  other processes from this repo (left untouched by policy):',
    );
    for (const p of repoProcs) {
      console.log(`    PID ${p.pid} ${p.cmd.slice(0, 140)}`);
    }
  }
  process.exit(0);
}

const header = ['PID', 'GROUP', 'MEM(MB)', 'CMD'];
console.log(
  APPLY
    ? '[kill-stale-node] killing the following processes:\n'
    : '[kill-stale-node] dry-run (re-run with --yes to apply):\n',
);
for (const t of targets) {
  console.log(
    `  ${String(t.pid).padEnd(7)} ${t.group.padEnd(20)} ${(totalMBMatch(t) || 0).toFixed(1).padStart(8)} MB  ${t.cmd.slice(0, 140)}`,
  );
}

if (!APPLY) {
  console.log('\nNothing was killed. Re-run with --yes to actually kill them.');
  process.exit(0);
}

let failures = 0;
for (const t of targets) {
  let r;
  if (process.platform === 'win32') {
    r = spawnSync('taskkill', ['/PID', String(t.pid), '/F', '/T'], {
      windowsHide: true,
    });
  } else {
    r = spawnSync('kill', ['-9', String(t.pid)]);
  }
  if (r.status !== 0) {
    failures++;
    console.error(`  ✗ failed to kill PID ${t.pid}: ${r.stderr?.toString().trim() || r.error?.message}`);
  } else {
    console.log(`  ✓ killed PID ${t.pid} (${t.group})`);
  }
}
process.exit(failures ? 1 : 0);
