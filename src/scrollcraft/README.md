# ScrollCraft Integration for ARS_FE

A React integration for [scroll-craft](https://github.com/nateherkai/scroll-craft), an agent skill for building premium, scroll-driven websites.

## Overview

This module provides React components, hooks, and utilities that wrap the scrollcraft vanilla JS engine, enabling scroll-driven interactions within the ARS platform.

### What is scrollcraft?

scrollcraft treats **scroll as the timeline** — the wheel becomes a scrubber, the page becomes a film with real text on top, and each section behaves differently enough that the visitor keeps going to find out what the next one does.

**Key capabilities:**
- **Scroll-driven video** — Video scrubs frame-by-frame under the wheel
- **Pinned sections** — Content sticks while its argument advances
- **Parallax layers** — Elements move at different rates for depth
- **Kinetic typography** — Text assembles line-by-line or word-by-word
- **Pointer interactivity** — Tilt, magnet, and spotlight effects
- **Worldflight mode** — One continuous camera flight through the page

## Quick Start

### 1. Import the CSS

Add scrollcraft integration CSS to your app entry point:

```tsx
// main.tsx or App.tsx
import '@scrollcraft/scrollcraft.css';
import '@scrollcraft/ars-integration.css';
```

Or with a path alias:

```tsx
import 'src/scrollcraft/scrollcraft.css';
import 'src/scrollcraft/ars-integration.css';
```

### 2. Use ScrollPage

Wrap your scroll-driven content with `ScrollPage`:

```tsx
import { ScrollPage } from 'src/scrollcraft';

export function MyLandingPage() {
  return (
    <ScrollPage
      theme="warmPaper"  // or "archiveDusk", "academicNavy", "paperDay"
      showProgress={true}
      showGrain={true}
    >
      {/* Your scroll-driven content */}
    </ScrollPage>
  );
}
```

### 3. Add Scroll Acts

Create pinned sections with scroll-driven content:

```tsx
import { 
  ScrollAct, 
  ScrollStage, 
  ScrollCopy, 
  ScrollScrim,
  ScrollMedia,
  ScrollCue,
  ScrollDisplay,
} from 'src/scrollcraft';

export function HeroSection() {
  return (
    <ScrollAct act="scrub" span={2.5} dwell={0.3}>
      <ScrollStage>
        {/* Background video that scrubs with scroll */}
        <ScrollMedia
          type="video"
          src="/video.mp4"
          poster="/poster.jpg"
        />
        
        {/* Gradient overlay */}
        <ScrollScrim variant="band" />
        
        {/* Text that fades in */}
        <ScrollCopy position="lead">
          <ScrollCue cue="0.1 0.5">
            <ScrollDisplay size="xl">
              Your Headline
            </ScrollDisplay>
          </ScrollCue>
        </ScrollCopy>
      </ScrollStage>
    </ScrollAct>
  );
}
```

## Core Concepts

### Acts (Sections)

Acts are the unit of scroll time. Each act has:
- A **device type** (`scrub`, `pin`, `pan`, `flow`)
- A **span** (how many viewport heights it owns)
- A **stage** (the sticky viewport container)

```tsx
<ScrollAct act="pin" span={2}>
  <ScrollStage>
    {/* Pinned content */}
  </ScrollStage>
</ScrollAct>
```

### Devices

| Device | Description | Use Case |
|--------|-------------|----------|
| `scrub` | Video/image scrubs with scroll | Hero with video background |
| `pin` | Content sticks while scroll advances | Feature reveals |
| `pan` | Horizontal rail movement | Gallery strips |
| `flow` | Natural scroll (default) | Regular content sections |

### Cue System

Cues control when elements fade/rise based on scroll progress:

```tsx
// Fade in from 10% to 50% of the act
<ScrollCue cue="0.1 0.5">
  <Heading>Text</Heading>
</ScrollCue>

// Kinetic text reveal (word by word)
<ScrollCue cue="0.1 0.5" kinetic="words">
  <Heading>Text</Heading>
</ScrollCue>
```

### Parallax

Layers move at different rates for depth:

```tsx
<ScrollParallax rate={-0.3}>
  <img src="/background.jpg" alt="" />
</ScrollParallax>

<ScrollParallax rate={0.1}>
  <Content>Foreground content</Content>
</ScrollParallax>
```

### WorldFlight Mode

One continuous camera flight through the page:

```tsx
import { WorldFlight } from 'src/scrollcraft';

<WorldFlight
  segments={[
    { label: 'Hero', weight: 1.5, poster: '/p1.jpg', video: '/v1.mp4' },
    { label: 'Features', weight: 1.2, poster: '/p2.jpg', video: '/v2.mp4' },
  ]}
  copies={[
    { content: <HeroCopy />, window: 'hero' },
    { content: <FeatureCopy />, window: '0.3 0.55' },
  ]}
/>
```

## Components

### Layout Components

| Component | Purpose |
|-----------|---------|
| `ScrollPage` | Full-page wrapper with engine initialization |
| `ScrollAct` | Scroll-driven section with device type |
| `ScrollStage` | Sticky viewport container |
| `ScrollCopy` | Text positioned over a stage |
| `ScrollScrim` | Gradient overlay for legibility |
| `ScrollWrap` | Max-width container with gutters |
| `ScrollSection` | Standard section with spacing |

### Content Components

| Component | Purpose |
|-----------|---------|
| `ScrollDisplay` | Display heading (h1-h3) |
| `ScrollLedea` | Introductory paragraph |
| `ScrollBody` | Body text |
| `ScrollLabel` | Small caps label |

### Interactive Components

| Component | Purpose |
|-----------|---------|
| `ScrollCue` | Fade/rise based on scroll |
| `ScrollReveal` | Clip-path wipe reveal |
| `ScrollParallax` | Differential movement |
| `ScrollCounter` | Animated number counter |
| `ScrollFlowReveal` | Fires once on entry |
| `ScrollTilt` | 3D tilt toward cursor |
| `ScrollMagnet` | Drifts toward cursor |
| `ScrollSpotlight` | Light follows cursor |

### Media Components

| Component | Purpose |
|-----------|---------|
| `ScrollMedia` | Video/image with scroll behavior |
| `ScrollPan` | Horizontal rail for panning |

## Themes

The integration includes pre-built themes aligned with ARS design tokens:

```tsx
import { ScrollPage } from 'src/scrollcraft';

// Warm paper (default ARS light theme)
<ScrollPage theme="warmPaper" />

// Archive dusk (dark theme)
<ScrollPage theme="archiveDusk" />

// Academic navy (scholarly feel)
<ScrollPage theme="academicNavy" />

// Paper day (clean minimal)
<ScrollPage theme="paperDay" />
```

### Role-Specific Accents

Apply role-specific colors to acts:

```tsx
<ScrollAct act="scrub" data-role="researcher">
  {/* Uses --ars-researcher accent color */}
</ScrollAct>

<ScrollAct act="scrub" data-role="reviewer">
  {/* Uses --ars-reviewer accent color */}
</ScrollAct>
```

## Hooks

### useScrollcraft

Initialize scrollcraft on a container:

```tsx
const { containerRef, isReady } = useScrollcraft({
  lerp: 0.18,  // Playhead smoothing (default)
  enabled: true,
});
```

### useScrollProgress

Track scroll progress within an element:

```tsx
const progress = useScrollProgress(elementRef);
```

### useReducedMotion

Check user motion preference:

```tsx
const prefersReducedMotion = useReducedMotion();
```

## TypeScript

All components are fully typed:

```tsx
interface ScrollActProps {
  act: 'scrub' | 'pin' | 'pan' | 'flow';
  span?: number;
  dwell?: number;
  clipMap?: 'travel';
  drift?: string;
}

interface ScrollMediaProps {
  type: 'video' | 'image';
  src?: string;
  srcMobile?: string;
  poster?: string;
  lerp?: number;
  alt?: string;
}
```

## Best Practices

### 1. Plan Variety

Use at least 4 different device types per page:

```tsx
// Hero: video scrub
<ScrollAct act="scrub" span={2.5}>
  
// Features: pinned sections
<ScrollAct act="pin" span={1.5}>

// Gallery: horizontal pan
<ScrollAct act="pan" span={2}>
  
// CTA: flow reveal
<ScrollSection>
  <ScrollFlowReveal>
```

### 2. Engineer the Peak

One moment should get the most scroll room:

```tsx
// The most important act gets the largest span
<ScrollAct act="pin" span={3}>  // Peak
<ScrollAct act="pin" span={1.5}> // Supporting
```

### 3. Use Real Typography

scrollcraft components use semantic HTML:

```tsx
// ✅ Correct
<ScrollDisplay size="xl">Heading</ScrollDisplay>
<ScrollBody>Paragraph text</ScrollBody>

// ❌ Avoid
<div className="big-text">Heading</div>
```

### 4. Test Reduced Motion

Always test with `prefers-reduced-motion`:

```tsx
@media (prefers-reduced-motion: reduce) {
  [data-sc-parallax],
  [data-sc-pan],
  .sc-split__i {
    transform: none !important;
  }
}
```

## File Structure

```
src/scrollcraft/
├── index.ts              # Main exports and hooks
├── components.tsx        # React components
├── ScrollPage.tsx        # Page wrapper and utilities
├── ScrollCraftDemo.tsx   # Demo component
├── scrollcraft.js        # Engine (from nateherkai/scroll-craft)
├── scrollcraft.css       # Base styles
├── ars-tokens.ts         # ARS token mapping
├── ars-integration.css   # Integration CSS
└── README.md            # This file
```

## Reference

- [scroll-craft GitHub](https://github.com/nateherkai/scroll-craft)
- [scroll-craft SKILL.md](https://github.com/nateherkai/scroll-craft/blob/main/plugins/nateherk-design/skills/scroll-craft/SKILL.md)
- [Design References](https://github.com/nateherkai/scroll-craft/tree/main/plugins/nateherk-design/skills/scroll-craft/references)

## License

scroll-craft is MIT licensed. See [LICENSE](https://github.com/nateherkai/scroll-craft/blob/main/LICENSE).
