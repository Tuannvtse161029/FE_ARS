import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { RegisterSuccessModal } from '../../../src/pages/Register/components/RegisterSuccessModal';

const renderSuccessModal = (
  isOpen = true,
  overrides?: {
    email?: string;
    role?: string;
    onClose?: () => void;
  }
) => {
  const onClose = overrides?.onClose ?? vi.fn();
  const email = overrides?.email ?? 'test@example.com';
  const role = (overrides?.role as any) ?? 'Researcher';
  return render(
    <MemoryRouter>
      <RegisterSuccessModal
        isOpen={isOpen}
        email={email}
        role={role}
        onClose={onClose}
      />
    </MemoryRouter>
  );
};

describe('RegisterSuccessModal', () => {
  describe('open/close', () => {
    test('does not render when isOpen is false', () => {
      renderSuccessModal(false);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    test('renders dialog when isOpen is true', () => {
      renderSuccessModal();
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    test('renders with correct aria-modal and aria-labelledby', () => {
      renderSuccessModal();
      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-modal', 'true');
      expect(dialog).toHaveAttribute('aria-labelledby', 'register-success-title');
    });

    test('calls onClose when Escape is pressed', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      renderSuccessModal(true, { onClose });
      await user.keyboard('{Escape}');
      expect(onClose).toHaveBeenCalled();
    });

    test('renders only the "Explore Community Forums" CTA button (no other buttons)', () => {
      renderSuccessModal();
      const buttons = screen.getAllByRole('button');
      expect(buttons).toHaveLength(1);
      expect(buttons[0]).toHaveTextContent(/explore community forums/i);
    });
  });

  describe('content', () => {
    test('displays success title', () => {
      renderSuccessModal();
      expect(
        screen.getByText(/registration submitted successfully/i)
      ).toBeInTheDocument();
    });

    test('displays the submitted email', () => {
      renderSuccessModal(true, { email: 'user@university.edu' });
      expect(screen.getByText(/user@university.edu/i)).toBeInTheDocument();
    });

    test('displays the role in the message', () => {
      renderSuccessModal(true, { role: 'Reviewer' });
      expect(screen.getByText(/reviewer/i)).toBeInTheDocument();
    });

    test('renders the "Explore Community Forums" CTA button', () => {
      renderSuccessModal();
      expect(
        screen.getByRole('button', { name: /explore community forums/i })
      ).toBeInTheDocument();
    });

    test('renders green checkmark indicator', () => {
      renderSuccessModal();
      const wrapper = document.querySelector('[class*="checkmarkWrapper"]');
      expect(wrapper).toBeInTheDocument();
    });
  });
});
