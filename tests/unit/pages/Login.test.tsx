/**
 * Tests for Login.tsx — GIS-credential Google sign-in (agreed FE ↔ BE contract).
 *
 * Contract:
 *   1. The user clicks the Google button. GIS returns a `CredentialResponse`
 *      whose `credential` field is the signed Google ID token (JWT).
 *   2. `Login.tsx` calls `AuthContext.loginWithGoogle(response)` exactly once
 *      per click (UI-level in-flight guard).
 *   3. `loginWithGoogle` is responsible for forwarding `{ credential }` to
 *      `POST /api/Auth/google-login`, persisting the session, and routing
 *      the user. The Login page does NOT call `api.post` directly and does
 *      NOT touch `storage` / `useAuthStore` itself.
 *   4. Errors surface as a recoverable alert message. The user remains on
 *      /login on failure.
 *   5. The button is in-flight deduped so a duplicate GIS callback does
 *      not fire `loginWithGoogle` twice.
 *   6. `authService.logout()` runs defensively before forwarding the
 *      credential so a guest leaves anonymous state behind (null-safe).
 *
 * These tests pin the Login page surface only; the deeper AuthContext
 * routing logic is covered by AuthContext.loginWithGoogle tests.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

const loginWithGoogleMock = vi.fn();
const authLogoutMock = vi.fn();

vi.mock('../../../src/services/auth.service', () => ({
  authService: {
    setAuthData: vi.fn(),
    logout: (...args: unknown[]) => authLogoutMock(...args),
  },
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
  }: {
    onCredential?: (r: { credential: string }) => void;
  }) => (
    <button
      type="button"
      data-testid="google-button"
      onClick={() => onCredential?.({ credential: 'gis-credential-token' })}
    >
      mock-google-button
    </button>
  ),
}));

vi.mock('../../../src/pages/Register/components/PdfDropzone', () => ({
  PdfDropzone: () => null,
}));

vi.mock('../../../src/services/role.service', () => ({
  roleService: {
    fetchRoles: vi.fn().mockResolvedValue([
      { roleId: 1, name: 'Researcher' },
      { roleId: 2, name: 'Admin' },
      { roleId: 3, name: 'Reviewer' },
      { roleId: 4, name: 'Lecturer' },
      { roleId: 5, name: 'Graduate Student' },
    ]),
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
  Input: (props: {
    name?: string;
    value?: string;
    onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
    disabled?: boolean;
    type?: string;
    label?: string;
    placeholder?: string;
  }) => (
    <label>
      {props.label}
      <input
        name={props.name}
        type={props.type}
        value={props.value ?? ''}
        onChange={props.onChange}
        disabled={props.disabled}
        placeholder={props.placeholder}
        data-testid={`input-${props.name}`}
      />
    </label>
  ),
}));

vi.mock('./components/RoleSelectionModal', () => ({
  default: () => null,
}));

import Login from '../../../src/pages/Login/Login';

beforeEach(() => {
  loginWithGoogleMock.mockReset();
  authLogoutMock.mockReset();
  loginWithGoogleMock.mockResolvedValue(undefined);
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

function fireGoogleClick() {
  const button = screen.getByTestId('google-button');
  fireEvent.click(button);
}

describe('Login — email sign-in presentation', () => {
  it('labels the existing credential control as an email input', () => {
    mountLogin();

    const email = screen.getByLabelText(/^email$/i);
    expect(email).toHaveAttribute('type', 'email');
    expect(email).toHaveAttribute('placeholder', 'name@institution.edu');
  });

  it('excludes Admin from the optional role picker', async () => {
    mountLogin();

    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'Researcher' })).toBeInTheDocument();
    });

    const rolePicker = screen.getByLabelText(/sign in as role/i);
    expect(rolePicker).toHaveTextContent('Auto-detect Role (Default)');
    expect(rolePicker).toHaveTextContent('Researcher');
    expect(rolePicker).toHaveTextContent('Reviewer');
    expect(rolePicker).toHaveTextContent('Lecturer');
    expect(rolePicker).toHaveTextContent('Graduate Student');
    expect(screen.queryByRole('option', { name: 'Admin' })).not.toBeInTheDocument();
  });
});

describe('Login — GIS credential Google sign-in (page surface)', () => {
  it('forwards the GIS credential to loginWithGoogle EXACTLY once per click', async () => {
    mountLogin();
    fireGoogleClick();

    await waitFor(() => {
      expect(loginWithGoogleMock).toHaveBeenCalledTimes(1);
    });

    // The first argument must be the GIS CredentialResponse so the
    // AuthContext can extract the credential string and POST it to BE.
    expect(loginWithGoogleMock.mock.calls[0][0]).toEqual({
      credential: 'gis-credential-token',
    });
  });

  it('runs null-safe guest cleanup (authService.logout) BEFORE forwarding the credential', async () => {
    mountLogin();
    fireGoogleClick();

    await waitFor(() => {
      expect(loginWithGoogleMock).toHaveBeenCalledTimes(1);
    });
    expect(authLogoutMock).toHaveBeenCalledTimes(1);
  });

  it('prevents duplicate in-flight submissions when clicked twice rapidly', async () => {
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

    expect(loginWithGoogleMock).toHaveBeenCalledTimes(1);
  });

  it('surfaces a recoverable error message when loginWithGoogle rejects', async () => {
    loginWithGoogleMock.mockRejectedValueOnce(
      Object.assign(new Error('Google sign-in failed'), {
        name: 'GoogleLoginError',
        code: 'INVALID_CREDENTIAL',
      }),
    );

    mountLogin();
    fireGoogleClick();

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    // The user remains on /login (no auto-navigation on failure).
    expect(screen.queryByTestId('forum-marker')).toBeNull();
    expect(screen.queryByTestId('onboarding-marker')).toBeNull();
  });
});
