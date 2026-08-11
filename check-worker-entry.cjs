const fs = require('fs');
const path = require('path');

const entryPath = path.join(__dirname, 'node_modules/pdfjs-dist/build/pdf.worker.entry.js');
const entry = fs.readFileSync(entryPath, 'utf8');
console.log('pdf.worker.entry.js content:');
console.log(entry.slice(0, 1000));
console.log('\n---');
console.log('Last 500 chars:');
console.log(entry.slice(-500));

// Also check if there's a legacy build dir
const legacyPath = path.join(__dirname, 'node_modules/pdfjs-dist/legacy');
if (fs.existsSync(legacyPath)) {
  console.log('\n--- Legacy dir exists ---');
  const legacyFiles = fs.readdirSync(legacyPath);
  console.log(legacyFiles);
}
