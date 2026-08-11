const fs = require('fs');
const path = require('path');

const workerPath = require.resolve('pdfjs-dist/build/pdf.worker.min.js');
const worker = fs.readFileSync(workerPath, 'utf8');

console.log('Worker file size:', worker.length);
console.log('First 500 chars:');
console.log(worker.slice(0, 500));
console.log('\n--- Searching for version strings ---');
const matches = worker.match(/"(\d+\.\d+\.\d+)"/g);
console.log('Quoted version strings:', matches ? matches.slice(0, 10) : 'none');
const rev = worker.match(/revision["\s:]+(\d+)/i);
console.log('Revision:', rev);
const build = worker.match(/build["\s:]+(\d+)/i);
console.log('Build:', build);
