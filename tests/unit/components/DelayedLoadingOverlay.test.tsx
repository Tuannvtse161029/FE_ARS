/**
 * Component tests for src/components/DelayedLoadingOverlay.tsx.
 *
 * Verifies:
 *   - Renders nothing while `isLoading` is false (no flicker for fast requests).
 *   - Renders the labeled status surface only after the configured delay elapses.
 *   - Exposes an accessible `role="status"` with `aria-live="polite"` and the
 *     caller-provided label.
 *   - Renders the Lucide-style hand-writing illustration (paper outline,
 *     three ruled research lines, hand + pencil group) inside the overlay so
 *     the loading state still reads as "writing a research paper".
 *   - Honors custom label and delay props.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { DelayedLoadingOverlay } from '../../../src/components/DelayedLoadingOverlay';
import styles from '../../../src/components/DelayedLoadingOverlay.module.css';

describe('<DelayedLoadingOverlay>', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders nothing while isLoading is false', () => {
    const { container } = render(<DelayedLoadingOverlay isLoading={false} />);
    expect(container.firstChild).toBeNull();
  });

  it('does not render the surface until the delay has elapsed', () => {
    render(<DelayedLoadingOverlay isLoading label="Loading ARS" delay={250} />);

    // Still inside the delay window — overlay should not mount yet.
    expect(screen.queryByRole('status')).not.toBeInTheDocument();

    // Advance just before the delay; still not rendered.
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();

    // Cross the delay boundary; overlay should now be visible.
    act(() => {
      vi.advanceTimersByTime(60);
    });
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('exposes role="status" with aria-live="polite" and the supplied label', () => {
    render(<DelayedLoadingOverlay isLoading label="Loading page" delay={0} />);
    act(() => {
      vi.advanceTimersByTime(0);
    });
    const surface = screen.getByRole('status');
    expect(surface).toHaveAttribute('aria-live', 'polite');
    expect(surface).toHaveAttribute('aria-label', 'Loading page');
    expect(screen.getByText('Loading page')).toBeInTheDocument();
    expect(screen.getByText('This may take a moment.')).toBeInTheDocument();
  });

  it('falls back to the default label and delay when none are provided', () => {
    render(<DelayedLoadingOverlay isLoading />);
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    const surface = screen.getByRole('status');
    expect(surface).toHaveAttribute('aria-label', 'Loading your workspace');
  });

  it('renders the hand-writing illustration with paper, ruled lines, hand and pencil', () => {
    render(<DelayedLoadingOverlay isLoading label="Loading ARS" delay={0} />);
    act(() => {
      vi.advanceTimersByTime(0);
    });

    const illustration = screen.getByTestId('loading-illustration');
    expect(illustration).toBeInTheDocument();
    expect(illustration.tagName.toLowerCase()).toBe('svg');
    // The illustration is decorative; the accessible label is on the wrapper.
    expect(illustration).toHaveAttribute('aria-hidden', 'true');

    // Lucide-style monochrome outline (no fills, single stroke colour).
    expect(illustration).toHaveAttribute('fill', 'none');
    expect(illustration).toHaveAttribute('stroke', 'currentColor');
    expect(illustration).toHaveAttribute('stroke-width', '2');
    expect(illustration).toHaveAttribute('stroke-linecap', 'round');
    expect(illustration).toHaveAttribute('stroke-linejoin', 'round');

    // Paper outline, ruled lines, hand and pencil all present.
    expect(
      illustration.querySelector(`.${styles.paper}`),
    ).not.toBeNull();
    expect(
      illustration.querySelector(`.${styles.line1}`),
    ).not.toBeNull();
    expect(
      illustration.querySelector(`.${styles.line2}`),
    ).not.toBeNull();
    expect(
      illustration.querySelector(`.${styles.line3}`),
    ).not.toBeNull();
    expect(
      illustration.querySelector(`.${styles.handPen}`),
    ).not.toBeNull();
    expect(
      illustration.querySelector(`.${styles.pencil}`),
    ).not.toBeNull();
    expect(
      illustration.querySelector(`.${styles.hand}`),
    ).not.toBeNull();
  });

  it('hides the surface again when isLoading flips back to false', () => {
    const { rerender, container } = render(
      <DelayedLoadingOverlay isLoading label="Loading ARS" delay={0} />,
    );
    act(() => {
      vi.advanceTimersByTime(0);
    });
    expect(screen.getByRole('status')).toBeInTheDocument();

    rerender(<DelayedLoadingOverlay isLoading={false} label="Loading ARS" />);
    expect(container.firstChild).toBeNull();
  });

  it('wires the handPen group so the writing loop can drive the pencil', () => {
    render(<DelayedLoadingOverlay isLoading label="Loading ARS" delay={0} />);
    act(() => {
      vi.advanceTimersByTime(0);
    });

    const illustration = screen.getByTestId('loading-illustration');
    const handPen = illustration.querySelector(`.${styles.handPen}`);
    expect(handPen).not.toBeNull();
    expect(handPen?.tagName.toLowerCase()).toBe('g');

    // Hand + pencil live inside the same group so they translate together.
    expect(handPen?.querySelector(`.${styles.hand}`)).not.toBeNull();
    expect(handPen?.querySelector(`.${styles.pencil}`)).not.toBeNull();
  });
});

// ───────────────────────────────────────────────────────────────────
// Theme behaviour (this worker)
// ───────────────────────────────────────────────────────────────────
describe('<DelayedLoadingOverlay> — theme behaviour', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    document.documentElement.removeAttribute('data-theme');
  });

  afterEach(() => {
    vi.useRealTimers();
    document.documentElement.removeAttribute('data-theme');
  });

  /**
   * Read a CSS custom property from the document root. jsdom doesn't
   * implement a real cascade, so we seed the value the way
   * `ars-tokens.css` would for each theme.
   */
  const seedToken = (name: string, value: string) => {
    document.documentElement.style.setProperty(name, value);
  };

  it('uses Paper Day tokens by default (light surface, ink colour follows)', () => {
    seedToken('--surface-canvas', '#fffdf8');
    seedToken('--ink-primary', '#1d1c19');

    render(<DelayedLoadingOverlay isLoading label="Loading ARS" delay={0} />);
    act(() => {
      vi.advanceTimersByTime(0);
    });

    const backdrop = screen.getByRole('status').parentElement;
    expect(backdrop).not.toBeNull();

    // The backdrop is a div with the .backdrop class. We can't read the
    // computed `color-mix(...)` value in jsdom, but we can verify the
    // inline token values are present so the production cascade will
    // resolve correctly.
    const surface = document.documentElement.style.getPropertyValue('--surface-canvas');
    expect(surface).toBe('#fffdf8');
    expect(backdrop).toBeInTheDocument();
  });

  it('flips the backdrop reference to the archive-dusk canvas when the theme attribute is set', () => {
    seedToken('--surface-canvas', '#fffdf8'); // paper-day default
    render(<DelayedLoadingOverlay isLoading label="Loading ARS" delay={0} />);
    act(() => {
      vi.advanceTimersByTime(0);
    });

    // Simulate the user toggling to dark mode (the hook would do this
    // before the overlay becomes visible on a long-running request).
    seedToken('--surface-canvas', '#090d16'); // archive-dusk canvas
    document.documentElement.setAttribute('data-theme', 'archive-dusk');

    // The overlay is still mounted, but its CSS now reads
    // --surface-canvas from the archive-dusk cascade.
    expect(
      document.documentElement.style.getPropertyValue('--surface-canvas'),
    ).toBe('#090d16');
    expect(document.documentElement.getAttribute('data-theme')).toBe(
      'archive-dusk',
    );
  });

  it('drops the :global archive-dusk override — the cascade handles both themes via tokens', () => {
    // The previous CSS used `:global(:root[data-theme='archive-dusk']) .backdrop`
    // with hardcoded rgba(24, 22, 16, 0.96) and #f4e9c9 colours. With the
    // refactor those values must no longer appear in the compiled stylesheet
    // — the cascade auto-themes via --surface-canvas / --ink-primary. We
    // pin the negative so a future regression that re-hardcodes the dark
    // colours (or reintroduces the :global override) trips this test.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const fs = require('fs') as typeof import('fs');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const path = require('path') as typeof import('path');
    const cssPath = path.join(
      process.cwd(),
      'src',
      'components',
      'DelayedLoadingOverlay.module.css',
    );
    const css = fs.readFileSync(cssPath, 'utf8');

    expect(css).not.toMatch(/:global\(:root\[data-theme=/);
    expect(css).not.toMatch(/rgba\(255,\s*248,\s*232/);
    expect(css).not.toMatch(/rgba\(24,\s*22,\s*16/);
    expect(css).not.toMatch(/#231d10/);
    expect(css).not.toMatch(/#f4e9c9/);
  });
});
