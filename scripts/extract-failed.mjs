import fs from 'node:fs';
const content = fs.readFileSync('test-triage/vitest-baseline.txt', 'utf8');
const lines = content.split('\n');
const failed = [];
const passed = [];
for (const line of lines) {
  // × is U+00D7
  if (line.startsWith(' \u00d7 tests/')) failed.push(line.substring(2).trim());
  else if (line.startsWith(' \u2713 tests/')) passed.push(line.substring(2).trim());
}
console.log('failed:', failed.length, 'passed:', passed.length);
fs.writeFileSync('test-triage/failed-tests.txt', failed.join('\n'), 'utf8');
fs.writeFileSync('test-triage/passed-tests.txt', passed.join('\n'), 'utf8');
console.log('failed files:');
const failedFiles = new Set(failed.map((f) => f.split(' ')[0]));
[...failedFiles].sort().forEach((f) => console.log('  ' + f));