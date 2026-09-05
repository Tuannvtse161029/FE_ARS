/**
 * Custom badge artwork registry.
 *
 * Any PNG/SVG artwork dropped into `src/assets/badges/` can be referenced
 * from the Admin "Medals & Badges" page via the image URL field, e.g.
 *   /assets/badges/orcid-bronze.png
 *
 * Vite bundles files imported through this barrel so the production URL is
 * stable. The lucide:IconName convention remains the default for built-in
 * medals and does not need an entry here.
 */

export interface BadgeArtworkEntry {
  /** Stable key — referenced by name in medal.imageUrl fallback paths. */
  key: string;
  /** Vite asset URL for the artwork. Add new entries below as artwork is dropped in. */
  src: string;
  /** Optional accessible label for tooltip / a11y. */
  label?: string;
}

export const BADGE_ARTWORK_REGISTRY: Record<string, BadgeArtworkEntry> = {
  // Add entries here when custom artwork is added to this folder:
  // e.g.  orcidBronze: { key: 'orcidBronze', src: '...png', label: 'ORCID Bronze' },
};

export const resolveBadgeArtwork = (imageUrl: string | undefined | null): BadgeArtworkEntry | null => {
  if (!imageUrl) return null;
  // Only intercept paths that point into our local badges folder; leave
  // http(s)/data:/blob: untouched so SafeMedalBadge can render them.
  if (!imageUrl.startsWith('/assets/badges/')) return null;
  const key = imageUrl.replace('/assets/badges/', '').replace(/\.[^.]+$/, '');
  return BADGE_ARTWORK_REGISTRY[key] ?? null;
};
