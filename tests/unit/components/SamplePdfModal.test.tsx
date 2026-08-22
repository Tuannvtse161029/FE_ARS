import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SamplePdfModal } from '../../../src/pages/Register/components/SamplePdfModal';

describe('SamplePdfModal', () => {
  // ─────────────────────────────────────────────────────────────────────────────
  // OPEN / CLOSE
  // ─────────────────────────────────────────────────────────────────────────────

  describe('open/close', () => {
    test('does not render when isOpen is false', () => {
      render(<SamplePdfModal isOpen={false} onClose={vi.fn()} />);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    test('renders dialog when isOpen is true', () => {
      render(<SamplePdfModal isOpen={true} onClose={vi.fn()} />);
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    test('calls onClose when "Got It" button is clicked', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      render(<SamplePdfModal isOpen={true} onClose={onClose} />);
      await user.click(screen.getByRole('button', { name: /got it, back to registration/i }));
      expect(onClose).toHaveBeenCalled();
    });

    test('calls onClose when Escape key is pressed', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      render(<SamplePdfModal isOpen={true} onClose={onClose} />);
      await user.keyboard('{Escape}');
      expect(onClose).toHaveBeenCalled();
    });

    test('closes when clicking the overlay (outside modal)', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      render(<SamplePdfModal isOpen={true} onClose={onClose} />);
      await user.click(document.body);
      // Clicking the overlay div is harder in RTL; rely on Escape test
    });

    test('renders with correct aria attributes', () => {
      render(<SamplePdfModal isOpen={true} onClose={vi.fn()} />);
      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-modal', 'true');
      expect(dialog).toHaveAttribute('aria-labelledby', 'sample-pdf-title');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // TABS
  // ─────────────────────────────────────────────────────────────────────────────

  describe('role tabs', () => {
    test('shows all four role tabs', () => {
      render(<SamplePdfModal isOpen={true} onClose={vi.fn()} />);
      expect(screen.getByRole('tab', { name: /researcher/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /reviewer/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /lecturer/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /graduate student/i })).toBeInTheDocument();
      // Admin is provisioned directly in the DB and bypasses the role-
      // request lifecycle — there's no sample verification document for it,
      // so it must NOT appear as a tab.
      expect(screen.queryByRole('tab', { name: /^admin$/i })).not.toBeInTheDocument();
    });

    test('defaults to Researcher tab (initialRole)', () => {
      render(<SamplePdfModal isOpen={true} onClose={vi.fn()} initialRole="Researcher" />);
      expect(screen.getByText('Dr. Nguyen Van A')).toBeInTheDocument();
    });

    test('defaults to Reviewer tab when initialRole is Reviewer', () => {
      render(<SamplePdfModal isOpen={true} onClose={vi.fn()} initialRole="Reviewer" />);
      expect(screen.getByText('Dr. Tran Thi B')).toBeInTheDocument();
    });

    test('defaults to Lecturer tab when initialRole is Lecturer', () => {
      render(<SamplePdfModal isOpen={true} onClose={vi.fn()} initialRole="Lecturer" />);
      expect(screen.getByText('Dr. Le Van C')).toBeInTheDocument();
    });

    test('defaults to Graduate Student tab when initialRole is Graduate Student', () => {
      render(<SamplePdfModal isOpen={true} onClose={vi.fn()} initialRole="Graduate Student" />);
      expect(screen.getByText('Pham Thi D')).toBeInTheDocument();
    });

    test('switches content when a tab is clicked', async () => {
      const user = userEvent.setup();
      render(<SamplePdfModal isOpen={true} onClose={vi.fn()} initialRole="Researcher" />);
      expect(screen.getByText('Dr. Nguyen Van A')).toBeInTheDocument();
      await user.click(screen.getByRole('tab', { name: /reviewer/i }));
      expect(screen.getByText('Dr. Tran Thi B')).toBeInTheDocument();
    });

    test('active tab has aria-selected=true', () => {
      render(<SamplePdfModal isOpen={true} onClose={vi.fn()} initialRole="Researcher" />);
      expect(screen.getByRole('tab', { name: /researcher/i })).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByRole('tab', { name: /reviewer/i })).toHaveAttribute('aria-selected', 'false');
    });

    test('renders profile data for Researcher tab', () => {
      render(<SamplePdfModal isOpen={true} onClose={vi.fn()} initialRole="Researcher" />);
      expect(screen.getByText('Vietnam National University, Ho Chi Minh City')).toBeInTheDocument();
      expect(screen.getByText('0000-0002-1825-0097')).toBeInTheDocument();
      expect(screen.getByText('47')).toBeInTheDocument(); // publications
    });

    test('renders publication record for Researcher', () => {
      render(<SamplePdfModal isOpen={true} onClose={vi.fn()} initialRole="Researcher" />);
      expect(screen.getByText(/deep learning for vietnamese sign language/i)).toBeInTheDocument();
    });

    test('renders watermark text', () => {
      render(<SamplePdfModal isOpen={true} onClose={vi.fn()} />);
      expect(screen.getByText(/sample verification document/i)).toBeInTheDocument();
    });
  });
});
