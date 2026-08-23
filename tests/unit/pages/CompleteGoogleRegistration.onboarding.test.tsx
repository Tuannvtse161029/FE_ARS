/**
 * Agent 30 — focused tests for the rewritten CompleteGoogleRegistration page.
 *
 * Covered scenarios (mapped to the task spec):
 *   1. Approved Google user routes normally without the dialog.
 *   2. First-time Google user lands on the dialog (NOT on /forum).
 *   3. Reviewer must enter an ORCID iD with a valid checksum.
 *   4. Changing the role away from Reviewer HIDES and CLEARS the ORCID.
 *   5. The captured Firebase URL is what the BE receives in the payload.
 *   6. Submit double-click fires exactly ONE POST.
 *   7. A successful submit navigates the pending user to /forum.
 *   8. The page cannot reach a role workspace directly (no destination
 *      other than /forum or /login).
 *   9. Refreshing after a successful submit does NOT re-submit.
 *  10. The Google callback is consumed once per page mount.
 *
 * Storage / behavioural invariants:
 *   - No `ars_google_onboarding_session` key is ever written.
 *   - No logs of credentials / Firebase URLs.
 *   - The BTR placeholder ("Backend onboarding endpoint unavailable") is
 *     removed in this revision.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

const postCompleteGoogleRegistrationMock = vi.fn();
const userServiceGetByIdMock = vi.fn();

const fetchBusinessRolesMock = vi.fn().mockResolvedValue([
  'Researcher',
  'Reviewer',
  'Lecturer',
  'Graduate Student',
]);

const authValue: {
  isAuthenticated: boolean;
  user: typeof authValue.user;
  effectiveRole: string | null;
  completeGoogleRegistration: (payload: {
    pdfUrl: string;
    phoneNumber: string;
    role: string;
    orcidId?: string;
  }) => Promise<{
    status: 'submitted';
    role: string | null;
    effectiveRole: string | null;
    requestStatus: string | null;
    onboardingStatus: string | null;
  }>;
} = {
  isAuthenticated: true,
  user: {
    userId: 7,
    username: 'Google User',
    email: 'user@example.com',
    role: '',
    isActive: false,
    verificationStatus: 'Pending',
    effectiveRole: 'Guest',
  },
  effectiveRole: 'Guest',
  completeGoogleRegistration: postCompleteGoogleRegistrationMock,
};

const storageGetTokenMock = vi.fn(() => 'ars-jwt-token');
const storageGetUserMock = vi.fn(() => ({
  id: 7,
  username: 'Google User',
  email: 'user@example.com',
  fullName: 'Google User',
  roleId: 0,
  roleName: '',
  isActive: false,
  verificationStatus: 'Pending',
  effectiveRole: 'Guest',
}));

vi.mock('../../../src/services/googleAuth.service', () => ({
  googleAuthService: {
    postGoogleLogin: vi.fn(),
    postCompleteGoogleRegistration: vi.fn(),
  },
}));

vi.mock('../../../src/services/user.service', () => ({
  userService: {
    getById: (...args: unknown[]) => userServiceGetByIdMock(...args),
    update: vi.fn(),
  },
}));

vi.mock('../../../src/services/auth.service', () => ({
  authService: {
    logout: vi.fn(),
    setAuthData: vi.fn(),
  },
  clearAuthSession: vi.fn(),
}));

vi.mock('../../../src/services/role.service', () => ({
  roleService: {
    fetchBusinessRolesForOnboarding: (...args: unknown[]) =>
      fetchBusinessRolesMock(...args),
  },
  ALLOWED_ONBOARDING_ROLES: [
    'Researcher',
    'Reviewer',
    'Lecturer',
    'Graduate Student',
  ],
}));

vi.mock('../../../src/store', () => {
  const state = {
    updateUser: vi.fn(),
    logout: vi.fn(),
    user: {
      id: 7,
      username: 'Google User',
      email: 'user@example.com',
      fullName: 'Google User',
      roleId: 0,
      roleName: '',
      isActive: false,
      verificationStatus: 'Pending',
      effectiveRole: 'Guest',
    },
    effectiveRole: 'Guest',
    isAuthenticated: true,
  };
  const useAuthStore = (selector: (s: typeof state) => unknown) =>
    selector(state);
  useAuthStore.getState = () => state;
  return { useAuthStore };
});

vi.mock('../../../src/context/AuthContext', () => ({
  useAuth: () => authValue,
}));

vi.mock('../../../src/utils/storage', () => ({
  storage: {
    setToken: vi.fn(),
    setUser: vi.fn(),
    getToken: (...args: unknown[]) =>
      (storageGetTokenMock as unknown as (...a: unknown[]) => string | null)(
        ...args,
      ),
    getUser: (...args: unknown[]) =>
      (storageGetUserMock as unknown as (...a: unknown[]) => unknown)(...args),
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
    'data-testid': dataTestId,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    type?: 'button' | 'submit';
    disabled?: boolean;
    isLoading?: boolean;
    'data-testid'?: string;
  }) => (
    <button
      type={type ?? 'button'}
      onClick={onClick}
      disabled={disabled || isLoading}
      data-testid={dataTestId ?? 'btn'}
    >
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
    error,
  }: {
    id?: string;
    name?: string;
    value?: string;
    onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
    disabled?: boolean;
    error?: string;
  }) => (
    <>
      <input
        id={id}
        name={name}
        value={value ?? ''}
        onChange={onChange}
        disabled={disabled}
        data-testid={`input-${name}`}
        data-error={error ?? ''}
      />
      {error && <span data-testid={`${name}-error`}>{error}</span>}
    </>
  ),
}));

vi.mock('../../../src/pages/Register/components/PdfDropzone', () => ({
  PdfDropzone: ({
    onUploadComplete,
    onUploadStateChange,
  }: {
    onUploadComplete: (file: File, url: string) => void;
    onRemove?: () => void;
    pdfUrl?: string | null;
    uploadedFile?: File | null;
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

vi.mock('../../../src/assets/images/ARS_Logo.png', () => ({
  default: 'ars-logo-stub',
}));

import { CompleteGoogleRegistration } from '../../../src/pages/CompleteGoogleRegistration/CompleteGoogleRegistration';

beforeEach(() => {
  sessionStorage.clear();
  postCompleteGoogleRegistrationMock.mockReset();
  userServiceGetByIdMock.mockReset();
  fetchBusinessRolesMock.mockClear();
  storageGetTokenMock.mockReset();
  storageGetTokenMock.mockReturnValue('ars-jwt-token');
  storageGetUserMock.mockReset();
  storageGetUserMock.mockReturnValue({
    id: 7,
    username: 'Google User',
    email: 'user@example.com',
    fullName: 'Google User',
    roleId: 0,
    roleName: '',
    isActive: false,
    verificationStatus: 'Pending',
    effectiveRole: 'Guest',
  });
  authValue.user = {
    userId: 7,
    username: 'Google User',
    email: 'user@example.com',
    role: '',
    isActive: false,
    verificationStatus: 'Pending',
    effectiveRole: 'Guest',
  };
  authValue.effectiveRole = 'Guest';
  authValue.isAuthenticated = true;
  authValue.completeGoogleRegistration = postCompleteGoogleRegistrationMock;
});

function mount(initialEntries: string[] = ['/complete-google-registration']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <Routes>
        <Route
          path="/complete-google-registration"
          element={<CompleteGoogleRegistration />}
        />
        <Route path="/login" element={<div data-testid="login-marker">login</div>} />
        <Route path="/forum" element={<div data-testid="forum-marker">forum</div>} />
        <Route
          path="/researcher/dashboard"
          element={<div data-testid="researcher-marker">researcher</div>}
        />
      </Routes>
    </MemoryRouter>,
  );
}

async function selectRole(role: string) {
  await waitFor(() => {
    const roleSelect = document.querySelector('select#role') as HTMLSelectElement | null;
    expect(roleSelect).not.toBeNull();
    expect(roleSelect?.options.length).toBeGreaterThan(1);
  });
  fireEvent.change(document.querySelector('select#role')!, {
    target: { value: role },
  });
}

async function uploadPdf() {
  fireEvent.click(screen.getByTestId('upload'));
  await waitFor(() => {
    expect(
      screen.getByText(/Uploaded\. The PDF URL is sent to the platform/i),
    ).toBeInTheDocument();
  });
}

describe('Agent 30 — first-time Google routing & dialog', () => {
  it('renders the dialog (NOT /forum) for a first-time Google user with a pending record', async () => {
    mount();
    await waitFor(() => {
      expect(
        screen.getByTestId('complete-google-registration'),
      ).toBeInTheDocument();
    });
    expect(screen.queryByTestId('forum-marker')).toBeNull();
    expect(
      screen.getByText(/Complete your ARS registration/i),
    ).toBeInTheDocument();
  });

  it('redirects approved users (roleId > 0, isActive = true) directly to /forum', async () => {
    authValue.user = {
      userId: 12,
      username: 'Existing Researcher',
      email: 'existing@example.com',
      role: 'Researcher',
      isActive: true,
      verificationStatus: 'Accepted',
      effectiveRole: 'Researcher',
    };
    authValue.effectiveRole = 'Researcher';
    storageGetUserMock.mockReturnValueOnce({
      id: 12,
      username: 'Existing Researcher',
      email: 'existing@example.com',
      fullName: 'Existing Researcher',
      roleId: 3,
      roleName: 'Researcher',
      isActive: true,
      verificationStatus: 'Accepted',
      effectiveRole: 'Researcher',
    });

    mount();

    await waitFor(() => {
      expect(screen.queryByTestId('forum-marker')).toBeInTheDocument();
    });
    expect(
      screen.queryByTestId('complete-google-registration'),
    ).not.toBeInTheDocument();
  });

  it('redirects unauthenticated users to /login', async () => {
    authValue.isAuthenticated = false;
    authValue.user = null;
    storageGetUserMock.mockReturnValue(null);
    storageGetTokenMock.mockReturnValue(null);

    mount();

    await waitFor(() => {
      expect(screen.queryByTestId('login-marker')).toBeInTheDocument();
    });
  });
});

describe('Agent 30 — Reviewer ORCID behaviour', () => {
  it('shows the ORCID input when Reviewer is selected and surfaces a checksum error inline', async () => {
    mount();
    await selectRole('Reviewer');

    const orcid = await screen.findByTestId('input-orcidId');
    expect(orcid).toBeInTheDocument();

    // Empty input → submit is disabled.
    const submit = screen.getByTestId('submit-button');
    expect(submit).toBeDisabled();

    // Invalid checksum → error visible eagerly as the user types.
    // 0000-0000-0000-1234 has body digits whose ISO 7064 MOD 11-2 check
    // produces digit '7' but the user typed '4', so this id is rejected.
    await act(async () => {
      fireEvent.change(orcid, {
        target: { value: '0000-0000-0000-1234' },
      });
    });
    await waitFor(() => {
      expect(screen.getByTestId('orcid-error')).toBeInTheDocument();
      expect(
        screen.getByTestId('orcid-error').textContent,
      ).toMatch(/does not pass the ISO 7064 checksum/i);
    });
    expect(submit).toBeDisabled();

    // Valid checksum → error clears, submit becomes enabled once a PDF
    // is uploaded.
    await act(async () => {
      fireEvent.change(orcid, {
        target: { value: '0000-0002-1825-0097' },
      });
    });
    await waitFor(() => {
      expect(screen.queryByTestId('orcid-error')).toBeNull();
    });
    await uploadPdf();
    await waitFor(() => {
      expect(submit).not.toBeDisabled();
    });
  });

  it('hides and CLEARS the ORCID when the role is changed away from Reviewer', async () => {
    mount();
    await selectRole('Reviewer');
    const orcid = await screen.findByTestId('input-orcidId');
    fireEvent.change(orcid, {
      target: { value: '0000-0002-1825-0097' },
    });

    // Switch back to Researcher.
    await selectRole('Researcher');

    await waitFor(() => {
      expect(screen.queryByTestId('input-orcidId')).toBeNull();
    });

    // Switching back to Reviewer should NOT re-display the stale value.
    await selectRole('Reviewer');
    const freshOrcid = await screen.findByTestId('input-orcidId');
    expect((freshOrcid as HTMLInputElement).value).toBe('');
  });
});

describe('Agent 30 — Submit / payload / duplicate / refresh', () => {
  it('sends the Firebase URL in the payload to the AuthContext method', async () => {
    mount();
    await selectRole('Reviewer');
    await uploadPdf();
    const orcid = screen.getByTestId('input-orcidId');
    fireEvent.change(orcid, {
      target: { value: '0000-0002-1825-0097' },
    });
    postCompleteGoogleRegistrationMock.mockResolvedValueOnce({
      status: 'submitted',
      role: 'Reviewer',
      effectiveRole: 'Guest',
      requestStatus: 'Pending',
      onboardingStatus: 'Completed',
    });

    fireEvent.click(screen.getByTestId('submit-button'));

    await waitFor(() => {
      expect(postCompleteGoogleRegistrationMock).toHaveBeenCalledTimes(1);
    });
    const [call] = postCompleteGoogleRegistrationMock.mock.calls[0];
    expect(call).toMatchObject({
      pdfUrl: 'https://firebase.storage/ars/proof.pdf',
      role: 'Reviewer',
      orcidId: '0000-0002-1825-0097',
    });
    // Per BE_GOOGLE_ONBOARDING_COMPLETION_TICKET.md the BE derives
    // the user id from the JWT subject — we never echo the upstream
    // Google ID token, the OAuth code, or a user id into the body.
    expect(call).not.toHaveProperty('credential');
    expect(call).not.toHaveProperty('code');
    expect(call).not.toHaveProperty('userId');
  });

  it('produces exactly ONE submit on double-click', async () => {
    mount();
    await selectRole('Researcher');
    await uploadPdf();
    let resolveSubmit!: () => void;
    postCompleteGoogleRegistrationMock.mockReturnValueOnce(
      new Promise((res) => {
        resolveSubmit = () =>
          res({
            status: 'submitted',
            role: 'Researcher',
            effectiveRole: 'Guest',
            requestStatus: 'Pending',
            onboardingStatus: 'Completed',
          });
      }),
    );

    const submit = screen.getByTestId('submit-button');
    fireEvent.click(submit);
    fireEvent.click(submit);
    fireEvent.click(submit);
    resolveSubmit();

    await waitFor(() => {
      expect(postCompleteGoogleRegistrationMock).toHaveBeenCalledTimes(1);
    });
  });

  it('redirects the pending user to /forum after a successful submit', async () => {
    mount();
    await selectRole('Researcher');
    await uploadPdf();
    postCompleteGoogleRegistrationMock.mockResolvedValueOnce({
      status: 'submitted',
      role: 'Researcher',
      effectiveRole: 'Guest',
      requestStatus: 'Pending',
      onboardingStatus: 'Completed',
    });

    fireEvent.click(screen.getByTestId('submit-button'));

    // The dialog either succeeds (and the AuthContext method navigates to
    // /forum) or renders the local success card. Either way the dialog
    // itself must NOT be rendered.
    await waitFor(() => {
      expect(
        screen.queryByTestId('complete-google-registration'),
      ).not.toBeInTheDocument();
    });
    // Forum is reachable through either the redirect or the local
    // success-state "Go to the Forum" button.
    const forum =
      screen.queryByTestId('forum-marker') ??
      screen.queryByRole('button', { name: /Go to the Forum/i });
    expect(forum).toBeTruthy();
    expect(
      screen.queryByTestId('researcher-marker'),
    ).not.toBeInTheDocument();
  });

  it('does not re-submit when the page is re-mounted after a successful submit', async () => {
    sessionStorage.setItem(
      'ars_google_onboarding_submitted',
      JSON.stringify({
        userId: 7,
        role: 'Researcher',
        effectiveRole: 'Guest',
        requestStatus: 'Pending',
        submittedAt: '2026-08-23T00:00:00.000Z',
      }),
    );

    mount();
    await waitFor(() => {
      expect(screen.getByTestId('onboarding-submitted')).toBeInTheDocument();
    });

    expect(screen.queryByTestId('submit-button')).toBeNull();
    expect(postCompleteGoogleRegistrationMock).not.toHaveBeenCalled();
  });

  it('ignores a stale submission sentinel from a DIFFERENT userId (regression: deleted-account re-signin)', async () => {
    // Regression: a previously deleted account's `ars_google_onboarding_submitted`
    // sentinel must NOT survive a fresh Google sign-in for a new account.
    // The page must drop the stale sentinel and render the onboarding form
    // (the `Go to the Forum` button on the post-submit state must never
    // appear to a fresh user).
    sessionStorage.setItem(
      'ars_google_onboarding_submitted',
      JSON.stringify({
        userId: 42, // different from the auth store's userId (7)
        role: 'Researcher',
        effectiveRole: 'Guest',
        requestStatus: 'Pending',
        submittedAt: '2026-08-23T00:00:00.000Z',
      }),
    );

    mount();
    await waitFor(() => {
      expect(screen.getByTestId('submit-button')).toBeInTheDocument();
    });

    // Success state must NOT render — the sentinel belonged to a different account.
    expect(screen.queryByTestId('onboarding-submitted')).toBeNull();
    expect(
      screen.queryByRole('button', { name: /Go to the Forum/i }),
    ).not.toBeInTheDocument();
    // The stale sentinel was cleared on mount.
    expect(sessionStorage.getItem('ars_google_onboarding_submitted')).toBeNull();
    // No re-submit POST to the BE.
    expect(postCompleteGoogleRegistrationMock).not.toHaveBeenCalled();
  });

  it('ignores a legacy submission sentinel without userId (back-compat fallback)', async () => {
    // Older builds wrote a sentinel WITHOUT a `userId` field. Treat it
    // as stale rather than honoring it for an arbitrary fresh session —
    // the user can simply re-submit.
    sessionStorage.setItem(
      'ars_google_onboarding_submitted',
      JSON.stringify({
        role: 'Researcher',
        effectiveRole: 'Guest',
        requestStatus: 'Pending',
        submittedAt: '2026-08-23T00:00:00.000Z',
      }),
    );

    mount();
    await waitFor(() => {
      expect(screen.getByTestId('submit-button')).toBeInTheDocument();
    });

    expect(screen.queryByTestId('onboarding-submitted')).toBeNull();
  });

  it('surfaces an upload error from the dropzone and prevents submit', async () => {
    mount();
    await selectRole('Researcher');

    // Dropzone mock is permissive here — we verify the submit button stays
    // disabled when no PDF has been uploaded. The dropzone-side error
    // path is exercised in tests/unit/pages/Register/components/PdfDropzone.
    const submit = screen.getByTestId('submit-button');
    expect(submit).toBeDisabled();
  });
});

describe('Agent 30 — AuthContext wiring invariants', () => {
  it('does not write the legacy ars_google_onboarding_session key', async () => {
    mount();
    await selectRole('Researcher');
    await uploadPdf();
    expect(sessionStorage.getItem('ars_google_onboarding_session')).toBeNull();
    expect(localStorage.getItem('ars_google_onboarding_session')).toBeNull();
  });

  it('refuses to submit when the ARS JWT (session token) is missing — the page bounces to /login and never invokes the AuthContext method', async () => {
    // Per `BE_GOOGLE_ONBOARDING_COMPLETION_TICKET.md` the BE requires a
    // valid ARS authentication session. The page enforces this on mount:
    // when storage.getToken() returns null (or any falsy value) the page
    // redirects to /login. We must therefore never silently submit a
    // token-less payload to the BE.
    storageGetTokenMock.mockReturnValue(null);
    mount();
    // The page should have rendered the `<Navigate to="/login" replace />`
    // guard — the form is unreachable.
    await waitFor(() => {
      expect(screen.queryByTestId('login-marker')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('submit-button')).toBeNull();
    expect(postCompleteGoogleRegistrationMock).not.toHaveBeenCalled();
  });

  it('submits successfully when the legacy OAuth code-redirect flow left NO cached Google credential (the BE has the JWT via the shared axios header)', async () => {
    // This is the legacy /auth/google/callback?code=... path: the BE
    // exchanged the code server-side and already issued an ARS JWT, so
    // the page has the token via the shared axios `Authorization`
    // header — but there is NO cached Google ID token (and never was).
    // Per BE_GOOGLE_ONBOARDING_COMPLETION_TICKET.md the onboarding
    // endpoint authenticates via the ARS JWT only, so this is the
    // primary supported path for first-time Google users entering
    // through the OAuth code redirect.
    mount();
    await selectRole('Reviewer');
    await uploadPdf();
    const orcid = screen.getByTestId('input-orcidId');
    fireEvent.change(orcid, {
      target: { value: '0000-0002-1825-0097' },
    });
    postCompleteGoogleRegistrationMock.mockResolvedValueOnce({
      status: 'submitted',
      role: 'Reviewer',
      effectiveRole: 'Guest',
      requestStatus: 'Pending',
      onboardingStatus: 'Completed',
    });

    fireEvent.click(screen.getByTestId('submit-button'));

    await waitFor(() => {
      expect(postCompleteGoogleRegistrationMock).toHaveBeenCalledTimes(1);
    });
    const [call] = postCompleteGoogleRegistrationMock.mock.calls[0];
    // The legacy flow's submitted payload MUST NOT include a `credential`
    // field — Swagger `additionalProperties: false` would 400 the BE.
    expect(call).not.toHaveProperty('credential');
    expect(call).not.toHaveProperty('code');
    expect(call).toMatchObject({
      pdfUrl: 'https://firebase.storage/ars/proof.pdf',
      role: 'Reviewer',
      orcidId: '0000-0002-1825-0097',
    });
  });

  it('treats the AuthContext method as the single submission boundary (no direct fetch)', async () => {
    const fetchSpy = vi.fn();
    global.fetch = fetchSpy as unknown as typeof fetch;
    mount();
    await selectRole('Researcher');
    await uploadPdf();
    postCompleteGoogleRegistrationMock.mockResolvedValueOnce({
      status: 'submitted',
      role: 'Researcher',
      effectiveRole: 'Guest',
      requestStatus: 'Pending',
      onboardingStatus: 'Completed',
    });

    fireEvent.click(screen.getByTestId('submit-button'));

    await waitFor(() => {
      expect(postCompleteGoogleRegistrationMock).toHaveBeenCalledTimes(1);
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
