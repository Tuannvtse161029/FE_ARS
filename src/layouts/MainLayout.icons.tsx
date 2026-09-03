/**
 * MainLayout — Inline SVG icons for the theme toggle and the
 * always-visible sidebar collapse / expand button.
 *
 * Authored here (rather than imported from lucide-react) so that the new
 * collapse-and-dark-mode worker does not introduce new icon dependencies
 * outside of what `MainLayout.tsx` already pulls in. All icons follow the
 * same single-color monochrome line style as the rest of the project
 * (`#A0AEC0` baseline per the ARS visual system), and inherit the
 * surrounding text color so the night-mode theme swap recolors them
 * automatically.
 *
 * Each component accepts the same `size` prop used by `lucide-react`
 * icons (default 18) so consumers can swap them in interchangeably.
 *
 * NOTE — Agent 38 (this worker):
 *   The icons file is scoped to MainLayout. Other agents working in
 *   `src/layouts/` should leave this file untouched so the local
 *   theme/collapse icons stay single-sourced.
 */
import * as React from 'react';

export interface MainLayoutIconProps {
  /** Pixel size for both width and height. Default 18. */
  size?: number;
  /** Accessible label for assistive tech. Defaults to `''` (decorative). */
  'aria-label'?: string;
  /** Optional custom CSS class name. */
  className?: string;
}

const baseProps = (
  size: number,
  label: string | undefined,
  className?: string,
): React.SVGAttributes<SVGSVGElement> & { width: number; height: number } => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': label ? undefined : true,
  'aria-label': label,
  focusable: 'false',
  className,
});

/**
 * Chevron-left — used by the sidebar collapse button when expanded.
 */
export const ChevronLeftIcon: React.FC<MainLayoutIconProps> = ({
  size = 18,
  'aria-label': ariaLabel,
  className,
}) => (
  <svg {...baseProps(size, ariaLabel, className)} data-testid="icon-chevron-left">
    <polyline points="15 18 9 12 15 6" />
  </svg>
);

/**
 * Chevron-right — used by the sidebar expand button when collapsed.
 */
export const ChevronRightIcon: React.FC<MainLayoutIconProps> = ({
  size = 18,
  'aria-label': ariaLabel,
  className,
}) => (
  <svg {...baseProps(size, ariaLabel, className)} data-testid="icon-chevron-right">
    <polyline points="9 18 15 12 9 6" />
  </svg>
);

/**
 * Sun icon — shown by the theme toggle when the active theme is night,
 * meaning clicking it returns the user to the light theme.
 */
export const SunIcon: React.FC<MainLayoutIconProps> = ({
  size = 18,
  'aria-label': ariaLabel,
  className,
}) => (
  <svg {...baseProps(size, ariaLabel, className)} data-testid="icon-sun">
    <circle cx="12" cy="12" r="4" />
    <line x1="12" y1="2" x2="12" y2="4" />
    <line x1="12" y1="20" x2="12" y2="22" />
    <line x1="4.93" y1="4.93" x2="6.34" y2="6.34" />
    <line x1="17.66" y1="17.66" x2="19.07" y2="19.07" />
    <line x1="2" y1="12" x2="4" y2="12" />
    <line x1="20" y1="12" x2="22" y2="12" />
    <line x1="4.93" y1="19.07" x2="6.34" y2="17.66" />
    <line x1="17.66" y1="6.34" x2="19.07" y2="4.93" />
  </svg>
);

/**
 * Moon icon — shown by the theme toggle when the active theme is light,
 * meaning clicking it switches the user to the night theme.
 */
export const MoonIcon: React.FC<MainLayoutIconProps> = ({
  size = 18,
  'aria-label': ariaLabel,
  className,
}) => (
  <svg {...baseProps(size, ariaLabel, className)} data-testid="icon-moon">
    <path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79z" />
  </svg>
);

/**
 * Research paper icon — a manuscript page with a folded corner and text
 * lines, used as the shared decorative sidebar watermark.
 */
export const ResearchPaperIcon: React.FC<MainLayoutIconProps> = ({
  size = 18,
  'aria-label': ariaLabel,
}) => (
  <svg {...baseProps(size, ariaLabel)} data-testid="icon-research-paper">
    <path d="M6 2h8l4 4v16H6z" />
    <path d="M14 2v5h5" />
    <line x1="9" y1="11" x2="15" y2="11" />
    <line x1="9" y1="15" x2="15" y2="15" />
    <line x1="9" y1="19" x2="13" y2="19" />
  </svg>
);

export default {
  ChevronLeftIcon,
  ChevronRightIcon,
  SunIcon,
  MoonIcon,
  ResearchPaperIcon,
};
