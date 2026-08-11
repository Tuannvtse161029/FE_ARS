const fs = require('fs');
const path = require('path');
const https = require('https');

// Search node_modules for 6.2.108
function searchDir(dir, depth = 0) {
  if (depth > 4) return;
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === 'node_modules' || entry.name === '.cache') continue;
      const full = path.join(dir, entry.name);
      if (entry.isFile() && entry.name === 'package.json') {
        try {
          const pkg = JSON.parse(fs.readFileSync(full, 'utf8'));
          if (pkg.version === '6.2.108') {
            console.log('FOUND 6.2.108 in:', full);
          }
          if (pkg.dependencies && pkg.dependencies['pdfjs-dist']) {
            console.log('pdfjs-dist dep in', full, '->', pkg.dependencies['pdfjs-dist']);
          }
        } catch {}
      }
      if (entry.isDirectory()) {
        searchDir(full, depth + 1);
      }
    }
  } catch {}
}

searchDir(path.join(__dirname, 'node_modules'));
console.log('Done searching');

// Also check if firebase uses any pdf lib
const firebasePkg = JSON.parse(fs.readFileSync(path.join(__dirname, 'node_modules/firebase/package.json'), 'utf8'));
console.log('\nFirebase version:', firebasePkg.version);
console.log('Firebase deps:', JSON.stringify(firebasePkg.dependencies, null, 2));
