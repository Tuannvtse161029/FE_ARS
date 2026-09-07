/**
 * Landing page image sources.
 *
 * AI-generated assets (nano-banana / Gemini 2.5 Flash Image, Sep 2026).
 * Each asset was generated from the prompt seed documented below its
 * import and committed as a local binary under src/assets/images/ — never
 * served from an external CDN to avoid mixed-content and render-blocking.
 *
 * Paper Day palette enforced at generation time:
 *   --accent-primary: #e2ad2f
 *   --accent-hover:   #c78e12
 *   --ink-primary:    #1d1c19
 *   --surface-paper:  #fff9e8
 *   --sidebar-bg:     #1b1a17
 */

import heroBackdropSrc from '@/assets/images/hero-backdrop.png';
import statementStillSrc from '@/assets/images/statement-still.png';
import testimonialPortraitSrc from '@/assets/images/testimonial-portrait.png';

/**
 * Hero right-column backdrop. Sits behind the SVG constellation
 * composition, so it is masked to the same rounded frame and
 * tinted toward the navy/amber palette via CSS overlay.
 */
export const HERO_BACKDROP_URL: string = heroBackdropSrc;

/**
 * Statement section still life — fills the previously text-only
 * right column with a research-archive composition that balances
 * the editorial two-column layout.
 */
export const STATEMENT_STILL_URL: string = statementStillSrc;

/**
 * Testimonial section portrait — scholarly figure that grounds
 * the existing quote block. Rendered as a circular accent above
 * the attribution row.
 */
export const TESTIMONIAL_PORTRAIT_URL: string = testimonialPortraitSrc;

/**
 * Debug helper — exposes the resolved image URLs on `window.__ARS_LANDING_IMG__`
 * so you can confirm in DevTools that the assets are wired to the right files
 * even before any visual element renders.
 */
if (typeof window !== 'undefined') {
  (window as unknown as { __ARS_LANDING_IMG__: Record<string, string> }).__ARS_LANDING_IMG__ = {
    HERO_BACKDROP_URL,
    STATEMENT_STILL_URL,
    TESTIMONIAL_PORTRAIT_URL,
  };
  console.info(
    '[ARS Landing] image placeholders wired:',
    { HERO_BACKDROP_URL, STATEMENT_STILL_URL, TESTIMONIAL_PORTRAIT_URL },
  );
}