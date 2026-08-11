const fs = require('fs');
const path = require('path');

const workerPath = path.join(__dirname, 'node_modules/pdfjs-dist/build/pdf.worker.min.js');
const worker = fs.readFileSync(workerPath, 'utf8');

console.log('Worker file size:', worker.length);
console.log('First 500 chars:');
console.log(worker.slice(0, 500));
console.log('\n--- Searching for version strings ---');
const matches = worker.match(/"(\d+\.\d+\.\d+)"/g);
console.log('Quoted version strings:', matches ? matches.slice(0, 10) : 'none');
const pdfjsVersion = worker.match(/pdfjs\s*\|\|\s*"([^"]+)"/);
console.log('pdfjs fallback:', pdfjsVersion);
