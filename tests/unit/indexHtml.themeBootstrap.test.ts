/**
 * `index.html` — Pre-paint theme bootstrap regression check.
 *
 * The pre-paint `<script>` in `<head>` is the ONLY thing standing
 * between an Archive-Dusk user and a flashbang of cream parchment on
 * every reload. React mounts AFTER the browser paints `<body>`, so the
 * only way to suppress the flash is to set `data-theme` synchronously
 * from `localStorage` before the browser computes any CSS for the
 * page body.
 *
 * This test pins the script's presence and shape so a future refactor
 * that moves/renames/deletes the bootstrap trips here instead of
 * letting the regression reach production.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';

const readIndexHtml = (): string => {
  const indexPath = path.join(process.cwd(), 'index.html');
  return fs.readFileSync(indexPath, 'utf8');
};

describe('index.html — pre-paint theme bootstrap', () => {
  let html: string;

  beforeAll(() => {
    html = readIndexHtml();
  });

  it('declares a synchronous (non-module) script in <head>', () => {
    // The script MUST be classic (not type="module") so the browser
    // runs it before the deferred module bundle. The bootstrap is the
    // entire point — a deferred execution defeats it.
    const scriptRegex = /<head>[\s\S]*?<script>([\s\S]*?)<\/script>[\s\S]*?<\/head>/;
    const match = html.match(scriptRegex);
    expect(match).not.toBeNull();
    if (!match) return;

    const [scriptTag] = match;
    expect(scriptTag).not.toMatch(/type\s*=\s*["']module["']/);
  });

  it('reads ars_theme from localStorage and applies it to <html data-theme>', () => {
    expect(html).toMatch(/localStorage\.getItem\(\s*['"]ars_theme['"]\s*\)/);
    expect(html).toMatch(
      /document\.documentElement\.setAttribute\(\s*['"]data-theme['"]/,
    );
  });

  it('migrates the legacy "night" / "light" values', () => {
    // A stored `night` / `light` value (from an older version of the
    // app) must be normalised to the current vocabulary so the user
    // doesn't bounce back to the default after upgrading.
    expect(html).toMatch(/['"]night['"]/);
    expect(html).toMatch(/archive-dusk/);
    expect(html).toMatch(/['"]light['"]/);
    expect(html).toMatch(/paper-day/);
  });

  it('falls back to Paper Day when localStorage access throws', () => {
    expect(html).toMatch(/try\s*\{/);
    expect(html).toMatch(/catch\s*\(/);
    expect(html).toMatch(/paper-day/);
  });

  it('runs the bootstrap BEFORE the <body> tag so the first paint is themed', () => {
    // Find the FIRST `<script>` tag (the pre-paint bootstrap). The
    // module bundle is loaded via `<script type="module" src=…>`,
    // which we intentionally ignore here — we only care that the
    // classic (non-module) script appears in `<head>`.
    const scriptTags = [...html.matchAll(/<script\b([^>]*)>/g)];
    const classicIdx = scriptTags.findIndex(
      ([, attrs]) => !/\btype\s*=\s*["']module["']/i.test(attrs),
    );
    const bodyIdx = html.indexOf('<body>');
    expect(classicIdx).toBeGreaterThan(-1);
    expect(bodyIdx).toBeGreaterThan(-1);

    const classicOffset = scriptTags[classicIdx]!.index ?? -1;
    expect(classicOffset).toBeGreaterThan(-1);
    expect(classicOffset).toBeLessThan(bodyIdx);
  });

  it('ships a no-media <meta name="theme-color"> so the JS can override it', () => {
    // Two media-gated tags cover the OS-level preference. A third tag
    // with no `media` attribute is the one `useThemeToggle` overwrites
    // once the React app mounts.
    const matches = html.match(
      /<meta\s+name="theme-color"[^>]*>/g,
    );
    expect(matches).not.toBeNull();
    if (!matches) return;

    const noMedia = matches.filter((tag) => !/\smedia\s*=/.test(tag));
    expect(noMedia.length).toBeGreaterThanOrEqual(1);
  });
});
