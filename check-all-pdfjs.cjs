const fs = require('fs');
const path = require('path');

// Find ALL directories named pdfjs-dist anywhere in node_modules
function findAllPdfJsDists(root, results = []) {
  try {
    const entries = fs.readdirSync(root, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(root, entry.name);
      if (entry.name === 'pdfjs-dist') {
        try {
          const pkg = JSON.parse(fs.readFileSync(path.join(full, 'package.json'), 'utf8'));
          results.push({ path: full, version: pkg.version });
        } catch (e) { results.push({ path: full, error: e.message }); }
      } else if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
        findAllPdfJsDists(full, results);
      }
    }
  } catch {}
}

// Check if firebase bundles pdfjs
function checkFirebase() {
  const firebasePath = path.join(__dirname, 'node_modules/firebase');
  const pkg = JSON.parse(fs.readFileSync(path.join(firebasePath, 'package.json'), 'utf8'));
  console.log('Firebase deps with pdf:', Object.keys(pkg.dependencies || {}).filter(k => k.includes('pdf')));
  
  // Check firebase/app 
  const appPath = path.join(__dirname, 'node_modules/@firebase/app/package.json');
  if (fs.existsSync(appPath)) {
    const appPkg = JSON.parse(fs.readFileSync(appPath, 'utf8'));
    console.log('@firebase/app version:', appPkg.version);
  }
}

findAllPdfJsDists(path.join(__dirname, 'node_modules'));
checkFirebase();

// Check pdfjs-dist/package.json
const mainPdfJs = JSON.parse(fs.readFileSync(path.join(__dirname, 'node_modules/pdfjs-dist/package.json'), 'utf8'));
console.log('\nMain pdfjs-dist:');
console.log('  Version:', mainPdfJs.version);
console.log('  Main:', mainPdfJs.main);
console.log('  Module:', mainPdfJs.module);
console.log('  Exports:', JSON.stringify(mainPdfJs.exports?.['.']?.import || mainPdfJs.exports || 'N/A'));

// Check the actual pdf.js file that gets imported
const pdfJsPath = path.join(__dirname, 'node_modules/pdfjs-dist/build/pdf.js');
if (fs.existsSync(pdfJsPath)) {
  const pdfJsContent = fs.readFileSync(pdfJsPath, 'utf8');
  const m = pdfJsContent.match(/"(\d+\.\d+\.\d+)"/);
  console.log('\npdf.js version string:', m ? m[1] : 'not found');
}

// Check what the ?url import resolves to in dev mode
console.log('\n--- Worker files available ---');
const buildDir = path.join(__dirname, 'node_modules/pdfjs-dist/build');
const buildFiles = fs.readdirSync(buildDir);
console.log(buildFiles);
