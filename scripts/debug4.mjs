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

const splitBy = (s, rx) => s.split(rx);

// Show first 200 chars and last 200 chars of each separator's output
console.log('Total stdout length:', res.stdout.length);
console.log('---raw stdout first 400 chars---');
console.log(JSON.stringify(res.stdout.slice(0, 400)));
console.log('---raw stdout last 400 chars---');
console.log(JSON.stringify(res.stdout.slice(-400)));

const a = splitBy(res.stdout, /\r+\n/);
console.log('split /\\r+\\n/ ->', a.length, 'pieces');
console.log('piece[0]:', JSON.stringify(a[0]));
console.log('piece[1]:', JSON.stringify(a[1]));
console.log('piece[2]:', JSON.stringify(a[2]));

const b = splitBy(res.stdout, /\r+\n\r+\n/);
console.log('split /\\r+\\n\\r+\\n/ ->', b.length, 'pieces');
console.log('b[0]:', JSON.stringify(b[0]));
console.log('b[1]:', JSON.stringify(b[1]));
