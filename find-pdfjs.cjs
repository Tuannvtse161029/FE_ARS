const fs = require('fs');
const path = require('path');

// Search ALL of node_modules for pdfjs-dist
function findPdfJsDists(dir, results = []) {
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.name === 'pdfjs-dist') {
        try {
          const pkg = JSON.parse(fs.readFileSync(path.join(full, 'package.json'), 'utf8'));
          results.push({ path: full, version: pkg.version });
        } catch {}
      }
      if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
        const nested = path.join(full, 'node_modules');
        if (fs.existsSync(nested)) {
          findPdfJsDists(nested, results);
        }
      }
    }
  } catch {}
}

const results = [];
findPdfJsDists(path.join(__dirname, 'node_modules'), results);
console.log('Found pdfjs-dist instances:', JSON.stringify(results, null, 2));

// Also check if the ?url import resolves correctly
console.log('\n--- Checking ?url resolution ---');
// The ?url import should return the path to the local file
// But maybe it's being resolved to a CDN URL somehow?
