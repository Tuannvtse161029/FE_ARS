/**
 * Landing page image sources.
 *
 * These are curated Unsplash URLs used as placeholders. When the
 * Higgsfield workspace has credits available, regenerate each slot
 * and replace the URL with the AI-generated asset:
 *
 *   - heroBackdrop  → 16:9 warm editorial scene (research collaboration)
 *   - statementStill → 4:3 still life (research archive, manuscripts)
 *   - testimonialPortrait → 3:2 scholarly portrait
 *
 * Recommended AI prompt seeds are documented below each URL so the
 * eventual generation matches the warm "Paper Day" palette:
 *   --accent-primary: #e2ad2f
 *   --accent-hover:   #c78e12
 *   --ink-primary:    #1d1c19
 *   --surface-paper:  #fff9e8
 *   --sidebar-bg:     #1b1a17
 */

const UNSPLASH_BASE = 'https://images.unsplash.com';

const img = (id: string, w: number) =>
  `${UNSPLASH_BASE}/${id}?w=${w}&q=80&auto=format&fit=crop`;

/**
 * Hero right-column backdrop. Sits behind the SVG constellation
 * composition, so it is masked to the same rounded frame and
 * tinted toward the navy/amber palette via CSS overlay.
 *
 * AI prompt seed (cinematic, warm editorial):
 *   "Editorial journal masthead illustration of an academic research
 *    collaboration: three diverse researchers reviewing open manuscripts
 *    around a wooden table in a softly-lit university library. Soft golden
 *    amber window light, deep navy shadows, parchment cream highlights.
 *    35mm editorial photography, shallow depth of field. No text, no logos."
 */
export const HERO_BACKDROP_URL = img('photo-1521587760476-6c12a4b040da', 1600);

/**
 * Statement section still life — fills the previously text-only
 * right column with a research-archive composition that balances
 * the editorial two-column layout.
 *
 * AI prompt seed (still life):
 *   "Still life of an academic research archive: stacked research
 *    journals, open scientific manuscripts, fountain pens, a brass
 *    magnifying glass, pressed botanical specimens, vintage globe in
 *    soft focus. Warm amber golden lighting, parchment cream, deep ink,
 *    rich wood browns. Editorial museum photography, three-quarter
 *    angle, no text or logos."
 */
export const STATEMENT_STILL_URL = img('photo-1532012197267-da84d127e765', 1200);

/**
 * Testimonial section portrait — scholarly figure that grounds
 * the existing quote block. Rendered as a circular accent above
 * the attribution row.
 *
 * AI prompt seed (portrait):
 *   "Editorial portrait of a Vietnamese female research scholar in
 *    her late 30s, mid-shot, soft cream linen blouse, holding an
 *    open academic journal. Softly blurred warm library background.
 *    Thoughtful, confident expression. Warm golden window light,
 *    parchment cream and deep navy palette. Editorial photography,
 *    shallow depth of field, no logos or text overlays."
 */
export const TESTIMONIAL_PORTRAIT_URL = img(
  'photo-1573496359142-b8d87734a5a2',
  600,
);