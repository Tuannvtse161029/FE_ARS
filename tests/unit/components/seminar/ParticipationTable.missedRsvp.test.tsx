/**
 * Regression tests for the "missed RSVP" auto-decline behavior in
 * `src/components/seminar/ParticipationTable.tsx`.
 *
 * Contract pinned by these tests:
 *
 *   1. When a seminar's `endTime` is in the past but the seminar is
 *      still flagged IN PROGRESS (the in-progress window is
 *      `[startTime, endTime)`) AND the participant's invitation is
 *      still PENDING, the table must:
 *        - render the row under the "Invitations" tab only;
 *        - render the "Missed RSVP" status pill (en + vi);
 *        - render the read-only "You missed the RSVP window" message
 *          in the actions cell;
 *        - NOT render the Accept / Reject / Participate buttons.
 *
 *   2. The same row must be excluded from the default "All" tab so
 *      the participant's normal participation list is not cluttered
 *      with rows they can no longer act on.
 *
 *   3. A PENDING invitation whose seminar is still UPCOMING (not yet
 *      started) must still render the Accept / Reject buttons — only
 *      the IN PROGRESS + PENDING combination auto-declines.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nProvider } from '../../../../src/i18n/I18nContext';
import { ParticipationTable } from '../../../../src/components/seminar/ParticipationTable';
import type { ParticipationRow } from '../../../../src/hooks/useSeminarParticipations';

// ─────────────────────────────────────────────────────────────────────────────
// Module mocks
// ─────────────────────────────────────────────────────────────────────────────

// The participation hook is the single source of truth for the table. We
// mock the whole module so the test can swap rows + refetch per case.
const mockRowsState: {
  rows: ParticipationRow[];
  isLoading: boolean;
  error: string | null;
} = {
  rows: [],
  isLoading: false,
  error: null,
};

const refetchMock = vi.fn(async () => undefined);
const acceptMock = vi.fn(async () => undefined);
const declineMock = vi.fn(async () => undefined);

vi.mock('../../../../src/hooks/useSeminarParticipations', () => ({
  useSeminarParticipations: () => ({
    rows: mockRowsState.rows,
    isLoading: mockRowsState.isLoading,
    error: mockRowsState.error,
    refetch: refetchMock,
    invitations: mockRowsState.rows.filter((r) => r.invitationStatus === 'PENDING'),
    seminars: mockRowsState.rows.filter(
      (r) => r.invitationStatus === 'INVITED' || r.invitationStatus === 'SUBMITTED',
    ),
  }),
  useAcceptInvitation: () => ({
    accept: acceptMock,
    isAccepting: false,
    error: null,
  }),
  useDeclineInvitation: () => ({
    decline: declineMock,
    isDeclining: false,
    error: null,
  }),
}));

vi.mock('../../../../src/services/notification.service', () => ({
  notificationService: {
    create: vi.fn().mockResolvedValue({}),
  },
}));

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build a PENDING participation row whose seminar is in the requested
 * effective state.
 *
 *   `effectiveState: 'in-progress'`  → startTime = 30 min ago, endTime = 30 min from now
 *   `effectiveState: 'upcoming'`     → startTime = 30 min from now, endTime = 90 min from now
 *   `effectiveState: 'completed'`    → endTime = 30 min ago
 */
const makePendingRow = (
  id: number,
  effectiveState: 'in-progress' | 'upcoming' | 'completed',
  overrides: Partial<ParticipationRow> = {},
): ParticipationRow => {
  const now = Date.now();
  const mins = (m: number) => new Date(now + m * 60_000).toISOString();
  const startEnd =
    effectiveState === 'in-progress'
      ? { startTime: mins(-30), endTime: mins(30) }
      : effectiveState === 'upcoming'
        ? { startTime: mins(30), endTime: mins(90) }
        : { startTime: mins(-120), endTime: mins(-30) };
  return {
    seminarId: id,
    title: `Test Seminar ${id}`,
    detail: `Detail for seminar ${id}`,
    onlineLink: 'https://meet.google.com/abc-defg-hij',
    organizerName: 'Host Lecturer',
    organizerId: 99,
    invitationStatus: 'PENDING',
    invitationStatusRaw: 'Pending',
    participantSubmitted: false,
    feedbackJson: null,
    seminarParticipantId: id,
    ...startEnd,
    ...overrides,
  };
};

const waitForDictionary = async () => {
  await waitFor(
    () => {
      // The toolbar's status-tablist label resolves once the en
      // dictionary has loaded. We assert on the `aria-label` of the
      // status tablist (rendered unconditionally above the empty
      // state) so the wait succeeds whether or not any rows are
      // visible.
      const tablist = document.querySelector('[aria-label="Filter participations"]');
      expect(tablist).toBeInTheDocument();
      // And the "Refresh" button label, which is also unconditional.
      expect(screen.getByRole('button', { name: /Refresh participations/i })).toBeInTheDocument();
    },
    { timeout: 3000 },
  );
};

const renderTable = () => render(<I18nProvider><ParticipationTable /></I18nProvider>);

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('ParticipationTable — missed RSVP auto-decline', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRowsState.rows = [];
    mockRowsState.isLoading = false;
    mockRowsState.error = null;
  });

  it('renders a "Missed RSVP" pill and read-only actions for an in-progress seminar with a PENDING invitation', async () => {
    mockRowsState.rows = [makePendingRow(1, 'in-progress')];

    renderTable();
    await waitForDictionary();

    // The row is excluded from the default "All" tab (per the auto-declined
    // filter behaviour) — switch to Invitations to surface it. The tab's
    // accessible name is `${label}${count}` (no separator), so we match
    // on the label prefix only.
    const user = userEvent.setup();
    await user.click(screen.getByRole('tab', { name: /^Invitations/i }));

    // The status pill carries the "Missed RSVP" label.
    const pill = await screen.findByTestId('seminar-status-missed-rsvp');
    expect(pill).toHaveTextContent(/Missed RSVP/i);

    // The actions cell carries the locked message — no Accept/Reject/Participate
    // affordances should be present for this row.
    const actions = screen.getByTestId('seminar-actions-missed-rsvp');
    expect(actions).toHaveTextContent(/missed the rsvp window/i);
    const tr = actions.closest('tr')!;
    expect(within(tr).queryByRole('button', { name: /Accept invitation/i })).toBeNull();
    expect(within(tr).queryByRole('button', { name: /Reject invitation/i })).toBeNull();
    expect(within(tr).queryByRole('button', { name: /Participate/i })).toBeNull();

    // And the underlying API hooks are never called — this is a display-only projection.
    expect(acceptMock).not.toHaveBeenCalled();
    expect(declineMock).not.toHaveBeenCalled();
  });

  it('excludes a missed-RSVP row from the default "All" filter', async () => {
    // Two rows: one PENDING + UPCOMING (still actionable), one PENDING + IN PROGRESS
    // (missed RSVP). Under "All" only the actionable row should appear.
    mockRowsState.rows = [
      makePendingRow(1, 'upcoming'),
      makePendingRow(2, 'in-progress'),
    ];

    renderTable();
    await waitForDictionary();

    // Default tab is "All" — only the upcoming row is visible.
    expect(await screen.findByText('Test Seminar 1')).toBeInTheDocument();
    expect(screen.queryByText('Test Seminar 2')).not.toBeInTheDocument();

    // The Invitations tab counts both rows (so the participant can still find the record).
    const invitationsTab = screen.getByRole('tab', { name: /^Invitations/i });
    expect(within(invitationsTab).getByText('2')).toBeInTheDocument();

    // And the In Progress tab excludes the missed-RSVP row (count is 0).
    const inProgressTab = screen.getByRole('tab', { name: /^In Progress/i });
    expect(within(inProgressTab).getByText('0')).toBeInTheDocument();
  });

  it('shows the missed-RSVP row under the "Invitations" tab so the participant can find it', async () => {
    mockRowsState.rows = [makePendingRow(1, 'in-progress')];

    renderTable();
    await waitForDictionary();

    const user = userEvent.setup();
    await user.click(screen.getByRole('tab', { name: /^Invitations/i }));

    // The missed-RSVP row appears under Invitations.
    expect(await screen.findByText('Test Seminar 1')).toBeInTheDocument();
    expect(screen.getByTestId('seminar-status-missed-rsvp')).toHaveTextContent(/Missed RSVP/i);
  });

  it('keeps Accept / Reject buttons for a PENDING invitation whose seminar is still UPCOMING', async () => {
    mockRowsState.rows = [makePendingRow(1, 'upcoming')];

    renderTable();
    await waitForDictionary();

    // Under the default "All" tab the upcoming pending row is visible and
    // still exposes the Accept + Reject affordances.
    const row = await screen.findByText('Test Seminar 1');
    const tr = row.closest('tr');
    expect(tr).not.toBeNull();
    expect(within(tr!).getByRole('button', { name: /Accept invitation/i })).toBeInTheDocument();
    expect(within(tr!).getByRole('button', { name: /Reject invitation/i })).toBeInTheDocument();
    expect(screen.queryByTestId('seminar-status-missed-rsvp')).toBeNull();
  });
});
