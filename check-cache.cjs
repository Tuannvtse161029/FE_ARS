const fs = require('fs');
const path = require('path');

// Check the vite cache for pdfjs files
const viteCache = path.join(__dirname, 'node_modules/.vite');
function checkViteCache(dir, depth = 0) {
  if (depth > 3) return;
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.name.includes('pdfjs') || (entry.isFile() && entry.name.endsWith('.js'))) {
        console.log('Vite cache file:', full);
        if (entry.isFile() && entry.name.endsWith('.js')) {
          const content = fs.readFileSync(full, 'utf8');
          const m = content.match(/"(\d+\.\d+\.\d+)"/);
          if (m) console.log('  version:', m[1]);
        }
      }
      if (entry.isDirectory() && !entry.name.startsWith('.')) {
        checkViteCache(full, depth + 1);
      }
    }
  } catch {}
}

console.log('--- Checking Vite cache ---');
checkViteCache(viteCache);

// Check if maybe there's a different pdfjs-dist in the project root
const rootPkg = path.join(__dirname, 'package.json');
const root = JSON.parse(fs.readFileSync(rootPkg, 'utf8'));
console.log('\nDirect deps on pdfjs:', Object.keys(root.dependencies || {}).filter(k => k.includes('pdfjs')));
console.log('DevDeps on pdfjs:', Object.keys(root.devDependencies || {}).filter(k => k.includes('pdfjs')));

// The real question: where does 6.2.108 come from?
// Let's check if the browser is somehow loading a CDN version
// Actually - let me check the NODE_modules/.cache/vite directory
const viteTransformCache = path.join(__dirname, 'node_modules/.cache/vite');
if (fs.existsSync(viteTransformCache)) {
  console.log('\nVite transform cache exists');
  function searchCache(dir, depth = 0) {
    if (depth > 3) return;
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isFile()) {
          const content = fs.readFileSync(full, 'utf8');
          if (content.includes('6.2.108')) {
            console.log('FOUND 6.2.108 in cache:', full);
          }
          if (content.includes('pdfjs') && entry.name.endsWith('.js')) {
            const m = content.match(/"(\d+\.\d+\.\d+)"/);
            if (m) console.log('Version in cache file', entry.name, ':', m[1]);
          }
        } else if (entry.isDirectory() && !entry.name.startsWith('.')) {
          searchCache(full, depth + 1);
        }
      }
    } catch {}
  }
  searchCache(viteTransformCache);
} else {
  console.log('\nNo vite transform cache');
}

// Check vitest cache
const vitestCache = path.join(__dirname, 'node_modules/.vitest');
if (fs.existsSync(vitestCache)) {
  console.log('\nVitest cache exists');
  const entries = fs.readdirSync(vitestCache);
  console.log('Vitest cache contents:', entries.slice(0, 20));
}
