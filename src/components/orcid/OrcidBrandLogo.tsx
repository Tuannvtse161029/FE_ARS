/**
 * OrcidBrandLogo — official ORCID iD brand mark (inline SVG).
 *
 * ORCID's brand guidelines require the iD logo to appear alongside the
 * word "ORCID" wherever third parties reference ORCID as a third-party
 * identity provider. The green ring must remain visually consistent
 * across surfaces, so we render it as an inline SVG (no external CDN).
 *
 * Brand palette:
 *   - Primary green:  #A6CE39  (the ORCID ring)
 *   - Hover green:    #81A52A
 *   - Text white:     #FFFFFF
 *
 * Variants:
 *   - "id"      — the circular "iD" badge used in identity panels
 *   - "wordmark" — the rounded green pill with the iD + ORCID text
 *
 * Size:
 *   - Provide a `size` prop (default 24px). The wordmark auto-scales to
 *     preserve aspect ratio.
 *
 * All current ORCID-affiliated surfaces in ARS_FE should render this
 * logo rather than a generic "Link2" or generic green dot.
 */

import type { CSSProperties } from 'react';

export type OrcidBrandLogoVariant = 'id' | 'wordmark';

export interface OrcidBrandLogoProps {
  variant?: OrcidBrandLogoVariant;
  /** Pixel size of the badge's bounding box. Default 24. */
  size?: number;
  /** Optional accessible label override. Defaults are 'ORCID iD'. */
  ariaLabel?: string;
  className?: string;
  style?: CSSProperties;
}

const PRIMARY = '#A6CE39';
const HOVER = '#81A52A';

export const OrcidBrandLogo = ({
  variant = 'id',
  size = 24,
  ariaLabel = 'ORCID iD',
  className,
  style,
}: OrcidBrandLogoProps) => {
  if (variant === 'wordmark') {
    // The official ORCID wordmark: green rounded pill, white "iD" circle
    // on the left, then the text "ORCID". Aspect ratio follows the
    // brand mark (≈ 5:1.6).
    const height = Math.max(20, Math.round(size * 0.9));
    const width = Math.round(height * 5);
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label={ariaLabel}
        width={width}
        height={height}
        viewBox="0 0 80 26"
        className={className}
        style={style}
      >
        <title>{ariaLabel}</title>
        {/* Outer rounded pill background */}
        <rect x="0" y="0" width="80" height="26" rx="13" ry="13" fill={PRIMARY} />
        {/* Inner white "iD" circle */}
        <circle cx="13" cy="13" r="10" fill="#FFFFFF" />
        {/* "i" */}
        <text
          x="10.4"
          y="17.5"
          fontFamily="Helvetica, Arial, sans-serif"
          fontSize="12"
          fontWeight="700"
          fill={PRIMARY}
        >
          i
        </text>
        {/* "D" */}
        <text
          x="14"
          y="17.5"
          fontFamily="Helvetica, Arial, sans-serif"
          fontSize="11"
          fontWeight="700"
          fill={PRIMARY}
        >
          D
        </text>
        {/* "ORCID" wordmark */}
        <text
          x="26"
          y="18"
          fontFamily="Helvetica, Arial, sans-serif"
          fontSize="11"
          fontWeight="700"
          fill="#FFFFFF"
          letterSpacing="0.4"
        >
          ORCID
        </text>
      </svg>
    );
  }

  // Default — circular "iD" badge.
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={ariaLabel}
      width={size}
      height={size}
      viewBox="0 0 256 256"
      className={className}
      style={style}
    >
      <title>{ariaLabel}</title>
      {/* Green ring */}
      <circle cx="128" cy="128" r="120" fill={PRIMARY} />
      {/* Inner white circle */}
      <circle cx="128" cy="128" r="92" fill="#FFFFFF" />
      {/* "i" */}
      <rect x="68" y="64" width="14" height="14" fill={PRIMARY} />
      <rect x="68" y="88" width="14" height="104" fill={PRIMARY} />
      {/* "D" — drawn as a stroke path */}
      <path
        d="M 104 88 L 104 192 L 154 192
           C 188 192 196 168 196 140
           C 196 112 188 88 154 88 Z
           M 118 102 L 152 102
           C 174 102 182 116 182 140
           C 182 164 174 178 152 178
           L 118 178 Z"
        fill={PRIMARY}
      />
    </svg>
  );
};

export const ORCID_BRAND_COLORS = {
  PRIMARY,
  HOVER,
} as const;

export default OrcidBrandLogo;