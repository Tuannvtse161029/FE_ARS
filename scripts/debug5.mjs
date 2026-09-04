import { spawnSync } from 'node:child_process';

const SELF_PID = process.pid;
console.log('SELF_PID:', SELF_PID);

const res = spawnSync(
  'wmic',
  [
    'process',
    'where',
    `Name='node.exe' and ProcessId<>${SELF_PID}`,
    'get',
    'ProcessId,CommandLine',
    '/format:list',
  ],
  { encoding: 'utf8', windowsHide: true },
);
console.log('status:', res.status);
console.log('stdout:', res.stdout.length, 'chars');
console.log('first 500 chars of stdout:');
console.log(res.stdout.slice(0, 500));

const blocks = res.stdout.split(/\r+\n\r+\n/);
console.log('\nblocks:', blocks.length);
