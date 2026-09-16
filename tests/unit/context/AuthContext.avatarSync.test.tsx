/**
 * Regression tests for AuthContext avatar sync (BTR-AVATAR-SYNC-01).
 *
 * Pins the fix that ensures `avatarUrl` flows from the BE → Zustand
 * auth store → MainLayout header dropdown.
 *
 * History: the Profile page correctly displayed the user's chosen
 * avatar because it reads from the legacy `ars_user` storage blob
 * (which Profile.handleAvatarSave writes via storage.setUser). But
 * the header dropdown in MainLayout reads `user?.avatarUrl` from the
 * Zustand `useAuthStore`, and Zustand's persisted blob was missing
 * the `avatarUrl` field for two reasons:
 *
 *   1. `AuthContext.persistAuthAndNavigate` (the login path) built the
 *      `user` object passed to `authStore.login()` from
 *      `freshUser` / `response` fields — but never copied
 *      `avatarUrl` from either source. The login-time persisted
 *      Zustand blob therefore had no `avatarUrl` to begin with.
 *
 *   2. `AuthContext.syncUserFromBE` (the boot-time `GET /api/user/{id}`
 *      rehydration path) called `authStore.updateUser()` with only
 *      four fields: `isActive`, `verificationStatus`, `accountTier`,
 *      `effectiveRole`. `avatarUrl` was never forwarded, so even on a
 *      page reload the avatarUrl would be stripped from the in-memory
 *      store.
 *
 * Symptom: user saves an avatar in the Profile picker → Profile page
 * shows the photo correctly (reads from `ars_user`) → but the header
 * dropdown shows the initials fallback forever (reads from
 * `useAuthStore.user.avatarUrl` which is `undefined`).
 *
 * These tests assert the login path forwards `avatarUrl` into
 * `authStore.login()`. The boot-time `syncUserFromBE` path is harder
 * to test in isolation because it is gated on a real authenticated
 * Zustand store satisfying the `isApprovedActive` predicate; that
 * path is covered by an end-to-end browser smoke in
 * `tests/e2e/avatar-sync.spec.ts` (not in this unit suite).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, act, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

// ─────────────────────────────────────────────────────────────────────────────
// Hoisted mocks
// ─────────────────────────────────────────────────────────────────────────────

const { authStoreLoginMock, clearAuthSessionMock, welcomeSignalShowMock,
  userServiceGetByIdMock, authServiceLoginMock } = vi.hoisted(() => ({
  authStoreLoginMock: vi.fn(),
  clearAuthSessionMock: vi.fn(),
  welcomeSignalShowMock: vi.fn(),
  userServiceGetByIdMock: vi.fn(),
  authServiceLoginMock: vi.fn(),
}));

vi.mock('../../../src/services/axios', () => ({
  default: {
    post: vi.fn(),
    get: vi.fn(),
    defaults: { headers: { common: {} } },
  },
}));

vi.mock('../../../src/services/user.service', () => ({
  userService: {
    getById: (...args: unknown[]) =>
      userServiceGetByIdMock(...args) as Promise<unknown>,
  },
}));

vi.mock('../../../src/utils/storage', () => ({
  storage: {
    setToken: vi.fn(),
    setUser: vi.fn(),
    setRememberMe: vi.fn(),
    getToken: vi.fn(),
    getUser: vi.fn(),
    getRememberMe: vi.fn().mockReturnValue(false),
  },
  default: { setToken: vi.fn(), setUser: vi.fn() },
}));

vi.mock('../../../src/services/auth.service', () => ({
  authService: {
    login: (...args: unknown[]) => authServiceLoginMock(...args),
    logout: vi.fn(),
  },
  clearAuthSession: (...args: unknown[]) => clearAuthSessionMock(...args),
  default: {
    login: (...args: unknown[]) => authServiceLoginMock(...args),
    logout: vi.fn(),
  },
}));

vi.mock('../../../src/store', () => ({
  useAuthStore: Object.assign(
    () => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      effectiveRole: null,
      login: (...args: unknown[]) => authStoreLoginMock(...args),
      logout: vi.fn(),
      setLoading: vi.fn(),
      updateUser: vi.fn(),
      setEffectiveRole: vi.fn(),
    }),
    {
      getState: () => ({
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
        effectiveRole: null,
        login: (...args: unknown[]) => authStoreLoginMock(...args),
        logout: vi.fn(),
        setLoading: vi.fn(),
        updateUser: vi.fn(),
        setEffectiveRole: vi.fn(),
      }),
    },
  ),
}));

vi.mock('../../../src/store/welcomeSignal', () => ({
  useWelcomeSignal: {
    getState: () => ({
      show: (...args: unknown[]) => welcomeSignalShowMock(...args),
      reset: vi.fn(),
    }),
  },
}));

import { AuthProvider, useAuth } from '../../../src/context/AuthContext';

// ─────────────────────────────────────────────────────────────────────────────
// Test fixture / helpers
// ─────────────────────────────────────────────────────────────────────────────

const AVATAR_URL =
  'https://firebasestorage.googleapis.com/v0/b/ars-platform.firebasestorage.app/o/avatars%2F24%2Favatar.jpg?alt=media&token=abc';

/** A fake "fresh" user record the BE returns from GET /api/user/{id}. */
function makeFreshUser(overrides: Partial<{ avatarUrl: string | null }> = {}) {
  return {
    id: 24,
    username: 'Dr. Emily Lecturer',
    email: 'lecturer@arsplatform.com',
    fullName: 'Dr. Emily Lecturer',
    avatarUrl: AVATAR_URL,
    roleId: 4,
    roleName: 'Lecturer',
    roles: ['Lecturer'],
    isActive: true,
    isEmailVerified: true,
    verificationStatus: 'Accepted',
    accountTier: 'Free',
    ...overrides,
  };
}

interface CaptureHandle {
  login: ReturnType<typeof useAuth>['login'];
}

function Probe({ onReady }: { onReady: (api: CaptureHandle) => void }) {
  const api = useAuth();
  onReady(api);
  return null;
}

function mountAuthContext(initialPath = '/forum') {
  let handle: CaptureHandle | null = null;
  const onReady = (api: CaptureHandle) => {
    handle = api;
  };
  const view = render(
    <MemoryRouter initialEntries={[initialPath]}>
      <AuthProvider>
        <Routes>
          <Route
            path="/login"
            element={
              <>
                <Probe onReady={onReady} />
                <div data-testid="login-marker">login</div>
              </>
            }
          />
          <Route path="*" element={<Probe onReady={onReady} />} />
        </Routes>
        <Routes>
          <Route path="/login" element={<div data-testid="login-marker">login</div>} />
          <Route path="/forum" element={<div data-testid="forum-marker">forum</div>} />
          <Route path="/home" element={<div data-testid="home-marker">home</div>} />
          <Route path="*" element={<div data-testid="unknown-marker">unknown</div>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
  return { view, getHandle: () => handle as unknown as CaptureHandle };
}

beforeEach(() => {
  authStoreLoginMock.mockReset();
  authServiceLoginMock.mockReset();
  clearAuthSessionMock.mockReset();
  clearAuthSessionMock.mockResolvedValue(undefined);
  welcomeSignalShowMock.mockReset();
  userServiceGetByIdMock.mockReset();
  // Default: the fresh GET returns the BE's authoritative record.
  userServiceGetByIdMock.mockResolvedValue(makeFreshUser());
  // Default: login returns the BE-shaped AuthResponse payload.
  authServiceLoginMock.mockResolvedValue({
    token: 'jwt-token',
    username: 'Dr. Emily Lecturer',
    email: 'lecturer@arsplatform.com',
    avatarUrl: undefined,
    role: 'Lecturer',
    userId: 24,
    roleId: 4,
    roles: ['Lecturer'],
    isActive: true,
    verificationStatus: 'Accepted',
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('AuthContext.avatarUrl forwarding — BTR-AVATAR-SYNC-01', () => {
  it('forwards avatarUrl from the fresh GET /api/user/{id} into authStore.login()', async () => {
    userServiceGetByIdMock.mockResolvedValue(makeFreshUser({ avatarUrl: AVATAR_URL }));

    const { getHandle } = mountAuthContext();
    await waitFor(() => getHandle().login);

    await act(async () => {
      await getHandle().login({
        email: 'lecturer@arsplatform.com',
        password: 'pw',
      });
    });

    expect(authStoreLoginMock).toHaveBeenCalled();
    const passedUser = authStoreLoginMock.mock.calls[0][0] as Record<string, unknown>;
    expect(passedUser.avatarUrl).toBe(AVATAR_URL);
    // Sanity: the other login-time fields are still present so the fix
    // didn't accidentally strip identity fields.
    expect(passedUser.id).toBe(24);
    expect(passedUser.roleName).toBe('Lecturer');
  });

  it('uses null for avatarUrl when neither the login response nor the fresh GET supplies one', async () => {
    userServiceGetByIdMock.mockResolvedValue(makeFreshUser({ avatarUrl: null }));

    const { getHandle } = mountAuthContext();
    await waitFor(() => getHandle().login);

    await act(async () => {
      await getHandle().login({
        email: 'lecturer@arsplatform.com',
        password: 'pw',
      });
    });

    expect(authStoreLoginMock).toHaveBeenCalled();
    const passedUser = authStoreLoginMock.mock.calls[0][0] as Record<string, unknown>;
    // `null` (NOT `undefined`) is the canonical "no avatar" value —
    // AvatarVisual's `url && <img>` check treats both as "fallback to
    // initials" but `null` matches the BE contract and the existing
    // User type signature.
    expect(passedUser.avatarUrl).toBeNull();
  });
});
