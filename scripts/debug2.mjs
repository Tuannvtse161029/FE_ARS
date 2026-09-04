import { spawnSync } from 'node:child_process';
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

function fmtMB(bytes) {
  if (typeof bytes !== 'number') return '-';
  return (bytes / 1024 / 1024).toFixed(1);
}

function row(pid, memMB, cpu, started, cmd) {
  const safe = cmd ?? '';
  return {
    PID: String(pid).padEnd(7),
    'MEM(MB)': String(memMB).padStart(8),
    'CPU(s)': String(cpu).padStart(8),
    STARTED: String(started ?? '-').padEnd(20),
    CMD: safe || '(no command line)',
  };
}

const blocks = res.stdout.split(/\r?\n\r?\n/);
console.log('blocks count:', blocks.length);
const rawRows = [];
for (const block of blocks) {
  const map = {};
  for (const line of block.split(/\r?\n/)) {
    const idx = line.indexOf('=');
    if (idx < 0) continue;
    map[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
  }
  if (!map.ProcessId) continue;
  const cpuMs = Number(map.KernelModeTime || 0) + Number(map.UserModeTime || 0);
  rawRows.push({
    pid: Number(map.ProcessId),
    memBytes: Number(map.WorkingSetSize || 0),
    cpuSeconds: (cpuMs / 10_000_000).toFixed(1),
    cmd: map.CommandLine || '',
  });
}
console.log('rawRows count:', rawRows.length);
console.log('first row sample:', JSON.stringify(rawRows[0]));
const mapped = rawRows.map((r) => ({
  pid: r.pid,
  memMB: fmtMB(r.memBytes),
  cpu: r.cpuSeconds,
  started: '-',
  cmd: r.cmd,
}));
console.log('mapped[0]:', JSON.stringify(mapped[0]));
console.log('first transformed row:', JSON.stringify(row(mapped[0].pid, mapped[0].memMB, mapped[0].cpu, mapped[0].started, mapped[0].cmd)));
