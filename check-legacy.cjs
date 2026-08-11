const fs = require('fs');
const path = require('path');

// Check legacy build
const legacyBuild = path.join(__dirname, 'node_modules/pdfjs-dist/legacy/build');
if (fs.existsSync(legacyBuild)) {
  const files = fs.readdirSync(legacyBuild);
  console.log('Legacy build files:', files);
  for (const f of files) {
    if (f.endsWith('.js')) {
      const content = fs.readFileSync(path.join(legacyBuild, f), 'utf8');
      const m = content.match(/"(\d+\.\d+\.\d+)"/);
      console.log(f, 'version:', m ? m[1] : 'not found');
    }
  }
}

// Search ALL files in pdfjs-dist for 6.2.108
console.log('\n--- Searching for 6.2.108 ---');
function searchForString(dir, target, depth = 0) {
  if (depth > 3) return;
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === '.git' || entry.name === 'test' || entry.name === 'test-fixtures') continue;
      const full = path.join(dir, entry.name);
      if (entry.isFile() && entry.name.endsWith('.js')) {
        const content = fs.readFileSync(full, 'utf8');
        if (content.includes(target)) {
          console.log('FOUND "6.2.108" in:', full, '- first 200 chars:');
          console.log(content.slice(0, 200));
        }
      } else if (entry.isDirectory()) {
        searchForString(full, target, depth + 1);
      }
    }
  } catch {}
}

searchForString(path.join(__dirname, 'node_modules/pdfjs-dist'), '6.2.108');
console.log('Done searching pdfjs-dist');


// Also check if the Vite import of ?url resolves correctly
// Let's check the actual file content in different worker files
console.log('\n--- Version check in each worker file ---');
const workerFiles = ['pdf.worker.js', 'pdf.worker.min.js', 'pdf.worker.entry.js', 'pdf.sandbox.js'];
for (const wf of workerFiles) {
  const wfPath = path.join(__dirname, 'node_modules/pdfjs-dist/build', wf);
  if (fs.existsSync(wfPath)) {
    const content = fs.readFileSync(wfPath, 'utf8');
    const m = content.match(/["'](\d+\.\d+\.\d+)["']/);
    console.log(wf, '-> first version:', m ? m[1] : 'none');
  }
}
