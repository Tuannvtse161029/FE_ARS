/**
 * OpenAlexBrandLogo — inline SVG brand mark for OpenAlex.
 *
 * OpenAlex is a third-party open scholarly metadata provider used by ARS to
 * import publication metadata. This component renders the OpenAlex "X" mark:
 * a black rounded square with a white border and a white "X" glyph inside.
 *
 * The "X" mark uses `<line>` elements (not SVG `<text>`), so it renders
 * identically across all environments regardless of available fonts.
 *
 * The "OpenAlex" wordmark is NOT rendered here as SVG text — instead, place
 * a DOM `<span>` with your own typography beside this mark. This avoids the
 * SVG-font rendering pitfalls that produce garbled or missing characters.
 *
 * Brand palette:
 *   - Black (square fill):  #1A1A1A
 *   - White (border + X):   #FFFFFF
 *
 * Variants:
 *   - "mark"      — 20×20 rounded square with the white "X". Default.
 *   - "wordmark"  — same 20×20 mark. (Same visual; the wordmark is rendered
 *                    as DOM text by the consumer — e.g. `<OpenAlexBrandLogo
 *                    variant="mark" />` followed by `<span>OpenAlex</span>`.)
 *   - "chip"      — same 20×20 mark. (Same visual — see note above.)
 *
 * Why no inline wordmark: SVG `<text>` elements do not inherit the browser's
 * font rendering pipeline. They render against an embedded font fallback that
 * varies wildly across operating systems, producing missing-glyph rectangles
 * or "Tofu" characters. For "OpenAlex" to be readable, render the wordmark
 * as DOM text using the project's typography system. The SVG's job here is
 * purely to provide the recognizable "X" mark.
 */

import type { CSSProperties } from 'react';

export type OpenAlexBrandLogoVariant = 'mark' | 'wordmark' | 'chip';

export interface OpenAlexBrandLogoProps {
  variant?: OpenAlexBrandLogoVariant;
  /** Accessible label. Default "OpenAlex". */
  ariaLabel?: string;
  className?: string;
  style?: CSSProperties;
}

const OA_BLACK = '#1A1A1A';
const OA_WHITE = '#FFFFFF';

export const OpenAlexBrandLogo = ({
  variant: _variant = 'mark',
  ariaLabel = 'OpenAlex',
  className,
  style,
}: OpenAlexBrandLogoProps) => {
  // The "X" mark — two crossing lines inside a 14×14 inner box, centred
  // in a 20×20 viewBox. stroke-linecap="round" gives the X its soft,
  // approachable character. Pure SVG primitives — no font dependency.
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={ariaLabel || undefined}
      aria-hidden={ariaLabel ? undefined : true}
      width={20}
      height={20}
      viewBox="0 0 20 20"
      className={className}
      style={style}
    >
      {ariaLabel ? <title>{ariaLabel}</title> : null}
      {/* White outer border */}
      <rect x="0" y="0" width="20" height="20" rx="3.5" ry="3.5" fill={OA_WHITE} />
      {/* Black inner square */}
      <rect x="1" y="1" width="18" height="18" rx="2.5" ry="2.5" fill={OA_BLACK} />
      {/* "X" mark — two crossing lines, centred */}
      <g stroke={OA_WHITE} strokeWidth="2.2" strokeLinecap="round">
        <line x1="5" y1="5" x2="15" y2="15" />
        <line x1="15" y1="5" x2="5" y2="15" />
      </g>
    </svg>
  );
};

export const OPENALEX_BRAND_COLORS = {
  PRIMARY: OA_BLACK,
  BORDER: OA_WHITE,
} as const;

export default OpenAlexBrandLogo;
