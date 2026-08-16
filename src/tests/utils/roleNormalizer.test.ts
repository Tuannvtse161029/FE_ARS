/**
 * Regression tests for the central role normalizer and the AuthContext
 * post-login routing decision.
 *
 * Context: BE AuthController currently returns `roleId: 0, roleName:
 * 'Researcher'` for actual admin accounts (UserId = 18). The FE has to honour
 * either signal until BE fixes the mapping. These tests pin down the contract
 * so that future refactors can't accidentally break admin routing for either
 * signal shape.
 *
 * Spec:
 *   - `isAdminUser({ roleName: 'Admin' })`               → true
 *   - `isAdminUser({ roleId: 2 })`                       → true
 *   - `isAdminUser({ roleName: 'Researcher', roleId: 1 })` → false
 *   - `isAdminUser({ roleId: 0 })`                       → false (BE bug sentinel)
 *   - `landingRouteForRoleName('Admin', { isAdminOverride: true })` → '/admin'
 *   - `landingRouteForRoleName('Researcher')`            → '/forum'
 *   - `landingRouteForRoleName('Reviewer')`              → '/dashboard'
 */
import { describe, it, expect } from 'vitest';
import {
  isAdminUser,
  landingRouteForRoleName,
  resolveRoleName,
} from '../../utils/roleNormalizer';

describe('roleNormalizer – isAdminUser', () => {
  it('treats roleName === "Admin" as admin', () => {
    expect(isAdminUser({ roleName: 'Admin' })).toBe(true);
    expect(isAdminUser({ roleName: 'admin' })).toBe(true);
    expect(isAdminUser({ roleName: '  Admin  ' })).toBe(true);
  });

  it('treats roleId === 2 as admin (BE 1-based convention)', () => {
    expect(isAdminUser({ roleId: 2 })).toBe(true);
  });

  it('returns true when EITHER signal is admin (independent OR)', () => {
    expect(isAdminUser({ roleName: 'Researcher', roleId: 2 })).toBe(true);
    expect(isAdminUser({ roleName: 'Admin', roleId: 0 })).toBe(true);
  });

  it('returns false for non-admin roles', () => {
    expect(isAdminUser({ roleName: 'Researcher', roleId: 1 })).toBe(false);
    expect(isAdminUser({ roleName: 'Reviewer', roleId: 3 })).toBe(false);
    expect(isAdminUser({ roleName: 'Lecturer', roleId: 4 })).toBe(false);
    expect(isAdminUser({ roleName: 'Graduate Student', roleId: 5 })).toBe(false);
  });

  it('returns false for the BE bug sentinel roleId === 0', () => {
    // The current bug: admin users come back with roleId: 0 and roleName:
    // 'Researcher'. The normalizer must NOT treat roleId: 0 as admin on its
    // own; the roleName signal is the only way the bug state can be detected.
    expect(isAdminUser({ roleId: 0 })).toBe(false);
    expect(isAdminUser({ roleId: 0, roleName: 'Researcher' })).toBe(false);
  });

  it('returns false when both signals are absent', () => {
    expect(isAdminUser({})).toBe(false);
    expect(isAdminUser({ roleName: '', roleId: undefined })).toBe(false);
  });
});

describe('roleNormalizer – resolveRoleName', () => {
  it('returns "Admin" when roleId === 2', () => {
    expect(resolveRoleName({ roleId: 2 })).toBe('Admin');
  });

  it('returns the matched roleName for each known roleId', () => {
    expect(resolveRoleName({ roleId: 1 })).toBe('Researcher');
    expect(resolveRoleName({ roleId: 3 })).toBe('Reviewer');
    expect(resolveRoleName({ roleId: 4 })).toBe('Lecturer');
    expect(resolveRoleName({ roleId: 5 })).toBe('Graduate Student');
  });

  it('returns null for unknown roleId and no roleName', () => {
    expect(resolveRoleName({ roleId: 99 })).toBeNull();
    expect(resolveRoleName({ roleId: 0 })).toBeNull();
  });
});

describe('roleNormalizer – landingRouteForRoleName', () => {
  it('routes Admin → /admin (post-fix and current bug state)', () => {
    expect(landingRouteForRoleName('Admin')).toBe('/admin');
    expect(
      landingRouteForRoleName('Researcher', { isAdminOverride: true }),
    ).toBe('/admin');
  });

  it('routes Researcher → /forum', () => {
    expect(landingRouteForRoleName('Researcher')).toBe('/forum');
  });

  it('routes every other role → /dashboard', () => {
    expect(landingRouteForRoleName('Reviewer')).toBe('/dashboard');
    expect(landingRouteForRoleName('Lecturer')).toBe('/dashboard');
    expect(landingRouteForRoleName('Graduate Student')).toBe('/dashboard');
  });

  it('handles null / undefined / empty roleName as /dashboard', () => {
    expect(landingRouteForRoleName(null)).toBe('/dashboard');
    expect(landingRouteForRoleName(undefined)).toBe('/dashboard');
    expect(landingRouteForRoleName('')).toBe('/dashboard');
    expect(landingRouteForRoleName('   ')).toBe('/dashboard');
  });
});