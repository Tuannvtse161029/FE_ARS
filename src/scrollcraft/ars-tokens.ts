/**
 * ScrollCraft × ARS Design Token Alignment
 * 
 * This file maps scrollcraft's design tokens to the ARS design system,
 * creating a harmonious visual language for scroll-driven pages.
 * 
 * Reference:
 * - scrollcraft tokens: https://github.com/nateherkai/scroll-craft
 * - ARS tokens: src/styles/ars-tokens.css
 */

/**
 * ARS Theme Presets for ScrollCraft
 * 
 * These themes align scrollcraft's canvas/surface/ink model with ARS design tokens.
 */
export const arsScrollThemes = {
  /**
   * Warm Paper - Default ARS light theme
   * Uses warm parchment tones from the ARS design system
   */
  warmPaper: {
    canvas: '#fffdf8',      // app-canvas
    surface: '#fbf8f1',     // surface-paper
    ink: '#1d1c19',         // ink-primary
    inkSoft: '#6f695d',     // ink-muted
    accent: '#e2ad2f',      // accent-primary (ARS gold)
    accentInk: '#1d1c19',   // dark on gold
    fontDisplay: '"Roboto", "Segoe UI", Helvetica, Arial, sans-serif',
    fontText: '"Roboto", "Segoe UI", Helvetica, Arial, sans-serif',
  },

  /**
   * Archive Dusk - Dark theme
   * Deep slate/obsidian canvas for immersive scroll experiences
   */
  archiveDusk: {
    canvas: '#090d16',      // archive-dusk app-canvas
    surface: '#101726',     // archive-dusk surface-base
    ink: '#f8fafc',        // archive-dusk ink-primary
    inkSoft: '#94a3b8',     // archive-dusk ink-muted
    accent: '#3b82f6',      // archive-dusk accent-primary
    accentInk: '#ffffff',   // light on blue
    fontDisplay: '"Roboto", "Segoe UI", Helvetica, Arial, sans-serif',
    fontText: '"Roboto", "Segoe UI", Helvetica, Arial, sans-serif',
  },

  /**
   * Academic Navy - Professional academic feel
   * Uses the ARS deep navy for a scholarly impression
   */
  academicNavy: {
    canvas: '#1a1f36',      // ARS header/sidebar background
    surface: '#2d3561',     // Slightly lighter navy
    ink: '#f4efe6',         // Warm parchment text
    inkSoft: '#a0aec0',     // Muted slate
    accent: '#f5b400',      // ARS yellow accent
    accentInk: '#1a1f36',   // Dark on yellow
    fontDisplay: '"Roboto", "Segoe UI", Helvetica, Arial, sans-serif',
    fontText: '"Roboto", "Segoe UI", Helvetica, Arial, sans-serif',
  },

  /**
   * Paper Day - Clean minimal theme
   * Inspired by Paper Day design system
   */
  paperDay: {
    canvas: '#fffdf8',      // Warm white
    surface: '#ffffff',      // Pure white
    ink: '#1d1c19',         // Near black
    inkSoft: '#6f695d',     // Muted
    accent: '#e2ad2f',      // Gold accent
    accentInk: '#1d1c19',   // Dark on gold
    fontDisplay: '"Roboto", "Segoe UI", Helvetica, Arial, sans-serif',
    fontText: '"Roboto", "Segoe UI", Helvetica, Arial, sans-serif',
  },
} as const;

/**
 * Token mapping helper
 * 
 * Converts CSS variable names between systems:
 * scrollcraft: --sc-* 
 * ARS: --ars-* or semantic tokens
 */
export const tokenMap = {
  // Canvas / Background
  'sc-canvas': 'app-canvas',
  'sc-surface': 'surface-raised',
  
  // Typography
  'sc-ink': 'ink-primary',
  'sc-ink-soft': 'ink-secondary',
  'sc-font-display': 'font-family-ui',
  'sc-font-text': 'font-family-ui',
  
  // Accent
  'sc-accent': 'accent-primary',
  'sc-accent-ink': 'ink-on-paper',
  
  // Borders
  'sc-hairline': 'border-subtle',
  'sc-hairline-strong': 'border-strong',
} as const;

/**
 * CSS variable overrides for scrollcraft sections
 * 
 * Apply these to .scroll-page or specific .sc-act elements
 * to override scrollcraft's default dark theme with ARS tokens.
 */
export const arsScrollCSS = `
/* ============================================================================
   ScrollCraft × ARS Integration CSS
   Applies ARS design tokens to scrollcraft elements
   ============================================================================ */

/* Override scrollcraft root tokens with ARS theme */
.scroll-page,
.sc-page--warm {
  --sc-canvas: var(--app-canvas, #fffdf8);
  --sc-surface: var(--surface-raised, #ffffff);
  --sc-ink: var(--ink-primary, #1d1c19);
  --sc-ink-soft: var(--ink-secondary, #6f695d);
  --sc-accent: var(--accent-primary, #e2ad2f);
  --sc-accent-ink: var(--ink-on-paper, #1d1c19);
  --sc-font-display: var(--font-family-ui, 'Roboto', sans-serif);
  --sc-font-text: var(--font-family-ui, 'Roboto', sans-serif);
  
  --sc-hairline: var(--border-subtle);
  --sc-hairline-strong: var(--border-strong);
}

/* Dark theme override */
.scroll-page--dark,
.sc-page--dark {
  --sc-canvas: var(--app-canvas, #090d16);
  --sc-surface: var(--surface-base, #101726);
  --sc-ink: var(--ink-primary, #f8fafc);
  --sc-ink-soft: var(--ink-secondary, #94a3b8);
  --sc-accent: var(--accent-primary, #3b82f6);
  --sc-accent-ink: var(--ink-on-paper, #ffffff);
}

/* Navy theme override */
.sc-page--navy {
  --sc-canvas: #1a1f36;
  --sc-surface: #2d3561;
  --sc-ink: #f4efe6;
  --sc-ink-soft: #a0aec0;
  --sc-accent: #f5b400;
  --sc-accent-ink: #1a1f36;
}

/* ============================================================================
   Typography alignment
   ============================================================================ */

/* Use ARS heading styles for sc-display */
.sc-display {
  font-family: var(--sc-font-display);
  font-weight: 600; /* ARS medium weight */
  line-height: var(--sc-leading-none);
  letter-spacing: var(--sc-track-tight);
  text-wrap: balance;
  color: var(--sc-ink);
}

.sc-display--xl {
  font-size: clamp(2.5rem, 1.9rem + 3vw, 5rem);
}

.sc-display--lg {
  font-size: clamp(2rem, 1.5rem + 2.5vw, 4rem);
}

.sc-display--md {
  font-size: clamp(1.5rem, 1.2rem + 1.5vw, 2.5rem);
  letter-spacing: var(--sc-track-snug);
}

/* Use ARS body styles */
.sc-lede {
  font-size: clamp(1.1rem, 1rem + 0.5vw, 1.3rem);
  line-height: 1.5;
  color: var(--sc-ink);
}

.sc-body {
  font-family: var(--sc-font-text);
  font-size: 1rem;
  line-height: 1.7;
  color: var(--sc-ink-soft);
  max-width: 62ch;
}

.sc-label {
  font-family: var(--sc-font-mono, monospace);
  font-size: 0.75rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--sc-ink-soft);
}

/* ============================================================================
   Layout alignment
   ============================================================================ */

/* Use ARS spacing scale */
.sc-section {
  padding-block: clamp(4rem, 8vw, 10rem);
}

.sc-wrap {
  max-width: 82rem;
  padding-inline: clamp(1.25rem, 5vw, 5.5rem);
  margin-inline: auto;
}

/* ============================================================================
   Scrim alignment with ARS tones
   ============================================================================ */

/* Adjust scrim to use ARS canvas */
.sc-scrim {
  --sc-canvas-override: var(--sc-canvas);
}

/* ============================================================================
   Motion alignment with ARS motion system
   ============================================================================ */

/* Override scrollcraft easings with ARS motion tokens */
:root {
  --sc-ease-out: var(--motion-ease-standard, cubic-bezier(0.16, 1, 0.3, 1));
  --sc-ease-in-out: cubic-bezier(0.77, 0, 0.175, 1);
  --sc-ease-drawer: cubic-bezier(0.32, 0.72, 0, 1);
  --sc-d-fast: var(--duration-fast, 150ms);
  --sc-d-base: var(--duration-standard, 200ms);
  --sc-d-slow: var(--duration-emphasis, 250ms);
}

/* ============================================================================
   Role-specific accent overrides
   Use these classes on .sc-act elements for role-specific theming
   ============================================================================ */

/* Researcher - warm amber/ochre */
.sc-act--researcher {
  --sc-accent: var(--ars-researcher, #b45309);
  --sc-accent-ink: #ffffff;
}

/* Reviewer - forest green */
.sc-act--reviewer {
  --sc-accent: var(--ars-reviewer, #065f46);
  --sc-accent-ink: #ffffff;
}

/* Lecturer - deep burgundy */
.sc-act--lecturer {
  --sc-accent: var(--ars-lecturer, #7c2d12);
  --sc-accent-ink: #ffffff;
}

/* Graduate Student - slate blue */
.sc-act--student {
  --sc-accent: var(--ars-gradstudent, #1e3a8a);
  --sc-accent-ink: #ffffff;
}

/* Admin - violet */
.sc-act--admin {
  --sc-accent: var(--ars-admin, #818cf8);
  --sc-accent-ink: #1a1f36;
}
`;

/**
 * Apply ARS scroll theme to an element
 */
export function applyArsTheme(
  element: HTMLElement,
  theme: keyof typeof arsScrollThemes = 'warmPaper'
): void {
  const tokens = arsScrollThemes[theme];
  
  element.style.setProperty('--sc-canvas', tokens.canvas);
  element.style.setProperty('--sc-surface', tokens.surface);
  element.style.setProperty('--sc-ink', tokens.ink);
  element.style.setProperty('--sc-ink-soft', tokens.inkSoft);
  element.style.setProperty('--sc-accent', tokens.accent);
  element.style.setProperty('--sc-accent-ink', tokens.accentInk);
  element.style.setProperty('--sc-font-display', tokens.fontDisplay);
  element.style.setProperty('--sc-font-text', tokens.fontText);
}

export default {
  arsScrollThemes,
  tokenMap,
  arsScrollCSS,
  applyArsTheme,
};
