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

import heroBgSrc from '@/assets/images/hero-bg.jpg';
import statementStillSrc from '@/assets/images/statement-still.png';
// Reuse the academic-collaboration Codex asset for the testimonial portrait
// placeholder until a dedicated portrait file is added.
import testimonialPortraitSrc from '@/assets/images/Codex Image Sep 9, 2026, 05_17_43 PM.png';

// New Codex-generated images for landing page enhancement
import heroAcademicKnowledgeSrc from '@/assets/images/Codex Image Sep 9, 2026, 05_17_04 PM.png';
import heroResearchersCollaborateSrc from '@/assets/images/Codex Image Sep 9, 2026, 05_17_18 PM.png';
import peerReviewWorkflowSrc from '@/assets/images/Codex Image Sep 9, 2026, 05_17_28 PM.png';
import seminarsCommunitySrc from '@/assets/images/Codex Image Sep 9, 2026, 05_17_34 PM.png';
import academicCollaborationAltSrc from '@/assets/images/Codex Image Sep 9, 2026, 05_17_43 PM.png';

/**
 * Hero right-column backdrop. Sits behind the SVG constellation
 * composition, so it is masked to the same rounded frame and
 * tinted toward the navy/amber palette via CSS overlay.
 */
export const HERO_BACKDROP_URL: string = heroBgSrc;

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
 * Hero image — academic knowledge visual for the main hero section.
 * Replaces the login wallpaper poster in LandingScrollVideo.
 * AI-generated: Codex, Sep 2026.
 */
export const HERO_ACADEMIC_URL: string = heroAcademicKnowledgeSrc;

/**
 * Alternative hero image — researchers collaborating in academic setting.
 * Available as an alternative hero visual.
 * AI-generated: Codex, Sep 2026.
 */
export const HERO_RESEARCHERS_URL: string = heroResearchersCollaborateSrc;

/**
 * Peer review workflow illustration — supports the publication workflow section.
 * Shows structured expert review process.
 * AI-generated: Codex, Sep 2026.
 */
export const PEER_REVIEW_WORKFLOW_URL: string = peerReviewWorkflowSrc;

/**
 * Seminars and research community illustration — supports the seminars feature section.
 * Shows academic collaboration and seminar environment.
 * AI-generated: Codex, Sep 2026.
 */
export const SEMINARS_COMMUNITY_URL: string = seminarsCommunitySrc;

/**
 * Alternative academic collaboration image — available as a secondary option.
 * AI-generated: Codex, Sep 2026.
 */
export const ACADEMIC_COLLABORATION_ALT_URL: string = academicCollaborationAltSrc;

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
    HERO_ACADEMIC_URL,
    HERO_RESEARCHERS_URL,
    PEER_REVIEW_WORKFLOW_URL,
    SEMINARS_COMMUNITY_URL,
    ACADEMIC_COLLABORATION_ALT_URL,
  };
  console.info(
    '[ARS Landing] image placeholders wired:',
    {
      HERO_BACKDROP_URL,
      STATEMENT_STILL_URL,
      TESTIMONIAL_PORTRAIT_URL,
      HERO_ACADEMIC_URL,
      HERO_RESEARCHERS_URL,
      PEER_REVIEW_WORKFLOW_URL,
      SEMINARS_COMMUNITY_URL,
      ACADEMIC_COLLABORATION_ALT_URL,
    },
  );
}