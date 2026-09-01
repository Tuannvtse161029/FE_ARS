/**
 * Tests for `auth.service.login` against the BE off-by-one role-mapping bug.
 *
 * Two scenarios pinned down:
 *   1. BE returns `roleId: 0, roleName: 'Researcher'` (current bug state) —
 *      the FE has to read `roles: ['Admin']` from the BE and let the central
 *      normalizer decide the user is an admin via the roleName signal.
 *   2. BE returns `roleId: 2, roleName: 'Admin'` (post-fix) — the FE has to
 *      forward `roleId` through AuthResponse so the guard and post-login
 *      redirect can detect admin via either signal.
 *
 * Scenario 1 cannot work today without the BE ALSO returning the admin role
 * in `roles[]`, because the AuthService currently has no other signal. The
 * test below asserts that scenario 2 works correctly and documents scenario 1
 * as a known gap that depends on BE cooperation.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const postMock = vi.fn();

vi.mock('../../../src/services/axios', () => ({
  default: { post: (...args: unknown[]) => postMock(...args) },
}));

vi.mock('../../../src/utils/storage', () => ({
  storage: {
    setToken: vi.fn(),
    setUser: vi.fn(),
    getToken: vi.fn(),
    getUser: vi.fn(),
    clearAuth: vi.fn(),
  },
}));

import { authService } from '../../../src/services/auth.service';

describe('auth.service.login – roleId plumbing', () => {
  beforeEach(() => {
    postMock.mockReset();
  });

  it('forwards BE roleId into AuthResponse (post-fix scenario)', async () => {
    postMock.mockResolvedValueOnce({
      data: {
        token: 'jwt-token',
        username: 'admin@arsplatform.com',
        email: 'admin@arsplatform.com',
        userId: 18,
        roleId: 2,
        roleName: 'Admin',
        roles: ['Admin'],
      },
    });

    const result = await authService.login({
      email: 'admin@arsplatform.com',
      password: 'password',
    });

    expect(result.roleId).toBe(2);
    expect(result.role).toBe('Admin');
    expect(result.roles).toEqual(['Admin']);
  });

  it('does not drop Admin when the BE includes it in the roles list', async () => {
    postMock.mockResolvedValueOnce({
      data: {
        token: 'jwt-token',
        username: 'admin@arsplatform.com',
        email: 'admin@arsplatform.com',
        userId: 18,
        roleId: 0,
        roleName: 'Researcher',
        roles: ['Admin'],
      },
    });

    const result = await authService.login({
      email: 'admin@arsplatform.com',
      password: 'password',
    });

    // The current bug state: roleId is wrong but the BE did include 'Admin'
    // in `roles[]`. The FE has to surface it so the post-login picker /
    // normalizer can route correctly.
    expect(result.roles).toEqual(['Admin']);
  });

  it('defaults roleId to 0 when the BE does not include one', async () => {
    postMock.mockResolvedValueOnce({
      data: {
        token: 'jwt-token',
        username: 'researcher@arsplatform.com',
        email: 'researcher@arsplatform.com',
        userId: 4,
        roleName: 'Researcher',
        roles: ['Researcher'],
      },
    });

    const result = await authService.login({
      email: 'researcher@arsplatform.com',
      password: 'password',
    });

    expect(result.roleId).toBe(0);
    expect(result.role).toBe('Researcher');
  });

  // Agent 39 — effectiveRole explicit-Guest scenario
  it('forwards explicit effectiveRole: "Guest" from the BE (pending Admin approval)', async () => {
    postMock.mockResolvedValueOnce({
      data: {
        token: 'jwt-token',
        username: 'pending@arsplatform.com',
        email: 'pending@arsplatform.com',
        userId: 7,
        roleName: 'Researcher',
        roles: ['Researcher'],
        isActive: false,
        verificationStatus: 'Pending',
        // The BE-derived authoritative role, distinct from `role`.
        effectiveRole: 'Guest',
      },
    });

    const result = await authService.login({
      email: 'pending@arsplatform.com',
      password: 'password',
    });

    expect(result.effectiveRole).toBe('Guest');
    expect(result.role).toBe('Researcher');
  });

  // Agent 39 — derived fallback when the BE does not surface effectiveRole
  it('derives effectiveRole: "Guest" when isActive is false and the BE does not surface the field', async () => {
    postMock.mockResolvedValueOnce({
      data: {
        token: 'jwt-token',
        username: 'pending@arsplatform.com',
        email: 'pending@arsplatform.com',
        userId: 7,
        roleName: 'Researcher',
        roles: ['Researcher'],
        isActive: false,
        verificationStatus: 'Pending',
        // effectiveRole intentionally absent
      },
    });

    const result = await authService.login({
      email: 'pending@arsplatform.com',
      password: 'password',
    });

    expect(result.effectiveRole).toBe('Guest');
  });

  // Agent 39 — verified user keeps the assigned role
  it('mirrors effectiveRole to the assigned role when isActive is true and the BE does not surface the field', async () => {
    postMock.mockResolvedValueOnce({
      data: {
        token: 'jwt-token',
        username: 'researcher@arsplatform.com',
        email: 'researcher@arsplatform.com',
        userId: 4,
        roleName: 'Researcher',
        roles: ['Researcher'],
        isActive: true,
        verificationStatus: 'Accepted',
      },
    });

    const result = await authService.login({
      email: 'researcher@arsplatform.com',
      password: 'password',
    });

    expect(result.effectiveRole).toBe('Researcher');
  });

  // Agent 39 — never coerce an unknown string to 'Guest'
  it('falls back to the derived role when effectiveRole is an unknown string', async () => {
    postMock.mockResolvedValueOnce({
      data: {
        token: 'jwt-token',
        username: 'researcher@arsplatform.com',
        email: 'researcher@arsplatform.com',
        userId: 4,
        roleName: 'Researcher',
        roles: ['Researcher'],
        isActive: true,
        verificationStatus: 'Accepted',
        effectiveRole: 'Foo', // unknown — must NOT be coerced to 'Guest'
      },
    });

    const result = await authService.login({
      email: 'researcher@arsplatform.com',
      password: 'password',
    });

    // Derived from isActive=true ⇒ the assigned role, not 'Guest'.
    expect(result.effectiveRole).toBe('Researcher');
  });
});