/**
 * Vital tests for Agent 53 — Centralized ARS Session Cleanup.
 *
 * Covers the Guest null-field logout root cause, the centralized
 * `clearAuthSession()` routine, Axios header clearing, defensive Google
 * Identity auto-select toggle, and backend logout failure isolation.
 *
 * The tests intentionally exercise `clearAuthSession()` directly (the
 * exported function) so they do not depend on the React tree, the
 * Zustand persist adapter, or the route history. AuthContext-level
 * assertions live in their own hook test that wires the provider.
 *
 * No network calls — axios is mocked at the module boundary.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// vi.mock factories are hoisted to the top of the file. Any shared
// mutable state we want the factories to close over MUST be declared
// inside `vi.hoisted(...)` so the values exist at hoist time.
const { postMock, localStore, sessionStore, storageShim } = vi.hoisted(() => {
  const localStore: Record<string, string> = {};
  const sessionStore: Record<string, string> = {};
  const postMock = vi.fn();

  const storageShim = {
    getToken: vi.fn(
      () => localStore['ars_token'] ?? sessionStore['ars_token'] ?? null,
    ),
    setToken: vi.fn((t: string) => {
      if (localStore['ars_remember'] === 'true') localStore['ars_token'] = t;
      else sessionStore['ars_token'] = t;
    }),
    getUser: vi.fn(() => {
      const raw = localStore['ars_user'] ?? sessionStore['ars_user'];
      return raw ? JSON.parse(raw) : null;
    }),
    setUser: vi.fn((u: unknown) => {
      const serialized = JSON.stringify(u);
      if (localStore['ars_remember'] === 'true') localStore['ars_user'] = serialized;
      else sessionStore['ars_user'] = serialized;
    }),
    clearAuth: vi.fn(() => {
      delete localStore['ars_token'];
      delete localStore['ars_user'];
      delete localStore['ars_remember'];
      delete sessionStore['ars_token'];
      delete sessionStore['ars_user'];
    }),
    getRememberMe: vi.fn(() => localStore['ars_remember'] === 'true'),
    setRememberMe: vi.fn((r: boolean) => {
      if (r) localStore['ars_remember'] = 'true';
      else delete localStore['ars_remember'];
    }),
    removeToken: vi.fn(() => {
      delete localStore['ars_token'];
      delete sessionStore['ars_token'];
    }),
    removeUser: vi.fn(() => {
      delete localStore['ars_user'];
      delete sessionStore['ars_user'];
    }),
    removeRememberMe: vi.fn(() => {
      delete localStore['ars_remember'];
    }),
  };

  return { postMock, localStore, sessionStore, storageShim };
});

vi.mock('../../../src/services/axios', () => ({
  default: {
    post: (...args: unknown[]) => postMock(...args),
    defaults: { headers: { common: {} as Record<string, unknown> } },
  },
}));

vi.mock('../../../src/utils/storage', () => ({ storage: storageShim }));

// Seed JSDOM storage with the shim contents so removeItem actually fires.
Object.defineProperty(global, 'localStorage', {
  value: {
    getItem: vi.fn((k: string) => localStore[k] ?? null),
    setItem: vi.fn((k: string, v: string) => {
      localStore[k] = v;
    }),
    removeItem: vi.fn((k: string) => {
      delete localStore[k];
    }),
    clear: vi.fn(() => {
      for (const k of Object.keys(localStore)) delete localStore[k];
    }),
  },
  writable: true,
  configurable: true,
});
Object.defineProperty(global, 'sessionStorage', {
  value: {
    getItem: vi.fn((k: string) => sessionStore[k] ?? null),
    setItem: vi.fn((k: string, v: string) => {
      sessionStore[k] = v;
    }),
    removeItem: vi.fn((k: string) => {
      delete sessionStore[k];
    }),
    clear: vi.fn(() => {
      for (const k of Object.keys(sessionStore)) delete sessionStore[k];
    }),
  },
  writable: true,
  configurable: true,
});

// ── Imports after mocks ────────────────────────────────────────────────────
import { clearAuthSession, authService } from '../../../src/services/auth.service';
import { STORAGE_KEYS } from '../../../src/utils/constants';

// ── Helpers ────────────────────────────────────────────────────────────────
const seedAuthState = (
  overrides: { withToken?: boolean; remember?: boolean } = {},
) => {
  if (overrides.remember) localStore[STORAGE_KEYS.REMEMBER_ME] = 'true';
  if (overrides.withToken) {
    localStore[STORAGE_KEYS.TOKEN] = 'bearer.abc.def';
  } else {
    sessionStore[STORAGE_KEYS.TOKEN] = 'bearer.abc.def';
  }
  sessionStore[STORAGE_KEYS.USER] = JSON.stringify({
    id: 0,
    username: 'guest.user',
    email: 'guest@example.com',
    fullName: 'Guest User',
    // Agent 53 — Guest may validly have null role fields. The original
    // logout path crashed on `user.id === 0` because the BE returns 0
    // for "no role". The new cleanup tolerates this and proceeds.
    roleId: null,
    roleName: null,
    isActive: false,
    verificationStatus: 'Pending',
    accountTier: 'Free',
    effectiveRole: 'Guest',
    userRole: null,
    professionalProfile: null,
  });
  // Some additional auth artefacts Agent 53 must remove.
  sessionStore['ars-active-role'] = 'Researcher';
  localStore['ars_active_role'] = 'Admin';
  sessionStore['ars-auth-storage'] = '{"state":{"user":null}}';
  // Agent 52 — real Google onboarding session key (token-bearing). Mirrors
  // `SESSION_KEY` in `src/pages/CompleteGoogleRegistration/CompleteGoogleRegistration.tsx`.
  sessionStore['ars_google_onboarding_session'] = JSON.stringify({
    token: 'pending-google-token',
    email: 'pending@example.com',
    requiresOnboarding: true,
  });
  // Domain data that must NOT be wiped (sanity check).
  localStore['ars_wallet'] = '500000';
  sessionStore['ars_reviewer_balance'] = '4200000';
};

describe('clearAuthSession — Agent 53 centralized cleanup', () => {
  beforeEach(() => {
    postMock.mockReset();
    postMock.mockResolvedValue({ status: 200, data: { ok: true } });
    for (const k of Object.keys(localStore)) delete localStore[k];
    for (const k of Object.keys(sessionStore)) delete sessionStore[k];
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── 1. Guest null-field logout root cause ────────────────────────────────
  it('cleans up a Guest session whose persisted user has null roleId / roleName / userRole / professionalProfile', async () => {
    seedAuthState({ withToken: false, remember: false });

    await clearAuthSession();

    expect(sessionStore[STORAGE_KEYS.TOKEN]).toBeUndefined();
    expect(sessionStore[STORAGE_KEYS.USER]).toBeUndefined();
    expect(localStore[STORAGE_KEYS.TOKEN]).toBeUndefined();
    expect(localStore[STORAGE_KEYS.USER]).toBeUndefined();
    expect(localStore[STORAGE_KEYS.REMEMBER_ME]).toBeUndefined();

    // Domain data survives — no localStorage.clear() in the cleanup path.
    expect(localStore['ars_wallet']).toBe('500000');
    expect(sessionStore['ars_reviewer_balance']).toBe('4200000');
  });

  // ── 2. Every documented ARS key removal ──────────────────────────────────
  it('removes every documented ARS auth-related key from BOTH localStorage and sessionStorage', async () => {
    seedAuthState({ withToken: true, remember: true });

    // Pre-condition: keys are present.
    expect(localStore[STORAGE_KEYS.TOKEN]).toBe('bearer.abc.def');
    expect(sessionStore[STORAGE_KEYS.USER]).toBeDefined();
    expect(sessionStore['ars-active-role']).toBe('Researcher');
    expect(localStore['ars_active_role']).toBe('Admin');
    expect(sessionStore['ars-auth-storage']).toBeDefined();
    // The token-bearing Google onboarding session key MUST be present
    // before cleanup so we can prove the routine actually removed it.
    expect(sessionStore['ars_google_onboarding_session']).toBeDefined();

    await clearAuthSession();

    for (const key of [
      STORAGE_KEYS.TOKEN,
      STORAGE_KEYS.USER,
      STORAGE_KEYS.REMEMBER_ME,
      'ars-active-role',
      'ars_active_role',
      'ars-auth-storage',
      // Real Agent 52 session key — token-bearing; must be wiped from
      // BOTH buckets.
      'ars_google_onboarding_session',
    ]) {
      expect(localStore[key]).toBeUndefined();
      expect(sessionStore[key]).toBeUndefined();
    }
  });

  // ── 3. Axios no longer carries the old bearer token ──────────────────────
  it('strips the Axios Authorization header from the shared instance', async () => {
    // Simulate the interceptor having attached a bearer header earlier.
    const axios = (await import('../../../src/services/axios')).default;
    axios.defaults.headers.common = { Authorization: 'Bearer bearer.abc.def' };
    seedAuthState({ withToken: true });

    await clearAuthSession();

    expect(axios.defaults.headers.common.Authorization).toBeUndefined();
  });

  // ── 3a. Agent 52's real Google onboarding session key is wiped ───────────
  // The key name comes from `SESSION_KEY` in
  // src/pages/CompleteGoogleRegistration/CompleteGoogleRegistration.tsx
  // (Agent 52 territory — DO NOT edit that file). The session blob is
  // token-bearing, so a logout that left it behind would leak the
  // pending Google bearer token across the ARS session boundary.
  it('removes the Agent 52 ars_google_onboarding_session key from BOTH localStorage and sessionStorage', async () => {
    // Seed the key into BOTH buckets so we prove symmetric removal.
    sessionStore['ars_google_onboarding_session'] = JSON.stringify({
      token: 'google-bearer-token-A',
      email: 'g1@example.com',
    });
    localStore['ars_google_onboarding_session'] = JSON.stringify({
      token: 'google-bearer-token-B',
      email: 'g2@example.com',
    });

    // Pre-condition assertion: the cleanup target exists in both stores.
    expect(sessionStore['ars_google_onboarding_session']).toBeDefined();
    expect(localStore['ars_google_onboarding_session']).toBeDefined();

    await clearAuthSession();

    expect(sessionStore['ars_google_onboarding_session']).toBeUndefined();
    expect(localStore['ars_google_onboarding_session']).toBeUndefined();
  });

  // ── 4. Local cleanup is isolated from the 401 interceptor ────────────────
  it('does not call the protected logout endpoint during Guest cleanup', async () => {
    seedAuthState({ withToken: false });

    await clearAuthSession();

    expect(postMock).not.toHaveBeenCalled();
    expect(sessionStore[STORAGE_KEYS.TOKEN]).toBeUndefined();
    expect(sessionStore[STORAGE_KEYS.USER]).toBeUndefined();
  });

  // ── 5. No google.accounts.id.revoke() ─────────────────────────────────────
  it('never calls google.accounts.id.revoke — only the auto-select toggle is touched', async () => {
    const revoke = vi.fn();
    const disableAutoSelect = vi.fn();
    (global as unknown as { google: unknown }).google = {
      accounts: {
        id: {
          disableAutoSelect,
          revoke,
        },
      },
    };
    seedAuthState({ withToken: false });

    await clearAuthSession();

    expect(disableAutoSelect).toHaveBeenCalledTimes(1);
    expect(revoke).not.toHaveBeenCalled();

    delete (global as unknown as { google?: unknown }).google;
  });

  // ── 6. Defensive disableAutoSelect fires when GIS is present ─────────────
  it('calls google.accounts.id.disableAutoSelect when GIS is available', async () => {
    const disableAutoSelect = vi.fn();
    (global as unknown as { google: unknown }).google = {
      accounts: { id: { disableAutoSelect } },
    };

    await clearAuthSession();

    expect(disableAutoSelect).toHaveBeenCalledTimes(1);

    delete (global as unknown as { google?: unknown }).google;
  });

  // ── 7. No-op when GIS is absent ──────────────────────────────────────────
  it('does not throw when google.accounts.id is not loaded', async () => {
    delete (global as unknown as { google?: unknown }).google;
    seedAuthState({ withToken: false });

    await expect(clearAuthSession()).resolves.toBeUndefined();
  });

  // ── 8. authService.logout still triggers the centralized routine ─────────
  it('authService.logout() performs local cleanup without a recursive BE call', async () => {
    seedAuthState({ withToken: false });

    authService.logout();
    expect(sessionStore[STORAGE_KEYS.TOKEN]).toBeUndefined();
    expect(sessionStore[STORAGE_KEYS.USER]).toBeUndefined();

    await new Promise((r) => setTimeout(r, 0));
    expect(postMock).not.toHaveBeenCalled();
  });

  // ── 9. No stale hydration can resurrect the cleared session ─────────────
  it('does not leave any ars-auth-storage key that Zustand could rehydrate', async () => {
    seedAuthState({ withToken: false });

    await clearAuthSession();

    // Both buckets stripped so no future mount can read the prior session.
    expect(sessionStore['ars-auth-storage']).toBeUndefined();
    expect(localStore['ars-auth-storage']).toBeUndefined();
  });
});
