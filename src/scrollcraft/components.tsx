/**
 * ScrollCraft Components
 * 
 * React components that wrap common scrollcraft patterns.
 * These components generate semantic HTML with the correct data-sc-* attributes
 * and integrate seamlessly with the scrollcraft engine.
 */

import React, { forwardRef } from 'react';
import { buildScrollAttrs, type ScrollActType, type ScrollRevealDirection, type ScrollKineticMode } from './index';

// ============================================================================
// ScrollStage - The sticky viewport container for pinned sections
// ============================================================================

export interface ScrollStageProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  /** Additional CSS class */
  className?: string;
}

export const ScrollStage = forwardRef<HTMLDivElement, ScrollStageProps>(
  function ScrollStage({ children, className = '', ...props }, ref) {
    return (
      <div
        ref={ref}
        className={`sc-stage ${className}`.trim()}
        {...props}
      >
        {children}
      </div>
    );
  }
);

// ============================================================================
// ScrollCopy - Text content positioned over a stage
// ============================================================================

export interface ScrollCopyProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  /** Copy position */
  position?: 'lead' | 'center' | 'trail';
  /** Additional CSS class */
  className?: string;
}

export const ScrollCopy = forwardRef<HTMLDivElement, ScrollCopyProps>(
  function ScrollCopy({ children, position = 'lead', className = '', ...props }, ref) {
    return (
      <div
        ref={ref}
        className={`sc-copy sc-copy--${position} ${className}`.trim()}
        {...props}
      >
        {children}
      </div>
    );
  }
);

// ============================================================================
// ScrollScrim - Gradient overlay for text legibility
// ============================================================================

export interface ScrollScrimProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Scrim variant */
  variant?: 'default' | 'bottom' | 'left' | 'right' | 'lead' | 'trail' | 'band' | 'vignette';
  /** Additional CSS class */
  className?: string;
}

export const ScrollScrim = forwardRef<HTMLDivElement, ScrollScrimProps>(
  function ScrollScrim({ variant = 'default', className = '', ...props }, ref) {
    return (
      <div
        ref={ref}
        className={`sc-scrim ${variant !== 'default' ? `sc-scrim--${variant}` : ''} ${className}`.trim()}
        aria-hidden="true"
        {...props}
      />
    );
  }
);

// ============================================================================
// ScrollAct - A scroll-driven act section
// ============================================================================

export interface ScrollActProps extends React.HTMLAttributes<HTMLElement> {
  children: React.ReactNode;
  /** Device type: scrub, pin, pan, or flow */
  act: ScrollActType;
  /** Viewport heights this act owns */
  span?: number;
  /** Dwell factor for settling mid-act */
  dwell?: number;
  /** Clip mapping mode */
  clipMap?: 'travel';
  /** Background color drift */
  drift?: string;
  /** Tag to use for the section element */
  as?: keyof JSX.IntrinsicElements;
  /** Additional CSS class */
  className?: string;
}

export const ScrollAct = forwardRef<HTMLElement, ScrollActProps>(
  function ScrollAct(
    { 
      children, 
      act, 
      span, 
      dwell, 
      clipMap, 
      drift, 
      as: Tag = 'section', 
      className = '',
      ...props 
    },
    ref
  ) {
    const attrs = buildScrollAttrs({
      act: { act, span, dwell, clipMap, drift },
    });

    return React.createElement(
      Tag,
      { ref, className: className || undefined, ...attrs, ...props },
      children
    );
  }
);

// ============================================================================
// ScrollMedia - Video or image with scroll-driven behavior
// ============================================================================

export interface ScrollMediaProps extends React.HTMLAttributes<HTMLVideoElement | HTMLImageElement> {
  /** Media type */
  type: 'video' | 'image';
  /** Source URL */
  src?: string;
  /** Mobile source URL */
  srcMobile?: string;
  /** Poster image for video */
  poster?: string;
  /** Lerp rate override */
  lerp?: number;
  /** Alt text (for images) */
  alt?: string;
  /** Additional CSS class */
  className?: string;
}

export const ScrollMedia = forwardRef<HTMLVideoElement | HTMLImageElement, ScrollMediaProps>(
  function ScrollMedia(
    { type, src, srcMobile, poster, lerp, alt, className = '', ...props },
    ref
  ) {
    const commonAttrs = {
      'data-sc-src': src,
      'data-sc-src-mobile': srcMobile,
      'data-sc-poster': poster,
      'data-sc-lerp': lerp,
    };

    if (type === 'video') {
      return (
        <video
          ref={ref as React.RefObject<HTMLVideoElement>}
          className={className}
          {...commonAttrs}
          data-sc-scrub=""
          muted
          playsInline
          preload="none"
          {...(props as React.VideoHTMLAttributes<HTMLVideoElement>)}
        />
      );
    }

    return (
      <img
        ref={ref as React.RefObject<HTMLImageElement>}
        className={className}
        src={src}
        alt={alt || ''}
        {...(props as React.ImgHTMLAttributes<HTMLImageElement>)}
      />
    );
  }
);

// ============================================================================
// ScrollCue - Text that fades/rises based on scroll progress
// ============================================================================

export interface ScrollCueProps extends React.HTMLAttributes<HTMLElement> {
  children: React.ReactNode;
  /** Cue window: "from to [rampIn [rampOut]]" */
  cue?: string;
  /** Rise distance in pixels */
  rise?: number;
  /** Kinetic text split mode */
  kinetic?: ScrollKineticMode;
  /** Tag to use */
  as?: keyof JSX.IntrinsicElements;
  /** Additional CSS class */
  className?: string;
}

export const ScrollCue = forwardRef<HTMLElement, ScrollCueProps>(
  function ScrollCue(
    { children, cue = '0.1 0.5', rise, kinetic, as: Tag = 'div', className = '', ...props },
    ref
  ) {
    const attrs = buildScrollAttrs({
      cue: { cue, rise, kinetic },
    });

    return React.createElement(
      Tag,
      { ref, className: className || undefined, ...attrs, ...props },
      children
    );
  }
);

// ============================================================================
// ScrollReveal - Element with clip-path reveal animation
// ============================================================================

export interface ScrollRevealProps extends React.HTMLAttributes<HTMLElement> {
  children: React.ReactNode;
  /** Reveal direction */
  direction?: ScrollRevealDirection;
  /** Reveal timing: "from to" */
  at?: string;
  /** Tag to use */
  as?: keyof JSX.IntrinsicElements;
  /** Additional CSS class */
  className?: string;
}

export const ScrollReveal = forwardRef<HTMLElement, ScrollRevealProps>(
  function ScrollReveal(
    { children, direction = 'up', at, as: Tag = 'div', className = '', ...props },
    ref
  ) {
    const attrs = buildScrollAttrs({
      reveal: { direction, at },
    });

    return React.createElement(
      Tag,
      { ref, className: className || undefined, ...attrs, ...props },
      children
    );
  }
);

// ============================================================================
// ScrollParallax - Layer with parallax movement
// ============================================================================

export interface ScrollParallaxProps extends React.HTMLAttributes<HTMLElement> {
  children: React.ReactNode;
  /** Parallax rate (-1 to 1). Negative = moves up faster (recedes). */
  rate?: number;
  /** Tag to use */
  as?: keyof JSX.IntrinsicElements;
  /** Additional CSS class */
  className?: string;
}

export const ScrollParallax = forwardRef<HTMLElement, ScrollParallaxProps>(
  function ScrollParallax(
    { children, rate = 0, as: Tag = 'div', className = '', ...props },
    ref
  ) {
    const attrs = buildScrollAttrs({
      parallax: { rate },
    });

    return React.createElement(
      Tag,
      { ref, className: className || undefined, ...attrs, ...props },
      children
    );
  }
);

// ============================================================================
// ScrollCounter - Animated number counter
// ============================================================================

export interface ScrollCounterProps extends React.HTMLAttributes<HTMLElement> {
  /** Count range: "from to" (e.g., "0 4200") */
  range?: string;
  /** Count timing window */
  at?: string;
  /** Animation duration in ms */
  ms?: number;
  /** Tag to use */
  as?: keyof JSX.IntrinsicElements;
  /** Additional CSS class */
  className?: string;
}

export const ScrollCounter = forwardRef<HTMLElement, ScrollCounterProps>(
  function ScrollCounter(
    { range = '0 100', at, ms, as: Tag = 'span', className = '', ...props },
    ref
  ) {
    const attrs = buildScrollAttrs({
      counter: { range, at, ms },
    });

    return React.createElement(
      Tag,
      { ref, className: className || undefined, ...attrs, ...props },
      null
    );
  }
);

// ============================================================================
// ScrollFlowReveal - Flow section that reveals once on entry
// ============================================================================

export interface ScrollFlowRevealProps extends React.HTMLAttributes<HTMLElement> {
  children: React.ReactNode;
  /** Stagger delay for children in ms */
  stagger?: number;
  /** Tag to use */
  as?: keyof JSX.IntrinsicElements;
  /** Additional CSS class */
  className?: string;
}

export const ScrollFlowReveal = forwardRef<HTMLElement, ScrollFlowRevealProps>(
  function ScrollFlowReveal(
    { children, stagger, as: Tag = 'div', className = '', ...props },
    ref
  ) {
    return React.createElement(
      Tag,
      { 
        ref, 
        className: className || undefined, 
        'data-sc-in': '', 
        'data-sc-stagger': stagger,
        ...props 
      },
      children
    );
  }
);

// ============================================================================
// ScrollPan - Horizontal rail for panning
// ============================================================================

export interface ScrollPanProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  /** Extra travel multiplier */
  multiplier?: number;
  /** Additional CSS class */
  className?: string;
}

export const ScrollPan = forwardRef<HTMLDivElement, ScrollPanProps>(
  function ScrollPan(
    { children, multiplier = 0.6, className = '', ...props },
    ref
  ) {
    return (
      <div
        ref={ref}
        className={`sc-rail ${className}`.trim()}
        data-sc-pan={String(multiplier)}
        style={{ display: 'flex', willChange: 'transform' }}
        {...props}
      >
        {children}
      </div>
    );
  }
);

// ============================================================================
// ScrollSpotlight - Element with spotlight effect following cursor
// ============================================================================

export interface ScrollSpotlightProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  /** Additional CSS class */
  className?: string;
}

export const ScrollSpotlight = forwardRef<HTMLDivElement, ScrollSpotlightProps>(
  function ScrollSpotlight({ children, className = '', ...props }, ref) {
    return (
      <div
        ref={ref}
        className={className}
        data-sc-spotlight=""
        style={{ isolation: 'isolate', position: 'relative' as const }}
        {...props}
      >
        {children}
        {/* Spotlight overlay is added via CSS ::after */}
      </div>
    );
  }
);

// ============================================================================
// ScrollTilt - Element with 3D tilt effect
// ============================================================================

export interface ScrollTiltProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  /** Tilt degrees */
  degrees?: number;
  /** Additional CSS class */
  className?: string;
}

export const ScrollTilt = forwardRef<HTMLDivElement, ScrollTiltProps>(
  function ScrollTilt({ children, degrees = 8, className = '', ...props }, ref) {
    return (
      <div
        ref={ref}
        className={className}
        data-sc-tilt={String(degrees)}
        style={{ transformStyle: 'preserve-3d', willChange: 'transform' }}
        {...props}
      >
        {children}
      </div>
    );
  }
);

// ============================================================================
// ScrollMagnet - Element that drifts toward cursor
// ============================================================================

export interface ScrollMagnetProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  /** Magnet strength (0-1) */
  strength?: number;
  /** Additional CSS class */
  className?: string;
}

export const ScrollMagnet = forwardRef<HTMLDivElement, ScrollMagnetProps>(
  function ScrollMagnet({ children, strength = 0.35, className = '', ...props }, ref) {
    return (
      <div
        ref={ref}
        className={className}
        data-sc-magnet={String(strength)}
        style={{ willChange: 'transform' }}
        {...props}
      >
        {children}
      </div>
    );
  }
);

// ============================================================================
// ScrollProgress - Page scroll progress indicator
// ============================================================================

export interface ScrollProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Additional CSS class */
  className?: string;
}

export const ScrollProgress = forwardRef<HTMLDivElement, ScrollProgressProps>(
  function ScrollProgress({ className = '', ...props }, ref) {
    return (
      <div
        ref={ref}
        className={className}
        data-sc-progress=""
        {...props}
      />
    );
  }
);

// ============================================================================
// ScrollGrain - Atmospheric grain overlay
// ============================================================================

export interface ScrollGrainProps {
  /** Additional CSS class */
  className?: string;
}

export function ScrollGrain({ className = '' }: ScrollGrainProps) {
  return <div className={`sc-grain ${className}`.trim()} aria-hidden="true" />;
}

// ============================================================================
// Typography Components (from scrollcraft.css)
// ============================================================================

export interface ScrollDisplayProps extends React.HTMLAttributes<HTMLHeadingElement> {
  /** Size variant */
  size?: 'xl' | 'lg' | 'md';
  /** Additional CSS class */
  className?: string;
}

export const ScrollDisplay = forwardRef<HTMLHeadingElement, ScrollDisplayProps>(
  function ScrollDisplay({ size = 'lg', className = '', ...props }, ref) {
    return (
      <h1
        ref={ref}
        className={`sc-display sc-display--${size} ${className}`.trim()}
        {...props}
      />
    );
  }
);

export interface ScrollLedeaProps extends React.HTMLAttributes<HTMLParagraphElement> {
  /** Additional CSS class */
  className?: string;
}

export const ScrollLedea = forwardRef<HTMLParagraphElement, ScrollLedeaProps>(
  function ScrollLedea({ className = '', ...props }, ref) {
    return (
      <p ref={ref} className={`sc-lede ${className}`.trim()} {...props} />
    );
  }
);

export interface ScrollBodyProps extends React.HTMLAttributes<HTMLParagraphElement> {
  /** Additional CSS class */
  className?: string;
}

export const ScrollBody = forwardRef<HTMLParagraphElement, ScrollBodyProps>(
  function ScrollBody({ className = '', ...props }, ref) {
    return (
      <p ref={ref} className={`sc-body ${className}`.trim()} {...props} />
    );
  }
);

export interface ScrollLabelProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Additional CSS class */
  className?: string;
}

export const ScrollLabel = forwardRef<HTMLSpanElement, ScrollLabelProps>(
  function ScrollLabel({ className = '', ...props }, ref) {
    return (
      <span ref={ref} className={`sc-label ${className}`.trim()} {...props} />
    );
  }
);

// ============================================================================
// Layout Components
// ============================================================================

export interface ScrollWrapProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Additional CSS class */
  className?: string;
}

export const ScrollWrap = forwardRef<HTMLDivElement, ScrollWrapProps>(
  function ScrollWrap({ className = '', ...props }, ref) {
    return (
      <div ref={ref} className={`sc-wrap ${className}`.trim()} {...props} />
    );
  }
);

export interface ScrollSectionProps extends React.HTMLAttributes<HTMLElement> {
  /** Additional CSS class */
  className?: string;
}

export const ScrollSection = forwardRef<HTMLElement, ScrollSectionProps>(
  function ScrollSection({ className = '', ...props }, ref) {
    return (
      <section ref={ref as React.RefObject<HTMLElement>} className={`sc-section ${className}`.trim()} {...props} />
    );
  }
);

export interface ScrollStackProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Additional CSS class */
  className?: string;
}

export const ScrollStack = forwardRef<HTMLDivElement, ScrollStackProps>(
  function ScrollStack({ className = '', ...props }, ref) {
    return (
      <div ref={ref} className={`sc-stack ${className}`.trim()} {...props} />
    );
  }
);

// Export all components
export default {
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
};
