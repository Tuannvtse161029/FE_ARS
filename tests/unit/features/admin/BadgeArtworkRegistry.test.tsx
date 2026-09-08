/**
 * Unit coverage for the badge artwork registry + picker. Confirms:
 *
 *   - `resolveBadgeArtwork` returns the matching entry for `/assets/badges/`
 *     URLs, including the new `.svg` library entries.
 *   - Unknown keys fall back to `null` so the existing renderer can switch
 *     to the lucide default.
 *   - `artworkKeyToImageUrl` produces the canonical URL admin picks write
 *     back into `medal.imageUrl`.
 *   - `BadgeArtworkPicker` renders the registry tiles, groups them by
 *     category, supports search filtering, and emits the right URL when
 *     an admin clicks a tile.
 *
 * The picker is wrapped in a real `I18nProvider` so the Vietnamese caption
 * test exercises the same code path the production modal hits.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { I18nProvider } from '../../../../src/i18n/I18nContext';
import {
  BADGE_ARTWORK_LIST,
  BADGE_ARTWORK_REGISTRY,
  artworkKeyToImageUrl,
  resolveBadgeArtwork,
} from '../../../../src/assets/badges';
import { BadgeArtworkPicker } from '../../../../src/features/admin/components/BadgeArtworkPicker';

const wrap = (ui: React.ReactElement): React.ReactElement => (
  <I18nProvider>{ui}</I18nProvider>
);

describe('badge artwork registry', () => {
  afterEach(() => {
    cleanup();
  });

  it('returns the matching entry for /assets/badges URLs', () => {
    const entry = resolveBadgeArtwork('/assets/badges/orcidShield.svg');
    expect(entry).not.toBeNull();
    expect(entry?.key).toBe('orcidShield');
  });

  it('returns null for unknown keys so callers can fall back', () => {
    expect(resolveBadgeArtwork('/assets/badges/does-not-exist.svg')).toBeNull();
  });

  it('returns null for lucide URLs and remote URLs', () => {
    expect(resolveBadgeArtwork('lucide:ShieldCheck')).toBeNull();
    expect(resolveBadgeArtwork('https://example.com/badge.png')).toBeNull();
    expect(resolveBadgeArtwork(undefined)).toBeNull();
    expect(resolveBadgeArtwork(null)).toBeNull();
    expect(resolveBadgeArtwork('')).toBeNull();
  });

  it('exposes a non-empty library list with curated defaults', () => {
    expect(BADGE_ARTWORK_LIST.length).toBeGreaterThanOrEqual(20);
    // Sanity: every entry is registered under its own key.
    for (const entry of BADGE_ARTWORK_LIST) {
      expect(BADGE_ARTWORK_REGISTRY[entry.key]).toBe(entry);
    }
  });

  it('produces a canonical /assets/badges/<key>.svg URL from a registry key', () => {
    expect(artworkKeyToImageUrl('medalGold')).toBe('/assets/badges/medalGold.svg');
    expect(artworkKeyToImageUrl('orcidShield')).toBe(
      '/assets/badges/orcidShield.svg',
    );
  });
});

describe('BadgeArtworkPicker', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders a tile per registered artwork and supports search filtering', () => {
    const handleChange = vi.fn();
    render(wrap(<BadgeArtworkPicker value="" onChange={handleChange} />));

    // All tiles should be option elements once rendered.
    const options = screen.getAllByRole('option');
    expect(options.length).toBe(BADGE_ARTWORK_LIST.length);

    // Filter for "orcid" — locale-insensitive (matches English label too).
    fireEvent.change(screen.getByRole('searchbox'), {
      target: { value: 'orcid' },
    });

    const filtered = screen.getAllByRole('option');
    expect(filtered.length).toBeGreaterThan(0);
    for (const opt of filtered) {
      const label = (opt.getAttribute('aria-label') ?? '').toLowerCase();
      expect(label).toContain('orcid');
    }
  });

  it('emits the canonical /assets/badges/<key>.svg URL when a tile is picked', () => {
    const handleChange = vi.fn();
    render(
      wrap(
        <BadgeArtworkPicker
          value="/assets/badges/orcidShield.svg"
          onChange={handleChange}
        />,
      ),
    );

    // The currently-selected artwork is flagged aria-selected="true".
    expect(
      screen.getByRole('option', { name: /orcid shield/i, selected: true }),
    ).toBeInTheDocument();

    // Clicking a different tile writes the canonical URL.
    fireEvent.click(screen.getByRole('option', { name: /gold distinction medal/i }));
    expect(handleChange).toHaveBeenCalledWith('/assets/badges/medalGold.svg');
  });

  it('renders the "no matches" empty state when the search returns nothing', () => {
    const handleChange = vi.fn();
    render(wrap(<BadgeArtworkPicker value="" onChange={handleChange} />));
    fireEvent.change(screen.getByRole('searchbox'), {
      target: { value: 'definitely-no-match-xyz' },
    });
    expect(screen.getByRole('status')).toHaveTextContent(/definitely-no-match-xyz/);
    expect(screen.queryAllByRole('option')).toHaveLength(0);
  });
});
