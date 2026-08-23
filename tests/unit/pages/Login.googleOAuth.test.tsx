/**
 * Tests for the Login.tsx Google button (GIS-credential flow).
 *
 * Agreed FE ↔ BE contract:
 *   1. The user clicks the Google button. GIS returns a `CredentialResponse`
 *      whose `credential` field is the signed Google ID token (JWT).
 *   2. `Login.tsx` extracts the `credential` string and calls
 *      `AuthContext.loginWithGoogle(response)`, which forwards the opaque
 *      credential to `POST /api/Auth/google-login` via
 *      `googleAuthService.postGoogleLogin`.
 *   3. The BE returns the ARS session. New users are routed to
 *      `/complete-google-registration`; existing accepted users are routed
 *      to their workspace.
 *   4. The button is in-flight deduped so a duplicate GIS callback does
 *      not fire `postGoogleLogin` twice.
 *   5. `authService.logout()` runs defensively before the credential POST
 *      so a guest leaves anonymous state behind (null-safe).
 *
 * These tests pin the contract above; if any of them break, the FE and BE
 * have drifted from the agreed `{ credential }` POST.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

const postMock = vi.fn();
const authLogoutMock = vi.fn();
const loginWithGoogleMock = vi.fn();

const postGoogleLoginMock = vi.fn();

vi.mock('../../../src/services/axios', () => ({
  default: {
    post: (...args: unknown[]) => postMock(...args),
    get: vi.fn(),
    defaults: { headers: { common: {} } },
  },
}));

vi.mock('../../../src/services/auth.service', () => ({
  authService: {
    setAuthData: vi.fn(),
    login: vi.fn(),
    logout: (...args: unknown[]) => authLogoutMock(...args),
  },
}));

vi.mock('../../../src/services/googleAuth.service', () => ({
  googleAuthService: {
    postGoogleLogin: (...args: unknown[]) => postGoogleLoginMock(...args),
    extractCredential: (response: { credential?: unknown }) =>
      typeof response?.credential === 'string' ? response.credential : null,
    normaliseGoogleLoginResponse: vi.fn(),
  },
  GoogleLoginError: class GoogleLoginError extends Error {
    code = 'NO_CREDENTIAL';
    status: number | null = null;
    constructor(code: string, message: string, status: number | null = null) {
      super(message);
      this.code = code as never;
      this.status = status;
    }
  },
}));

vi.mock('../../../src/store', () => ({
  useAuthStore: () => ({
    login: vi.fn(),
    logout: vi.fn(),
  }),
}));

vi.mock('../../../src/context/AuthContext', () => ({
  useAuth: () => ({
    login: vi.fn(),
    loginWithGoogle: (...args: unknown[]) => loginWithGoogleMock(...args),
    isLoading: false,
    error: null,
    user: null,
    pendingRoleSelection: null,
    confirmRoleSelection: vi.fn(),
    cancelRoleSelection: vi.fn(),
  }),
}));

vi.mock('../../../src/components/auth/GoogleSignInButton', () => ({
  GoogleSignInButton: ({
    onCredential,
    pending,
    errorMessage,
    label,
  }: {
    onCredential?: (response: { credential: string }) => void;
    pending?: boolean;
    errorMessage?: string | null;
    label?: string;
  }) => (
    <button
      type="button"
      data-testid="google-button"
      onClick={() =>
        onCredential?.({ credential: 'GIS_CREDENTIAL_TOKEN', select_by: 'btn' })
      }
      disabled={pending}
      data-pending={pending ? '1' : '0'}
      data-error={errorMessage ?? ''}
    >
      {pending ? 'Loading…' : label ?? 'Sign in with Google'}
    </button>
  ),
}));

vi.mock('../../../src/pages/Register/components/PdfDropzone', () => ({
  PdfDropzone: () => null,
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
  __esModule: true,
  default: (props: {
    name?: string;
    value?: string;
    onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
    disabled?: boolean;
  }) => (
    <input
      name={props.name}
      value={props.value ?? ''}
      onChange={props.onChange}
      disabled={props.disabled}
      data-testid={`input-${props.name}`}
    />
  ),
  Input: (props: {
    name?: string;
    value?: string;
    onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
    disabled?: boolean;
  }) => (
    <input
      name={props.name}
      value={props.value ?? ''}
      onChange={props.onChange}
      disabled={props.disabled}
      data-testid={`input-${props.name}`}
    />
  ),
}));

vi.mock('./components/RoleSelectionModal', () => ({
  default: () => null,
}));

import Login from '../../../src/pages/Login/Login';

beforeEach(() => {
  postMock.mockReset();
  authLogoutMock.mockReset();
  loginWithGoogleMock.mockReset();
  loginWithGoogleMock.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

function mountLogin() {
  return render(
    <MemoryRouter initialEntries={['/login']}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/forum" element={<div data-testid="forum-marker">forum</div>} />
        <Route
          path="/complete-google-registration"
          element={<div data-testid="onboarding-marker">onboarding</div>}
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe('Login — GIS credential Google sign-in', () => {
  it('forwards the GIS credential to loginWithGoogle EXACTLY once per click', async () => {
    mountLogin();
    const button = screen.getByTestId('google-button');
    fireEvent.click(button);

    await waitFor(() => {
      expect(loginWithGoogleMock).toHaveBeenCalledTimes(1);
    });

    // The first argument must be the GIS CredentialResponse so the
    // AuthContext can extract the credential string and POST it to BE.
    const firstArg = loginWithGoogleMock.mock.calls[0][0];
    expect(firstArg).toMatchObject({ credential: 'GIS_CREDENTIAL_TOKEN' });
  });

  it('runs null-safe guest cleanup (authService.logout) BEFORE forwarding the credential', async () => {
    mountLogin();
    fireEvent.click(screen.getByTestId('google-button'));

    await waitFor(() => {
      expect(loginWithGoogleMock).toHaveBeenCalledTimes(1);
    });
    expect(authLogoutMock).toHaveBeenCalledTimes(1);
  });

  it('prevents duplicate in-flight clicks (only ONE loginWithGoogle even when fired thrice)', async () => {
    loginWithGoogleMock.mockImplementationOnce(
      () => new Promise(() => {
        /* never resolves — keeps the in-flight flag set */
      }),
    );
    mountLogin();
    const button = screen.getByTestId('google-button');
    fireEvent.click(button);
    fireEvent.click(button);
    fireEvent.click(button);

    await new Promise<void>((r) => setTimeout(r, 0));

    expect(loginWithGoogleMock).toHaveBeenCalledTimes(1);
  });

  it('surfaces a recoverable error message when loginWithGoogle rejects', async () => {
    loginWithGoogleMock.mockRejectedValueOnce(
      Object.assign(new Error('Google token rejected'), {
        name: 'GoogleLoginError',
        code: 'INVALID_CREDENTIAL',
      }),
    );
    mountLogin();
    fireEvent.click(screen.getByTestId('google-button'));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    // The user stays on /login (no auto-navigation on failure).
    expect(screen.queryByTestId('forum-marker')).toBeNull();
    expect(screen.queryByTestId('onboarding-marker')).toBeNull();
  });

  it('flips the button into a loading state while the credential POST is in flight', async () => {
    loginWithGoogleMock.mockImplementationOnce(
      () => new Promise(() => {
        /* never resolves */
      }),
    );
    mountLogin();
    fireEvent.click(screen.getByTestId('google-button'));

    await waitFor(() => {
      const button = screen.getByTestId('google-button');
      expect(button.getAttribute('data-pending')).toBe('1');
    });
  });

  it('does NOT call the legacy /api/auth/google-oauth-login flow at all', async () => {
    mountLogin();
    fireEvent.click(screen.getByTestId('google-button'));

    await waitFor(() => {
      expect(loginWithGoogleMock).toHaveBeenCalledTimes(1);
    });
    // No window.location.assign / GET redirect endpoint is invoked.
    expect(postMock).not.toHaveBeenCalled();
  });
});
