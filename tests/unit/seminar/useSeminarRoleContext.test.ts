/**
 * Hook-level tests for src/hooks/useSeminar.ts::useSeminarRoleContext.
 *
 * Pins the role-context derivation so a future change to the auth store or
 * the role normalizer cannot silently widen / narrow the mutator allow list.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';

const authState = vi.hoisted(() => ({
  user: null as
    | null
    | {
        id: number;
        roleId: number | null;
        roleName: string | null;
        isActive: boolean;
      },
  effectiveRole: null as string | null,
}));

vi.mock('../../../src/store', () => ({
  useAuthStore: (selector: (s: typeof authState) => unknown) => selector(authState),
}));

import { useSeminarRoleContext } from '../../../src/hooks/useSeminar';

describe('useSeminarRoleContext', () => {
  beforeEach(() => {
    authState.user = null;
    authState.effectiveRole = null;
  });

  it('returns canModify=true and canView=true for a Lecturer', () => {
    authState.user = {
      id: 42,
      roleId: 4,
      roleName: 'Lecturer',
      isActive: true,
    };
    const { result } = renderHook(() => useSeminarRoleContext());
    expect(result.current.currentRole).toBe('Lecturer');
    expect(result.current.currentUserId).toBe(42);
    expect(result.current.canModify).toBe(true);
    expect(result.current.canView).toBe(true);
    expect(result.current.isReadOnlyForViewer).toBe(false);
    expect(result.current.backendAvailability).toBe('full');
  });

  it('returns canModify=false and canView=true for a Researcher', () => {
    authState.user = {
      id: 7,
      roleId: 1,
      roleName: 'Researcher',
      isActive: true,
    };
    const { result } = renderHook(() => useSeminarRoleContext());
    expect(result.current.currentRole).toBe('Researcher');
    expect(result.current.canModify).toBe(false);
    expect(result.current.canView).toBe(true);
    expect(result.current.isReadOnlyForViewer).toBe(true);
    expect(result.current.backendAvailability).toBe('full');
  });

  it('returns canModify=false and canView=true for a Reviewer', () => {
    authState.user = {
      id: 9,
      roleId: 3,
      roleName: 'Reviewer',
      isActive: true,
    };
    const { result } = renderHook(() => useSeminarRoleContext());
    expect(result.current.currentRole).toBe('Reviewer');
    expect(result.current.canModify).toBe(false);
    expect(result.current.canView).toBe(true);
    expect(result.current.backendAvailability).toBe('full');
  });

  it('returns canModify=false and canView=true for a Graduate Student', () => {
    authState.user = {
      id: 11,
      roleId: 5,
      roleName: 'Graduate Student',
      isActive: true,
    };
    const { result } = renderHook(() => useSeminarRoleContext());
    expect(result.current.currentRole).toBe('Graduate Student');
    expect(result.current.canModify).toBe(false);
    expect(result.current.canView).toBe(true);
    expect(result.current.backendAvailability).toBe('full');
  });

  it('returns canModify=false and canView=false for an Admin', () => {
    authState.user = {
      id: 1,
      roleId: 2,
      roleName: 'Admin',
      isActive: true,
    };
    const { result } = renderHook(() => useSeminarRoleContext());
    expect(result.current.currentRole).toBe('Admin');
    expect(result.current.canModify).toBe(false);
    expect(result.current.canView).toBe(false);
    expect(result.current.backendAvailability).toBe('full');
  });

  it('returns null currentRole and canModify=false / canView=false for an unauthenticated user', () => {
    const { result } = renderHook(() => useSeminarRoleContext());
    expect(result.current.currentRole).toBeNull();
    expect(result.current.currentUserId).toBeNull();
    expect(result.current.canModify).toBe(false);
    expect(result.current.canView).toBe(false);
    expect(result.current.backendAvailability).toBe('full');
  });

  it('treats Guest effective role as null (no business role)', () => {
    authState.effectiveRole = 'Guest';
    authState.user = {
      id: 5,
      roleId: 4,
      roleName: 'Lecturer',
      isActive: false,
    };
    const { result } = renderHook(() => useSeminarRoleContext());
    expect(result.current.currentRole).toBeNull();
    expect(result.current.canModify).toBe(false);
    expect(result.current.canView).toBe(false);
    expect(result.current.backendAvailability).toBe('full');
  });

  it('prefers effectiveRole over roleName when both are present', () => {
    authState.effectiveRole = 'Lecturer';
    authState.user = {
      id: 7,
      roleId: 1,
      roleName: 'Researcher',
      isActive: true,
    };
    const { result } = renderHook(() => useSeminarRoleContext());
    expect(result.current.currentRole).toBe('Lecturer');
    expect(result.current.canModify).toBe(true);
    expect(result.current.backendAvailability).toBe('full');
  });
});