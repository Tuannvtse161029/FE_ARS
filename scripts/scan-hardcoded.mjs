// Scan all .tsx files in src for hardcoded English text patterns.
import fs from 'node:fs';
import path from 'node:path';

function findFiles(dir, ext) {
  const result = [];
  const items = fs.readdirSync(dir, { withFileTypes: true });
  for (const item of items) {
    const p = path.join(dir, item.name);
    if (item.isDirectory()) {
      if (['node_modules', 'dist', 'build', '.git', 'test-results', 'tests', 'test', 'reports'].includes(item.name)) continue;
      result.push(...findFiles(p, ext));
    } else if (item.name.endsWith(ext)) {
      result.push(p);
    }
  }
  return result;
}

// Look for JSX text content with multiple English words and no Vietnamese
function scanFile(filePath) {
  const src = fs.readFileSync(filePath, 'utf8');
  const lines = src.split(/\r?\n/);
  const issues = [];

  const VI = /[ăâđêôơưáàảãạắằẳẵặấầẩẫậéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵĂÂĐÊÔƠƯÁÀẢÃẠẮẰẲẴẶẤẦẨẪẬÉÈẺẼẸẾỀỂỄỆÍÌỈĨỊÓÒỎÕỌỐỒỔỖỘỚỜỞỠỢÚÙỦŨỤỨỪỬỮỰÝỲỶỸỴ]/;
  // Patterns to detect hardcoded English text
  const jsxTextPattern = />\s*([A-Z][A-Za-z0-9\s,'.\-:!?&\(\)\/]{8,})\s*</g;
  // String props with English values
  const stringPropPattern = /(?:placeholder|title|label|aria-label|confirmText|okText|cancelText|description|content|tooltip|hint)="([A-Z][A-Za-z0-9\s,'.\-:!?&\(\)\/]{4,})"/g;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Skip lines that are comments or imports
    if (/^\s*(\/\/|\/\*|\*|import|export \*)/.test(line)) continue;
    // Skip lines with t() calls
    if (/t\(\s*['"`]/.test(line)) continue;
    // Skip lines with translator-like calls
    if (/translate\(/.test(line)) continue;

    // JSX text
    let m;
    const re1 = new RegExp(jsxTextPattern.source, 'g');
    while ((m = re1.exec(line)) !== null) {
      const txt = m[1].trim();
      // Skip if contains Vietnamese or template literals or single special chars
      if (VI.test(txt)) continue;
      if (/^\{.*\}$/.test(txt)) continue;
      if (/^[{}$\\]/.test(txt)) continue;
      if (txt.length < 8) continue;
      // Skip common shortcodes
      if (/^[A-Z]{2,5}$/.test(txt)) continue; // like OK, ORCID
      if (/^(true|false|null|undefined)$/.test(txt)) continue;
      issues.push({ line: i + 1, type: 'jsx-text', text: txt });
    }

    // String props
    const re2 = new RegExp(stringPropPattern.source, 'g');
    while ((m = re2.exec(line)) !== null) {
      const txt = m[1].trim();
      if (VI.test(txt)) continue;
      if (txt.length < 4) continue;
      if (/^[A-Z]{2,5}$/.test(txt)) continue;
      if (/^(true|false|null|undefined)$/.test(txt)) continue;
      issues.push({ line: i + 1, type: 'prop', text: txt });
    }
  }
  return issues;
}

const root = 'src';
const files = findFiles(root, '.tsx');
console.log('Total tsx files:', files.length);

let total = 0;
const summary = {};
for (const f of files) {
  const issues = scanFile(f);
  if (issues.length > 0) {
    total += issues.length;
    summary[f] = issues;
  }
}

console.log('\nFiles with potential issues:', Object.keys(summary).length);
console.log('Total issues:', total);

// Print summary, sorted by number of issues
const sorted = Object.entries(summary).sort((a, b) => b[1].length - a[1].length);
for (const [f, issues] of sorted.slice(0, 50)) {
  console.log('\n' + f + ': (' + issues.length + ' issues)');
  for (const i of issues.slice(0, 5)) console.log('  L' + i.line + ' (' + i.type + '): ' + i.text.slice(0, 80));
  if (issues.length > 5) console.log('  ... and ' + (issues.length - 5) + ' more');
}

// Save to file for review
let output = '';
for (const [f, issues] of sorted) {
  output += f + ' (' + issues.length + ' issues)\n';
  for (const i of issues) output += '  L' + i.line + ' (' + i.type + '): ' + i.text + '\n';
  output += '\n';
}
fs.writeFileSync('scan-results.txt', output);
console.log('\nFull results written to scan-results.txt');
