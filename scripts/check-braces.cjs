const fs = require('fs');
const path = process.argv[2];
const c = fs.readFileSync(path, 'utf8');
let depth = 0;
let line = 1;
let inStr = null;
let inLineComment = false;
let inBlockComment = false;
for (let i = 0; i < c.length; i++) {
  const ch = c[i];
  const next = c[i+1];
  if (ch === '\n') { line++; inLineComment = false; continue; }
  if (inLineComment) continue;
  if (inBlockComment) {
    if (ch === '*' && next === '/') { inBlockComment = false; i++; }
    continue;
  }
  if (inStr) {
    if (ch === '\\') { i++; continue; }
    if (ch === inStr) inStr = null;
    continue;
  }
  if (ch === '/' && next === '/') { inLineComment = true; i++; continue; }
  if (ch === '/' && next === '*') { inBlockComment = true; i++; continue; }
  if (ch === '"' || ch === "'" || ch === '`') { inStr = ch; continue; }
  if (ch === '{') depth++;
  if (ch === '}') depth--;
  if (ch === '(') depth++;
  if (ch === ')') depth--;
}
console.log('final brace+paren depth at end of file (line', line, '):', depth);