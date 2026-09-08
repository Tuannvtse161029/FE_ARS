/**
 * Test that the `SafeMedalBadge` renderer correctly picks up the new
 * `/assets/badges/...` shape — same as `https://...` today, but needed
 * because we extended the predicate at runtime. We render with a fake
 * `<img>` URL; jsdom doesn't fetch it but renders the `<img>` element,
 * which is enough to assert the branch fires.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { I18nProvider } from '../../../../src/i18n/I18nContext';
import { SafeMedalBadge } from '../../../../src/features/admin/components/SafeMedalBadge';

const wrap = (ui: React.ReactElement): React.ReactElement => (
  <I18nProvider>{ui}</I18nProvider>
);

describe('SafeMedalBadge local-asset branch', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders an <img> for /assets/badges/... URLs, sourced from the registry', () => {
    render(
      wrap(
        <SafeMedalBadge
          imageUrl="/assets/badges/orcidShield.svg"
          code="ORCID_BRONZE"
          tier="Bronze"
          size={72}
          alt="Bronze ORCID sample"
        />,
      ),
    );

    // The SafeMedalBadge resolves the stable /assets/badges/<key>.svg URL
    // through BADGE_ARTWORK_REGISTRY so the actual <img> renders the
    // bundled asset data URL. We assert the artwork contains the SVG
    // markup rather than the original raw path string.
    const img = document.querySelector('img');
    expect(img).not.toBeNull();
    const src = img?.getAttribute('src') ?? '';
    expect(src.startsWith('data:image/svg+xml')).toBe(true);
    expect(src).toContain('ORCID%20verified%20shield');
    expect(img?.getAttribute('alt')).toBe('Bronze ORCID sample');
  });

  it('falls back to lucide icon when the local URL does not match the registry', () => {
    render(
      wrap(
        <SafeMedalBadge
          imageUrl="/assets/badges/does-not-exist.svg"
          code="ORCID_BRONZE"
          tier="Bronze"
          size={72}
          alt="Unknown artwork"
        />,
      ),
    );

    // Unknown local paths fall through to the lucide-icon tier ring — no
    // <img> is mounted.
    expect(document.querySelector('img')).toBeNull();
  });
});
