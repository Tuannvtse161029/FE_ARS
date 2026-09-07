/**
 * scrollcraft React Integration
 * 
 * This module provides React hooks and utilities for integrating the scrollcraft
 * scroll-driven interaction engine into a React application.
 * 
 * scrollcraft is a vanilla JS runtime that reads `data-sc-*` attributes from your
 * HTML and drives scroll interactions. This wrapper provides React components and
 * hooks for seamless integration.
 */

import { useEffect, useRef, useState } from 'react';
import './scrollcraft.css';

// Type declarations for the scrollcraft mount function
declare global {
  interface Window {
    scrollcraft?: {
      mount: (root: Element | string, opts?: { lerp?: number }) => () => void;
    };
  }
}

/**
 * Initialize scrollcraft on a container element.
 * Returns a cleanup function that should be called on unmount.
 */
function initScrollcraft(root: Element, opts?: { lerp?: number }): () => void {
  // Check if scrollcraft is already loaded
  if (window.scrollcraft?.mount) {
    return window.scrollcraft.mount(root, opts);
  }
  
  // Load scrollcraft dynamically
  console.warn('[scrollcraft] Engine not loaded. Call loadScrollcraft() first.');
  return () => {};
}

/**
 * Load the scrollcraft engine script.
 * Call this once at app startup or before using scrollcraft components.
 */
export function loadScrollcraft(): Promise<void> {
  return new Promise((resolve, reject) => {
    // Already loaded
    if (window.scrollcraft?.mount) {
      resolve();
      return;
    }
    
    // Check if script tag already exists
    const existingScript = document.querySelector('script[data-scrollcraft]');
    if (existingScript) {
      const checkLoaded = setInterval(() => {
        if (window.scrollcraft?.mount) {
          clearInterval(checkLoaded);
          resolve();
        }
      }, 50);
      return;
    }
    
    const script = document.createElement('script');
    script.src = new URL('./scrollcraft.js', import.meta.url).href;
    script.setAttribute('data-scrollcraft', '');
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load scrollcraft engine'));
    document.head.appendChild(script);
  });
}

/**
 * useScrollcraft - Hook to initialize scrollcraft on a container element.
 * 
 * @param containerRef - Ref to the container element
 * @param options - Optional configuration
 * 
 * Usage:
 * ```tsx
 * const containerRef = useScrollcraft({ lerp: 0.18 });
 * 
 * return (
 *   <div ref={containerRef}>
 *     <section data-sc-act="pin" data-sc-span="2">
 *       <div className="sc-stage">
 *         <video data-sc-scrub src="/video.mp4" poster="/poster.jpg" />
 *         <div className="sc-copy sc-copy--lead">
 *           <h1 data-sc-cue="0.1 0.5">Scroll-driven heading</h1>
 *         </div>
 *       </div>
 *     </section>
 *   </div>
 * );
 * ```
 */
export function useScrollcraft<T extends HTMLElement>(
  options?: {
    lerp?: number;
    enabled?: boolean;
  }
) {
  const containerRef = useRef<T>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const [isReady, setIsReady] = useState(false);
  
  const { lerp = 0.18, enabled = true } = options || {};
  
  useEffect(() => {
    if (!enabled || !containerRef.current) return;
    
    let mounted = true;
    
    const init = async () => {
      try {
        await loadScrollcraft();
        
        if (!mounted || !containerRef.current) return;
        
        // Wait for fonts to load before initializing
        if (document.fonts) {
          await document.fonts.ready;
        }
        
        if (!mounted || !containerRef.current) return;
        
        cleanupRef.current = initScrollcraft(containerRef.current, { lerp });
        setIsReady(true);
      } catch (error) {
        console.error('[scrollcraft] Failed to initialize:', error);
      }
    };
    
    init();
    
    return () => {
      mounted = false;
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }
      setIsReady(false);
    };
  }, [lerp, enabled]);
  
  return { containerRef, isReady };
}

/**
 * useScrollProgress - Track scroll progress within a pinned section.
 * 
 * Useful for creating custom scroll-driven effects that integrate with
 * the scrollcraft engine.
 */
export function useScrollProgress(
  elementRef: React.RefObject<HTMLElement>,
  options?: {
    onProgress?: (progress: number) => void;
  }
) {
  const [progress, setProgress] = useState(0);
  
  useEffect(() => {
    const el = elementRef.current;
    if (!el) return;
    
    const handleScroll = () => {
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight;
      
      // Calculate progress based on scroll position
      const scrollableHeight = rect.height - vh;
      if (scrollableHeight <= 0) {
        setProgress(rect.top <= 0 ? 1 : 0);
        return;
      }
      
      const scrolled = -rect.top;
      const newProgress = Math.max(0, Math.min(1, scrolled / scrollableHeight));
      setProgress(newProgress);
      
      options?.onProgress?.(newProgress);
    };
    
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    
    return () => window.removeEventListener('scroll', handleScroll);
  }, [elementRef, options]);
  
  return progress;
}

/**
 * useIntersectionObserver - Track element visibility for lazy loading.
 */
export function useIntersectionObserver(
  elementRef: React.RefObject<HTMLElement>,
  options?: IntersectionObserverInit
) {
  const [isIntersecting, setIsIntersecting] = useState(false);
  
  useEffect(() => {
    const el = elementRef.current;
    if (!el) return;
    
    const observer = new IntersectionObserver(([entry]) => {
      setIsIntersecting(entry.isIntersecting);
    }, {
      threshold: 0.1,
      ...options,
    });
    
    observer.observe(el);
    
    return () => observer.disconnect();
  }, [elementRef, options]);
  
  return isIntersecting;
}

// Export types for scrollcraft attributes
export type ScrollActType = 'scrub' | 'pin' | 'pan' | 'flow';
export type ScrollRevealDirection = 'up' | 'down' | 'left' | 'right' | 'iris';
export type ScrollKineticMode = 'lines' | 'words' | 'chars';

export interface ScrollCueOptions {
  /** Cue window: from [to [rampIn [rampOut]]] */
  cue?: string;
  /** Rise distance in pixels */
  rise?: number;
  /** Kinetic text split mode */
  kinetic?: ScrollKineticMode;
}

export interface ScrollActOptions {
  /** Device type: scrub, pin, pan, or flow */
  act?: ScrollActType;
  /** Viewport heights this act owns */
  span?: number;
  /** Dwell factor (0-1) for settling mid-act */
  dwell?: number;
  /** Clip mapping mode */
  clipMap?: 'travel';
  /** Background color drift */
  drift?: string;
}

export interface ScrollMediaOptions {
  /** Video source */
  src?: string;
  /** Mobile video source */
  srcMobile?: string;
  /** Poster image */
  poster?: string;
  /** Lerp rate override */
  lerp?: number;
}

export interface ScrollRevealOptions {
  /** Reveal direction */
  direction?: ScrollRevealDirection;
  /** Reveal timing window */
  at?: string;
}

export interface ScrollParallaxOptions {
  /** Parallax rate (-1 to 1) */
  rate?: number;
}

export interface ScrollCounterOptions {
  /** Count range: "from to" */
  range?: string;
  /** Count timing window */
  at?: string;
  /** Animation duration in ms */
  ms?: number;
}

// Helper function to build data-sc-* attribute strings
export function buildScrollAttrs(options: {
  act?: ScrollActOptions;
  cue?: ScrollCueOptions;
  media?: ScrollMediaOptions;
  reveal?: ScrollRevealOptions;
  parallax?: ScrollParallaxOptions;
  counter?: ScrollCounterOptions;
  /** Additional custom data-sc-* attributes */
  custom?: Record<string, string>;
}): Record<string, string> {
  const attrs: Record<string, string> = {};
  
  // Act attributes
  if (options.act) {
    if (options.act.act) attrs['data-sc-act'] = options.act.act;
    if (options.act.span !== undefined) attrs['data-sc-span'] = String(options.act.span);
    if (options.act.dwell !== undefined) attrs['data-sc-dwell'] = String(options.act.dwell);
    if (options.act.clipMap) attrs['data-sc-clip-map'] = options.act.clipMap;
    if (options.act.drift) attrs['data-sc-drift'] = options.act.drift;
  }
  
  // Cue attributes
  if (options.cue) {
    if (options.cue.cue) attrs['data-sc-cue'] = options.cue.cue;
    if (options.cue.rise !== undefined) attrs['data-sc-rise'] = String(options.cue.rise);
    if (options.cue.kinetic) attrs['data-sc-kinetic'] = options.cue.kinetic;
  }
  
  // Media attributes
  if (options.media) {
    if (options.media.src) attrs['data-sc-src'] = options.media.src;
    if (options.media.srcMobile) attrs['data-sc-src-mobile'] = options.media.srcMobile;
    if (options.media.poster) attrs['data-sc-poster'] = options.media.poster;
    if (options.media.lerp !== undefined) attrs['data-sc-lerp'] = String(options.media.lerp);
  }
  
  // Reveal attributes
  if (options.reveal) {
    if (options.reveal.direction) attrs['data-sc-reveal'] = options.reveal.direction;
    if (options.reveal.at) attrs['data-sc-reveal-at'] = options.reveal.at;
  }
  
  // Parallax attributes
  if (options.parallax) {
    if (options.parallax.rate !== undefined) attrs['data-sc-parallax'] = String(options.parallax.rate);
  }
  
  // Counter attributes
  if (options.counter) {
    if (options.counter.range) attrs['data-sc-count'] = options.counter.range;
    if (options.counter.at) attrs['data-sc-count-at'] = options.counter.at;
    if (options.counter.ms !== undefined) attrs['data-sc-count-ms'] = String(options.counter.ms);
  }
  
  // Custom attributes
  if (options.custom) {
    Object.assign(attrs, options.custom);
  }
  
  return attrs;
}

// ── Re-exports for tree-shake-friendly single-entry-point consumption ──
export { ScrollPage, WorldFlight, useScrollPosition, useReducedMotion, usePointerPosition, useScrollPageTheme, ScrollDivider, ScrollVisuallyHidden } from './ScrollPage';
export type { ScrollPageTheme, WorldFlightSegment, WorldFlightCopy, WorldFlightProps } from './ScrollPage';

export {
  ScrollStage,
  ScrollCopy,
  ScrollScrim,
  ScrollAct,
  ScrollMedia,
  ScrollCue,
  ScrollReveal,
  ScrollParallax,
  ScrollCounter,
  ScrollFlowReveal,
  ScrollPan,
  ScrollSpotlight,
  ScrollTilt,
  ScrollMagnet,
  ScrollProgress,
  ScrollGrain,
  ScrollDisplay,
  ScrollLedea,
  ScrollBody,
  ScrollLabel,
  ScrollWrap,
  ScrollSection,
  ScrollStack,
} from './components';

export { arsScrollThemes, tokenMap, arsScrollCSS, applyArsTheme } from './ars-tokens';

export { ScrollCraftDemo } from './ScrollCraftDemo';
export type { ScrollCraftDemoProps } from './ScrollCraftDemo';

export default {
  loadScrollcraft,
  useScrollcraft,
  useScrollProgress,
  useIntersectionObserver,
  buildScrollAttrs,
};
