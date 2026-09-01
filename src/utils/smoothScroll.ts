/**
 * Window scroll utilities used by in-page anchor navigation.
 *
 * Centralises the eased scroll animation, the reduced-motion fallback, and
 * the cancel-on-re-click behaviour so that every page shares a single
 * implementation. Callers should not need to know about `requestAnimationFrame`,
 * easing curves, or `prefers-reduced-motion`.
 */

export interface SmoothScrollOptions {
  /** Vertical offset (px) subtracted from the target's top. Use to clear a sticky header. */
  offsetPx?: number;
  /** Animation duration (ms). */
  durationMs?: number;
  /** Easing curve, input/output both in [0, 1]. Defaults to easeOutCubic. */
  easing?: (progress: number) => number;
}

const DEFAULT_OFFSET_PX = 80;
const DEFAULT_DURATION_MS = 720;

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

const prefersReducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Module-level so a re-entrant call (clicking a second nav link mid-scroll)
// cancels the in-flight frame instead of stacking two animations on the same
// scroll container. There is only one window scroll, so a single slot is
// sufficient.
let activeFrame: number | null = null;

/**
 * Scroll the window so `target` sits `offsetPx` below the top of the viewport.
 *
 * Falls back to an instant jump when the user prefers reduced motion. Re-entrant
 * calls cancel the previous animation and start a fresh one from the current
 * scroll position, so clicking a different nav link mid-flight feels responsive.
 */
export const smoothScrollTo = (
  target: HTMLElement,
  options: SmoothScrollOptions = {},
): void => {
  const offsetPx = options.offsetPx ?? DEFAULT_OFFSET_PX;
  const durationMs = options.durationMs ?? DEFAULT_DURATION_MS;
  const easing = options.easing ?? easeOutCubic;

  if (prefersReducedMotion()) {
    target.scrollIntoView({ block: 'start' });
    return;
  }

  const startY = window.scrollY;
  const targetY =
    target.getBoundingClientRect().top + window.scrollY - offsetPx;
  const distance = targetY - startY;
  if (Math.abs(distance) < 1) return;

  if (activeFrame !== null) cancelAnimationFrame(activeFrame);
  const startTime = performance.now();
  const step = (now: number) => {
    const progress = Math.min((now - startTime) / durationMs, 1);
    window.scrollTo(0, startY + distance * easing(progress));
    activeFrame = progress < 1 ? requestAnimationFrame(step) : null;
  };
  activeFrame = requestAnimationFrame(step);
};
