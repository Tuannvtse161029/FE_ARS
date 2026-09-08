# Badges

Custom badge artwork lives in this folder. Files must be **PNG or SVG** and stay **≤ 200 KB** each. From the Admin "Medals & Badges" page, paste a path like `/assets/badges/your-file.png` into the artwork URL field — the `SafeMedalBadge` component will resolve it through `index.ts`. After adding a new file, register it in `index.ts` so Vite bundles it for production and the stable URL is generated.

## Library subfolder

`library/` ships a curated set of flat-color achievement badge SVGs that admins can pick from directly inside the "Choose from library" tab of the artwork modal. Each SVG is registered in [`index.ts`](./index.ts) under a stable key (`orcidShield`, `medalGold`, …).

### License

Every artwork currently in `library/` was bespoke-authored for ARS — they are part of this project, not third-party assets. See `library/LICENSES.md` for the full attribution log. When you add an artwork from an external source, append it there with the source URL and license name in the same row.

### Adding new artwork

1. Drop the SVG (or PNG) into `library/` with a kebab-case name (e.g. `orcid-shield.svg`).
2. Add a typed `import` at the top of `index.ts` and a matching entry in `BADGE_ARTWORK_REGISTRY`.
3. Group the entry under a `category` so the picker tabs (`ORCID`, `Published`, `Seminar`, `Mentoring`, `Review`, `Flawless`, `Community`, `General`) stay coherent.
4. Update `library/LICENSES.md` with the source + license.

The artwork is then picked from the modal and the chosen key is stored as `/assets/badges/<key>.<ext>` in `medal.imageUrl`. No backend migration is needed.
