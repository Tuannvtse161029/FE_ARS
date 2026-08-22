/**
 * Tests for src/pages/Register/Register.tsx
 *
 * All network calls (authService, Firebase Storage) are mocked so tests run
 * in isolation without a backend.
 *
 * For the pdfUrl integration test, vi.hoisted() is used to share spy references
 * with the hoisted vi.mock factory without running into the temporal dead zone.
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { Register } from '../../../src/pages/Register/Register';

// ── Module-level mocks via vi.hoisted() ────────────────────────────────────────

const { registerUserSpy, setAuthDataSpy } = vi.hoisted(() => {
  return {
    registerUserSpy: vi.fn(),
    setAuthDataSpy: vi.fn(),
  };
});

const { loginSpy, setLoadingSpy } = vi.hoisted(() => {
  return {
    loginSpy: vi.fn(),
    setLoadingSpy: vi.fn(),
  };
});

// Shared mock state object. PdfDropzone reads progress/isUploading/pdfUrl from the
// hook. uploadPdf synchronously sets pdfUrl on the shared object BEFORE resolving,
// so PdfDropzone's useEffect sees the non-null pdfUrl in the same tick as the
// React state update that fires on await resolution.
const firebaseUploadMock = vi.hoisted(() => {
  let _pdfUrl: string | null = null;
  let _isUploading = false;
  return {
    get pdfUrl() { return _pdfUrl; },
    set pdfUrl(v: string | null) { _pdfUrl = v; },
    get isUploading() { return _isUploading; },
    set isUploading(v: boolean) { _isUploading = v; },
    uploadPdf: vi.fn().mockImplementation(async () => {
      // Set pdfUrl BEFORE the await so PdfDropzone's useEffect fires with the new
      // value when React processes the state update after the promise resolves.
      _pdfUrl = 'https://firebasestorage.googleapis.com/test-verification.pdf';
      _isUploading = false;
      await Promise.resolve();
    }),
    progress: 0,
    error: null as string | null,
    resetUpload: vi.fn().mockImplementation(() => {
      _pdfUrl = null;
      _isUploading = false;
    }),
  };
});

vi.mock('../../../src/services/auth.service', () => ({
  authService: {
    registerUser: registerUserSpy,
    setAuthData: setAuthDataSpy,
  },
}));

vi.mock('../../store', () => ({
  useAuthStore: () => ({
    login: loginSpy,
    setLoading: setLoadingSpy,
  }),
}));

vi.mock('../../../src/hooks/useFirebaseUpload', () => ({
  useFirebaseUpload: () => firebaseUploadMock,
}));

const renderRegister = () =>
  render(<Register />, {
    wrapper: ({ children }: { children: React.ReactNode }) => (
      <MemoryRouter>{children}</MemoryRouter>
    ),
  });

// ─────────────────────────────────────────────────────────────────────────────
// SMOKE TESTS
// ─────────────────────────────────────────────────────────────────────────────

describe('Register Page – smoke', () => {
  test('renders all form fields', () => {
    renderRegister();
    expect(screen.getByLabelText(/full name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/phone number/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/retype password/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/select your platform role/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/orcid iD/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument();
  });

  test('renders ARS branding and title', () => {
    renderRegister();
    expect(screen.getByText('Academic Research System')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /create your account/i })).toBeInTheDocument();
  });

  test('renders PDF upload dropzone', () => {
    renderRegister();
    expect(screen.getByText(/drag & drop verification document/i)).toBeInTheDocument();
    expect(screen.getByText(/pdf only, max 10mb/i)).toBeInTheDocument();
  });

  test('renders role banner with sample PDF button', () => {
    renderRegister();
    expect(screen.getByText(/researcher verification required/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /view sample pdf format/i })).toBeInTheDocument();
  });

  test('renders "Already have an account" link', () => {
    renderRegister();
    expect(screen.getByText(/already have an account/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /sign in instead/i })).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BUTTON DISABLED STATE
// ─────────────────────────────────────────────────────────────────────────────

describe('Register Page – submit button state', () => {
  test('submit is disabled when form is empty', () => {
    renderRegister();
    expect(screen.getByRole('button', { name: /create account/i })).toBeDisabled();
  });

  test('submit is disabled when password fields are empty', () => {
    renderRegister();
    expect(screen.getByRole('button', { name: /create account/i })).toBeDisabled();
  });

  test('submit is disabled when passwords do not match', async () => {
    const user = userEvent.setup();
    renderRegister();
    await user.type(screen.getByLabelText(/full name/i), 'Dr. Nguyen Van A');
    await user.type(screen.getByLabelText(/email address/i), 'test@example.com');
    await user.type(screen.getByLabelText(/phone number/i), '+84 90 123 4567');
    await user.type(screen.getByLabelText(/^password$/i), 'Password123');
    await user.type(screen.getByLabelText(/retype password/i), 'Different123');
    expect(screen.getByRole('button', { name: /create account/i })).toBeDisabled();
  });

  test('submit is disabled when email is invalid', async () => {
    const user = userEvent.setup();
    renderRegister();
    await user.type(screen.getByLabelText(/full name/i), 'Dr. Nguyen Van A');
    await user.type(screen.getByLabelText(/email address/i), 'not-valid-email');
    await user.type(screen.getByLabelText(/phone number/i), '+84 90 123 4567');
    await user.type(screen.getByLabelText(/^password$/i), 'Password123');
    await user.type(screen.getByLabelText(/retype password/i), 'Password123');
    expect(screen.getByRole('button', { name: /create account/i })).toBeDisabled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BUTTON ENABLED STATE
// ─────────────────────────────────────────────────────────────────────────────

describe('Register Page – submit button enabled when form is complete', () => {
  test('button is disabled without PDF (even with all fields valid)', async () => {
    const user = userEvent.setup();
    renderRegister();
    await user.type(screen.getByLabelText(/full name/i), 'Dr. Nguyen Van A');
    await user.type(screen.getByLabelText(/email address/i), 'test@example.com');
    await user.type(screen.getByLabelText(/phone number/i), '+84 90 123 4567');
    await user.type(screen.getByLabelText(/^password$/i), 'Password123');
    await user.type(screen.getByLabelText(/retype password/i), 'Password123');
    // PDF missing → button still disabled
    expect(screen.getByRole('button', { name: /create account/i })).toBeDisabled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ROLE SELECT
// ─────────────────────────────────────────────────────────────────────────────

describe('Register Page – role select', () => {
  test('defaults to Researcher', () => {
    renderRegister();
    expect(screen.getByLabelText(/select your platform role/i)).toHaveValue('Researcher');
  });

  test('role banner text updates when role changes', async () => {
    const user = userEvent.setup();
    renderRegister();
    await user.selectOptions(screen.getByLabelText(/select your platform role/i), 'Reviewer');
    expect(screen.getByText(/reviewer verification required/i)).toBeInTheDocument();
  });

  test('all four role options are available', () => {
    renderRegister();
    const select = screen.getByLabelText(/select your platform role/i);
    const options = Array.from(select.querySelectorAll('option')).map(o => o.value);
    expect(options).toEqual(['Researcher', 'Reviewer', 'Lecturer', 'Graduate Student']);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SAMPLE PDF MODAL
// ─────────────────────────────────────────────────────────────────────────────

describe('Register Page – sample PDF modal', () => {
  test('modal opens when "View Sample PDF Format" is clicked', async () => {
    const user = userEvent.setup();
    renderRegister();
    await user.click(screen.getByRole('button', { name: /view sample pdf format/i }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/sample pdf verification document/i)).toBeInTheDocument();
  });

  test('modal closes when "Got It" button is clicked', async () => {
    const user = userEvent.setup();
    renderRegister();
    await user.click(screen.getByRole('button', { name: /view sample pdf format/i }));
    await user.click(screen.getByRole('button', { name: /got it, back to registration/i }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  test('modal shows all four role tabs', async () => {
    const user = userEvent.setup();
    renderRegister();
    await user.click(screen.getByRole('button', { name: /view sample pdf format/i }));
    expect(screen.getByRole('tab', { name: /researcher/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /reviewer/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /lecturer/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /graduate student/i })).toBeInTheDocument();
  });

  test('clicking a role tab updates the displayed profile', async () => {
    const user = userEvent.setup();
    renderRegister();
    await user.click(screen.getByRole('button', { name: /view sample pdf format/i }));
    await user.click(screen.getByRole('tab', { name: /reviewer/i }));
    expect(screen.getByText('Dr. Tran Thi B')).toBeInTheDocument();
  });

  test('modal closes on Escape key', async () => {
    const user = userEvent.setup();
    renderRegister();
    await user.click(screen.getByRole('button', { name: /view sample pdf format/i }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// LINK NAVIGATION
// ─────────────────────────────────────────────────────────────────────────────

describe('Register Page – link navigation', () => {
  test('navigates to login via link', () => {
    renderRegister();
    const link = screen.getByRole('link', { name: /sign in instead/i });
    expect(link).toHaveAttribute('href', '/login');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PDF URL IN REGISTRATION PAYLOAD (R6)
// ─────────────────────────────────────────────────────────────────────────────

describe('Register Page – pdfUrl included in registration payload', () => {
  beforeEach(() => {
    registerUserSpy.mockReset();
    registerUserSpy.mockResolvedValue({
      token: 'test-jwt-token',
      username: 'Test User',
      email: 'test@example.com',
      role: 'Researcher',
      isActive: false,
      verificationStatus: 'Pending',
      accountTier: 'Free',
    });
  });

  test('authService.registerUser is called with pdfUrl when form is submitted', async () => {
    const user = userEvent.setup();

    renderRegister();

    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Fill in all required fields
    await user.type(screen.getByLabelText(/full name/i), 'Dr. Nguyen Van A');
    await user.type(screen.getByLabelText(/email address/i), 'test@example.com');
    await user.type(screen.getByLabelText(/phone number/i), '+84 90 123 4567');
    await user.type(screen.getByLabelText(/^password$/i), 'Password123');
    await user.type(screen.getByLabelText(/retype password/i), 'Password123');

    // Trigger the file input. The mock's uploadPdf sets pdfUrl synchronously before
    // resolving, so PdfDropzone's useEffect fires onUploadComplete immediately after
    // the await completes — enabling the submit button.
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const fakeFile = new File(['(PDF content)'], 'verification.pdf', {
      type: 'application/pdf',
    });
    await user.upload(fileInput, fakeFile);

    // Submit
    const submitBtn = screen.getByRole('button', { name: /create account/i });
    await user.click(submitBtn);

    // Assert authService.registerUser was called with pdfUrl in the payload
    expect(registerUserSpy).toHaveBeenCalledTimes(1);
    const [payload] = registerUserSpy.mock.calls[0];
    expect(payload).toHaveProperty('pdfUrl');
    expect(typeof payload.pdfUrl).toBe('string');
    expect(payload.pdfUrl).toBe('https://firebasestorage.googleapis.com/test-verification.pdf');

    consoleErrorSpy.mockRestore();
  });

  test('submit button stays disabled while PDF is uploading', async () => {
    const user = userEvent.setup();

    // Simulate upload in progress — pdfUrl not yet available, isUploading = true
    firebaseUploadMock.isUploading = true;
    firebaseUploadMock.pdfUrl = null;

    renderRegister();

    // Fill all required fields
    await user.type(screen.getByLabelText(/full name/i), 'Dr. Nguyen Van A');
    await user.type(screen.getByLabelText(/email address/i), 'test@example.com');
    await user.type(screen.getByLabelText(/phone number/i), '+84 90 123 4567');
    await user.type(screen.getByLabelText(/^password$/i), 'Password123');
    await user.type(screen.getByLabelText(/retype password/i), 'Password123');

    // Button must stay disabled because isUploadingPdf === true (upload still running)
    const submitBtn = screen.getByRole('button', { name: /create account/i });
    expect(submitBtn).toBeDisabled();

    // Reset to default state
    firebaseUploadMock.isUploading = false;
  });
});
