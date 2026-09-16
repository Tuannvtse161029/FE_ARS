/**
 * Regression tests for src/components/seminar/SeminarCalendar.tsx.
 *
 * Pins the September 2026 layout fix:
 *
 *   Before: when `hostingSeminars + joiningSeminars` was empty (the
 *   common case for Reviewer / Graduate Student who don't organise
 *   seminars and may not have any invitations), the calendar body
 *   collapsed to a single centred "No seminars scheduled" message.
 *   The header (date title, Today/nav, view toggle, legend) was
 *   visible but the grid (Sun-Sat columns with hour rows for the
 *   week view, or the 6×7 day cell grid for the month view) was
 *   completely hidden. The visual result was a header-only page
 *   that gave the user no sense of where in the week/month they
 *   were and looked like a broken component.
 *
 *   After: the grid ALWAYS renders. The empty case shows a small
 *   inline "No seminars in this view" status chip ABOVE the grid
 *   so users still get the date/time structure, can navigate
 *   prev/next/today, and switch between day/week/month views.
 *   The header-less version is only acceptable when the WHOLE
 *   calendar is intentionally hidden (e.g. role-gated pages), not
 *   when data is just empty.
 *
 * These tests render the calendar in a default I18nProvider and
 * assert on four properties:
 *
 *   1. The grid structure is present in week, month, and day views
 *      regardless of whether seminars are passed.
 *   2. The empty-state hint chip is shown when there are no seminars.
 *   3. The empty-state hint chip is NOT shown once a seminar exists.
 *   4. Seminar event blocks render correctly when data is provided.
 *   5. `showHostingLegend={false}` hides the "Hosting" legend dot
 *      without dropping the grid (Reviewer/GradStudent UX).
 *   6. The error/loading banners render and the retry callback fires.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { I18nProvider } from '../../../../src/i18n/I18nContext';
import { SeminarCalendar } from '../../../../src/components/seminar/SeminarCalendar';
import type { EnrichedSeminar } from '../../../../src/hooks/useSeminarCalendar';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const renderCalendar = (ui: React.ReactElement): ReturnType<typeof render> =>
  render(<I18nProvider>{ui}</I18nProvider>);

/**
 * Wait for the en dictionary chunk to finish loading inside the I18nProvider
 * so the components re-render with translated strings instead of raw keys.
 *
 * We assert on the `aria-label` of the calendar region becoming the
 * resolved string "Seminar Calendar" (or its Vietnamese equivalent) —
 * when that happens, the en dictionary has loaded.
 */
const waitForDictionary = async () => {
  await waitFor(
    () => {
      const region = document.querySelector('[aria-label="Seminar Calendar"]');
      expect(region).toBeInTheDocument();
    },
    { timeout: 3000 },
  );
};

/** Build a minimal EnrichedSeminar fixture. */
const makeSeminar = (
  id: number,
  startTime: string,
  endTime: string,
  role: 'hosting' | 'joining' = 'joining',
): EnrichedSeminar => ({
  seminarId: id,
  title: `Seminar ${id}`,
  content: `Content for seminar ${id}`,
  startTime,
  endTime,
  status: 'Upcoming',
  organizerId: role === 'hosting' ? 42 : 99,
  onlineLink: null,
  calendarRole: role,
});

// Wednesday in the current week, 10:00 – 11:00 local.
const FIXED_START = '2026-09-16T10:00:00Z';
const FIXED_END = '2026-09-16T11:00:00Z';

beforeEach(() => {
  // Each test starts on English; the Vietnamese test opts in explicitly.
  window.localStorage.setItem('ars_lang', 'en');
});

afterEach(() => {
  window.localStorage.setItem('ars_lang', 'en');
});

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('SeminarCalendar — empty-state grid regression', () => {
  it('renders the week grid (day columns + hour rows) when no seminars are passed', async () => {
    renderCalendar(
      <SeminarCalendar
        hostingSeminars={[]}
        joiningSeminars={[]}
        showHostingLegend={false}
        initialDate={new Date('2026-09-16T00:00:00Z')}
      />,
    );
    await waitForDictionary();

    // The header should be present.
    expect(
      screen.getByRole('region', { name: /seminar calendar/i }),
    ).toBeInTheDocument();

    // The week view should be selected by default — it renders hour
    // labels (07:00 – 22:00) inside the time gutter.
    expect(screen.getByText('07:00')).toBeInTheDocument();
    expect(screen.getByText('22:00')).toBeInTheDocument();

    // The empty-state hint chip should be visible above the grid.
    expect(
      screen.getByText(/no seminars in this view/i),
    ).toBeInTheDocument();

    // The view-toggle buttons (Day / Week / Month) must still render.
    expect(screen.getByRole('button', { name: /^day$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^week$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^month$/i })).toBeInTheDocument();
  });

  it('renders the month grid when no seminars are passed and month view is selected', async () => {
    renderCalendar(
      <SeminarCalendar
        hostingSeminars={[]}
        joiningSeminars={[]}
        showHostingLegend={false}
        initialDate={new Date('2026-09-16T00:00:00Z')}
      />,
    );
    await waitForDictionary();

    // Switch to month view.
    const monthBtn = screen.getByRole('button', { name: /^month$/i });
    monthBtn.click();

    // Empty hint must still be visible.
    await waitFor(() => {
      expect(
        screen.getByText(/no seminars in this view/i),
      ).toBeInTheDocument();
    });

    // The hour-row labels (07:00, 22:00) are week-view-only; in month
    // view they disappear but the day-number cells (1, 2, 3 …) appear
    // instead. The grid is a 6×7 layout so day "1" can appear twice
    // (once for the previous month spillover, once for Sep 1 itself).
    // We just need at least one cell rendered to prove the grid exists.
    await waitFor(() => {
      const dayCells = document.querySelectorAll('[class*="monthDayNumber"]');
      expect(dayCells.length).toBeGreaterThanOrEqual(28);
    });
  });

  it('renders a day view (single day column) when no seminars are passed and day view is selected', async () => {
    renderCalendar(
      <SeminarCalendar
        hostingSeminars={[]}
        joiningSeminars={[]}
        showHostingLegend={false}
        initialDate={new Date('2026-09-16T00:00:00Z')}
      />,
    );
    await waitForDictionary();

    const dayBtn = screen.getByRole('button', { name: /^day$/i });
    dayBtn.click();

    await waitFor(() => {
      // Day view still shows hour gutter labels.
      expect(screen.getByText('07:00')).toBeInTheDocument();
      expect(screen.getByText('22:00')).toBeInTheDocument();
    });
  });

  it('shows the empty-state hint chip ONLY when there are no seminars', async () => {
    // First render: empty.
    const { unmount } = renderCalendar(
      <SeminarCalendar
        hostingSeminars={[]}
        joiningSeminars={[]}
        showHostingLegend={false}
        initialDate={new Date('2026-09-16T00:00:00Z')}
      />,
    );
    await waitForDictionary();
    expect(screen.getByText(/no seminars in this view/i)).toBeInTheDocument();
    unmount();

    // Second render: with one seminar in the current week.
    renderCalendar(
      <SeminarCalendar
        hostingSeminars={[]}
        joiningSeminars={[makeSeminar(1, FIXED_START, FIXED_END, 'joining')]}
        showHostingLegend={false}
        initialDate={new Date('2026-09-16T00:00:00Z')}
      />,
    );
    await waitForDictionary();

    // The empty hint must NOT appear.
    expect(
      screen.queryByText(/no seminars in this view/i),
    ).not.toBeInTheDocument();

    // The seminar block should be present (it uses the seminar title in
    // an accessible label on its button).
    await waitFor(() => {
      expect(screen.getByLabelText(/seminar 1/i)).toBeInTheDocument();
    });
  });

  it('hides the Hosting legend dot when showHostingLegend={false} but still renders the grid', async () => {
    renderCalendar(
      <SeminarCalendar
        hostingSeminars={[makeSeminar(2, FIXED_START, FIXED_END, 'hosting')]}
        joiningSeminars={[]}
        showHostingLegend={false}
        initialDate={new Date('2026-09-16T00:00:00Z')}
      />,
    );
    await waitForDictionary();

    // The "Hosting" legend item must be absent. We search for a span
    // whose text is exactly "Hosting" inside the legend group.
    expect(screen.queryByText(/^hosting$/i)).not.toBeInTheDocument();
    // The "Joining" legend item must be present.
    expect(screen.getByText(/^joining$/i)).toBeInTheDocument();
    // The grid is still rendered (hour labels present).
    expect(screen.getByText('07:00')).toBeInTheDocument();
  });

  it('renders the status banners: loading chip, error banner, retry button', async () => {
    const { rerender } = renderCalendar(
      <SeminarCalendar
        hostingSeminars={[]}
        joiningSeminars={[]}
        showHostingLegend={false}
        initialDate={new Date('2026-09-16T00:00:00Z')}
        isLoading
      />,
    );
    await waitForDictionary();
    expect(screen.getByText(/loading seminars/i)).toBeInTheDocument();

    const onRetry = vi.fn();
    rerender(
      <I18nProvider>
        <SeminarCalendar
          hostingSeminars={[]}
          joiningSeminars={[]}
          showHostingLegend={false}
          initialDate={new Date('2026-09-16T00:00:00Z')}
          errorMessage="Network down"
          onRetry={onRetry}
        />
      </I18nProvider>,
    );
    await waitForDictionary();
    expect(screen.getByText(/network down/i)).toBeInTheDocument();
    const retryBtn = screen.getByRole('button', { name: /retry/i });
    retryBtn.click();
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('renders the calendar in Vietnamese without crashing', async () => {
    // Opt into Vietnamese before mounting.
    window.localStorage.setItem('ars_lang', 'vi');

    renderCalendar(
      <SeminarCalendar
        hostingSeminars={[]}
        joiningSeminars={[]}
        showHostingLegend={false}
        initialDate={new Date('2026-09-16T00:00:00Z')}
      />,
    );

    // Once the vi dictionary loads, the region label flips to "Lịch hội thảo".
    await waitFor(
      () => {
        const region = document.querySelector('[aria-label="Lịch hội thảo"]');
        expect(region).toBeInTheDocument();
      },
      { timeout: 5000 },
    );

    // The Vietnamese empty hint must appear (it lives in vi.ts).
    // jsdom does not implement `innerText`, so we use `textContent`.
    expect(document.body.textContent ?? '').toContain('Chưa có hội thảo');
  });
});
