/**
 * Coverage for the bold / illustrative badge picker. Confirms:
 *
 *   - `BADGE_BOLD_ARTWORK_LIST` exposes only entries tagged `style: 'bold'`
 *     and there are enough of them to be a "rich" tab.
 *   - `BoldArtworkPicker` renders those tiles, groups them by category,
 *     and supports search filtering.
 *   - Clicking a tile emits the canonical `/assets/badges/<key>.svg` URL.
 *   - Unknown bold prefixes fall through gracefully, mirroring the
 *     `BadgeArtworkPicker` contract.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { I18nProvider } from '../../../../src/i18n/I18nContext';
import {
  BADGE_BOLD_ARTWORK_LIST,
  BADGE_ARTWORK_REGISTRY,
  artworkKeyToImageUrl,
  resolveBadgeArtwork,
} from '../../../../src/assets/badges';
import { BoldArtworkPicker } from '../../../../src/features/admin/components/BoldArtworkPicker';

const wrap = (ui: React.ReactElement): React.ReactElement => (
  <I18nProvider>{ui}</I18nProvider>
);

describe('bold artwork registry', () => {
  afterEach(() => {
    cleanup();
  });

  it('exposes a non-empty bold-only list', () => {
    expect(BADGE_BOLD_ARTWORK_LIST.length).toBeGreaterThanOrEqual(10);
    for (const entry of BADGE_BOLD_ARTWORK_LIST) {
      expect(entry.style).toBe('bold');
      expect(entry.key.startsWith('bold')).toBe(true);
      expect(BADGE_ARTWORK_REGISTRY[entry.key]).toBe(entry);
    }
  });

  it('includes the round-2 additions (diamond, calendar-streak, galaxy, pixel, infinity, holo-cube)', () => {
    const keys = BADGE_BOLD_ARTWORK_LIST.map((entry) => entry.key);
    for (const expected of [
      'boldDiamondTrophy',
      'boldCalendarStreak',
      'boldGalaxyMedal',
      'boldPixelGrid',
      'boldInfinityLoop',
      'boldHoloCube',
    ]) {
      expect(keys).toContain(expected);
    }
  });

  it('includes the round-2 library additions (anchor, chat-bubble, chess, hourglass, calendar-days, palette)', () => {
    const keys = Object.keys(BADGE_ARTWORK_REGISTRY);
    for (const expected of [
      'anchor',
      'chatBubble',
      'chessKnight',
      'hourglass',
      'calendarDays',
      'palette',
    ]) {
      expect(keys).toContain(expected);
    }
  });

  it('still resolves bold keys through resolveBadgeArtwork', () => {
    expect(resolveBadgeArtwork('/assets/badges/boldOrcidBanner.svg')?.key).toBe(
      'boldOrcidBanner',
    );
    expect(resolveBadgeArtwork('/assets/badges/does-not-exist-bold.svg')).toBeNull();
    expect(artworkKeyToImageUrl('boldOrcidBanner')).toBe(
      '/assets/badges/boldOrcidBanner.svg',
    );
  });
});

describe('BoldArtworkPicker', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders a tile per bold artwork and supports search filtering', () => {
    const handleChange = vi.fn();
    render(wrap(<BoldArtworkPicker value="" onChange={handleChange} />));

    const options = screen.getAllByRole('option');
    expect(options.length).toBe(BADGE_BOLD_ARTWORK_LIST.length);

    // Filter for "rocket" — locale-insensitive enough to hit a label.
    fireEvent.change(screen.getByRole('searchbox'), {
      target: { value: 'rocket' },
    });

    const filtered = screen.getAllByRole('option');
    expect(filtered.length).toBeGreaterThan(0);
    for (const opt of filtered) {
      const label = (opt.getAttribute('aria-label') ?? '').toLowerCase();
      expect(label).toContain('rocket');
    }
  });

  it('emits the canonical URL when a bold tile is picked', () => {
    const handleChange = vi.fn();
    render(
      wrap(
        <BoldArtworkPicker
          value="/assets/badges/boldOrcidBanner.svg"
          onChange={handleChange}
        />,
      ),
    );

    // The currently-selected artwork is flagged aria-selected="true".
    expect(
      screen.getByRole('option', {
        name: /orcid banner with starburst/i,
        selected: true,
      }),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('option', { name: /breakthrough rocket launch/i }),
    );
    expect(handleChange).toHaveBeenCalledWith(
      '/assets/badges/boldRocketLaunch.svg',
    );
  });

  it('renders the "no matches" empty state when the search returns nothing', () => {
    const handleChange = vi.fn();
    render(wrap(<BoldArtworkPicker value="" onChange={handleChange} />));
    fireEvent.change(screen.getByRole('searchbox'), {
      target: { value: 'definitely-no-match-bold-xyz' },
    });
    expect(screen.getByRole('status')).toHaveTextContent(/definitely-no-match-bold-xyz/);
    expect(screen.queryAllByRole('option')).toHaveLength(0);
  });
});
