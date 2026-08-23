import fs from 'node:fs';
import path from 'node:path';

const rel = '../../routes/PrivateRoute';
const up = (rel.match(/^\.\.\//g) || []).length;
console.log('upCount=', up);
const tail = rel.split('/').slice(up);
console.log('tail=', tail);
const first = tail[0] || '';
console.log('first=', first);

const PROJECT_DIRS = new Set([
  'routes', 'services', 'store', 'components', 'pages',
  'context', 'hooks', 'layouts', 'utils', 'types', 'config',
  'assets', 'firebase.ts', 'App', 'main',
]);
console.log('isProjectDir=', PROJECT_DIRS.has(first));

const testDir = path.dirname('tests/unit/routes/PublicRoute.admin.test.tsx');
console.log('testDir=', testDir);

function resolveRel(fromDir, rel) {
  rel = rel.split('\\').join('/');
  const parts = fromDir.split(/[\\/]/);
  const u = (rel.match(/^\.\.\//g) || []).length;
  const tail = rel.split('/').slice(u);
  const up = parts.slice(0, parts.length - u);
  return path.join('F:\\CAPSTONE_PROJECT\\ARS_FE', ...up, ...tail);
}

console.log('target=', resolveRel(testDir, rel));

// Try fix
const withSrc = '../'.repeat(up + 1) + 'src/' + rel.split('/').slice(up).join('/');
console.log('withSrc=', withSrc);
console.log('resolved=', resolveRel(testDir, withSrc));
