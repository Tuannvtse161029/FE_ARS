const fs = require('fs');
const path = require('path');

// Check if there's a pdfjs-dist v6 somewhere in firebase or other packages
function findPdfJsRecursive(dir, depth = 0, results = []) {
  if (depth > 5) return results;
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.name === 'pdfjs-dist' && !full.includes('node_modules\\pdfjs-dist')) {
        try {
          const pkg = JSON.parse(fs.readFileSync(path.join(full, 'package.json'), 'utf8'));
          results.push({ path: full, version: pkg.version });
        } catch {}
      }
      if (entry.isDirectory() && !entry.name.startsWith('.') && !entry.name.startsWith('test')) {
        findPdfJsRecursive(full, depth + 1, results);
      }
    }
  } catch {}
  return results;
}

const results = findPdfJsRecursive(path.join(__dirname, 'node_modules'));
console.log('Nested pdfjs-dist instances:', JSON.stringify(results, null, 2));

// Check the vite cache
const viteCacheDir = path.join(__dirname, 'node_modules/.vite');
if (fs.existsSync(viteCacheDir)) {
  console.log('\nVite cache exists');
} else {
  console.log('\nNo vite cache found');
}

// Search for 6.2 in ALL of node_modules (not just pdfjs-dist)
console.log('\n--- Searching ALL node_modules for "6.2" ---');
let found6 = false;
function searchAll(dir, depth = 0) {
  if (depth > 3) return;
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isFile() && (entry.name === 'package.json' || entry.name.endsWith('.js') || entry.name.endsWith('.mjs'))) {
        try {
          const content = fs.readFileSync(full, 'utf8');
          if (content.includes('6.2.108') || content.includes('6.2.1')) {
            console.log('FOUND 6.2 in:', full);
            found6 = true;
          }
        } catch {}
      } else if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'test' && entry.name !== 'tests') {
        searchAll(full, depth + 1);
      }
    }
  } catch {}
}

searchAll(path.join(__dirname, 'node_modules'));
if (!found6) console.log('6.2 NOT found anywhere in node_modules');

// Also check the vitest cache
const vitestCacheDir = path.join(__dirname, 'node_modules/.vitest');
if (fs.existsSync(vitestCacheDir)) {
  console.log('\nVitest cache exists, checking...');
  searchAll(vitestCacheDir);
}

// Check for @pdfjs-dist scoped package
const pdfjsScoped = path.join(__dirname, 'node_modules/@pdfjs-dist');
if (fs.existsSync(pdfjsScoped)) {
  console.log('\n@pdfjs-dist scoped package exists!');
  const entries = fs.readdirSync(pdfjsScoped);
  console.log('Contents:', entries);
}
