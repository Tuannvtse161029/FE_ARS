/**
 * ScrollPage - Full-page scroll experience wrapper
 * 
 * Provides a complete scrollcraft-powered page with:
 * - Engine initialization
 * - Design token theming
 * - Progress indicator
 * - Grain overlay
 * - Reduced motion support
 */

import React, { useEffect, useState, useRef, createContext, useContext } from 'react';
import { loadScrollcraft } from './index';
import { ScrollGrain, ScrollProgress } from './components';

// ============================================================================
// Theme Context
// ============================================================================

export interface ScrollPageTheme {
  canvas: string;
  surface: string;
  ink: string;
  inkSoft: string;
  accent: string;
  accentInk: string;
  fontDisplay: string;
  fontText: string;
}

export const defaultTheme: ScrollPageTheme = {
  canvas: '#f4efe6',    // ARS warm parchment
  surface: '#fbf8f1',   // ARS paper card
  ink: '#2d3561',       // ARS deep navy
  inkSoft: '#59627a',   // ARS muted slate
  accent: '#007aff',    // ARS blue
  accentInk: '#ffffff',
  fontDisplay: '"Roboto", "Segoe UI", Helvetica, Arial, sans-serif',
  fontText: '"Roboto", "Segoe UI", Helvetica, Arial, sans-serif',
};

const ThemeContext = createContext<ScrollPageTheme>(defaultTheme);

export function useScrollPageTheme() {
  return useContext(ThemeContext);
}

// ============================================================================
// ScrollPage Component
// ============================================================================

export interface ScrollPageProps {
  children: React.ReactNode;
  /** Custom theme tokens */
  theme?: Partial<ScrollPageTheme>;
  /** Whether to show progress bar */
  showProgress?: boolean;
  /** Whether to show grain overlay */
  showGrain?: boolean;
  /** Additional CSS class for the page container */
  className?: string;
  /** Lerp rate for video scrubbing (default: 0.18) */
  lerp?: number;
  /** Whether scrollcraft is enabled */
  enabled?: boolean;
  /** Custom styles */
  style?: React.CSSProperties;
  /** ID for the page element */
  id?: string;
}

export function ScrollPage({
  children,
  theme = {},
  showProgress = false,
  showGrain = true,
  className = '',
  lerp = 0.18,
  enabled = true,
  style = {},
  id,
}: ScrollPageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isReady, setIsReady] = useState(false);
  const mergedTheme = { ...defaultTheme, ...theme };

  // Preload fonts and scrollcraft
  useEffect(() => {
    if (!enabled) return;

    const init = async () => {
      try {
        // Wait for fonts
        if (document.fonts) {
          await document.fonts.ready;
        }
        // Load scrollcraft engine
        await loadScrollcraft();
        setIsReady(true);
      } catch (error) {
        console.error('[ScrollPage] Failed to initialize:', error);
      }
    };

    init();
  }, [enabled]);

  // Initialize scrollcraft engine when ready
  useEffect(() => {
    if (!enabled || !isReady || !containerRef.current) return;

    let cleanup: (() => void) | null = null;

    if (window.scrollcraft?.mount) {
      cleanup = window.scrollcraft.mount(containerRef.current, { lerp });
    }

    return () => {
      if (cleanup) cleanup();
    };
  }, [enabled, isReady, lerp]);

  // Apply theme tokens to CSS variables
  const themeStyle: React.CSSProperties = {
    '--sc-canvas': mergedTheme.canvas,
    '--sc-surface': mergedTheme.surface,
    '--sc-ink': mergedTheme.ink,
    '--sc-ink-soft': mergedTheme.inkSoft,
    '--sc-accent': mergedTheme.accent,
    '--sc-accent-ink': mergedTheme.accentInk,
    '--sc-font-display': mergedTheme.fontDisplay,
    '--sc-font-text': mergedTheme.fontText,
  } as React.CSSProperties;

  return (
    <ThemeContext.Provider value={mergedTheme}>
      <div
        ref={containerRef}
        id={id}
        className={`scroll-page ${isReady ? 'sc-ready' : ''} ${className}`.trim()}
        style={{ ...themeStyle, ...style }}
        data-scrollcraft-ready={isReady}
      >
        {children}
        {showGrain && <ScrollGrain />}
        {showProgress && <ScrollProgress />}
      </div>
    </ThemeContext.Provider>
  );
}

// ============================================================================
// WorldFlight Mode - One continuous camera flight
// ============================================================================

export interface WorldFlightSegment {
  /** Waypoint label */
  label?: string;
  /** Segment weight in viewport heights */
  weight?: number;
  /** Dwell remap for this leg (0-0.6) */
  linger?: number;
  /** Poster image */
  poster?: string;
  /** Video source */
  video?: string;
  /** Mobile video source */
  videoMobile?: string;
}

export interface WorldFlightCopy {
  /** Copy content */
  content: React.ReactNode;
  /** Window position: "hero" | "finale" | "from to [in [out]]" */
  window: string;
}

export interface WorldFlightProps {
  /** Flight segments */
  segments: WorldFlightSegment[];
  /** Copy blocks */
  copies?: WorldFlightCopy[];
  /** Crossfade seam band in viewport heights (default: 0.12) */
  seam?: number;
  /** Additional CSS class */
  className?: string;
}

export function WorldFlight({ segments, copies = [], seam = 0.12, className = '' }: WorldFlightProps) {
  return (
    <div
      className={className}
      data-sc-mode="worldflight"
      data-sc-seam={String(seam)}
    >
      {/* Stage - fixed viewport */}
      <div className="sc-world" data-sc-world>
        {segments.map((segment, index) => (
          <div
            key={index}
            className="sc-world__seg"
            data-sc-segment
            data-sc-w={String(segment.weight ?? 1.3)}
            data-sc-linger={String(segment.linger ?? 0)}
            data-sc-waypoint={segment.label ?? ''}
          >
            {segment.poster && (
              <img 
                className="sc-world__poster" 
                src={segment.poster} 
                alt="" 
                data-sc-poster
              />
            )}
            {segment.video && (
              <video
                data-sc-scrub
                data-sc-src={segment.video}
                data-sc-src-mobile={segment.videoMobile}
                muted
                playsInline
                preload="none"
              />
            )}
          </div>
        ))}
      </div>

      {/* Copy layer */}
      <div className="sc-world__copy" data-sc-world-copy>
        <div className="sc-world__scrim sc-scrim sc-scrim--band" aria-hidden="true" />
        {copies.map((copy, index) => (
          <div
            key={index}
            className="sc-copy sc-copy--lead"
            data-sc-copy
            data-sc-window={copy.window}
          >
            {copy.content}
          </div>
        ))}
      </div>

      {/* Spacer - creates scroll track */}
      <div className="sc-world__spacer" data-sc-spacer aria-hidden="true" />
    </div>
  );
}

// ============================================================================
// Scroll Hooks for custom effects
// ============================================================================

/**
 * useScrollPosition - Get current scroll position and velocity
 */
export function useScrollPosition() {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [velocity, setVelocity] = useState({ x: 0, y: 0 });
  const lastPosition = useRef({ x: 0, y: 0, time: Date.now() });

  useEffect(() => {
    const handleScroll = () => {
      const now = Date.now();
      const dt = now - lastPosition.current.time;
      
      const newY = window.scrollY;
      const newX = window.scrollX;
      
      setVelocity({
        x: dt > 0 ? (newX - lastPosition.current.x) / dt : 0,
        y: dt > 0 ? (newY - lastPosition.current.y) / dt : 0,
      });
      
      setPosition({ x: newX, y: newY });
      lastPosition.current = { x: newX, y: newY, time: now };
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return { position, velocity };
}

/**
 * useReducedMotion - Detect user preference for reduced motion
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);

    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  return reduced;
}

/**
 * usePointerPosition - Get normalized pointer position (0-1)
 */
export function usePointerPosition() {
  const [position, setPosition] = useState({ x: 0.5, y: 0.5 });

  useEffect(() => {
    const handleMove = (e: MouseEvent) => {
      setPosition({
        x: e.clientX / window.innerWidth,
        y: e.clientY / window.innerHeight,
      });
    };

    const handleLeave = () => {
      setPosition({ x: 0.5, y: 0.5 });
    };

    window.addEventListener('mousemove', handleMove, { passive: true });
    window.addEventListener('mouseleave', handleLeave);
    
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseleave', handleLeave);
    };
  }, []);

  return position;
}

// ============================================================================
// Utility Components
// ============================================================================

/**
 * ScrollDivider - Visual divider between sections
 */
export interface ScrollDividerProps {
  className?: string;
}

export function ScrollDivider({ className = '' }: ScrollDividerProps) {
  return <hr className={`sc-rule ${className}`.trim()} />;
}

/**
 * ScrollVisuallyHidden - Accessible hidden content
 */
export interface ScrollVisuallyHiddenProps extends React.HTMLAttributes<HTMLSpanElement> {
  children: React.ReactNode;
}

export function ScrollVisuallyHidden({ children, className = '', ...props }: ScrollVisuallyHiddenProps) {
  return (
    <span
      className={className}
      style={{
        position: 'absolute',
        width: '1px',
        height: '1px',
        padding: 0,
        margin: '-1px',
        overflow: 'hidden',
        clip: 'rect(0, 0, 0, 0)',
        whiteSpace: 'nowrap',
        border: 0,
      }}
      {...props}
    >
      {children}
    </span>
  );
}

// Export all
export default {
  ScrollPage,
  WorldFlight,
  useScrollPosition,
  useReducedMotion,
  usePointerPosition,
  useScrollPageTheme,
  ScrollDivider,
  ScrollVisuallyHidden,
  defaultTheme,
};
