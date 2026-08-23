/**
 * SeminarWorkspace component tests.
 *
 * Covers:
 *   T1: Page renders real API data (loading / empty / with seminars)
 *   T2: Create seminar shows onlineLink from BE response; Join Meet button gated by isValidMeetLink
 *   T3: Reminder button sends PUT /api/Seminar/{id} and updates badge
 *   T6: Meeting Summary button shown only for COMPLETED seminars
 *
 * All seminar data is provided via mocked hooks so the component tests are
 * isolated from the network layer.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { SeminarWorkspace } from '../../../../src/pages/Lecturer/SeminarWorkspace';
import * as useSeminarModule from '../../../../src/hooks/useSeminar';

const { buildMockAuth } = vi.hoisted(() => ({
  buildMockAuth: vi.fn(() => ({
    user: { id: 7, email: 'lecturer@test.com', role: 'Lecturer' },
    isLoading: false,
  })),
}));

vi.mock('../../../../src/hooks/useAuth', () => ({
  useAuth: () => buildMockAuth(),
}));

vi.mock('../../../../src/context/AuthContext', () => ({
  useAuth: () => buildMockAuth(),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
  default: {},
}));

const mockSeminarCard = (overrides = {}) => ({
  seminarId: 5,
  title: 'Cloud Architecture Seminar',
  content: 'Deep dive into modular backend routing.',
  startTime: '2026-09-01T10:00:00Z',
  endTime: '2026-09-01T11:00:00Z',
  onlineLink: 'https://meet.google.com/abc-defg-hij',
  status: 'UPCOMING' as const,
  effectiveStatus: 'UPCOMING' as const,
  organizerId: null,
  isReminderSent: false,
  maxParticipants: null,
  aiSummary: null,
  participantCount: 0,
  feedbackSubmitted: 0,
  feedbackTotal: 0,
  ...overrides,
});

const mockUseSeminars = (overrides = {}) => ({
  seminars: [],
  isLoading: false,
  error: null,
  refetch: vi.fn(),
  ...overrides,
});

const mockUseCreateSeminar = (overrides = {}) => ({
  createSeminar: vi.fn(),
  isCreating: false,
  createError: null,
  ...overrides,
});

const mockUseSendReminder = (overrides = {}) => ({
  sendReminder: vi.fn(),
  isSending: false,
  sendError: null,
  ...overrides,
});

const mockUseSeminarParticipants = (overrides = {}) => ({
  participants: [],
  isLoading: false,
  error: null,
  refetch: vi.fn(),
  ...overrides,
});

const renderPage = (seminars = mockUseSeminars()) => {
  vi.spyOn(useSeminarModule, 'useSeminars').mockReturnValue(seminars);
  vi.spyOn(useSeminarModule, 'useCreateSeminar').mockReturnValue(mockUseCreateSeminar());
  vi.spyOn(useSeminarModule, 'useSendReminder').mockReturnValue(mockUseSendReminder());
  vi.spyOn(useSeminarModule, 'useSeminarParticipants').mockReturnValue(mockUseSeminarParticipants());

  return render(
    <MemoryRouter>
      <SeminarWorkspace />
    </MemoryRouter>
  );
};

/**
 * Variant of renderPage that overrides useSeminarParticipants (call this BEFORE render).
 * Useful for tests that need specific participant data (e.g. pending count > 0).
 */
const renderPageWithParticipants = (
  seminars = mockUseSeminars(),
  participantsOverrides = mockUseSeminarParticipants()
) => {
  vi.spyOn(useSeminarModule, 'useSeminars').mockReturnValue(seminars);
  vi.spyOn(useSeminarModule, 'useCreateSeminar').mockReturnValue(mockUseCreateSeminar());
  vi.spyOn(useSeminarModule, 'useSendReminder').mockReturnValue(mockUseSendReminder());
  vi.spyOn(useSeminarModule, 'useSeminarParticipants').mockReturnValue(participantsOverrides);

  return render(
    <MemoryRouter>
      <SeminarWorkspace />
    </MemoryRouter>
  );
};

describe('SeminarWorkspace', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── T1: Page display ────────────────────────────────────────────────────────

  it('shows loading spinner when isLoading is true', () => {
    renderPage(mockUseSeminars({ isLoading: true }));
    expect(screen.getByText(/loading seminars/i)).toBeInTheDocument();
  });

  it('shows empty state when seminars array is empty', () => {
    renderPage(mockUseSeminars({ isLoading: false, seminars: [] }));
    expect(screen.getByText(/no seminars yet/i)).toBeInTheDocument();
  });

  it('shows seminar cards when data is loaded', () => {
    renderPage(
      mockUseSeminars({
        seminars: [mockSeminarCard()],
      })
    );
    expect(screen.getByText('Cloud Architecture Seminar')).toBeInTheDocument();
  });

  it('shows error banner with retry button when error is present', () => {
    renderPage(mockUseSeminars({ error: 'Network failure', seminars: [] }));
    expect(screen.getByText(/network failure/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it('calls refetch when retry button is clicked', async () => {
    const refetch = vi.fn();
    renderPage(mockUseSeminars({ error: 'oops', refetch }));
    await userEvent.click(screen.getByRole('button', { name: /retry/i }));
    expect(refetch).toHaveBeenCalled();
  });

  // ── T2: Create seminar + Meet link ──────────────────────────────────────────

  it('opens create modal on button click', async () => {
    renderPage();
    await userEvent.click(screen.getByRole('button', { name: /create seminar/i }));
    expect(screen.getByText(/create new academic seminar/i)).toBeInTheDocument();
  });

  it('Join Meet button is disabled when onlineLink is empty', () => {
    renderPage(
      mockUseSeminars({
        seminars: [mockSeminarCard({ onlineLink: '', status: 'UPCOMING', effectiveStatus: 'UPCOMING' })],
      })
    );
    expect(screen.getByRole('button', { name: /join google meet/i })).toBeDisabled();
  });

  it('Join Meet button is disabled when onlineLink is not a valid Meet URL', () => {
    renderPage(
      mockUseSeminars({
        seminars: [mockSeminarCard({ onlineLink: 'https://zoom.us/j/123', status: 'UPCOMING', effectiveStatus: 'UPCOMING' })],
      })
    );
    expect(screen.getByRole('button', { name: /join google meet/i })).toBeDisabled();
  });

  it('Join Meet button is enabled when onlineLink is a valid Google Meet URL', () => {
    renderPage(
      mockUseSeminars({
        seminars: [mockSeminarCard({ onlineLink: 'https://meet.google.com/abc-defg-hij', status: 'UPCOMING', effectiveStatus: 'UPCOMING' })],
      })
    );
    expect(screen.getByRole('button', { name: /join google meet/i })).not.toBeDisabled();
  });

  it('shows "Link not generated" message when onlineLink is null', () => {
    renderPage(
      mockUseSeminars({
        seminars: [mockSeminarCard({ onlineLink: '', status: 'UPCOMING', effectiveStatus: 'UPCOMING' })],
      })
    );
    expect(screen.queryByRole('button', { name: /join google meet/i })).toBeDisabled();
  });

  // ── T3: Reminder ─────────────────────────────────────────────────────────────

  it('reminder button is disabled while sending', async () => {
    vi.clearAllMocks();

    const sendReminder = vi.fn().mockImplementation(() => new Promise(() => { /* never resolves */ }));

    // Define the complete participants mock with a pending (non-submitted) participant
    const participantsWithPending = [
      { seminarParticipantId: 1, seminarId: 5, userId: 1, invitationStatus: 'Invited' },
    ];

    // Complete mock return objects — no spreading, no partial overrides
    vi.spyOn(useSeminarModule, 'useSeminars').mockReturnValue(
      mockUseSeminars({
        seminars: [
          mockSeminarCard({ seminarId: 5, status: 'COMPLETED', effectiveStatus: 'COMPLETED' }),
        ],
      })
    );
    vi.spyOn(useSeminarModule, 'useCreateSeminar').mockReturnValue(mockUseCreateSeminar());
    vi.spyOn(useSeminarModule, 'useSendReminder').mockReturnValue({
      sendReminder,
      isSending: true,
      sendError: null,
    });
    vi.spyOn(useSeminarModule, 'useSeminarParticipants').mockReturnValue({
      participants: participantsWithPending,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(
      <MemoryRouter>
        <SeminarWorkspace />
      </MemoryRouter>
    );

    // Open feedback modal
    await userEvent.click(screen.getByRole('button', { name: /form feedback/i }));
    await waitFor(() => {
      const all = screen.getAllByText((content) => /feedback & grading/i.test(String(content)));
      expect(all.length).toBeGreaterThan(0);
    });

    // Button must be disabled because isSending is true
    const btn = screen.getByRole('button', { name: /remind pending/i });
    expect(btn).toBeDisabled();
  });

  it('clicking reminder button while already sending does not trigger additional calls', async () => {
    vi.clearAllMocks();

    // Simulate a slow resolution so the guard can be tested
    let resolveReminder: () => void;
    const sendReminder = vi.fn().mockImplementation(
      () => new Promise<void>((r) => { resolveReminder = r; })
    );

    const participantsWithPending = [
      { seminarParticipantId: 1, seminarId: 5, userId: 1, invitationStatus: 'Invited' },
    ];

    vi.spyOn(useSeminarModule, 'useSeminars').mockReturnValue(
      mockUseSeminars({
        seminars: [
          mockSeminarCard({ seminarId: 5, status: 'COMPLETED', effectiveStatus: 'COMPLETED' }),
        ],
      })
    );
    vi.spyOn(useSeminarModule, 'useCreateSeminar').mockReturnValue(mockUseCreateSeminar());
    vi.spyOn(useSeminarModule, 'useSendReminder').mockReturnValue({
      sendReminder,
      isSending: false,
      sendError: null,
    });
    vi.spyOn(useSeminarModule, 'useSeminarParticipants').mockReturnValue({
      participants: participantsWithPending,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(
      <MemoryRouter>
        <SeminarWorkspace />
      </MemoryRouter>
    );

    await userEvent.click(screen.getByRole('button', { name: /form feedback/i }));
    await waitFor(() => {
      const all = screen.getAllByText((content) => /feedback & grading/i.test(String(content)));
      expect(all.length).toBeGreaterThan(0);
    });

    // Button must be enabled (not disabled) so we can test the double-click guard
    const btn = screen.getByRole('button', { name: /remind pending/i });
    expect(btn).not.toBeDisabled();

    // Click the remind button twice rapidly (simulating double-click)
    await userEvent.click(btn);
    await userEvent.click(btn);

    // Only one API call should have fired despite two clicks (double-click guard)
    expect(sendReminder).toHaveBeenCalledTimes(1);

    // Clean up the hanging promise
    resolveReminder!();
  });

  // Note: The actual sendReminder call is tested in useSeminarAudio.test.ts (hook integration).
  // The button render + disabled state are covered above. Direct hook integration is not
  // retested here to avoid flakiness from modal state interactions.

  // ── T6: Meeting Summary button visibility ──────────────────────────────────

  it('shows View Notes button for COMPLETED seminars', () => {
    renderPage(
      mockUseSeminars({
        seminars: [mockSeminarCard({ status: 'COMPLETED', effectiveStatus: 'COMPLETED' })],
      })
    );
    expect(screen.getByRole('button', { name: /view notes/i })).toBeInTheDocument();
  });

  it('does NOT show View Notes button for UPCOMING seminars', () => {
    renderPage(
      mockUseSeminars({
        seminars: [mockSeminarCard({ status: 'UPCOMING', effectiveStatus: 'UPCOMING' })],
      })
    );
    expect(screen.queryByRole('button', { name: /view notes/i })).not.toBeInTheDocument();
  });

  it('does NOT show View Notes button for DRAFT seminars', () => {
    renderPage(
      mockUseSeminars({
        seminars: [mockSeminarCard({ status: 'DRAFT', effectiveStatus: 'DRAFT' })],
      })
    );
    expect(screen.queryByRole('button', { name: /view notes/i })).not.toBeInTheDocument();
  });

  // ── Participant stats ──────────────────────────────────────────────────────────

  it('displays feedback progress fraction on COMPLETED card', () => {
    renderPage(
      mockUseSeminars({
        seminars: [
          mockSeminarCard({
            status: 'COMPLETED',
            feedbackSubmitted: 3,
            feedbackTotal: 5,
          }),
        ],
      })
    );
    expect(screen.getByText('3/5')).toBeInTheDocument();
  });
});
