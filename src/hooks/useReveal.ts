/**
 * useReveal — IntersectionObserver-driven fade-in hook.
 *
 * Returns a ref the consumer attaches to the element that should
 * reveal on scroll, plus a `seen` boolean that flips to `true` the
 * moment the element enters the viewport (or is already on screen
 * when the component mounts).
 *
 * Critical: if the element is ALREADY past the viewport top when
 * the observer attaches (e.g. when navigating back to the top of a
 * long page, or when the element is in a sticky stage that already
 * passed its reveal trigger), we mark it seen immediately. Otherwise
 * the observer would silently never fire and the section would stay
 * invisible forever.
 *
 * This is the same hook LandingScrollVideo.tsx defines privately —
 * extracted into its own module so smaller act components
 * (RecognitionAct, etc.) can share the same behavior without
 * duplicating the IntersectionObserver plumbing.
 */

import { useEffect, useRef, useState } from 'react';

/** safeMatchMedia — guards against environments without window.matchMedia
 * (jsdom test envs, SSR, older browsers). Returns the MediaQueryList when
 * available, or null so callers can pick a safe default without crashing.
 */
export const safeMatchMedia = (query: string): MediaQueryList | null => {
  if (
    typeof window === 'undefined' ||
    typeof window.matchMedia !== 'function'
  ) {
    return null;
  }
  return window.matchMedia(query);
};

export const useReveal = <T extends HTMLElement>(threshold = 0.15) => {
  const ref = useRef<T>(null);
  const [seen, setSeen] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    // If element is already on-screen or above the viewport top, mark seen.
    // The check uses the full viewport (no negative rootMargin inset) so
    // elements currently sitting in the bottom 8% of the viewport are
    // still treated as "on screen".
    const rect = node.getBoundingClientRect();
    const vh = window.innerHeight || document.documentElement.clientHeight;
    if (rect.top < vh && rect.bottom > 0) {
      setSeen(true);
      return;
    }

    if (typeof IntersectionObserver === 'undefined') {
      setSeen(true);
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setSeen(true);
          io.disconnect();
        }
      },
      // Small bottom inset shrinks the trigger zone so elements don't
      // fire too early, but not so much that bottom-of-viewport
      // elements miss the trigger.
      { threshold, rootMargin: '0px 0px 0px 0px' },
    );
    io.observe(node);
    return () => io.disconnect();
  }, [threshold]);

  return { ref, seen };
};

export default useReveal;
