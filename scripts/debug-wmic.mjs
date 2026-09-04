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
console.log('status:', res.status);
console.log('STDOUT:---');
console.log(JSON.stringify(res.stdout));
console.log('---END');
