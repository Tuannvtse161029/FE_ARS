const { execSync } = require('child_process');
try {
  const result = execSync('npx playwright install chromium --dry-run 2>&1', { encoding: 'utf8' });
  console.log(result);
} catch (e) {
  console.log(e.stdout);
  console.log(e.stderr);
}
