/**
 * Unit tests for Academic Scholarly Identifier (OpenAlex & Semantic Scholar) on Register Page
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, test, expect, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { I18nProvider } from '../../../src/i18n/I18nContext';
import { Register } from '../../../src/pages/Register/Register';

const { registerUserSpy, setAuthDataSpy } = vi.hoisted(() => {
  return {
    registerUserSpy: vi.fn(),
    setAuthDataSpy: vi.fn(),
  };
});

const firebaseUploadMock = vi.hoisted(() => {
  let _pdfUrl: string | null = 'https://firebasestorage.googleapis.com/test-verification.pdf';
  let _isUploading = false;
  return {
    get pdfUrl() { return _pdfUrl; },
    set pdfUrl(v: string | null) { _pdfUrl = v; },
    get isUploading() { return _isUploading; },
    set isUploading(v: boolean) { _isUploading = v; },
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
    user: null,
    pendingRoleSelection: null,
    confirmRoleSelection: vi.fn(),
    cancelRoleSelection: vi.fn(),
  }),
}));

vi.mock('../../../src/components/auth/GoogleSignInButton', () => ({
  GoogleSignInButton: () => null,
}));

vi.mock('../../../src/services/googleAuth.service', () => ({
  googleAuthService: {
    postGoogleLogin: vi.fn(),
    extractCredential: vi.fn(),
  },
  GoogleLoginError: class GoogleLoginError extends Error {},
}));

vi.mock('../../../src/hooks/useFirebaseUpload', () => ({
  useFirebaseUpload: () => firebaseUploadMock,
}));

vi.mock('../../../src/services/role.service', () => ({
  roleService: {
    fetchBusinessRolesForOnboarding: vi.fn().mockResolvedValue([
      'Researcher',
      'Reviewer',
      'Lecturer',
      'Graduate Student',
    ]),
  },
}));

const renderRegister = () =>
  render(<Register />, {
    wrapper: ({ children }: { children: React.ReactNode }) => (
      <I18nProvider>
        <MemoryRouter>{children}</MemoryRouter>
      </I18nProvider>
    ),
  });

const waitForDictionary = async () => {
  await waitFor(() => {
    expect(
      document.querySelector('[aria-label="register.dropzone.uploadLabel"]'),
    ).not.toBeInTheDocument();
  }, { timeout: 3000 });
};

describe('Register Page – Academic Scholarly Identifier', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    firebaseUploadMock.pdfUrl = 'https://firebasestorage.googleapis.com/test-verification.pdf';
    registerUserSpy.mockResolvedValue({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      user: {
        id: 'user-1',
        email: 'test@example.com',
        fullName: 'Dr. Nguyen Van A',
        role: 'Researcher',
      },
    });
  });

  test('renders academic identifier section by default for Researcher role', async () => {
    renderRegister();
    await waitForDictionary();

    expect(screen.getByTestId('register-academic-identifier-section')).toBeInTheDocument();
    expect(screen.getByTestId('register-radio-openalex')).toBeChecked();
    expect(screen.getByTestId('register-radio-semanticscholar')).not.toBeChecked();
    expect(screen.getByTestId('register-input-openalex')).toBeInTheDocument();
    expect(screen.queryByTestId('register-input-semanticscholar')).not.toBeInTheDocument();
  });

  test('switches to Semantic Scholar ID input when radio is clicked', async () => {
    const user = userEvent.setup();
    renderRegister();
    await waitForDictionary();

    const semanticScholarRadio = screen.getByTestId('register-radio-semanticscholar');
    await user.click(semanticScholarRadio);

    expect(semanticScholarRadio).toBeChecked();
    expect(screen.getByTestId('register-radio-openalex')).not.toBeChecked();
    expect(screen.getByTestId('register-input-semanticscholar')).toBeInTheDocument();
    expect(screen.queryByTestId('register-input-openalex')).not.toBeInTheDocument();
  });

  test('hides academic identifier section when role is changed to Graduate Student', async () => {
    const user = userEvent.setup();
    renderRegister();
    await waitForDictionary();

    expect(screen.getByTestId('register-academic-identifier-section')).toBeInTheDocument();

    const roleSelect = screen.getByLabelText(/select your platform role/i);
    await user.selectOptions(roleSelect, 'Graduate Student');

    expect(screen.queryByTestId('register-academic-identifier-section')).not.toBeInTheDocument();

    // Switch to Lecturer -> should reappear
    await user.selectOptions(roleSelect, 'Lecturer');
    expect(screen.getByTestId('register-academic-identifier-section')).toBeInTheDocument();
  });

  test('shows validation error when identifier input is left empty on blur', async () => {
    const user = userEvent.setup();
    renderRegister();
    await waitForDictionary();

    const openAlexInput = screen.getByTestId('register-input-openalex');
    await user.click(openAlexInput);
    await user.tab(); // Blur without typing

    await waitFor(() => {
      expect(screen.getByTestId('openalex-error')).toBeInTheDocument();
    });
  });

  test('submits with openAlexId and semanticScholarId: null when OpenAlex is selected', async () => {
    const user = userEvent.setup();
    renderRegister();
    await waitForDictionary();

    await user.type(screen.getByLabelText(/full name/i), 'Nguyen Van A');
    await user.type(screen.getByLabelText(/^email$/i), 'nguyenvana@example.com');
    await user.type(screen.getByLabelText(/phone number/i), '0912345678');
    await user.type(screen.getByLabelText(/^password$/i), 'Password123');
    await user.type(screen.getByLabelText(/retype password/i), 'Password123');

    // PDF upload
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const fakeFile = new File(['(PDF content)'], 'verification.pdf', {
      type: 'application/pdf',
    });
    await user.upload(fileInput, fakeFile);

    // Consent
    const consent = screen.getByRole('checkbox');
    await user.click(consent);

    // OpenAlex ID
    const openAlexInput = screen.getByTestId('register-input-openalex');
    await user.type(openAlexInput, 'https://openalex.org/A5023888391');

    const submitBtn = screen.getByRole('button', { name: /create account/i });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(registerUserSpy).toHaveBeenCalledTimes(1);
    });

    const payload = registerUserSpy.mock.calls[0][0];
    expect(payload.openAlexId).toBe('https://openalex.org/A5023888391');
    expect(payload.semanticScholarId).toBeNull();
  });

  test('submits with semanticScholarId and openAlexId: null when Semantic Scholar is selected', async () => {
    const user = userEvent.setup();
    renderRegister();
    await waitForDictionary();

    await user.type(screen.getByLabelText(/full name/i), 'Nguyen Van B');
    await user.type(screen.getByLabelText(/^email$/i), 'nguyenvanb@example.com');
    await user.type(screen.getByLabelText(/phone number/i), '0912345679');
    await user.type(screen.getByLabelText(/^password$/i), 'Password123');
    await user.type(screen.getByLabelText(/retype password/i), 'Password123');

    // PDF upload
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const fakeFile = new File(['(PDF content)'], 'verification.pdf', {
      type: 'application/pdf',
    });
    await user.upload(fileInput, fakeFile);

    // Consent
    const consent = screen.getByRole('checkbox');
    await user.click(consent);

    // Switch to Semantic Scholar
    await user.click(screen.getByTestId('register-radio-semanticscholar'));
    const semanticInput = screen.getByTestId('register-input-semanticscholar');
    await user.type(semanticInput, '1741101');

    const submitBtn = screen.getByRole('button', { name: /create account/i });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(registerUserSpy).toHaveBeenCalledTimes(1);
    });

    const payload = registerUserSpy.mock.calls[0][0];
    expect(payload.openAlexId).toBeNull();
    expect(payload.semanticScholarId).toBe('1741101');
  });

  test('submits with both openAlexId: null and semanticScholarId: null for Graduate Student', async () => {
    const user = userEvent.setup();
    renderRegister();
    await waitForDictionary();

    await user.type(screen.getByLabelText(/full name/i), 'Le Thi C');
    await user.type(screen.getByLabelText(/^email$/i), 'lethic@example.com');
    await user.type(screen.getByLabelText(/phone number/i), '0912345680');
    await user.type(screen.getByLabelText(/^password$/i), 'Password123');
    await user.type(screen.getByLabelText(/retype password/i), 'Password123');

    const roleSelect = screen.getByLabelText(/select your platform role/i);
    await user.selectOptions(roleSelect, 'Graduate Student');

    // PDF upload
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const fakeFile = new File(['(PDF content)'], 'verification.pdf', {
      type: 'application/pdf',
    });
    await user.upload(fileInput, fakeFile);

    // Consent
    const consent = screen.getByRole('checkbox');
    await user.click(consent);

    const submitBtn = screen.getByRole('button', { name: /create account/i });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(registerUserSpy).toHaveBeenCalledTimes(1);
    });

    const payload = registerUserSpy.mock.calls[0][0];
    expect(payload.openAlexId).toBeNull();
    expect(payload.semanticScholarId).toBeNull();
  });
});
