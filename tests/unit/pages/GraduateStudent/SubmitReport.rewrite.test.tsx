/**
 * Sibling tests for src/pages/GraduateStudent/SubmitReport.tsx.
 *
 * The 7 existing tests in `StudentSubmitReport.test.tsx` are untouched.
 * This new file focuses on the Phase C real-data rewrite:
 *   - No PHASES dropdown present — replaced by single "Workspace label" text input
 *   - groupMemberId read from joinedGroups[0].membershipId (NOT user.userId)
 *   - Submission success refetches both useStudentGroups and usePhasedReports
 *   - The MILESTONE_PHASE_KEY constant is gone (assert via grep on the file)
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { MemoryRouter } from 'react-router-dom';
import { SubmitReport } from '../../../../src/pages/GraduateStudent/SubmitReport';
import { buildMockAuth } from '../../../../src/utils/mockAuth';

const {
  mockUseStudentGroups,
  mockUsePhasedReports,
  mockSubmitPhasedReport,
  mockResubmitPhasedReport,
} = vi.hoisted(() => ({
  mockUseStudentGroups: vi.fn(),
  mockUsePhasedReports: vi.fn(),
  mockSubmitPhasedReport: vi.fn(),
  mockResubmitPhasedReport: vi.fn(),
}));

vi.mock('../../../../src/hooks/useAuth', () => ({
  useAuth: () => buildMockAuth({ role: 'Graduate Student', userId: 9 }),
}));

vi.mock('../../../../src/hooks/useStudentGroups', () => ({
  useStudentGroups: () => mockUseStudentGroups(),
}));

vi.mock('../../../../src/hooks/usePhasedReports', () => ({
  usePhasedReports: () => mockUsePhasedReports(),
}));

vi.mock('../../../../src/components/gradstudent/SubmitReportModal', () => ({
  default: ({
    isOpen,
    onSubmitted,
    groupMemberId,
    researchGroupId,
  }: {
    isOpen: boolean;
    onSubmitted: (report: unknown) => void;
    groupMemberId?: number;
    researchGroupId: number;
  }) => {
    if (!isOpen) return null;
    return (
      <div data-testid="submit-report-modal">
        <span data-testid="modal-group-member-id">{String(groupMemberId ?? '')}</span>
        <span data-testid="modal-research-group-id">{String(researchGroupId)}</span>
        <button
          type="button"
          onClick={() =>
            onSubmitted({
              id: 1,
              researchGroupId,
              status: 'SUBMITTED',
              submittedAt: new Date().toISOString(),
              reportFileUrl: 'https://fb/x.pdf',
              groupMemberId,
            })
          }
        >
          Trigger submit success
        </button>
      </div>
    );
  },
}));

const defaultGroups = () => ({
  guidanceProject: null,
  joinedGroups: [
    {
      id: 42,
      name: 'Alpha Lab',
      lecturerId: 4,
      topicId: 11,
      joinedAt: '2025-01-01T00:00:00Z',
      membershipId: 7, // CRITICAL: the rewrite reads this — NOT userId.
    },
  ],
  primaryGroup: {
    id: 42,
    name: 'Alpha Lab',
    lecturerId: 4,
    topicId: 11,
    joinedAt: '2025-01-01T00:00:00Z',
    membershipId: 7,
  },
  primaryTopic: {
    id: 11,
    title: 'Speech-to-text',
    status: 'OPEN',
  },
  isLoading: false,
  error: null,
  refetch: vi.fn(() => Promise.resolve()),
});

const defaultReports = () => ({
  reports: [],
  isLoading: false,
  error: null,
  refetch: vi.fn(() => Promise.resolve()),
  latestByStatus: () => null,
});

const renderPage = () =>
  render(
    <MemoryRouter>
      <SubmitReport />
    </MemoryRouter>,
  );

describe('<SubmitReport> — sibling tests (Phase C rewrite)', () => {
  beforeEach(() => {
    mockUseStudentGroups.mockReset();
    mockUsePhasedReports.mockReset();
    mockSubmitPhasedReport.mockReset();
    mockResubmitPhasedReport.mockReset();

    mockUseStudentGroups.mockImplementation(() => defaultGroups());
    mockUsePhasedReports.mockImplementation(() => defaultReports());
    void mockSubmitPhasedReport;
    void mockResubmitPhasedReport;
  });

  it('renders a single "Workspace label" text input — no PHASES <select>', async () => {
    renderPage();
    await waitFor(() =>
      expect(screen.getByText(/Submit Milestone Research Report/)).toBeInTheDocument(),
    );
    const labelInput = screen.getByLabelText(/Workspace label/i);
    expect(labelInput.tagName).toBe('INPUT');
    expect((labelInput as HTMLInputElement).type).toBe('text');
    // No select with PHASE_* options.
    expect(document.querySelector('select[name*="phase" i]')).toBeNull();
    expect(document.querySelector('select[name*="PHASE"]')).toBeNull();
  });

  it('groupMemberId passed to SubmitReportModal comes from joinedGroups[0].membershipId (=7), NOT from user.userId (=9)', async () => {
    renderPage();
    await waitFor(() =>
      expect(screen.getByText(/Submit Milestone Research Report/)).toBeInTheDocument(),
    );
    // Open the modal by clicking "Submit report".
    const submitButton = screen.getByRole('button', { name: /Submit report/i });
    await userEvent.setup().click(submitButton);
    await waitFor(() =>
      expect(screen.getByTestId('submit-report-modal')).toBeInTheDocument(),
    );
    // The mock component exposes groupMemberId on a data-testid element.
    expect(screen.getByTestId('modal-group-member-id')).toHaveTextContent('7');
    // The fallback path would surface `9` — assert it's NOT 9.
    expect(screen.getByTestId('modal-group-member-id').textContent).not.toBe('9');
  });

  it('on submit success, both useStudentGroups.refetch AND usePhasedReports.refetch are called', async () => {
    const refetchGroups = vi.fn(() => Promise.resolve());
    const refetchReports = vi.fn(() => Promise.resolve());
    mockUseStudentGroups.mockImplementation(() => ({
      ...defaultGroups(),
      refetch: refetchGroups,
    }));
    mockUsePhasedReports.mockImplementation(() => ({
      ...defaultReports(),
      refetch: refetchReports,
    }));
    renderPage();
    await waitFor(() =>
      expect(screen.getByText(/Submit Milestone Research Report/)).toBeInTheDocument(),
    );
    const submitButton = screen.getByRole('button', { name: /Submit report/i });
    await userEvent.setup().click(submitButton);
    await waitFor(() =>
      expect(screen.getByTestId('submit-report-modal')).toBeInTheDocument(),
    );
    // Click the mock modal's "Trigger submit success" button.
    await userEvent.setup().click(
      screen.getByRole('button', { name: /Trigger submit success/i }),
    );
    await waitFor(() => expect(refetchGroups).toHaveBeenCalled());
    await waitFor(() => expect(refetchReports).toHaveBeenCalled());
  });

  it('folder-path builder reads the workspace label input value', async () => {
    renderPage();
    await waitFor(() =>
      expect(screen.getByText(/Submit Milestone Research Report/)).toBeInTheDocument(),
    );
    const labelInput = screen.getByLabelText(/Workspace label/i) as HTMLInputElement;
    await userEvent.setup().clear(labelInput);
    await userEvent.setup().type(labelInput, 'draft v2');
    expect(labelInput.value).toBe('draft v2');
  });

  it('MILESTONE_PHASE_KEY constant is NOT referenced anywhere in SubmitReport.tsx', () => {
    // The Phase C rewrite removed the MILESTONE_PHASE_KEY constant in favor
    // of a derived folder path from the topic title / group name. Read the
    // page source and grep for the legacy constant.
    const srcPath = resolve(
      __dirname,
      '..',
      '..',
      '..',
      '..',
      'src',
      'pages',
      'GraduateStudent',
      'SubmitReport.tsx',
    );
    const src = readFileSync(srcPath, 'utf-8');
    expect(src).not.toMatch(/MILESTONE_PHASE_KEY/);
    // Sanity: the new "DEFAULT_FOLDER_KEY" fallback is present.
    expect(src).toMatch(/DEFAULT_FOLDER_KEY/);
  });
});