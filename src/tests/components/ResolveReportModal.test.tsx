/**
 * Tests for the ResolveReportModal (Admin) component.
 *
 * Covers:
 *   1. Returns null when isOpen is false
 *   2. Renders meta + 3 resolution actions when open with a report
 *   3. Selecting a different action updates the highlighted radio
 *   4. Submitting calls onConfirm with the selected action + trimmed note
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect } from 'vitest';
import React from 'react';
import { ResolveReportModal } from '../../components/admin/ResolveReportModal';
import type { ViolationReport } from '../../types/adminAuxiliary';

const fixtureReport: ViolationReport = {
  reportId: 5001,
  type: 'FORUM_COMMENT',
  targetAuthorId: 14,
  targetAuthorName: 'Pham Minh Duc',
  targetContentId: 9981,
  reportedContent: 'This paper is a complete waste of time.',
  reason: 'Personal attack',
  reportedById: 12,
  reportedByName: 'Tran Thi Bich',
  date: new Date().toISOString(),
  status: 'PENDING',
};

const renderModal = (
  overrides: Partial<React.ComponentProps<typeof ResolveReportModal>> = {},
) => {
  const onConfirm = vi.fn().mockResolvedValue(undefined);
  const onClose = vi.fn();
  const utils = render(
    <ResolveReportModal
      report={fixtureReport}
      isOpen
      isSubmitting={false}
      errorMessage={null}
      onClose={onClose}
      onConfirm={onConfirm}
      {...overrides}
    />,
  );
  return { onConfirm, onClose, ...utils };
};

describe('ResolveReportModal', () => {
  it('renders nothing when isOpen is false', () => {
    render(
      <ResolveReportModal
        report={fixtureReport}
        isOpen={false}
        isSubmitting={false}
        errorMessage={null}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('shows report metadata and all 3 resolution actions when open', () => {
    renderModal();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/Pham Minh Duc/)).toBeInTheDocument();
    expect(screen.getByText(/Personal attack/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Dismiss Report/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Delete Content & Send Warning/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Delete Content & Suspend User \(14 days\)/i })).toBeInTheDocument();
  });

  it('selecting a different resolution updates the highlighted action', async () => {
    const user = userEvent.setup();
    renderModal();
    const dismiss = screen.getByRole('button', { name: /Dismiss Report/i });
    const suspend = screen.getByRole('button', { name: /Delete Content & Suspend User \(14 days\)/i });
    expect(dismiss.getAttribute('aria-pressed') ?? '').not.toBe('true');
    expect(suspend.getAttribute('aria-pressed') ?? '').not.toBe('true');
    await user.click(suspend);
    expect(suspend.className).toMatch(/actionSelected/);
  });

  it('submitting passes the chosen action and trimmed note to onConfirm', async () => {
    const user = userEvent.setup();
    const { onConfirm } = renderModal();
    await user.click(
      screen.getByRole('button', { name: /Delete Content & Suspend User \(14 days\)/i }),
    );
    const note = screen.getByLabelText(/Verification notes/i);
    await user.type(note, '  Repeated abuse  ');
    await user.click(screen.getByRole('button', { name: /Confirm Resolution/i }));
    expect(onConfirm).toHaveBeenCalledWith(
      5001,
      'DELETE_CONTENT_SUSPEND_14D',
      'Repeated abuse',
    );
  });
});