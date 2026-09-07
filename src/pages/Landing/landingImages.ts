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

// Vite inlines the resolved URL at build time (hashed filename, long-term
// cacheable). Importing PNG directly works because Landing.tsx uses each
// export as a plain string `src` prop.
import heroBackdropSrc from '@/assets/images/hero-backdrop.png';
import statementStillSrc from '@/assets/images/statement-still.png';
import testimonialPortraitSrc from '@/assets/images/testimonial-portrait.png';

/**
 * Hero right-column backdrop. Sits behind the SVG constellation
 * composition, so it is masked to the same rounded frame and
 * tinted toward the navy/amber palette via CSS overlay.
 *
 * AI prompt seed:
 *   "Photorealistic editorial photograph, 3:2 aspect ratio, 1600x1067.
 *    A warm, scholarly scene of three diverse Vietnamese researchers
 *    collaborating around a heavy oak table in a softly lit university
 *    library reading room. ... [full prompt in git history]"
 */
export const HERO_BACKDROP_URL: string = heroBackdropSrc;

/**
 * Statement section still life — fills the previously text-only
 * right column with a research-archive composition that balances
 * the editorial two-column layout.
 *
 * AI prompt seed:
 *   "Photorealistic editorial still life, 4:3 aspect ratio, 1200x900.
 *    An overhead three-quarter angle shot of a researcher's desk
 *    arranged like a quiet museum vitrine. ... [full prompt in git history]"
 */
export const STATEMENT_STILL_URL: string = statementStillSrc;

/**
 * Testimonial section portrait — scholarly figure that grounds
 * the existing quote block. Rendered as a circular accent above
 * the attribution row.
 *
 * AI prompt seed:
 *   "Photorealistic editorial portrait, 3:2 aspect ratio, 600x400.
 *    A Vietnamese female research scholar in her late 30s, photographed
 *    mid-shot from the chest up. ... [full prompt in git history]"
 */
export const TESTIMONIAL_PORTRAIT_URL: string = testimonialPortraitSrc;