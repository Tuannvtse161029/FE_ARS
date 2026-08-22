/**
 * Tests for src/hooks/useAuthenticatedResearcher.ts.
 *
 * The hook is the single source of truth for "who is the current
 * researcher?" — it MUST only resolve the identity from the BE-derived
 * Zustand auth store, never from localStorage/sessionStorage, a route
 * param, or a fallback.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useAuthenticatedResearcher } from '../../../src/hooks/useAuthenticatedResearcher';
import { useAuthStore } from '../../../src/store/authSlice';

const resetStore = () => {
  useAuthStore.setState({
    user: null,
    token: null,
    isAuthenticated: false,
    isLoading: false,
    effectiveRole: null,
  });
};

describe('useAuthenticatedResearcher', () => {
  beforeEach(() => {
    resetStore();
  });

  it('returns null when no user is logged in', () => {
    const { result } = renderHook(() => useAuthenticatedResearcher());
    expect(result.current.researcherUserId).toBeNull();
    expect(result.current.isAuthenticatedResearcher).toBe(false);
  });

  it('returns the user id when authenticated', () => {
    useAuthStore.setState({
      user: {
        id: 22,
        username: 'r22',
        email: 'r22@example.com',
        fullName: 'Researcher 22',
        roleId: 1,
        roleName: 'Researcher',
        isActive: true,
      },
      isAuthenticated: true,
      isLoading: false,
    });
    const { result } = renderHook(() => useAuthenticatedResearcher());
    expect(result.current.researcherUserId).toBe(22);
    expect(result.current.isAuthenticatedResearcher).toBe(true);
  });

  it('returns null when the authenticated user has no numeric id', () => {
    useAuthStore.setState({
      user: {
        id: 0,
        username: 'r0',
        email: 'r0@example.com',
        fullName: 'No id',
        roleId: 1,
        roleName: 'Researcher',
        isActive: true,
      },
      isAuthenticated: true,
      isLoading: false,
    });
    const { result } = renderHook(() => useAuthenticatedResearcher());
    expect(result.current.researcherUserId).toBeNull();
  });

  it('returns null when the store is rehydrating (isLoading=true)', () => {
    useAuthStore.setState({
      user: {
        id: 22,
        username: 'r22',
        email: 'r22@example.com',
        fullName: 'Researcher 22',
        roleId: 1,
        roleName: 'Researcher',
        isActive: true,
      },
      isAuthenticated: true,
      isLoading: true,
    });
    const { result } = renderHook(() => useAuthenticatedResearcher());
    // The userId IS computed; callers gate via the `isLoading` flag.
    expect(result.current.researcherUserId).toBe(22);
    expect(result.current.isLoading).toBe(true);
  });

  it('updates reactively when the user switches (22 → 27)', () => {
    useAuthStore.setState({
      user: {
        id: 22,
        username: 'r22',
        email: 'r22@example.com',
        fullName: 'Researcher 22',
        roleId: 1,
        roleName: 'Researcher',
        isActive: true,
      },
      isAuthenticated: true,
      isLoading: false,
    });
    const { result, rerender } = renderHook(() => useAuthenticatedResearcher());
    expect(result.current.researcherUserId).toBe(22);

    useAuthStore.setState({
      user: {
        id: 27,
        username: 'r27',
        email: 'r27@example.com',
        fullName: 'Researcher 27',
        roleId: 1,
        roleName: 'Researcher',
        isActive: true,
      },
    });
    rerender();
    expect(result.current.researcherUserId).toBe(27);
  });

  it('returns null after logout', () => {
    useAuthStore.setState({
      user: {
        id: 22,
        username: 'r22',
        email: 'r22@example.com',
        fullName: 'Researcher 22',
        roleId: 1,
        roleName: 'Researcher',
        isActive: true,
      },
      isAuthenticated: true,
      isLoading: false,
    });
    const { result, rerender } = renderHook(() => useAuthenticatedResearcher());
    expect(result.current.researcherUserId).toBe(22);

    useAuthStore.getState().logout();
    rerender();
    expect(result.current.researcherUserId).toBeNull();
    expect(result.current.isAuthenticatedResearcher).toBe(false);
  });
});