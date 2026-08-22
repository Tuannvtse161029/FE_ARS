/**
 * Tests for Agent 52 — CompleteGoogleRegistration onboarding page.
 *
 * Critical contracts (post follow-up correction):
 *   - The page does NOT POST an onboarding payload. Swagger has no
 *     documented onboarding endpoint, so the page surfaces a
 *     "Backend Unavailable" notice and disables the Submit button.
 *   - The page does NOT call PUT /api/User/{id} as a proof/role
 *     submission. The previous iteration's User API update was
 *     withdrawn because `pdfUrl` is not a documented Swagger field on
 *     `UserUpdateRequest`.
 *   - The page does NOT fabricate a `roleName` (e.g. 'Researcher') or
 *     `roleId` 0 for the user record. The role selector is a UI
 *     placeholder — the payload is never sent.
 *   - The page does NOT store the JWT in a Google-only session key.
 *     The profile is read from the existing ARS auth store / storage.
 *   - The page does NOT route to /forum on submit. The Submit button
 *     is disabled and the page surfaces a BTR-AGENT52-02 reference.
 *   - The page does NOT call /api/Auth/register. google-login already
 *     created the user.
 *   - When the user is unauthenticated, the page bounces to /login.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

const updateMock = vi.fn();
const fetchMock = vi.fn();
const fetchBusinessRolesMock = vi.fn().mockResolvedValue([
  'Researcher',
  'Reviewer',
  'Lecturer',
  'Graduate Student',
]);

vi.mock('../../../src/services/user.service', () => ({
  userService: { update: (...args: unknown[]) => updateMock(...args) },
}));

vi.mock('../../../src/services/auth.service', () => ({
  authService: { logout: vi.fn(), setAuthData: vi.fn() },
}));

vi.mock('../../../src/services/role.service', () => ({
  roleService: { fetchBusinessRolesForOnboarding: (...args: unknown[]) => fetchBusinessRolesMock(...args) },
  ALLOWED_ONBOARDING_ROLES: ['Researcher', 'Reviewer', 'Lecturer', 'Graduate Student'],
}));

vi.mock('../../store', () => ({
  useAuthStore: () => ({
    login: vi.fn(),
    updateUser: vi.fn(),
    logout: vi.fn(),
  }),
}));

const authValue: {
  isAuthenticated: boolean;
  user: typeof authValue.user;
} = {
  isAuthenticated: true,
  user: {
    id: 7,
    username: 'user@example.com',
    email: 'user@example.com',
    fullName: 'Google User',
    roleId: 0,
    roleName: '',
    isActive: false,
    verificationStatus: 'Pending',
  },
};

const storageGetTokenMock = vi.fn(() => 'pre-seed-token');
const storageGetUserMock = vi.fn(() => ({
  id: 7,
  username: 'user@example.com',
  email: 'user@example.com',
  fullName: 'Google User',
  roleId: 0,
  roleName: '',
  isActive: false,
  verificationStatus: 'Pending',
}));

vi.mock('../../../src/context/AuthContext', () => ({
  useAuth: () => authValue,
}));

vi.mock('../../../src/utils/storage', () => ({
  storage: {
    setToken: vi.fn(),
    setUser: vi.fn(),
    getToken: (...args: unknown[]) => (storageGetTokenMock as unknown as (...a: unknown[]) => string | null)(...args),
    getUser: (...args: unknown[]) => (storageGetUserMock as unknown as (...a: unknown[]) => unknown)(...args),
    setRememberMe: vi.fn(),
  },
}));

vi.mock('../../../src/components/Button', () => ({
  Button: ({
    children,
    onClick,
    type,
    disabled,
    isLoading,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    type?: 'button' | 'submit';
    disabled?: boolean;
    isLoading?: boolean;
  }) => (
    <button type={type ?? 'button'} onClick={onClick} disabled={disabled || isLoading} data-testid="btn">
      {children}
    </button>
  ),
}));

vi.mock('../../../src/components/Input', () => ({
  Input: ({
    id,
    name,
    value,
    onChange,
    disabled,
  }: {
    id?: string;
    name?: string;
    value?: string;
    onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
    disabled?: boolean;
  }) => (
    <input
      id={id}
      name={name}
      value={value ?? ''}
      onChange={onChange}
      disabled={disabled}
      data-testid={`input-${name}`}
    />
  ),
}));

vi.mock('../../../src/pages/Register/components/PdfDropzone', () => ({
  PdfDropzone: ({
    onUploadComplete,
    onUploadStateChange,
  }: {
    onUploadComplete: (file: File, url: string) => void;
    onUploadStateChange?: (uploading: boolean) => void;
  }) => (
    <button
      type="button"
      data-testid="upload"
      onClick={() => {
        onUploadStateChange?.(true);
        onUploadComplete(
          new File(['pdf'], 'proof.pdf', { type: 'application/pdf' }),
          'https://firebase.storage/ars/proof.pdf',
        );
        onUploadStateChange?.(false);
      }}
    >
      upload
    </button>
  ),
}));

import { CompleteGoogleRegistration } from '../../../src/pages/CompleteGoogleRegistration/CompleteGoogleRegistration';

beforeEach(() => {
  sessionStorage.clear();
  updateMock.mockReset();
  fetchMock.mockReset();
  fetchBusinessRolesMock.mockClear();
  storageGetTokenMock.mockReset();
  storageGetTokenMock.mockReturnValue('pre-seed-token');
  storageGetUserMock.mockReset();
  storageGetUserMock.mockReturnValue({
    id: 7,
    username: 'user@example.com',
    email: 'user@example.com',
    fullName: 'Google User',
    roleId: 0,
    roleName: '',
    isActive: false,
    verificationStatus: 'Pending',
  });
  global.fetch = fetchMock as unknown as typeof fetch;
  fetchMock.mockResolvedValue({ ok: true });
});

function mountWithAuth() {
  return render(
    <MemoryRouter initialEntries={['/complete-google-registration']}>
      <Routes>
        <Route path="/complete-google-registration" element={<CompleteGoogleRegistration />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('CompleteGoogleRegistration — safe-mode behaviour', () => {
  it('does NOT POST anything to the backend on submit (no safe endpoint exists)', async () => {
    mountWithAuth();

    // Wait for the role list to load.
    await waitFor(() => {
      const roleSelect = document.querySelector('select#role') as HTMLSelectElement | null;
      expect(roleSelect).not.toBeNull();
      expect(roleSelect?.options.length).toBeGreaterThan(1);
    });

    // Upload a proof.
    fireEvent.click(screen.getByTestId('upload'));

    // Try to submit.
    const submit = screen.getByRole('button', { name: /Submit for verification/i });
    expect(submit).toBeDisabled();

    // No POST should have happened, no PUT should have happened.
    expect(fetchMock).not.toHaveBeenCalled();
    expect(updateMock).not.toHaveBeenCalled();
  });

  it('renders the Backend Unavailable notice with the BTR reference', async () => {
    mountWithAuth();

    await waitFor(() => {
      expect(screen.getByText(/Backend onboarding endpoint unavailable/i)).toBeInTheDocument();
    });

    // The BTR reference must be visible so the BE team can find it.
    expect(screen.getByText(/BTR-AGENT52-02/i)).toBeInTheDocument();
  });

  it('does NOT write a fake roleName or roleId to the user record', async () => {
    mountWithAuth();

    await waitFor(() => {
      expect(fetchBusinessRolesMock).toHaveBeenCalled();
    });

    // The role field exists but submitting is disabled — no PUT happens.
    const submit = screen.getByRole('button', { name: /Submit for verification/i });
    expect(submit).toBeDisabled();
    expect(updateMock).not.toHaveBeenCalled();
  });

  it('does NOT call /api/Auth/register', async () => {
    mountWithAuth();

    await waitFor(() => {
      expect(fetchBusinessRolesMock).toHaveBeenCalled();
    });

    // The page does not render a register CTA and does not POST.
    expect(screen.queryByText(/register/i)).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(updateMock).not.toHaveBeenCalled();
  });

  it('does NOT duplicate the app token into a Google-only session key', async () => {
    mountWithAuth();

    await waitFor(() => {
      expect(fetchBusinessRolesMock).toHaveBeenCalled();
    });

    // The page never reads or writes `ars_google_onboarding_session`.
    expect(sessionStorage.getItem('ars_google_onboarding_session')).toBeNull();
    expect(localStorage.getItem('ars_google_onboarding_session')).toBeNull();
  });

  it('does NOT route to /forum on submit', async () => {
    mountWithAuth();

    await waitFor(() => {
      expect(fetchBusinessRolesMock).toHaveBeenCalled();
    });

    // Submit is disabled — clicking it cannot navigate.
    const submit = screen.getByRole('button', { name: /Submit for verification/i });
    expect(submit).toBeDisabled();
    expect(screen.queryByTestId('forum-marker')).toBeNull();
  });

  it('still allows the user to capture their proof via the existing Firebase flow', async () => {
    mountWithAuth();

    await waitFor(() => {
      expect(fetchBusinessRolesMock).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByTestId('upload'));

    await waitFor(() => {
      expect(screen.getByText(/Uploaded to Firebase Storage/i)).toBeInTheDocument();
    });
  });
});

describe('CompleteGoogleRegistration — session handoff', () => {
  it('redirects to /login when the user is no longer authenticated', async () => {
    authValue.isAuthenticated = false;
    authValue.user = null;

    render(
      <MemoryRouter initialEntries={['/complete-google-registration']}>
        <Routes>
          <Route path="/complete-google-registration" element={<CompleteGoogleRegistration />} />
          <Route path="/login" element={<div data-testid="login">login</div>} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.queryByTestId('login')).toBeInTheDocument();
    });

    // Restore so other tests see the auth state.
    authValue.isAuthenticated = true;
    authValue.user = {
      id: 7,
      username: 'user@example.com',
      email: 'user@example.com',
      fullName: 'Google User',
      roleId: 0,
      roleName: '',
      isActive: false,
      verificationStatus: 'Pending',
    };
  });

  it('redirects to /login when the token is missing — refuse to treat a token-less session as a valid first-time onboarding subject', async () => {
    // The Login page's strict validation already prevents this state from
    // occurring in production, but the onboarding page must defend itself
    // from a partially-hydrated session (e.g. storage migration). We must
    // NOT use roleId 0 / empty roleName as valid backend data.
    storageGetTokenMock.mockReturnValueOnce(null);

    render(
      <MemoryRouter initialEntries={['/complete-google-registration']}>
        <Routes>
          <Route path="/complete-google-registration" element={<CompleteGoogleRegistration />} />
          <Route path="/login" element={<div data-testid="login">login</div>} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.queryByTestId('login')).toBeInTheDocument();
    });
  });

  it('redirects to /login when the persisted user record lacks a fullName', async () => {
    storageGetUserMock.mockReturnValueOnce({
      id: 7,
      username: 'user@example.com',
      email: 'user@example.com',
      // fullName intentionally omitted
      roleId: null,
      roleName: null,
      isActive: false,
      verificationStatus: 'Pending',
    });

    render(
      <MemoryRouter initialEntries={['/complete-google-registration']}>
        <Routes>
          <Route path="/complete-google-registration" element={<CompleteGoogleRegistration />} />
          <Route path="/login" element={<div data-testid="login">login</div>} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.queryByTestId('login')).toBeInTheDocument();
    });
  });

  it('redirects to /login when the persisted user record lacks a positive userId', async () => {
    storageGetUserMock.mockReturnValueOnce({
      id: 0,
      username: 'user@example.com',
      email: 'user@example.com',
      fullName: 'Google User',
      roleId: null,
      roleName: null,
      isActive: false,
      verificationStatus: 'Pending',
    });

    render(
      <MemoryRouter initialEntries={['/complete-google-registration']}>
        <Routes>
          <Route path="/complete-google-registration" element={<CompleteGoogleRegistration />} />
          <Route path="/login" element={<div data-testid="login">login</div>} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.queryByTestId('login')).toBeInTheDocument();
    });
  });
});
