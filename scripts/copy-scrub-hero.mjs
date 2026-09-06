// One-off script to copy a local video file into the public folder so it
// can be served by Vite's dev server and the production build. The source
// video lives under src/assets/videos/ and is referenced by the scroll-driven
// landing page at /scrub-hero.mp4.
//
// Run with: node scripts/copy-scrub-hero.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const src = path.join(root, 'src/assets/videos/A Conference Call in Real Life.mp4');
const dest = path.join(root, 'public/scrub-hero.mp4');

if (!fs.existsSync(src)) {
  console.error(`Source video missing: ${src}`);
  process.exit(1);
}

if (fs.existsSync(dest)) {
  console.log(`Already in place: ${dest}`);
  process.exit(0);
}

fs.copyFileSync(src, dest);
const sizeMb = (fs.statSync(dest).size / 1024 / 1024).toFixed(1);
console.log(`Copied ${sizeMb} MB → ${dest}`);
