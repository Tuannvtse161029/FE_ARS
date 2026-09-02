import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..', '..', '..');
const LOCAL = path.join(ROOT, '.env.playwright.local');

console.log('ROOT:', ROOT);
console.log('LOCAL:', LOCAL);
console.log('exists:', fs.existsSync(LOCAL));

if (fs.existsSync(LOCAL)) {
  const text = fs.readFileSync(LOCAL, 'utf8');
  console.log('File content:');
  console.log(text);
  
  // Simulate loadEnvFile
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    console.log(`  key=${key}, value=${value}`);
  }
}
