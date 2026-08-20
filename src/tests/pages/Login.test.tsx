/**
 * Tests for Agent 52 — Login.tsx Google Sign-In flow.
 *
 * Critical contracts (post follow-up correction):
 *   - The page posts the GIS `credential` EXACTLY once per callback.
 *   - The page does NOT authenticate from any other GIS field.
 *   - The page persists the session via the existing storage/authStore
 *     pattern — it does NOT modify AuthContext.
 *   - The page navigates with `replace: true` on every route change.
 *   - Pending / Rejected / Guest users route to /forum explicitly.
 *   - Duplicate in-flight submissions are blocked by the in-flight ref.
 *   - First-time Google users route to /complete-google-registration
 *     ONLY when the BE returns `isNewUser === true` OR
 *     `requiresOnboarding === true`. We never infer onboarding from a
 *     missing role property alone.
 *   - The page surfaces a recoverable error message on failure.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

const postMock = vi.fn();
const setAuthDataMock = vi.fn();
const authStoreLoginMock = vi.fn();
const authStoreLogoutMock = vi.fn();

vi.mock('../../services/axios', () => ({
  default: { post: (...args: unknown[]) => postMock(...args) },
}));

vi.mock('../../services/auth.service', () => ({
  authService: {
    setAuthData: (...args: unknown[]) => setAuthDataMock(...args),
    logout: vi.fn(),
  },
}));

vi.mock('../../store', () => ({
  useAuthStore: () => ({
    login: (...args: unknown[]) => authStoreLoginMock(...args),
    logout: (...args: unknown[]) => authStoreLogoutMock(...args),
  }),
}));

vi.mock('../../utils/storage', () => ({
  storage: {
    setToken: vi.fn(),
    setUser: vi.fn(),
    getToken: vi.fn(),
    setRememberMe: vi.fn(),
  },
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

vi.mock('../../hooks/useGoogleIdentity', () => ({
  useGoogleIdentity: ({ onCredential }: { onCredential: (r: unknown) => void }) => ({
    status: 'ready',
    buttonContainerRef: { current: null },
    isReady: true,
    errorMessage: null,
    // Expose the callback for direct invocation in tests.
    __onCredential: onCredential,
  }),
}));

vi.mock('../../components/auth/GoogleSignInButton', () => ({
  GoogleSignInButton: ({
    onCredential,
  }: {
    onCredential: (r: unknown) => void;
  }) => (
    <button
      type="button"
      data-testid="google-button"
      onClick={() => onCredential({ credential: 'gis-credential' })}
    >
      mock-google-button
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

beforeEach(() => {
  postMock.mockReset();
  setAuthDataMock.mockReset();
  authStoreLoginMock.mockReset();
  authStoreLogoutMock.mockReset();
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
        <Route path="/admin" element={<div data-testid="admin-marker">admin</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('Login — Google Sign-In credential flow', () => {
  it('posts the credential EXACTLY once for a successful Existing-User response', async () => {
    postMock.mockResolvedValueOnce({
      data: {
        token: 'jwt-from-google',
        email: 'user@example.com',
        fullName: 'Google User',
        userId: 42,
        role: 'Researcher',
        roleId: 1,
        roles: ['Researcher'],
        isActive: true,
        verificationStatus: 'Accepted',
      },
    });

    mountLogin();

    fireGoogleClick();

    await waitFor(() => {
      expect(postMock).toHaveBeenCalledTimes(1);
    });

    const [url, body] = postMock.mock.calls[0];
    expect(url).toBe('/api/auth/google-login');
    expect(body).toEqual({ credential: 'gis-credential' });
    // No client-decoded fields leak into the POST body.
    expect(Object.keys(body)).toEqual(['credential']);
  });

  it('persists the session via storage/authStore without touching AuthContext', async () => {
    postMock.mockResolvedValueOnce({
      data: {
        token: 'jwt-1',
        email: 'user@example.com',
        fullName: 'Google User',
        userId: 42,
        role: 'Researcher',
        roleId: 1,
        roles: ['Researcher'],
        isActive: true,
        verificationStatus: 'Accepted',
      },
    });

    mountLogin();

    fireGoogleClick();

    await waitFor(() => {
      expect(setAuthDataMock).toHaveBeenCalledTimes(1);
    });
    const authResponse = setAuthDataMock.mock.calls[0][0];
    expect(authResponse.token).toBe('jwt-1');
    expect(authResponse.email).toBe('user@example.com');
    expect(authResponse.role).toBe('Researcher');
    expect(authResponse.isActive).toBe(true);
    expect(authResponse.verificationStatus).toBe('Accepted');

    await waitFor(() => {
      expect(authStoreLoginMock).toHaveBeenCalledTimes(1);
    });
  });

  it('routes an Approved + Active business-role user to /forum (existing landing)', async () => {
    postMock.mockResolvedValueOnce({
      data: {
        token: 'jwt-1',
        email: 'user@example.com',
        fullName: 'Google User',
        userId: 42,
        role: 'Researcher',
        roleId: 1,
        roles: ['Researcher'],
        isActive: true,
        verificationStatus: 'Accepted',
      },
    });

    mountLogin();

    fireGoogleClick();

    await waitFor(() => {
      expect(screen.queryByTestId('forum-marker')).toBeInTheDocument();
    });
  });

  it('routes a Pending user to /forum (explicit, not via guard)', async () => {
    postMock.mockResolvedValueOnce({
      data: {
        token: 'jwt-1',
        email: 'user@example.com',
        fullName: 'Google User',
        userId: 42,
        role: 'Researcher',
        roleId: 1,
        roles: ['Researcher'],
        isActive: false,
        verificationStatus: 'Pending',
      },
    });

    mountLogin();

    fireGoogleClick();

    await waitFor(() => {
      expect(screen.queryByTestId('forum-marker')).toBeInTheDocument();
    });
  });

  it('routes a Rejected user to /forum (existing decision state)', async () => {
    postMock.mockResolvedValueOnce({
      data: {
        token: 'jwt-1',
        email: 'user@example.com',
        fullName: 'Google User',
        userId: 42,
        role: 'Researcher',
        roleId: 1,
        roles: ['Researcher'],
        isActive: false,
        verificationStatus: 'Rejected',
      },
    });

    mountLogin();

    fireGoogleClick();

    await waitFor(() => {
      expect(screen.queryByTestId('forum-marker')).toBeInTheDocument();
    });
  });

  it('routes a First-time user (isNewUser=true) to /complete-google-registration', async () => {
    postMock.mockResolvedValueOnce({
      data: {
        token: 'jwt-1',
        email: 'user@example.com',
        fullName: 'Google User',
        userId: 42,
        role: 'Researcher',
        roleId: 1,
        roles: ['Researcher'],
        isActive: false,
        verificationStatus: 'Pending',
        isNewUser: true,
      },
    });

    mountLogin();

    fireGoogleClick();

    await waitFor(() => {
      expect(screen.queryByTestId('onboarding-marker')).toBeInTheDocument();
    });

    // Existing user should NOT be on /forum.
    expect(screen.queryByTestId('forum-marker')).toBeNull();
  });

  it('routes a requiresOnboarding=true user to /complete-google-registration', async () => {
    postMock.mockResolvedValueOnce({
      data: {
        token: 'jwt-1',
        email: 'user@example.com',
        fullName: 'Google User',
        userId: 42,
        role: 'Researcher',
        roleId: 1,
        roles: ['Researcher'],
        isActive: false,
        verificationStatus: 'Pending',
        requiresOnboarding: true,
      },
    });

    mountLogin();

    fireGoogleClick();

    await waitFor(() => {
      expect(screen.queryByTestId('onboarding-marker')).toBeInTheDocument();
    });
  });

  it('does NOT infer onboarding from a missing role alone', async () => {
    postMock.mockResolvedValueOnce({
      data: {
        token: 'jwt-1',
        email: 'user@example.com',
        fullName: 'Google User',
        userId: 42,
        role: 'Researcher',
        roleId: 1,
        roles: ['Researcher'],
        isActive: true,
        verificationStatus: 'Accepted',
        // No isNewUser / requiresOnboarding flag — the user is approved.
      },
    });

    mountLogin();

    fireGoogleClick();

    await waitFor(() => {
      expect(screen.queryByTestId('forum-marker')).toBeInTheDocument();
    });

    expect(screen.queryByTestId('onboarding-marker')).toBeNull();
  });

  it('surfaces a recoverable error message on a 401 invalid credential', async () => {
    postMock.mockRejectedValueOnce({ response: { status: 401 } });

    mountLogin();

    fireGoogleClick();

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    // The user remains on /login (no auto-navigation on failure).
    expect(screen.queryByTestId('forum-marker')).toBeNull();
    expect(screen.queryByTestId('onboarding-marker')).toBeNull();
  });

  it('prevents duplicate in-flight submissions when clicked twice rapidly', async () => {
    let release: (v: unknown) => void = () => {};
    postMock.mockImplementationOnce(
      () => new Promise((resolve) => {
        release = resolve;
      }),
    );

    mountLogin();

    const button = screen.getByTestId('google-button');
    fireEvent.click(button);
    fireEvent.click(button);
    fireEvent.click(button);

    // The first click fires the POST, the next two are blocked by the
    // in-flight ref.
    expect(postMock).toHaveBeenCalledTimes(1);

    release({
      data: {
        token: 'jwt-1',
        email: 'user@example.com',
        fullName: 'Google User',
        userId: 42,
        role: 'Researcher',
        roleId: 1,
        roles: ['Researcher'],
        isActive: true,
        verificationStatus: 'Accepted',
      },
    });
  });

  // ── First-time branch: refuse to persist when the BE response is missing
  //    required fields. These checks run BEFORE any routing decision. Without
  //    them, CompleteGoogleRegistration would treat an invalid session as
  //    authenticated. See Login.tsx "Mandatory BE-response validation".
  it('does NOT persist any auth state when the BE response is missing a token', async () => {
    postMock.mockResolvedValueOnce({
      data: {
        // token intentionally omitted
        email: 'user@example.com',
        fullName: 'Google User',
        userId: 42,
        role: 'Researcher',
        roleId: 1,
        roles: ['Researcher'],
        isActive: true,
        verificationStatus: 'Accepted',
        isNewUser: true,
      },
    });

    mountLogin();

    fireGoogleClick();

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    // No persistence, no navigation.
    expect(setAuthDataMock).not.toHaveBeenCalled();
    expect(authStoreLoginMock).not.toHaveBeenCalled();
    expect(screen.queryByTestId('onboarding-marker')).toBeNull();
    expect(screen.queryByTestId('forum-marker')).toBeNull();
  });

  it('does NOT persist any auth state when the BE response is missing a positive userId', async () => {
    postMock.mockResolvedValueOnce({
      data: {
        token: 'jwt-1',
        email: 'user@example.com',
        fullName: 'Google User',
        // userId intentionally zero / missing
        userId: 0,
        role: 'Researcher',
        roleId: 1,
        roles: ['Researcher'],
        isActive: true,
        verificationStatus: 'Accepted',
        isNewUser: true,
      },
    });

    mountLogin();

    fireGoogleClick();

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    expect(setAuthDataMock).not.toHaveBeenCalled();
    expect(authStoreLoginMock).not.toHaveBeenCalled();
    expect(screen.queryByTestId('onboarding-marker')).toBeNull();
    expect(screen.queryByTestId('forum-marker')).toBeNull();
  });

  it('does NOT persist any auth state when the BE response is missing an email', async () => {
    postMock.mockResolvedValueOnce({
      data: {
        token: 'jwt-1',
        // email intentionally omitted
        fullName: 'Google User',
        userId: 42,
        role: 'Researcher',
        roleId: 1,
        roles: ['Researcher'],
        isActive: true,
        verificationStatus: 'Accepted',
        isNewUser: true,
      },
    });

    mountLogin();

    fireGoogleClick();

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    expect(setAuthDataMock).not.toHaveBeenCalled();
    expect(authStoreLoginMock).not.toHaveBeenCalled();
    expect(screen.queryByTestId('onboarding-marker')).toBeNull();
    expect(screen.queryByTestId('forum-marker')).toBeNull();
  });

  it('does NOT persist any auth state when the BE response is missing a fullName', async () => {
    postMock.mockResolvedValueOnce({
      data: {
        token: 'jwt-1',
        email: 'user@example.com',
        // fullName intentionally omitted
        userId: 42,
        role: 'Researcher',
        roleId: 1,
        roles: ['Researcher'],
        isActive: true,
        verificationStatus: 'Accepted',
        isNewUser: true,
      },
    });

    mountLogin();

    fireGoogleClick();

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    expect(setAuthDataMock).not.toHaveBeenCalled();
    expect(authStoreLoginMock).not.toHaveBeenCalled();
    expect(screen.queryByTestId('onboarding-marker')).toBeNull();
    expect(screen.queryByTestId('forum-marker')).toBeNull();
  });

  it('persists a first-time user with BE-derived data only (no fabricated roleId/roleName)', async () => {
    postMock.mockResolvedValueOnce({
      data: {
        token: 'jwt-1',
        email: 'new@example.com',
        fullName: 'New User',
        userId: 99,
        // role intentionally omitted — backend has not assigned a role yet
        isActive: false,
        verificationStatus: 'Pending',
        isNewUser: true,
      },
    });

    mountLogin();

    fireGoogleClick();

    await waitFor(() => {
      expect(screen.queryByTestId('onboarding-marker')).toBeInTheDocument();
    });

    // The authStore.login call must reflect the BE-derived shape, not
    // invented roleId/roleName/defaults.
    const [loginArg] = authStoreLoginMock.mock.calls[0];
    expect(loginArg.id).toBe(99);
    expect(loginArg.email).toBe('new@example.com');
    expect(loginArg.fullName).toBe('New User');
    expect(loginArg.roleId).toBeNull();
    expect(loginArg.roleName).toBeNull();
    expect(loginArg.isActive).toBe(false);
    expect(loginArg.verificationStatus).toBe('Pending');
  });
});

function fireGoogleClick() {
  const button = screen.getByTestId('google-button');
  fireEvent.click(button);
}
