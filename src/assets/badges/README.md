# Badges

Custom badge artwork lives in this folder. Files must be **PNG or SVG** and stay **≤ 200 KB** each. From the Admin "Medals & Badges" page, paste a path like `/assets/badges/your-file.png` into the artwork URL field — the `SafeMedalBadge` component will resolve it through `index.ts`. After adding a new file, register it in `index.ts` so Vite bundles it for production and the stable URL is generated.
