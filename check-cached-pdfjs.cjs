const fs = require('fs');
const path = require('path');

// Check the cached pdfjs-dist.js
const cached = path.join(__dirname, 'node_modules/.vite/deps/pdfjs-dist.js');
const content = fs.readFileSync(cached, 'utf8');
console.log('Vite cached pdfjs-dist.js first 2000 chars:');
console.log(content.slice(0, 2000));
console.log('\n--- Last 500 chars ---');
console.log(content.slice(-500));
console.log('\n--- Version string search ---');
const m = content.match(/"(\d+\.\d+\.\d+)"/g);
console.log('All version strings:', m ? m.slice(0, 10) : 'none');
const pdfjsVersion = content.match(/pdfjsVersion["\s:=]+["']?([^"'\s,]+)/);
console.log('pdfjsVersion:', pdfjsVersion);
