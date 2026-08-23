import fs from 'node:fs';
const c = fs.readFileSync('tests/unit/routes/PublicRoute.admin.test.tsx', 'utf8');
const re = /(from\s+|import\s+|\(\s*)\s*['"]([^'"]+)['"]/g;
let m;
while ((m = re.exec(c))) {
  console.log(`prefix=${JSON.stringify(m[1])} rel=${JSON.stringify(m[2])}`);
}
