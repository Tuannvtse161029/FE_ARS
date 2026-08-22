/**
 * ReportModal component tests.
 *
 * Coverage:
 *   1. Modal renders with correct target preview.
 *   2. Submit button is disabled when reason is empty.
 *   3. Submit button enables when reason >= 10 chars.
 *   4. On submit with valid data, reportService.createReport is called with
 *      correct targetType and targetId.
 *   5. On successful submit, modal closes.
 *   6. On API error, error message is displayed.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReportModal } from '../../../src/components/forum/ReportModal';
import { reportService } from '../../../src/services/report.service';

vi.mock('../../../src/services/report.service', () => ({
  reportService: {
    createReport: vi.fn(),
  },
}));

const mockedCreateReport = reportService.createReport as unknown as ReturnType<typeof vi.fn>;

const defaultProps = {
  isOpen: true,
  onClose: vi.fn(),
  targetType: 'ForumPost' as const,
  targetPreview: 'A Modular Backend Network Protocol for High-Throughput Storage',
  targetId: 10,
  reporterId: 7,
};

describe('ReportModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders with correct target preview for ForumPost', () => {
    render(<ReportModal {...defaultProps} targetType="ForumPost" targetPreview="Test post title" />);

    expect(screen.getByRole('heading', { name: /report forum post/i })).toBeInTheDocument();
    expect(screen.getByText('Test post title')).toBeInTheDocument();
  });

  it('renders with correct target preview for ForumComment', () => {
    render(
      <ReportModal
        {...defaultProps}
        targetType="ForumComment"
        targetPreview="This is a comment about the paper..."
      />
    );

    expect(screen.getByRole('heading', { name: /report comment/i })).toBeInTheDocument();
    expect(screen.getByText('This is a comment about the paper...')).toBeInTheDocument();
  });

  it('submit button is disabled when reason is empty', () => {
    render(<ReportModal {...defaultProps} />);

    const submitBtn = screen.getByRole('button', { name: /submit report/i });
    expect(submitBtn).toBeDisabled();
  });

  it('submit button is disabled when reason is less than 10 characters', () => {
    render(<ReportModal {...defaultProps} />);

    const textarea = screen.getByPlaceholderText(/describe why/i);
    fireEvent.change(textarea, { target: { value: 'Too short' } });

    const submitBtn = screen.getByRole('button', { name: /submit report/i });
    expect(submitBtn).toBeDisabled();
  });

  it('submit button enables when reason has at least 10 characters', async () => {
    render(<ReportModal {...defaultProps} />);

    const textarea = screen.getByPlaceholderText(/describe why/i);
    await userEvent.type(textarea, 'This is a valid reason for reporting');

    const submitBtn = screen.getByRole('button', { name: /submit report/i });
    expect(submitBtn).not.toBeDisabled();
  });

  it('calls reportService.createReport with correct payload on submit', async () => {
    mockedCreateReport.mockResolvedValueOnce({
      id: 1,
      reporterId: 7,
      targetType: 'ForumPost',
      targetId: 10,
      reason: 'Inappropriate content in the post',
      status: 'Pending',
      createdAt: '2026-08-19T00:00:00Z',
    });

    render(<ReportModal {...defaultProps} />);

    const textarea = screen.getByPlaceholderText(/describe why/i);
    await userEvent.type(textarea, 'Inappropriate content in the post');

    const submitBtn = screen.getByRole('button', { name: /submit report/i });
    await userEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockedCreateReport).toHaveBeenCalledTimes(1);
      expect(mockedCreateReport).toHaveBeenCalledWith({
        reporterId: 7,
        targetType: 'ForumPost',
        targetId: 10,
        reason: 'Inappropriate content in the post',
        violationNotes: undefined,
      });
    });
  });

  it('calls reportService.createReport with violationNotes when provided', async () => {
    mockedCreateReport.mockResolvedValueOnce({
      id: 1,
      reporterId: 7,
      targetType: 'ForumComment',
      targetId: 55,
      reason: 'Harassment and bullying behavior',
      status: 'Pending',
      violationNotes: 'Multiple targeted attacks on the same user',
      createdAt: '2026-08-19T00:00:00Z',
    });

    render(
      <ReportModal
        {...defaultProps}
        targetType="ForumComment"
        targetId={55}
        targetPreview="Get lost"
      />
    );

    const reasonTextarea = screen.getByPlaceholderText(/describe why/i);
    await userEvent.type(reasonTextarea, 'Harassment and bullying behavior');

    const notesTextarea = screen.getByPlaceholderText(/additional context/i);
    await userEvent.type(notesTextarea, 'Multiple targeted attacks on the same user');

    const submitBtn = screen.getByRole('button', { name: /submit report/i });
    await userEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockedCreateReport).toHaveBeenCalledWith({
        reporterId: 7,
        targetType: 'ForumComment',
        targetId: 55,
        reason: 'Harassment and bullying behavior',
        violationNotes: 'Multiple targeted attacks on the same user',
      });
    });
  });

  it('closes modal on successful submit', async () => {
    mockedCreateReport.mockResolvedValueOnce({
      id: 1,
      reporterId: 7,
      targetType: 'ForumPost',
      targetId: 10,
      reason: 'Valid reason here',
      status: 'Pending',
      createdAt: '2026-08-19T00:00:00Z',
    });

    const onClose = vi.fn();
    render(<ReportModal {...defaultProps} onClose={onClose} />);

    const textarea = screen.getByPlaceholderText(/describe why/i);
    await userEvent.type(textarea, 'Valid reason here');

    const submitBtn = screen.getByRole('button', { name: /submit report/i });
    await userEvent.click(submitBtn);

    await waitFor(() => {
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  it('shows loading state while submitting', async () => {
    mockedCreateReport.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve({ id: 1 }), 500))
    );

    render(<ReportModal {...defaultProps} />);

    const textarea = screen.getByPlaceholderText(/describe why/i);
    await userEvent.type(textarea, 'Valid reason here');

    const submitBtn = screen.getByRole('button', { name: /submit report/i });
    await userEvent.click(submitBtn);

    expect(screen.getByText(/submitting/i)).toBeInTheDocument();
    expect(submitBtn).toBeDisabled();
  });

  it('displays API error message on submission failure', async () => {
    mockedCreateReport.mockRejectedValueOnce(new Error('Unable to process report at this time'));

    render(<ReportModal {...defaultProps} />);

    const textarea = screen.getByPlaceholderText(/describe why/i);
    await userEvent.type(textarea, 'This is a valid report reason text');

    const submitBtn = screen.getByRole('button', { name: /submit report/i });
    await userEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });

  it('cancels submission when Cancel is clicked', async () => {
    mockedCreateReport.mockRejectedValueOnce(new Error('Should not be called'));

    render(<ReportModal {...defaultProps} />);

    const textarea = screen.getByPlaceholderText(/describe why/i);
    await userEvent.type(textarea, 'Some reason');

    const cancelBtn = screen.getByRole('button', { name: /^cancel$/i });
    await userEvent.click(cancelBtn);

    expect(mockedCreateReport).not.toHaveBeenCalled();
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('shows validation error when submitting with too-short reason', () => {
    render(<ReportModal {...defaultProps} />);

    const textarea = screen.getByPlaceholderText(/describe why/i);
    fireEvent.change(textarea, { target: { value: 'Short' } });

    // Button is disabled — use fireEvent so the click still fires
    const submitBtn = screen.getByRole('button', { name: /submit report/i });
    fireEvent.click(submitBtn);

    expect(screen.getByText(/10 characters/i)).toBeInTheDocument();
    expect(mockedCreateReport).not.toHaveBeenCalled();
  });

  it('closes when close button is clicked', () => {
    render(<ReportModal {...defaultProps} />);

    const closeBtn = screen.getByRole('button', { name: /close modal/i });
    fireEvent.click(closeBtn);

    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });

  it('trims whitespace from reason before sending', async () => {
    mockedCreateReport.mockResolvedValueOnce({
      id: 1,
      reporterId: 7,
      targetType: 'ForumPost',
      targetId: 10,
      reason: 'Valid reason here',
      status: 'Pending',
      createdAt: '2026-08-19T00:00:00Z',
    });

    render(<ReportModal {...defaultProps} />);

    const textarea = screen.getByPlaceholderText(/describe why/i);
    await userEvent.type(textarea, '   Valid reason here   ');

    const submitBtn = screen.getByRole('button', { name: /submit report/i });
    await userEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockedCreateReport).toHaveBeenCalledWith({
        reporterId: 7,
        targetType: 'ForumPost',
        targetId: 10,
        reason: 'Valid reason here',
        violationNotes: undefined,
      });
    });
  });

  it('resets form state when modal reopens', () => {
    const { rerender } = render(<ReportModal {...defaultProps} />);

    const textarea = screen.getByPlaceholderText(/describe why/i);
    fireEvent.change(textarea, { target: { value: 'Test reason text' } });
    expect(textarea).toHaveValue('Test reason text');

    // Simulate close
    rerender(<ReportModal {...defaultProps} isOpen={false} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    // Simulate reopen
    rerender(<ReportModal {...defaultProps} isOpen={true} />);
    const reopenedTextarea = screen.getByPlaceholderText(/describe why/i);
    expect(reopenedTextarea).toHaveValue('');
  });
});
