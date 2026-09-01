/**
 * Tests for useCanInteractInForum — combines Admin-approval
 * (`canCreatePost`) with the Researcher / Lecturer subscription gate.
 *
 * Verifies:
 *   - Approved Researcher with ACTIVE subscription → canInteract=true.
 *   - Approved Researcher with EXPIRED subscription → canInteract=false
 *     with a subscription-themed reason.
 *   - Approved Lecturer with missing subscription → canInteract=false
 *     with the same subscription-themed reason.
 *   - Unapproved (Guest / Pending) → canInteract=false with an
 *     approval-themed reason.
 *   - Approved Reviewer / Admin / Graduate Student are NEVER blocked
 *     by the subscription gate.
 */
import { renderHook, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// ── AuthContext mock factory ────────────────────────────────────────────────
let mockAuth: {
  user: Record<string, unknown> | null;
  isAuthenticated: boolean;
  effectiveRole: string | null;
} = {
  user: null,
  isAuthenticated: true,
  effectiveRole: null,
};

vi.mock('../../../src/context/AuthContext', () => ({
  useAuth: () => mockAuth,
}));

// ── Permissions mock factory ────────────────────────────────────────────────
let mockCanCreatePost = true;

vi.mock('../../../src/hooks/usePermissions', () => ({
  usePermissions: () => ({
    isVerified: mockCanCreatePost,
    canCreatePost: mockCanCreatePost,
    canViewAdminPanel: false,
    hasWallet: false,
    isGuest: false,
  }),
}));

// ── Subscription mock factory ───────────────────────────────────────────────
let mockSubscription: {
  isApplicable: boolean;
  isActive: boolean;
} = { isApplicable: false, isActive: true };

vi.mock('../../../src/hooks/useSubscription', () => ({
  useSubscription: () => mockSubscription,
}));

const setAuth = (role: string | null) => {
  mockAuth = {
    user: role
      ? {
          token: 'mock-token',
          username: 'User',
          email: 'user@example.com',
          role,
        }
      : null,
    isAuthenticated: true,
    effectiveRole: role,
  };
};

const importFresh = async () => {
  vi.resetModules();
  const mod = await import('../../../src/hooks/useCanInteractInForum');
  return mod.useCanInteractInForum;
};

describe('useCanInteractInForum', () => {
  beforeEach(() => {
    mockCanCreatePost = true;
    mockSubscription = { isApplicable: false, isActive: true };
    setAuth(null);
  });

  it('allows an approved Researcher with an active subscription to interact', async () => {
    setAuth('Researcher');
    mockCanCreatePost = true;
    mockSubscription = { isApplicable: true, isActive: true };

    const useCanInteractInForum = await importFresh();
    const { result } = renderHook(() => useCanInteractInForum());

    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(result.current.canInteract).toBe(true);
    expect(result.current.reason).toBeNull();
  });

  it('blocks an approved Researcher with an expired subscription', async () => {
    setAuth('Researcher');
    mockCanCreatePost = true;
    mockSubscription = { isApplicable: true, isActive: false };

    const useCanInteractInForum = await importFresh();
    const { result } = renderHook(() => useCanInteractInForum());

    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(result.current.canInteract).toBe(false);
    expect(result.current.reason).toMatch(/subscription/i);
  });

  it('blocks an approved Lecturer with a missing subscription', async () => {
    setAuth('Lecturer');
    mockCanCreatePost = true;
    mockSubscription = { isApplicable: true, isActive: false };

    const useCanInteractInForum = await importFresh();
    const { result } = renderHook(() => useCanInteractInForum());

    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(result.current.canInteract).toBe(false);
    expect(result.current.reason).toMatch(/subscription/i);
  });

  it('blocks unapproved users with an approval-themed reason (subscription never gates)', async () => {
    setAuth('Researcher');
    mockCanCreatePost = false;
    mockSubscription = { isApplicable: false, isActive: true };

    const useCanInteractInForum = await importFresh();
    const { result } = renderHook(() => useCanInteractInForum());

    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(result.current.canInteract).toBe(false);
    expect(result.current.reason).toMatch(/administrator/i);
  });

  it('never blocks Reviewer / Admin / Graduate Student', async () => {
    for (const role of ['Reviewer', 'Admin', 'Graduate Student']) {
      setAuth(role);
      mockCanCreatePost = true;
      mockSubscription = { isApplicable: false, isActive: true };

      const useCanInteractInForum = await importFresh();
      const { result } = renderHook(() => useCanInteractInForum());

      await act(async () => {
        await new Promise((r) => setTimeout(r, 0));
      });

      expect(result.current.canInteract).toBe(true);
      expect(result.current.reason).toBeNull();
    }
  });
});
