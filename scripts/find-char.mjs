import fs from 'node:fs';
const content = fs.readFileSync('test-triage/vitest-baseline.txt', 'utf8');
const lines = content.split('\n');
const found = lines.find(l => l.includes('\u00d7'));
if (found) {
  const idx = found.indexOf('\u00d7');
  console.log('found at idx', idx);
  console.log('codes around it:', found.substring(0, idx+1).split('').map(c => c.codePointAt(0).toString(16)));
} else {
  // Print first byte sequences
  const withFail = lines.filter(l => /[^\x00-\x7f]/.test(l));
  console.log('non-ascii line count:', withFail.length);
  if (withFail.length) {
    const idx = withFail[0].search(/[^\x00-\x7f]/);
    console.log('first non-ascii at idx', idx);
    console.log('codes around it:', [...withFail[0].substring(0, idx+5)].map(c => c.codePointAt(0).toString(16)));
    console.log('line:', JSON.stringify(withFail[0].substring(0, 80)));
  }
}