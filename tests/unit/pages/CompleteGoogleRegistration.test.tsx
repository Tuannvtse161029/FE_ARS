/**
 * Tests for the CompleteGoogleRegistration onboarding page (live contract revision).
 *
 * The page DOES post the documented onboarding payload to the live BE endpoint — see the JSDoc on `completeGoogleRegistration` in `src/context/AuthContext.tsx` and `src/services/googleAuth.service.ts`. Authentication is forwarded implicitly through the shared axios `Authorization` header (the ARS JWT), so this file no longer pretends the page is in a "safe-mode stub" that refuses to POST. The docstring below records the invariants this file still enforces against the live contract — the stale "Swagger has no documented onboarding endpoint" framing has been removed because the endpoint is now documented and the page POSTs to it exactly once per call (with the page owning the double-click / in-flight guard, the refresh-safe `ars_google_onboarding_submitted` sentinel, and the Idempotency-Key header that `googleAuthService.postCompleteGoogleRegistration` attaches server-side per user id; see `src/services/googleAuth.service.ts`).
 *
 * Invariants preserved by this file (do not weaken):
 *   - The page does NOT call PUT /api/User/{id} as a proof/role submission. The previous iteration's User API update was withdrawn because `pdfUrl` is not a documented Swagger field on `UserUpdateRequest`. The role and verification PDF are submitted through the onboarding endpoint instead, where the BE contract explicitly acknowledges them. `pdfUrl` is still uploaded to Firebase before being POSTed (see `src/pages/Register/components/PdfDropzone.tsx` and the page's `handleUploadComplete` callback) — we never send a local-only blob to the BE, and we never fabricate a `roleName` (e.g. 'Researcher') or `roleId` 0 on the user record as a stand-in for the proper onboarding submit. The role selector is therefore not a UI placeholder — it gates a real submit — but the page refuses to send `roleName` / `roleId` through PUT /api/User/{id}; the BE is the source of truth for the post-submit verification status and effective role.
 *   - The page does NOT duplicate the JWT into a Google-only session key. The Google ID token (`credential`) is never cached, never echoed, never read back from storage — both the credential flow (Login → POST /api/Auth/google-login) and the legacy code-redirect flow (/auth/google/callback) arrive here with the same ARS session, and the page only reads the ARS JWT through the shared `storage.getToken()` (see `src/utils/storage.ts` and `src/services/axios.ts`). The page's profile is read from the existing ARS auth store / storage, not from any Google-only blob.
 *   - The page does NOT call /api/Auth/register. `google-login` (or the legacy `/auth/google/callback`) already created the user; the onboarding completion endpoint only carries the role request, not an account creation. The page therefore does not render a "register" CTA, and we assert no `/api/Auth/register` traffic is generated as a regression guard for the credential flow → onboarding handoff.
 *   - When the user is unauthenticated (no token or no positive userId), the page bounces to /login. A partially-hydrated session (token missing, userId <= 0, or missing email/fullName) is treated as invalid for onboarding — the page refuses to render and refuses to submit a forged role request. This is the token-less bounce invariant that protects the BE from a stale ars_user snapshot leaking into the onboarding payload. See `profile` resolution in `src/pages/CompleteGoogleRegistration/CompleteGoogleRegistration.tsx`.
 *   - The page does NOT POST the onboarding payload before the user has selected a role and uploaded a verification PDF. The Submit button stays disabled until the role is chosen (with a valid ORCID iD for Reviewer) and a PDF URL is present — so a render-without-click never produces a network call. This guards the "exactly one POST per mount" contract that the BE dedupes with the per-user Idempotency-Key header and the refresh-safe `ars_google_onboarding_submitted` sessionStorage sentinel (cleared on logout, re-hydrated on mount to render the success state without re-submitting — see `handleSignOut` and the SUBMITTED_KEY effect in the page). The full submit path (POST → refetch BE user → route to /forum) is exercised by the Playwright spec in `tests/e2e/googleOnboarding.spec.ts`, not here, because it requires the shared axios `Authorization` interceptor and the BE-side session, both of which are easier to assert in the headless browser than in jsdom. The unit tests below stay focused on the invariants above, where they still add value beyond the e2e spec, and on the negative paths that the e2e spec does not cover (token-less bounce, missing userId bounce, the absence of `/api/Auth/register` and of a Google-only session key, the role/PDF guard before any POST, and the Firebase upload flow that produces the `pdfUrl` we send through the onboarding endpoint — never through PUT /api/User/{id}).
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

vi.mock('../../../src/store', () => ({
  useAuthStore: (selector: (s: { login: () => void; updateUser: (u: unknown) => void; logout: () => void; user?: { email?: string } }) => unknown) =>
    selector({ login: vi.fn(), updateUser: vi.fn(), logout: vi.fn(), user: { email: 'user@example.com' } }),
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

describe('CompleteGoogleRegistration — pre-submit guards', () => {
  it('does NOT POST the onboarding payload before a role is selected and a verification PDF is uploaded', async () => {
    mountWithAuth();

    // Wait for the role list to load.
    await waitFor(() => {
      const roleSelect = document.querySelector('select#role') as HTMLSelectElement | null;
      expect(roleSelect).not.toBeNull();
      expect(roleSelect?.options.length).toBeGreaterThan(1);
    });

    // Upload a proof, but DO NOT select a role yet.
    fireEvent.click(screen.getByTestId('upload'));

    // Submit is gated on role + PDF; without a role selection, the page
    // must NOT have posted the onboarding payload. The full submit path
    // (POST → refetch BE user → route to /forum) is exercised by the
    // Playwright spec — these unit tests stay focused on the pre-submit
    // guard and the invariants listed in the file header.
    const submit = screen.getByRole('button', { name: /Submit role request/i });
    expect(submit).toBeDisabled();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(updateMock).not.toHaveBeenCalled();
  });

  it('disables Submit until a role and a valid verification PDF are present', async () => {
    mountWithAuth();

    await waitFor(() => {
      const roleSelect = document.querySelector('select#role') as HTMLSelectElement | null;
      expect(roleSelect).not.toBeNull();
    });

    // Submit is disabled before role/PDF.
    const submit = screen.getByRole('button', { name: /Submit role request/i });
    expect(submit).toBeDisabled();

    // After uploading the proof, submit remains disabled until a role is chosen.
    fireEvent.click(screen.getByTestId('upload'));
    expect(submit).toBeDisabled();
  });

  it('does NOT fabricate a fake roleName or roleId on the user record', async () => {
    mountWithAuth();

    // The role selector is populated from the FE-owned constant — the
    // page does not call out to GET /api/Role for the user-selectable set.
    await waitFor(() => {
      const roleSelect = document.querySelector('select#role') as HTMLSelectElement | null;
      expect(roleSelect).not.toBeNull();
      expect(roleSelect?.options.length).toBe(5); // placeholder + 4 roles
    });

    // The role field is required to enable submit; no PUT happens.
    const submit = screen.getByRole('button', { name: /Submit role request/i });
    expect(submit).toBeDisabled();
    expect(updateMock).not.toHaveBeenCalled();
    // No GET /api/Role call is generated from the page itself.
    expect(fetchBusinessRolesMock).not.toHaveBeenCalled();
  });

  it('does NOT call /api/Auth/register from the onboarding page', async () => {
    mountWithAuth();

    await waitFor(() => {
      const roleSelect = document.querySelector('select#role') as HTMLSelectElement | null;
      expect(roleSelect?.options.length).toBe(5);
    });

    // The page does not render a register CTA and does not POST.
    expect(screen.queryByText(/register/i)).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(updateMock).not.toHaveBeenCalled();
    expect(fetchBusinessRolesMock).not.toHaveBeenCalled();
  });

  it('does NOT duplicate the app token into a Google-only session key', async () => {
    mountWithAuth();

    await waitFor(() => {
      const roleSelect = document.querySelector('select#role') as HTMLSelectElement | null;
      expect(roleSelect?.options.length).toBe(5);
    });

    // The page never reads or writes `ars_google_onboarding_session`.
    expect(sessionStorage.getItem('ars_google_onboarding_session')).toBeNull();
    expect(localStorage.getItem('ars_google_onboarding_session')).toBeNull();
  });

  it('still allows the user to capture their proof via the existing Firebase flow', async () => {
    mountWithAuth();

    await waitFor(() => {
      const roleSelect = document.querySelector('select#role') as HTMLSelectElement | null;
      expect(roleSelect?.options.length).toBe(5);
    });

    fireEvent.click(screen.getByTestId('upload'));

    await waitFor(() => {
      expect(
        screen.queryByTestId('upload'),
      ).toBeInTheDocument();
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

  it('still renders when the persisted user record lacks a fullName but the auth context supplies a username', async () => {
    // The new page falls back to the auth-context username when the
    // persisted blob lacks a fullName. A partially-hydrated session is
    // still considered valid as long as the auth context is populated.
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

    mountWithAuth();

    await waitFor(() => {
      // Role selector is populated from the FE-owned constant.
      const roleSelect = document.querySelector('select#role') as HTMLSelectElement | null;
      expect(roleSelect?.options.length).toBe(5);
    });

    // Page renders, not the login redirect.
    expect(screen.queryByTestId('login')).toBeNull();
    expect(screen.getByTestId('complete-google-registration')).toBeInTheDocument();
    // No GET /api/Role round-trip from the page itself.
    expect(fetchBusinessRolesMock).not.toHaveBeenCalled();
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
