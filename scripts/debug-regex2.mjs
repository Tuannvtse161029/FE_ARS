import fs from 'node:fs';

const text = fs.readFileSync('tests/unit/routes/PublicRoute.admin.test.tsx', 'utf8');
const re = /(from\s+|import\s+|\(\s*)\s*['"]([^'"]+)['"]/g;
let m;
while ((m = re.exec(text))) {
  if (m[2].startsWith('.')) console.log('FOUND:', JSON.stringify(m[1]), '=>', JSON.stringify(m[2]));
}
