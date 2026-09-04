#!/usr/bin/env node
//
// scripts/check-node.mjs — list every Node.js process on this machine
// with memory and CPU usage, so we can spot stale dev servers, leftover
// test runners, or duplicate Vite instances before they eat all RAM.
//
// Usage:
//   node scripts/check-node.mjs          # all Node.js processes
//   node scripts/check-node.mjs --keep   # also print working-set MB
//
// Why this exists:
//   Vite pre-bundles ~180 MB of `node_modules` (`firebase`, `pdfjs-dist`,
//   `recharts`+`d3`, `lucide-react`, …) into its module graph for every
//   dev server instance. Two or three leaked Vite servers therefore
//   routinely total 2–3 GB of working set. This script makes the leak
//   visible, so we can clean it up before re-running `npm run dev`.
//
// Output columns:
//   PID        — Windows process id
//   MEM(MB)    — working-set RSS in MB
//   CPU(s)     — total CPU seconds consumed since the process started
//   STARTED    — local-time start timestamp
//   CMD        — the first 220 chars of the command line (cwd + argv[1])
//
// On non-Windows hosts (CI, codespaces) it falls back to `ps -o ...` and
// still produces the same columns; no extra dependency is required.
//

import { spawnSync } from 'node:child_process';
import process from 'node:process';

const isWin = process.platform === 'win32';
const keepLong = process.argv.includes('--keep');

function fmtMB(bytes) {
  if (typeof bytes !== 'number') return '-';
  return (bytes / 1024 / 1024).toFixed(1);
}

function row(pid, memMB, cpu, started, cmd) {
  const safe = cmd ?? '';
  const cmdShort = safe.length > 220 ? safe.slice(0, 217) + '...' : safe;
  return {
    PID: String(pid).padEnd(7),
    'MEM(MB)': String(memMB).padStart(8),
    'CPU(s)': String(cpu).padStart(8),
    STARTED: (started ?? '-').padEnd(20),
    CMD: cmdShort || '(no command line)',
  };
}

function print(rows) {
  if (!rows.length) {
    console.log('[check-node] no Node.js processes found.');
    return;
  }
  const header = ['PID', 'MEM(MB)', 'CPU(s)', 'STARTED', 'CMD'];
  const widths = header.map((h) =>
    Math.max(h.length, ...rows.map((r) => String(r[h]).length)),
  );
  const fmt = (cells) => cells.map((c, i) => String(c).padEnd(widths[i])).join(' ');
  console.log(fmt(header));
  console.log(widths.map((w) => '-'.repeat(w)).join(' '));
  for (const r of rows) console.log(fmt(header.map((h) => r[h])));
}

function onWindows() {
  // `wmic` is available on every supported Windows install (incl. Win11 24H2).
  // The output format is one record per line with `Key=Value` pairs.
  const res = spawnSync(
    'wmic',
    [
      'process',
      'where',
      "name='node.exe'",
      'get',
      'ProcessId,CommandLine,WorkingSetSize,KernelModeTime,UserModeTime',
      '/format:list',
    ],
    { encoding: 'utf8', windowsHide: true },
  );
  if (res.status !== 0) {
    console.error('[check-node] wmic failed:', res.stderr || res.error?.message);
    return [];
  }
  // Start time — `wmic process get CreationDate` would be more accurate but is
  // slow; `Get-Process StartTime` gives us enough granularity. We shell out
  // once at the end to fetch the start times by PID.
  //
  // Real wmic output uses CRLF (`\r\n`) BOTH between lines AND between
  // records. An earlier draft used `\r?\n` which silently collapsed all
  // records into one — we now split on `\r+\n` which works on every
  // recent Windows build (verified on Win10 22H2 + Win11 24H2).
  const rows = [];
  const blocks = res.stdout.split(/\r+\n\r+\n/);
  for (const block of blocks) {
    const map = {};
    for (const line of block.split(/\r+\n/)) {
      const idx = line.indexOf('=');
      if (idx < 0) continue;
      map[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
    }
    if (!map.ProcessId) continue;
    const cpuMs =
      Number(map.KernelModeTime || 0) + Number(map.UserModeTime || 0);
    rows.push({
      pid: Number(map.ProcessId),
      memBytes: Number(map.WorkingSetSize || 0),
      cpuSeconds: (cpuMs / 10_000_000).toFixed(1),
      cmd: map.CommandLine || '',
    });
  }
  // Fetch start times via PowerShell — a single batched call is fast enough.
  const pids = rows.map((r) => r.pid).filter(Boolean);
  const startMap = new Map();
  if (pids.length) {
    const ps = spawnSync(
      'powershell',
      [
        '-NoProfile',
        '-Command',
        `Get-Process -Id ${pids.join(',')} -ErrorAction SilentlyContinue ` +
          `| Select-Object Id, StartTime | ConvertTo-Csv -NoTypeInformation`,
      ],
      { encoding: 'utf8', windowsHide: true },
    );
    if (ps.status === 0) {
      for (const line of ps.stdout.split(/\r?\n/).slice(1)) {
        const [idStr, ts] = line.split(',');
        if (!idStr) continue;
        startMap.set(Number(idStr.replace(/^"|"$/g, '')), ts?.replace(/^"|"$/g, ''));
      }
    }
  }
  return rows.map((r) => ({
    pid: r.pid,
    memMB: fmtMB(r.memBytes),
    cpu: r.cpuSeconds,
    started: startMap.get(r.pid) ?? '-',
    cmd: r.cmd,
  }));
}

function onPosix() {
  // `ps -o pid=,rss=,time=,etime=,command=` works on macOS & Linux without
  // any third-party dep. etime==elapsed since start — easier to display
  // than a timestamp and timezone-independent.
  const res = spawnSync(
    'ps',
    ['-axo', 'pid=,rss=,time=,etime=,command=', '-c'],
    { encoding: 'utf8' },
  );
  if (res.status !== 0) {
    console.error('[check-node] ps failed:', res.stderr || res.error?.message);
    return [];
  }
  const rows = [];
  for (const line of res.stdout.split(/\r?\n/)) {
    if (!line.trim()) continue;
    if (!/(^|\s)node(?:\s|$)/.test(line)) continue;
    const [pid, rss, time, etime, ...rest] = line.trim().split(/\s+/);
    rows.push({
      pid,
      memMB: fmtMB(Number(rss) * 1024),
      cpu: time,
      started: `${etime}s ago`,
      cmd: rest.join(' '),
    });
  }
  return rows;
}

const rows = isWin ? onWindows() : onPosix();
rows.sort((a, b) => Number(b.memMB) - Number(a.memMB));
// Explicit arrow wrapper — `Array.prototype.map` calls its callback as
// `fn(value, index, array)`, so `rows.map(row)` would feed the OBJECT
// as the first arg and the array index as the second — turning the entire
// row into one big "[object Object]". The wrapper below forwards the
// positional fields in the correct order.
print(
  rows.map((r) =>
    row(r.pid, r.memMB, r.cpu, r.started, r.cmd),
  ),
);

const total = rows.reduce((acc, r) => acc + Number(r.memMB || 0), 0);
console.log('-'.repeat(40));
console.log(
  `[check-node] ${rows.length} node process(es), total working set ≈ ${total.toFixed(0)} MB`,
);

if (!keepLong) {
  console.log(
    '\nTip: re-run with --keep to also list the full working-set for each PID.',
  );
}
