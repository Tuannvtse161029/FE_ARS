/**
 * Tests for the registration consent gate (Privacy Policy / Terms of Service).
 *
 * The consent checkbox is required and must be unchecked by default. Submit
 * stays disabled until the user has read and accepted. The BE RegisterRequest
 * payload must NOT include any new/dynamic field — the existing pdfUrl field
 * carries the verification document and consent is enforced FE-only (no
 * Swagger endpoint exists for storing consent at registration).
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

const firebaseUploadMock = vi.hoisted(() => {
  let _pdfUrl: string | null = null;
  let _isUploading = false;
  return {
    get pdfUrl() { return _pdfUrl; },
    set pdfUrl(v: string | null) { _pdfUrl = v; },
    get isUploading() { return _isUploading; },
    set isUploading(v: boolean) { _isUploading = false || _isUploading; _isUploading = v; },
    uploadPdf: vi.fn().mockImplementation(async () => {
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

vi.mock('../../../src/store', () => ({
  useAuthStore: () => ({
    login: loginSpy,
    setLoading: setLoadingSpy,
  }),
}));

vi.mock('../../../src/hooks/useFirebaseUpload', () => ({
  useFirebaseUpload: () => firebaseUploadMock,
}));

vi.mock('../../../src/context/AuthContext', () => ({
  useAuth: () => ({
    user: null,
    isAuthenticated: false,
    isLoading: false,
    error: null,
    login: undefined,
    loginWithGoogle: undefined,
    logout: undefined,
    handleSessionFailure: undefined,
    clearError: undefined,
    pendingRoleSelection: null,
    confirmRoleSelection: undefined,
    cancelRoleSelection: undefined,
    effectiveRole: null,
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));

const renderRegister = () =>
  render(<Register />, {
    wrapper: ({ children }: { children: React.ReactNode }) => (
      <MemoryRouter>{children}</MemoryRouter>
    ),
  });

// ─────────────────────────────────────────────────────────────────────────────
// CONSENT RENDERING
// ─────────────────────────────────────────────────────────────────────────────

describe('Register Page – consent rendering', () => {
  beforeEach(() => {
    firebaseUploadMock.pdfUrl = null;
    firebaseUploadMock.isUploading = false;
    registerUserSpy.mockReset();
    setAuthDataSpy.mockReset();
    loginSpy.mockReset();
  });

  test('renders the consent checkbox as unchecked by default', () => {
    renderRegister();
    const checkbox = screen.getByRole('checkbox', { name: /privacy policy|terms/i }) as HTMLInputElement;
    expect(checkbox).toBeInTheDocument();
    expect(checkbox.checked).toBe(false);
  });

  test('renders Privacy Policy and Terms of Service links', () => {
    renderRegister();
    const privacyLink = screen.getByRole('link', { name: /privacy policy/i });
    const termsLink = screen.getByRole('link', { name: /terms of service/i });
    expect(privacyLink).toBeInTheDocument();
    expect(privacyLink).toHaveAttribute('href', '/privacy-policy');
    expect(privacyLink).toHaveAttribute('target', '_blank');
    expect(privacyLink).toHaveAttribute('rel', expect.stringMatching(/noopener/));
    expect(termsLink).toBeInTheDocument();
    expect(termsLink).toHaveAttribute('href', '/terms-of-service');
    expect(termsLink).toHaveAttribute('target', '_blank');
    expect(termsLink).toHaveAttribute('rel', expect.stringMatching(/noopener/));
  });

  test('consent checkbox can be toggled', async () => {
    const user = userEvent.setup();
    renderRegister();
    const checkbox = screen.getByRole('checkbox', { name: /privacy policy|terms/i }) as HTMLInputElement;

    expect(checkbox.checked).toBe(false);
    await user.click(checkbox);
    expect(checkbox.checked).toBe(true);
    await user.click(checkbox);
    expect(checkbox.checked).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// CONSENT SUBMIT DISABLED STATE
// ─────────────────────────────────────────────────────────────────────────────

describe('Register Page – submit disabled until consent', () => {
  beforeEach(() => {
    firebaseUploadMock.pdfUrl = null;
    firebaseUploadMock.isUploading = false;
    registerUserSpy.mockReset();
  });

  async function fillRequiredFieldsExceptConsent(user: ReturnType<typeof userEvent.setup>) {
    await user.type(screen.getByLabelText(/full name/i), 'Dr. Nguyen Van A');
    await user.type(screen.getByLabelText(/email address/i), 'test@example.com');
    await user.type(screen.getByLabelText(/phone number/i), '+84 90 123 4567');
    await user.type(screen.getByLabelText(/^password$/i), 'Password123');
    await user.type(screen.getByLabelText(/retype password/i), 'Password123');
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const fakeFile = new File(['(PDF content)'], 'verification.pdf', {
      type: 'application/pdf',
    });
    await user.upload(fileInput, fakeFile);
  }

  test('submit stays disabled when consent is unchecked even with all fields valid', async () => {
    const user = userEvent.setup();
    renderRegister();

    await fillRequiredFieldsExceptConsent(user);

    const submitBtn = screen.getByRole('button', { name: /create account/i });
    expect(submitBtn).toBeDisabled();
  });

  test('submit becomes enabled after consent is checked', async () => {
    const user = userEvent.setup();
    renderRegister();

    await fillRequiredFieldsExceptConsent(user);

    const checkbox = screen.getByRole('checkbox', { name: /privacy policy|terms/i });
    await user.click(checkbox);

    const submitBtn = screen.getByRole('button', { name: /create account/i });
    expect(submitBtn).toBeEnabled();
  });

  test('submit returns to disabled after un-checking consent', async () => {
    const user = userEvent.setup();
    renderRegister();

    await fillRequiredFieldsExceptConsent(user);

    const checkbox = screen.getByRole('checkbox', { name: /privacy policy|terms/i });
    await user.click(checkbox);
    const submitBtn = screen.getByRole('button', { name: /create account/i });
    expect(submitBtn).toBeEnabled();

    await user.click(checkbox);
    expect(submitBtn).toBeDisabled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// CONSENT DOES NOT ADD UNDOCUMENTED PAYLOAD FIELDS
// ─────────────────────────────────────────────────────────────────────────────

describe('Register Page – payload contract (no undocumented fields)', () => {
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
    firebaseUploadMock.pdfUrl = null;
    firebaseUploadMock.isUploading = false;
  });

  test('submitting with consent checked calls registerUser with only documented Swagger fields', async () => {
    const user = userEvent.setup();
    renderRegister();

    await user.type(screen.getByLabelText(/full name/i), 'Dr. Nguyen Van A');
    await user.type(screen.getByLabelText(/email address/i), 'test@example.com');
    await user.type(screen.getByLabelText(/phone number/i), '+84 90 123 4567');
    await user.type(screen.getByLabelText(/^password$/i), 'Password123');
    await user.type(screen.getByLabelText(/retype password/i), 'Password123');

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const fakeFile = new File(['(PDF content)'], 'verification.pdf', { type: 'application/pdf' });
    await user.upload(fileInput, fakeFile);

    await user.click(screen.getByRole('checkbox', { name: /privacy policy|terms/i }));

    const submitBtn = screen.getByRole('button', { name: /create account/i });
    await user.click(submitBtn);

    expect(registerUserSpy).toHaveBeenCalledTimes(1);
    const [payload] = registerUserSpy.mock.calls[0];
    // Payload must contain only fields that exist in Swagger RegisterRequest.
    const documentedFields = [
      'email',
      'password',
      'fullName',
      'phoneNumber',
      'role',
      'pdfUrl',
      // Plus harmless "internal" fields below — but the BE only reads the documented ones.
      'username',
      'isActive',
    ];
    const payloadKeys = Object.keys(payload);
    const unexpected = payloadKeys.filter((k) => !documentedFields.includes(k));
    expect(unexpected).toEqual([]);
    // Consent is FE-only — must NOT be sent to BE.
    expect(payload).not.toHaveProperty('consentAccepted');
    expect(payload).not.toHaveProperty('consent');
    expect(payload).not.toHaveProperty('acceptedPrivacyPolicy');
    expect(payload).not.toHaveProperty('acceptedTermsOfService');
  });
});
