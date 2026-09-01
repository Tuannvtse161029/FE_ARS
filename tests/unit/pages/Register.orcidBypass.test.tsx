/**
 * PROD-002 — tests for the development-only ORCID bypass on the
 * `src/pages/Register/Register.tsx` Reviewer registration flow.
 *
 * The flag is read from `import.meta.env.VITE_REQUIRE_REVIEWER_ORCID` via
 * `src/config/featureFlags.ts`. The flag is a function evaluated at render time,
 * so each render() picks up the current flag value set via the test-only
 * override hook.
 *
 * These tests focus on the ORCID gate itself — they render the page with the
 * Reviewer role selected and assert whether the ORCID-required error and the
 * development-bypass banner are present. The full form-submission happy path
 * is exercised by the broader Register.test.tsx suite.
 */
import { render, screen, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

type FlagModule = typeof import('../../../src/config/featureFlags');

const { registerUserSpy, setAuthDataSpy } = vi.hoisted(() => ({
  registerUserSpy: vi.fn(),
  setAuthDataSpy: vi.fn(),
}));

const { loginSpy, setLoadingSpy } = vi.hoisted(() => ({
  loginSpy: vi.fn(),
  setLoadingSpy: vi.fn(),
}));

vi.mock('../../../src/services/auth.service', () => ({
  authService: {
    registerUser: registerUserSpy,
    setAuthData: setAuthDataSpy,
    logout: vi.fn(),
  },
}));

vi.mock('../../../src/store', () => ({
  useAuthStore: () => ({
    login: loginSpy,
    setLoading: setLoadingSpy,
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

vi.mock('../../../src/services/role.service', () => ({
  roleService: {
    fetchBusinessRolesForOnboarding: vi.fn().mockResolvedValue([
      'Researcher',
      'Reviewer',
      'Lecturer',
      'Graduate Student',
    ]),
    fetchRoles: vi.fn().mockResolvedValue([
      'Researcher',
      'Reviewer',
      'Lecturer',
      'Graduate Student',
    ]),
    isOnboardingSelectable: vi.fn().mockReturnValue(true),
  },
}));

describe('Register – PROD-002 ORCID bypass', () => {
  let flags: FlagModule;
  let Register: React.ComponentType;

  beforeAll(async () => {
    flags = await import('../../../src/config/featureFlags');
    const mod = await import('../../../src/pages/Register/Register');
    Register = mod.Register;
    flags.__setRequireReviewerOrcidForTests(null);
  });

  beforeEach(() => {
    registerUserSpy.mockReset();
    try { sessionStorage.removeItem('orcidRegistrationTicket'); } catch { /* ignore */ }
    flags.__setRequireReviewerOrcidForTests(null);
  });

  const renderRegister = () =>
    render(<Register />, {
      wrapper: ({ children }) => <MemoryRouter>{children}</MemoryRouter>,
    });

  const selectReviewerRole = async (user: ReturnType<typeof userEvent.setup>) => {
    await waitFor(() => {
      expect(screen.queryByRole('option', { name: 'Reviewer' })).toBeInTheDocument();
    });
    await user.selectOptions(screen.getByLabelText(/select your platform role/i), 'Reviewer');
  };

  // ── Tests ──────────────────────────────────────────────────────────────

  test('production mode: ORCID-required inline error appears when Reviewer is selected with no ORCID ticket', async () => {
    flags.__setRequireReviewerOrcidForTests(true);
    const user = userEvent.setup();
    await act(async () => {
      renderRegister();
    });
    await selectReviewerRole(user);
    // The copy must clearly state that ORCID is required.
    expect(
      screen.getByText(/reviewer requests require a verified orcid connection/i),
    ).toBeInTheDocument();
    // No development-bypass banner.
    expect(screen.queryByTestId('register-orcid-dev-bypass-notice')).not.toBeInTheDocument();
    // The Connect ORCID button is still available.
    expect(screen.getByTestId('register-connect-orcid-button')).toBeInTheDocument();
  });

  test('development mode: bypass banner appears and inline ORCID-required error is NOT shown', async () => {
    flags.__setRequireReviewerOrcidForTests(false);
    const user = userEvent.setup();
    await act(async () => {
      renderRegister();
    });
    await selectReviewerRole(user);
    // The development-only banner must be visible.
    expect(screen.getByTestId('register-orcid-dev-bypass-notice')).toBeInTheDocument();
    expect(
      screen.getByTestId('register-orcid-dev-bypass-notice').textContent,
    ).toMatch(/development-only orcid bypass/i);
    // The original "required" inline error must NOT be present.
    expect(
      screen.queryByText(/reviewer requests require a verified orcid connection/i),
    ).not.toBeInTheDocument();
    // The Connect ORCID button is still available so users who want ORCID
    // can still connect.
    expect(screen.getByTestId('register-connect-orcid-button')).toBeInTheDocument();
  });

  test('development mode: switching from Reviewer to Researcher removes the bypass banner', async () => {
    flags.__setRequireReviewerOrcidForTests(false);
    const user = userEvent.setup();
    await act(async () => {
      renderRegister();
    });
    await selectReviewerRole(user);
    expect(screen.getByTestId('register-orcid-dev-bypass-notice')).toBeInTheDocument();
    // Switch to Researcher.
    await user.selectOptions(screen.getByLabelText(/select your platform role/i), 'Researcher');
    // Bypass banner is gone for non-Reviewer roles.
    expect(screen.queryByTestId('register-orcid-dev-bypass-notice')).not.toBeInTheDocument();
  });

  test('an unconnected ORCID is NEVER represented as verified', async () => {
    flags.__setRequireReviewerOrcidForTests(false);
    const user = userEvent.setup();
    await act(async () => {
      renderRegister();
    });
    await selectReviewerRole(user);
    // Without going through the OAuth callback, the verified badge must NOT
    // appear regardless of bypass state.
    expect(screen.queryByTestId('register-orcid-verified-badge')).not.toBeInTheDocument();
  });

  test('ORCID connection button remains visible regardless of bypass state', async () => {
    const user = userEvent.setup();
    for (const bypassValue of [true, false]) {
      flags.__setRequireReviewerOrcidForTests(bypassValue);
      const { unmount } = await act(async () => renderRegister());
      await selectReviewerRole(user);
      expect(screen.getByTestId('register-connect-orcid-button')).toBeInTheDocument();
      unmount();
    }
  });

  test('non-Reviewer roles never show the bypass banner', async () => {
    flags.__setRequireReviewerOrcidForTests(false);
    const user = userEvent.setup();
    await act(async () => {
      renderRegister();
    });
    // Researcher is the default — banner should NOT be shown for any non-Reviewer role.
    for (const role of ['Researcher', 'Lecturer', 'Graduate Student']) {
      await user.selectOptions(screen.getByLabelText(/select your platform role/i), role);
      expect(screen.queryByTestId('register-orcid-dev-bypass-notice')).not.toBeInTheDocument();
    }
  });
});
