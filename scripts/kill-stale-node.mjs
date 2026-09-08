#!/usr/bin/env node
/**
 * kill-stale-node.mjs — kill stray node.exe processes that are holding
 * port 3000 between dev sessions on Windows.
 *
 * Use cases:
 *   - npm run node:clean         → prints PIDs, asks for confirmation
 *   - npm run node:clean:apply   → kills without prompting
 *
 * Best-effort: never throws. If `taskkill` is unavailable (no
 * permissions, no Windows, etc.) the script exits cleanly with a hint
 * about manual cleanup.
 */
import { execSync } from 'node:child_process';
import process from 'node:process';

const applyMode = process.argv.includes('--yes');

function listNodePids() {
  if (process.platform !== 'win32') return [];
  try {
    const out = execSync(
      'tasklist /FI "IMAGENAME eq node.exe" /FO CSV /NH',
      { stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true },
    )
      .toString()
      .trim();
    if (!out) return [];
    const pids = [];
    for (const row of out.split(/\r?\n/)) {
      const cols = row.split('","').map((s) => s.replace(/^"|"$/g, ''));
      const pid = cols[1];
      const sessionName = cols[5] ?? '';
      const currentPid = process.pid.toString();
      // Never kill ourselves — that's the parent of this script.
      // Services don't have session info in the format we get.
      if (pid && /^\d+$/.test(pid) && pid !== currentPid) {
        pids.push({ pid, session: sessionName });
      }
    }
    return pids;
  } catch {
    return [];
  }
}

const pids = listNodePids();
if (pids.length === 0) {
  console.log('\u2713 No stale node.exe processes found.');
  process.exit(0);
}

console.log(`Found ${pids.length} node.exe process(es):`);
for (const { pid, session } of pids) {
  console.log(`  - PID ${pid} (session: ${session || 'Services'})`);
}

if (!applyMode) {
  console.log('\nRe-run with `--yes` (or `npm run node:clean:apply`) to kill them.');
  process.exit(0);
}

let killed = 0;
for (const { pid } of pids) {
  try {
    execSync(`taskkill /F /PID ${pid}`, {
      stdio: 'ignore',
      windowsHide: true,
    });
    killed++;
  } catch {
    // permission denied / already exited
  }
}
console.log(`\u2713 Killed ${killed}/${pids.length} process(es).`);
process.exit(0);
