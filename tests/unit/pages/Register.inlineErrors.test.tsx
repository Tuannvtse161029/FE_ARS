/**
 * Vital Register form inline-error coverage for the validation audit.
 *
 * Goal: prove that on submit, invalid input produces accessible inline error
 * messages (FieldError with role="alert"), aria-invalid on the matching
 * input, and aria-describedby wiring. We only test the surfaces we added —
 * we do NOT try to verify backend payloads, payload shape, or PDF uploads.
 */
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { Register } from '../../../src/pages/Register/Register';

// Hoisted mocks (same shape as tests/unit/pages/Register.test.tsx)
const { registerUserSpy, setAuthDataSpy } = vi.hoisted(() => ({
  registerUserSpy: vi.fn(),
  setAuthDataSpy: vi.fn(),
}));

const firebaseUploadMock = vi.hoisted(() => {
  let _pdfUrl: string | null = 'https://firebasestorage.googleapis.com/test.pdf';
  let _isUploading = false;
  return {
    get pdfUrl() {
      return _pdfUrl;
    },
    set pdfUrl(v: string | null) {
      _pdfUrl = v;
    },
    get isUploading() {
      return _isUploading;
    },
    set isUploading(v: boolean) {
      _isUploading = v;
    },
    uploadPdf: vi.fn(),
    progress: 0,
    error: null as string | null,
    resetUpload: vi.fn(() => {
      _pdfUrl = null;
      _isUploading = false;
    }),
  };
});

vi.mock('../../../src/services/auth.service', () => ({
  authService: {
    registerUser: registerUserSpy,
    setAuthData: setAuthDataSpy,
    logout: vi.fn(),
  },
}));

vi.mock('../../../src/store', () => ({
  useAuthStore: () => ({
    login: vi.fn(),
    setLoading: vi.fn(),
  }),
}));

vi.mock('../../../src/context/AuthContext', () => ({
  useAuth: () => ({
    login: vi.fn(),
    loginWithGoogle: vi.fn().mockResolvedValue(undefined),
    isLoading: false,
    error: null,
  }),
}));

vi.mock('../../../src/hooks/useFirebaseUpload', () => ({
  useFirebaseUpload: () => firebaseUploadMock,
}));

// Suppress the success modal — we never want the dialog portal to escape
// the form wrapper during these tests.
vi.mock('../../../src/components/auth/RegistrationSuccessModal', () => ({
  RegistrationSuccessModal: () => null,
}));

const renderRegister = () =>
  render(<Register />, {
    wrapper: ({ children }: { children: React.ReactNode }) => (
      <MemoryRouter>{children}</MemoryRouter>
    ),
  });

describe('Register – accessible inline errors (audit)', () => {
  test('shows an inline Vietnamese-name error with aria-invalid', async () => {
    const user = userEvent.setup();
    renderRegister();

    const nameInput = screen.getByLabelText(/full name/i);
    // Type a name with digits to trigger the policy
    await user.type(nameInput, 'Nguyen123');
    await user.type(screen.getByLabelText(/email address/i), 'test@example.com');
    await user.type(screen.getByLabelText(/phone number/i), '+84 90 123 4567');
    await user.type(screen.getByLabelText(/^password$/i), 'Password123');
    await user.type(screen.getByLabelText(/retype password/i), 'Password123');

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const fakeFile = new File(['(PDF content)'], 'verification.pdf', {
      type: 'application/pdf',
    });
    await user.upload(fileInput, fakeFile);

    await user.click(screen.getByRole('checkbox', { name: /privacy policy|terms/i }));

    const submitBtn = screen.getByRole('button', { name: /create account/i });
    await user.click(submitBtn);

    const fullNameGroup = nameInput.closest('div') as HTMLElement;
    const errorEl = within(fullNameGroup).getByRole('alert');
    expect(errorEl.textContent).toMatch(/letters/i);
    expect(nameInput).toHaveAttribute('aria-invalid', 'true');
    expect(nameInput).toHaveAttribute('aria-describedby', 'fullName-error');
  });

  test('accepts a valid Vietnamese display name', async () => {
    const user = userEvent.setup();
    registerUserSpy.mockResolvedValue({
      token: 'test-jwt-token',
      username: 'Nguyễn Văn A',
      email: 'test@example.com',
      role: 'Researcher',
      isActive: false,
      verificationStatus: 'Pending',
      accountTier: 'Free',
    });
    renderRegister();
    const nameInput = screen.getByLabelText(/full name/i);
    await user.type(nameInput, 'Nguyễn Văn A');
    await user.type(screen.getByLabelText(/email address/i), 'test@example.com');
    await user.type(screen.getByLabelText(/phone number/i), '+84 90 123 4567');
    await user.type(screen.getByLabelText(/^password$/i), 'Password123');
    await user.type(screen.getByLabelText(/retype password/i), 'Password123');

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const fakeFile = new File(['(PDF content)'], 'verification.pdf', {
      type: 'application/pdf',
    });
    await user.upload(fileInput, fakeFile);

    await user.click(screen.getByRole('checkbox', { name: /privacy policy|terms/i }));

    const submitBtn = screen.getByRole('button', { name: /create account/i });
    await user.click(submitBtn);

    expect(nameInput).not.toHaveAttribute('aria-invalid', 'true');
    expect(registerUserSpy).toHaveBeenCalled();
    const call = registerUserSpy.mock.calls[0][0];
    expect(call.fullName).toBe('Nguyễn Văn A');
    expect(call.email).toBe('test@example.com');
  });

  test('maps server field errors to inline messages', async () => {
    const user = userEvent.setup();
    // Simulate the BE returning an errors-by-field payload on the single submit.
    registerUserSpy.mockReset();
    registerUserSpy.mockRejectedValueOnce({
      response: {
        data: {
          errors: {
            email: 'Email is already taken',
          },
        },
      },
    });
    renderRegister();

    await user.type(screen.getByLabelText(/full name/i), 'Nguyễn Văn A');
    const emailInput = screen.getByLabelText(/email address/i);
    await user.type(emailInput, 'test@example.com');
    await user.type(screen.getByLabelText(/phone number/i), '+84 90 123 4567');
    await user.type(screen.getByLabelText(/^password$/i), 'Password123');
    await user.type(screen.getByLabelText(/retype password/i), 'Password123');

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const fakeFile = new File(['(PDF content)'], 'verification.pdf', {
      type: 'application/pdf',
    });
    await user.upload(fileInput, fakeFile);

    await user.click(screen.getByRole('checkbox', { name: /privacy policy|terms/i }));

    const submitBtn = screen.getByRole('button', { name: /create account/i });
    await user.click(submitBtn);

    await new Promise((r) => setTimeout(r, 0));
    expect(emailInput).toHaveAttribute('aria-invalid', 'true');
    const emailGroup = emailInput.closest('div') as HTMLElement;
    expect(within(emailGroup).getByRole('alert').textContent).toBe(
      'Email is already taken',
    );
  });
});