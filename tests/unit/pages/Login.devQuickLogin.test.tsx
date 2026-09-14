/**
 * Tests for DevQuickLoginPanel — the dev-only sandbox seed-account
 * shortcuts that live on the Login page in development.
 *
 * Contract:
 *   1. The panel renders ONLY when `import.meta.env.DEV` is true AND the
 *      current hostname is a local dev host. Vite tree-shakes the panel
 *      in production builds because the visibility predicate short-
 *      circuits on `!import.meta.env.DEV`.
 *   2. Clicking a pill fills email + password into the React Hook Form
 *      and triggers the existing form submission pipeline so it routes
 *      through the same AuthContext.login() path as a real user.
 *   3. The panel is hidden from assistive tech via `aria-hidden="true"`
 *      because it is purely a developer convenience, not a user feature.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { I18nProvider } from '../../../src/i18n/I18nContext';

const useAuthMock = vi.fn();
vi.mock('../../../src/context/AuthContext', () => ({
  useAuth: () => useAuthMock(),
}));

const roleServiceFetchMock = vi.fn().mockResolvedValue([]);
vi.mock('../../../src/services/role.service', () => ({
  roleService: {
    fetchRoles: (...args: unknown[]) => roleServiceFetchMock(...args),
  },
}));

const GoogleSignInButtonMock = vi.fn(() => <div data-testid="google-button" />);
vi.mock('../../../src/components/auth/GoogleSignInButton', () => ({
  GoogleSignInButton: (props: Record<string, unknown>) =>
    GoogleSignInButtonMock(props),
}));

import Login from '../../../src/pages/Login/Login';

const originalLocation = window.location;

const setHostname = (hostname: string) => {
  Object.defineProperty(window, 'location', {
    configurable: true,
    writable: true,
    value: { ...originalLocation, hostname },
  });
};

const renderLogin = () =>
  render(
    <I18nProvider>
      <MemoryRouter initialEntries={['/login']}>
        <Login />
      </MemoryRouter>
    </I18nProvider>,
  );

describe('DevQuickLoginPanel — visibility', () => {
  beforeEach(() => {
    useAuthMock.mockReturnValue({
      login: vi.fn().mockResolvedValue(undefined),
      loginWithGoogle: vi.fn(),
      isLoading: false,
      error: null,
      user: null,
      pendingRoleSelection: null,
      confirmRoleSelection: vi.fn(),
      cancelRoleSelection: vi.fn(),
    });
    setHostname('localhost');
  });

  afterEach(() => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      writable: true,
      value: originalLocation,
    });
    vi.restoreAllMocks();
  });

  it('renders the panel on localhost in dev', () => {
    renderLogin();
    expect(screen.getByTestId('dev-quick-login-panel')).toBeInTheDocument();
    expect(
      screen.getByTestId('dev-quick-login-admin'),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId('dev-quick-login-g-student'),
    ).toBeInTheDocument();
  });

  it('hides the panel on a non-localhost hostname even in dev', () => {
    setHostname('example.com');
    renderLogin();
    expect(screen.queryByTestId('dev-quick-login-panel')).not.toBeInTheDocument();
  });

  it('marks the panel as aria-hidden so assistive tech skips it', () => {
    renderLogin();
    const panel = screen.getByTestId('dev-quick-login-panel');
    expect(panel).toHaveAttribute('aria-hidden', 'true');
  });
});

describe('DevQuickLoginPanel — pill interaction', () => {
  let loginSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    loginSpy = vi.fn().mockResolvedValue(undefined);
    useAuthMock.mockReturnValue({
      login: loginSpy,
      loginWithGoogle: vi.fn(),
      isLoading: false,
      error: null,
      user: null,
      pendingRoleSelection: null,
      confirmRoleSelection: vi.fn(),
      cancelRoleSelection: vi.fn(),
    });
    setHostname('127.0.0.1');
  });

  afterEach(() => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      writable: true,
      value: originalLocation,
    });
    vi.restoreAllMocks();
  });

  it('pre-fills the email + password fields when a pill is clicked', async () => {
    renderLogin();

    fireEvent.click(screen.getByTestId('dev-quick-login-reviewer'));

    const emailInput = (await screen.findByLabelText(/email address/i)) as HTMLInputElement;
    const passwordInput = (await screen.findByLabelText(/^password$/i)) as HTMLInputElement;
    expect(emailInput.value).toBe('reviewer@arsplatform.com');
    expect(passwordInput.value).toBe('Password123!');
  });

  it('invokes AuthContext.login() with the pill credentials', async () => {
    renderLogin();
    fireEvent.click(screen.getByTestId('dev-quick-login-admin'));

    await waitFor(() => expect(loginSpy).toHaveBeenCalledTimes(1));
    expect(loginSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'admin@arsplatform.com',
        password: 'Admin@123',
      }),
    );
  });

  it('disables pills while a login is in flight', () => {
    useAuthMock.mockReturnValue({
      login: vi.fn().mockResolvedValue(undefined),
      loginWithGoogle: vi.fn(),
      isLoading: true,
      error: null,
      user: null,
      pendingRoleSelection: null,
      confirmRoleSelection: vi.fn(),
      cancelRoleSelection: vi.fn(),
    });
    renderLogin();
    expect(
      screen.getByTestId('dev-quick-login-researcher'),
    ).toBeDisabled();
  });
});
