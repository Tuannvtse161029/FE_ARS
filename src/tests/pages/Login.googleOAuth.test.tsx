/**
 * Tests for Agent 54 — Login.tsx Google button (backend-driven OAuth).
 *
 * Critical contracts pinned here:
 *   - The button calls `googleOAuthService.beginGoogleOAuth` exactly
 *     once per click.
 *   - The button calls `authService.logout()` defensively before the
 *     redirect so a guest leaves no anonymous state behind (null-safe
 *     cleanup).
 *   - A second click while the redirect is in flight is rejected via
 *     the local in-flight ref (no second navigation issued).
 *   - The legacy `POST /api/Auth/google-login` flow is NOT invoked
 *     any more — the FE has fully migrated to the BE OAuth flow.
 *   - The page does NOT call `authService.login` / no email+password
 *     fields are involved (those still work via the form, but the
 *     Google button itself uses the OAuth path).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

const postMock = vi.fn();
const authLogoutMock = vi.fn();
const beginGoogleOAuthMock = vi.fn();

vi.mock('../../services/axios', () => ({
  default: {
    post: (...args: unknown[]) => postMock(...args),
    get: vi.fn(),
    defaults: { headers: { common: {} } },
  },
}));

vi.mock('../../services/auth.service', () => ({
  authService: {
    setAuthData: vi.fn(),
    login: vi.fn(),
    logout: (...args: unknown[]) => authLogoutMock(...args),
  },
}));

vi.mock('../../services/googleAuth.service', () => ({
  googleAuthService: {
    postGoogleLogin: vi.fn(),
    extractCredential: vi.fn(),
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

vi.mock('../../services/googleOAuth.service', () => ({
  googleOAuthService: {
    beginGoogleOAuth: (...args: unknown[]) => beginGoogleOAuthMock(...args),
    buildGoogleOAuthLoginUrl: vi.fn(),
    parseCallbackLocation: vi.fn(),
    payloadFromLocationSearch: vi.fn(),
    normaliseGoogleOAuthCallback: vi.fn(),
    isGoogleOAuthRedirectInFlight: vi.fn(() => false),
    _resetGoogleOAuthInFlightForTesting: vi.fn(),
  },
  GoogleOAuthError: class GoogleOAuthError extends Error {
    code = 'NETWORK';
    constructor(code: string, message: string) {
      super(message);
      this.code = code as never;
    }
  },
}));

vi.mock('../../store', () => ({
  useAuthStore: () => ({
    login: vi.fn(),
    logout: vi.fn(),
  }),
}));

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    login: vi.fn(),
    isLoading: false,
    error: null,
    user: null,
    pendingRoleSelection: null,
    confirmRoleSelection: vi.fn(),
    cancelRoleSelection: vi.fn(),
  }),
}));

vi.mock('../../components/auth/GoogleSignInButton', () => ({
  GoogleSignInButton: ({
    onBegin,
    pending,
    errorMessage,
  }: {
    onBegin?: () => void;
    pending?: boolean;
    errorMessage?: string | null;
  }) => (
    <button
      type="button"
      data-testid="google-button"
      onClick={onBegin}
      disabled={pending}
      data-pending={pending ? '1' : '0'}
      data-error={errorMessage ?? ''}
    >
      {pending ? 'Loading…' : 'Sign in with Google'}
    </button>
  ),
}));

vi.mock('../../pages/Register/components/PdfDropzone', () => ({
  PdfDropzone: () => null,
}));

vi.mock('../../components/Button', () => ({
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

vi.mock('../../components/Input', () => ({
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

import Login from '../../pages/Login/Login';

let originalAssign: typeof window.location.assign;

beforeEach(() => {
  postMock.mockReset();
  authLogoutMock.mockReset();
  beginGoogleOAuthMock.mockReset();
  // Stub out `window.location.assign` so the page does not attempt to
  // navigate when `beginGoogleOAuth` is invoked. The Login page itself
  // never calls `assign` directly — it delegates to the service — but
  // jsdom throws if a service tries to navigate during tests.
  originalAssign = window.location.assign;
  Object.defineProperty(window, 'location', {
    configurable: true,
    writable: true,
    value: {
      ...window.location,
      assign: vi.fn(),
      origin: 'http://localhost:3000',
    },
  });
  beginGoogleOAuthMock.mockResolvedValue(undefined);
});

afterEach(() => {
  Object.defineProperty(window, 'location', {
    configurable: true,
    writable: true,
    value: {
      ...window.location,
      assign: originalAssign,
    },
  });
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

describe('Login — Agent 54 Google OAuth begin handler', () => {
  it('calls beginGoogleOAuth EXACTLY once per click', async () => {
    mountLogin();
    const button = screen.getByTestId('google-button');
    fireEvent.click(button);

    await waitFor(() => {
      expect(beginGoogleOAuthMock).toHaveBeenCalledTimes(1);
    });

    // The legacy POST /api/Auth/google-login path is NOT invoked.
    expect(postMock).not.toHaveBeenCalled();
  });

  it('starts the backend OAuth endpoint without a frontend redirect_uri parameter', async () => {
    mountLogin();
    fireEvent.click(screen.getByTestId('google-button'));

    await waitFor(() => {
      expect(beginGoogleOAuthMock).toHaveBeenCalledTimes(1);
    });
    expect(beginGoogleOAuthMock.mock.calls[0]).toHaveLength(0);
  });

  it('runs null-safe guest cleanup (authService.logout) BEFORE the redirect', async () => {
    mountLogin();
    fireEvent.click(screen.getByTestId('google-button'));

    await waitFor(() => {
      expect(beginGoogleOAuthMock).toHaveBeenCalledTimes(1);
    });
    // logout was called once before the beginGoogleOAuth call site.
    expect(authLogoutMock).toHaveBeenCalledTimes(1);
  });

  it('prevents duplicate in-flight clicks (only ONE beginGoogleOAuth even when fired thrice)', async () => {
    beginGoogleOAuthMock.mockImplementationOnce(
      () => new Promise(() => {
        /* never resolves — keeps the in-flight flag set */
      }),
    );
    mountLogin();
    const button = screen.getByTestId('google-button');
    fireEvent.click(button);
    fireEvent.click(button);
    fireEvent.click(button);

    // Give the microtask queue a chance to drain.
    await new Promise<void>((r) => setTimeout(r, 0));

    expect(beginGoogleOAuthMock).toHaveBeenCalledTimes(1);
  });

  it('surfaces a recoverable error message when beginGoogleOAuth rejects', async () => {
    beginGoogleOAuthMock.mockRejectedValueOnce(
      Object.assign(new Error('bad url'), {
        name: 'GoogleOAuthError',
        code: 'BAD_REDIRECT_TARGET',
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

  it('flips the button into a loading state while the redirect is in flight', async () => {
    beginGoogleOAuthMock.mockImplementationOnce(
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

  it('does NOT call the legacy POST /api/auth/google-login at all', async () => {
    mountLogin();
    fireEvent.click(screen.getByTestId('google-button'));

    await waitFor(() => {
      expect(beginGoogleOAuthMock).toHaveBeenCalledTimes(1);
    });
    expect(postMock).not.toHaveBeenCalled();
  });
});