/**
 * Tests for Agent 54 — GoogleCallback.tsx (BE OAuth callback landing).
 *
 * Critical contracts pinned here:
 *   - The page consumes `?code=...` ONCE per mount (`processedRef`
 *     guard). Re-renders (e.g. StrictMode) do not re-persist the
 *     session nor re-navigate to a duplicate route.
 *   - The page persists the session via the existing ARS auth-storage
 *     path (storage + authStore) — same surface the password login uses.
 *   - Routing outcomes:
 *       isNewUser / requiresOnboarding → /complete-google-registration
 *       Pending                       → /forum
 *       Rejected                      → /forum (existing rejection path)
 *       Accepted + active + role      → workspace landing route
 *       Missing fields / no token     → /login (incomplete state UI)
 *       ?error=...                    → /login (cancellation UI)
 *   - The `code` query string is replaced from history after navigation
 *     (`replace: true`) so refreshing the page does not replay the code.
 *   - The page is null-safe for guests: the "Back to sign in" CTA
 *     calls `authService.logout()` which is a no-op when there is no
 *     session, and the persistence paths skip writing when the payload
 *     is incomplete.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

const setAuthDataMock = vi.fn();
const authLogoutMock = vi.fn();
const storageSetTokenMock = vi.fn();
const storageSetUserMock = vi.fn();
const storageSetRememberMeMock = vi.fn();
const authStoreLoginMock = vi.fn();
const authStoreLogoutMock = vi.fn();

vi.mock('../../../src/services/axios', () => ({
  default: {
    post: vi.fn(),
    get: vi.fn(),
    defaults: { headers: { common: {} } },
  },
}));

vi.mock('../../../src/services/auth.service', () => ({
  authService: {
    setAuthData: (...args: unknown[]) => setAuthDataMock(...args),
    logout: (...args: unknown[]) => authLogoutMock(...args),
  },
}));

vi.mock('../../../src/store', () => ({
  useAuthStore: Object.assign(
    () => ({
      login: (...args: unknown[]) => authStoreLoginMock(...args),
      logout: (...args: unknown[]) => authStoreLogoutMock(...args),
      user: null,
      token: null,
      isAuthenticated: false,
      effectiveRole: null,
    }),
    {
      getState: () => ({
        login: (...args: unknown[]) => authStoreLoginMock(...args),
        logout: (...args: unknown[]) => authStoreLogoutMock(...args),
        user: null,
        token: null,
        isAuthenticated: false,
        effectiveRole: null,
      }),
    },
  ),
}));

vi.mock('../../../src/utils/storage', () => ({
  storage: {
    setToken: (...args: unknown[]) => storageSetTokenMock(...args),
    setUser: (...args: unknown[]) => storageSetUserMock(...args),
    setRememberMe: (...args: unknown[]) => storageSetRememberMeMock(...args),
  },
}));

vi.mock('../../../src/store/welcomeSignal', () => ({
  useWelcomeSignal: {
    getState: () => ({ show: vi.fn(), reset: vi.fn() }),
  },
}));

vi.mock('../../../src/components/Button', () => ({
  Button: ({
    children,
    onClick,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
  }) => (
    <button type="button" onClick={onClick} data-testid="back-button">
      {children}
    </button>
  ),
}));

import GoogleCallback from '../../../src/pages/GoogleCallback/GoogleCallback';

function setWindowSearch(search: string) {
  Object.defineProperty(window, 'location', {
    configurable: true,
    writable: true,
    value: {
      ...window.location,
      search,
    },
  });
}

beforeEach(() => {
  setAuthDataMock.mockReset();
  authLogoutMock.mockReset();
  storageSetTokenMock.mockReset();
  storageSetUserMock.mockReset();
  storageSetRememberMeMock.mockReset();
  authStoreLoginMock.mockReset();
  authStoreLogoutMock.mockReset();
  sessionStorage.clear();
  localStorage.clear();
});

function mountAt(search: string) {
  setWindowSearch(search);
  return render(
    <MemoryRouter initialEntries={[`/auth/google/callback${search}`]}>
      <Routes>
        <Route
          path="/auth/google/callback"
          element={<GoogleCallback />}
        />
        <Route
          path="/complete-google-registration"
          element={<div data-testid="onboarding-marker">onboarding</div>}
        />
        <Route path="/forum" element={<div data-testid="forum-marker">forum</div>} />
        <Route path="/login" element={<div data-testid="login-marker">login</div>} />
        <Route path="/researcher/papers" element={<div data-testid="researcher-marker">researcher</div>} />
        <Route path="/reviewer/desk" element={<div data-testid="reviewer-marker">reviewer</div>} />
        <Route path="/lecturer/seminars" element={<div data-testid="lecturer-marker">lecturer</div>} />
        <Route path="/admin" element={<div data-testid="admin-marker">admin</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('GoogleCallback — first-time / onboarding routing (Agent 30 follow-up exact AND-clause)', () => {
  it('routes a first-time user (isNewUser=true AND requiresOnboarding=true) to /complete-google-registration', async () => {
    // Per the Agent 30 follow-up correction: the exact AND-clause is
    // isNewUser===true AND requiresOnboarding===true AND
    // effectiveRole===null AND approved roles empty. A bare isNewUser
    // signal is not enough — both explicit signals must be true.
    mountAt(
      '?token=jwt-1&userId=42&email=u@e.com&fullName=New&isNewUser=true&requiresOnboarding=true&isActive=false&verificationStatus=Pending',
    );

    await waitFor(() => {
      expect(screen.queryByTestId('onboarding-marker')).toBeInTheDocument();
    });
    expect(storageSetTokenMock).toHaveBeenCalledWith('jwt-1');
    expect(storageSetUserMock).toHaveBeenCalled();
    expect(authStoreLoginMock).toHaveBeenCalled();
  });

  it('routes a requiresOnboarding=true user with isNewUser=true (the explicit AND-clause) to /complete-google-registration', async () => {
    mountAt(
      '?token=jwt-1&userId=42&email=u@e.com&fullName=New&isNewUser=true&requiresOnboarding=true',
    );

    await waitFor(() => {
      expect(screen.queryByTestId('onboarding-marker')).toBeInTheDocument();
    });
  });

  it('persists a first-time session without fabricating roleId / roleName', async () => {
    mountAt(
      '?token=jwt-1&userId=99&email=new@example.com&fullName=New&isNewUser=true&requiresOnboarding=true',
    );

    await waitFor(() => {
      expect(screen.queryByTestId('onboarding-marker')).toBeInTheDocument();
    });

    const persistedUser = storageSetUserMock.mock.calls[0][0];
    expect(persistedUser.id).toBe(99);
    expect(persistedUser.email).toBe('new@example.com');
    expect(persistedUser.fullName).toBe('New');
    expect(persistedUser.roleId).toBeNull();
    expect(persistedUser.roleName).toBeNull();
  });

  it('does NOT route to onboarding on a bare isNewUser=true with a non-null role (legacy OR-semantics retired)', async () => {
    // A bare `isNewUser=true` without `requiresOnboarding=true` is no
    // longer enough to drive the onboarding branch. The snapshot with
    // a non-null role lands on /forum as a Guest (priority-3 branch
    // fires because isActive=false / verificationStatus=Pending).
    mountAt(
      '?token=jwt-1&userId=42&email=u@e.com&fullName=New&role=Researcher&roleId=1&isNewUser=true&isActive=false&verificationStatus=Pending',
    );

    await waitFor(() => {
      expect(screen.queryByTestId('forum-marker')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('onboarding-marker')).toBeNull();
  });
});

describe('GoogleCallback — existing-user routing', () => {
  it('routes an Approved + Active Admin user to /admin (via landingRouteForRoleName override)', async () => {
    mountAt(
      '?token=jwt-1&userId=42&email=admin@e.com&fullName=Admin&role=Admin&roleId=2&roles=Admin&isActive=true&verificationStatus=Accepted',
    );

    await waitFor(() => {
      expect(screen.queryByTestId('admin-marker')).toBeInTheDocument();
    });
    expect(setAuthDataMock).toHaveBeenCalledTimes(1);
  });

  it('routes an Approved + Active non-admin user to /forum (per landingRouteForRoleName policy)', async () => {
    mountAt(
      '?token=jwt-1&userId=42&email=u@e.com&fullName=User&role=Researcher&roleId=1&roles=Researcher&isActive=true&verificationStatus=Accepted',
    );

    await waitFor(() => {
      // Per `landingRouteForRoleName` policy the post-login landing for
      // non-Admin roles is `/forum`, NOT a per-role workspace — the
      // per-role workspace is selected later by the user via the role
      // selector. The callback MUST respect this policy; we verify
      // `/forum` is the landing page.
      expect(screen.queryByTestId('forum-marker')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('researcher-marker')).toBeNull();
    expect(setAuthDataMock).toHaveBeenCalledTimes(1);
  });

  it('routes a Pending user to /forum', async () => {
    mountAt(
      '?token=jwt-1&userId=42&email=u@e.com&fullName=User&role=Researcher&isActive=false&verificationStatus=Pending',
    );

    await waitFor(() => {
      expect(screen.queryByTestId('forum-marker')).toBeInTheDocument();
    });
  });

  it('routes a Rejected user to /forum (existing rejection path)', async () => {
    mountAt(
      '?token=jwt-1&userId=42&email=u@e.com&fullName=User&role=Researcher&isActive=false&verificationStatus=Rejected',
    );

    await waitFor(() => {
      expect(screen.queryByTestId('forum-marker')).toBeInTheDocument();
    });
  });
});

describe('GoogleCallback — error / incomplete paths', () => {
  it('renders the cancellation UI on ?error=access_denied (does NOT navigate to /login automatically)', async () => {
    mountAt('?error=access_denied&error_reason=user_denied');

    await waitFor(() => {
      expect(screen.queryByTestId('google-callback-status')).toBeInTheDocument();
    });
    const status = screen.getByTestId('google-callback-status');
    expect(status.getAttribute('data-status')).toBe('error');

    // The user remains on the callback page until they click "Back".
    expect(screen.queryByTestId('login-marker')).toBeNull();
    expect(screen.queryByTestId('forum-marker')).toBeNull();
  });

  it('renders the incomplete UI when the BE returns no session fields', async () => {
    // Real-life case: BE redirected here but the query string carried
    // only `?error=server_error` and no token / userId. The page must
    // not fabricate a session — it surfaces "incomplete" instead.
    mountAt('?error=server_error');

    await waitFor(() => {
      expect(screen.queryByTestId('google-callback-status')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('google-callback-status').getAttribute('data-status')).toBe('error');
  });

  it('the "Back to sign in" CTA clears the session null-safely and navigates to /login', async () => {
    mountAt('?error=access_denied');

    await waitFor(() => {
      expect(screen.queryByTestId('google-callback-status')).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('back-button'));
    });

    await waitFor(() => {
      expect(screen.queryByTestId('login-marker')).toBeInTheDocument();
    });
    expect(authLogoutMock).toHaveBeenCalledTimes(1);
  });

  it('does NOT persist a session when the payload is incomplete (no token)', async () => {
    mountAt('?userId=42&email=u@e.com&fullName=User');

    await waitFor(() => {
      expect(screen.queryByTestId('google-callback-status')).toBeInTheDocument();
    });

    // The page must refuse to write a half-session.
    expect(storageSetTokenMock).not.toHaveBeenCalled();
    expect(setAuthDataMock).not.toHaveBeenCalled();
    expect(authStoreLoginMock).not.toHaveBeenCalled();
  });

  it('does NOT persist a session when the userId is missing or zero', async () => {
    mountAt('?token=jwt-1&userId=0&email=u@e.com&fullName=User');

    await waitFor(() => {
      expect(screen.queryByTestId('google-callback-status')).toBeInTheDocument();
    });

    expect(storageSetTokenMock).not.toHaveBeenCalled();
    expect(setAuthDataMock).not.toHaveBeenCalled();
  });

  it('does NOT persist a session when email is missing', async () => {
    mountAt('?token=jwt-1&userId=42&fullName=User');

    await waitFor(() => {
      expect(screen.queryByTestId('google-callback-status')).toBeInTheDocument();
    });

    expect(storageSetTokenMock).not.toHaveBeenCalled();
  });
});

describe('GoogleCallback — duplicate callback processing guard', () => {
  it('processes the query string ONCE per mount (does not re-persist on re-render)', async () => {
    mountAt(
      '?token=jwt-1&userId=42&email=admin@e.com&fullName=Admin&role=Admin&roleId=2&roles=Admin&isActive=true&verificationStatus=Accepted',
    );

    await waitFor(() => {
      expect(screen.queryByTestId('admin-marker')).toBeInTheDocument();
    });

    // Re-renders / StrictMode re-mounts must not re-persist the session.
    // The session is persisted via `authService.setAuthData(...)` which
    // is what the rest of the FE uses too — count its invocations.
    const initialSetAuthCalls = setAuthDataMock.mock.calls.length;
    const initialStoreLoginCalls = authStoreLoginMock.mock.calls.length;
    expect(initialSetAuthCalls).toBe(1);
    expect(initialStoreLoginCalls).toBe(1);

    // No second mount should re-issue the writes (a few ms later).
    await new Promise<void>((r) => setTimeout(r, 30));
    expect(setAuthDataMock.mock.calls.length).toBe(initialSetAuthCalls);
    expect(authStoreLoginMock.mock.calls.length).toBe(initialStoreLoginCalls);
  });
});

describe('GoogleCallback — unified routing rule', () => {
  // Mirrors the routing rule applied in AuthContext.loginWithGoogle so
  // both Google entry paths (credential-flow and OAuth code-redirect-flow)
  // converge on the same destination for the same BE shape.
  it('routes a role-null + roleId-null response (no legacy signal) to /complete-google-registration', async () => {
    // BE omitted isNewUser/requiresOnboarding AND omitted role/roleId —
    // the documented fallback path (BTR-AGENT52-01) routes to onboarding.
    mountAt(
      '?token=jwt-1&userId=42&email=rn@e.com&fullName=No Role&isActive=false&verificationStatus=Pending',
    );

    await waitFor(() => {
      expect(screen.queryByTestId('onboarding-marker')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('forum-marker')).toBeNull();
    expect(setAuthDataMock).not.toHaveBeenCalled();
  });

  it('routes a non-null role + Pending verificationStatus to /forum (Guest)', async () => {
    mountAt(
      '?token=jwt-1&userId=42&email=p@e.com&fullName=Pending&role=Researcher&roleId=1&roles=Researcher&isActive=false&verificationStatus=Pending',
    );

    await waitFor(() => {
      expect(screen.queryByTestId('forum-marker')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('onboarding-marker')).toBeNull();
    expect(setAuthDataMock).toHaveBeenCalledTimes(1);
  });

  it('routes a non-null role + Accepted + active + non-Admin user to /forum (workspace landing)', async () => {
    // Existing approved Researcher — landingRouteForRoleName returns
    // /forum for non-Admin roles.
    mountAt(
      '?token=jwt-1&userId=42&email=a@e.com&fullName=Approved&role=Researcher&roleId=1&roles=Researcher&isActive=true&verificationStatus=Accepted',
    );

    await waitFor(() => {
      expect(screen.queryByTestId('forum-marker')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('onboarding-marker')).toBeNull();
  });

  it('routes a non-null role + Accepted + active + Admin user to /admin (workspace landing)', async () => {
    mountAt(
      '?token=jwt-1&userId=42&email=ad@e.com&fullName=Admin&role=Admin&roleId=2&roles=Admin&isActive=true&verificationStatus=Accepted',
    );

    await waitFor(() => {
      expect(screen.queryByTestId('admin-marker')).toBeInTheDocument();
    });
  });

  it('does not regress: bare isNewUser=true with non-null role routes to /forum (legacy OR-semantics retired)', async () => {
    // Per the Agent 30 follow-up correction: a bare isNewUser=true
    // without requiresOnboarding=true is no longer enough to drive the
    // onboarding branch. The snapshot with a non-null role lands on
    // /forum as a Guest instead.
    mountAt(
      '?token=jwt-1&userId=42&email=w@e.com&fullName=Weird&role=Researcher&roleId=1&isNewUser=true&isActive=false&verificationStatus=Pending',
    );

    await waitFor(() => {
      expect(screen.queryByTestId('forum-marker')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('onboarding-marker')).toBeNull();
  });

  it('routes to onboarding when isNewUser=true AND requiresOnboarding=true with a non-null role (the explicit AND-clause wins)', async () => {
    // Per the Agent 30 follow-up correction: when the BE surfaces both
    // explicit onboarding signals as `true` (and the approved role
    // list is empty) the AND-clause routes to onboarding — the
    // strongest positive signal we honour. Without requiresOnboarding
    // the legacy OR-logic would have routed to onboarding; with the
    // new spec the explicit AND-clause is required.
    mountAt(
      '?token=jwt-1&userId=42&email=w@e.com&fullName=Explicit&role=Researcher&roleId=1&isNewUser=true&requiresOnboarding=true&isActive=false&verificationStatus=Pending',
    );

    await waitFor(() => {
      expect(screen.queryByTestId('onboarding-marker')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('forum-marker')).toBeNull();
  });
});

describe('GoogleCallback — Agent 30 (regression) verificationStatus null is preserved through storage AND authStore', () => {
  // The screenshot payload for duyphuong2000.dpp@gmail.com surfaces
  // verificationStatus=null. Earlier the GoogleCallback persisted
  // `?? null` to storage but `?? 'Pending'` to the auth store; the
  // mismatch let `null` leak back out of the auth store for an instant
  // and falsely re-classified the user as "pending Admin" via
  // useVerifiedGuard / usePermissions. Both writes must now agree.
  function mountScreenshotState() {
    mountAt(
      '?token=jwt-screenshot&userId=17&email=duyphuong2000.dpp@gmail.com&fullName=Duy%20Phuong&isNewUser=true&requiresOnboarding=true&isActive=false',
    );
  }

  it('persists verificationStatus=null to storage (NOT coerced to "Pending")', async () => {
    mountScreenshotState();

    await waitFor(() => {
      expect(screen.queryByTestId('onboarding-marker')).toBeInTheDocument();
    });

    expect(storageSetUserMock).toHaveBeenCalledTimes(1);
    const persistedUser = storageSetUserMock.mock.calls[0][0];
    expect(persistedUser.verificationStatus).toBeNull();
  });

  it('persists verificationStatus=null to authStore.login() (NOT coerced to "Pending")', async () => {
    mountScreenshotState();

    await waitFor(() => {
      expect(screen.queryByTestId('onboarding-marker')).toBeInTheDocument();
    });

    expect(authStoreLoginMock).toHaveBeenCalledTimes(1);
    const loginPayload = authStoreLoginMock.mock.calls[0][0];
    expect(loginPayload.verificationStatus).toBeNull();
  });

  it('storage and authStore.verificationStatus agree (no Pending-fallback drift)', async () => {
    mountScreenshotState();

    await waitFor(() => {
      expect(screen.queryByTestId('onboarding-marker')).toBeInTheDocument();
    });

    expect(storageSetUserMock).toHaveBeenCalledTimes(1);
    expect(authStoreLoginMock).toHaveBeenCalledTimes(1);
    const persistedUser = storageSetUserMock.mock.calls[0][0];
    const loginPayload = authStoreLoginMock.mock.calls[0][0];
    expect(loginPayload.verificationStatus).toBe(persistedUser.verificationStatus);
    expect(loginPayload.verificationStatus).toBeNull();
  });
});