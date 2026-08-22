/**
 * Tests for Agent 52 — roleService (business-role directory).
 *
 * Critical contracts:
 *   - `Guest` is NEVER included, even when the BE returns it (it's an
 *     effective-time variant, not a persisted role).
 *   - `Admin` is NEVER included (DB-provisioned only).
 *   - Empty / failed BE responses return `[]` (the page renders an honest
 *     error state — never falls back to a hardcoded list).
 *   - Duplicate entries are deduped, BE order is preserved.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const getMock = vi.fn();

vi.mock('../../../src/services/axios', () => ({
  default: { get: (...args: unknown[]) => getMock(...args) },
}));

import { roleService, ALLOWED_ONBOARDING_ROLES } from '../../../src/services/role.service';

describe('roleService.fetchBusinessRolesForOnboarding', () => {
  beforeEach(() => {
    getMock.mockReset();
  });

  it('returns business roles from /api/Role', async () => {
    getMock.mockResolvedValueOnce({
      data: [
        { id: 1, name: 'Researcher' },
        { id: 3, name: 'Reviewer' },
        { id: 4, name: 'Lecturer' },
        { id: 5, name: 'Graduate Student' },
      ],
    });

    const roles = await roleService.fetchBusinessRolesForOnboarding();
    expect(roles).toEqual(['Researcher', 'Reviewer', 'Lecturer', 'Graduate Student']);
  });

  it('EXCLUDES Guest even when the BE returns it', async () => {
    getMock.mockResolvedValueOnce({
      data: [
        { id: 1, name: 'Researcher' },
        { id: 6, name: 'Guest' },
        { id: 3, name: 'Reviewer' },
      ],
    });

    const roles = await roleService.fetchBusinessRolesForOnboarding();
    expect(roles).not.toContain('Guest');
    expect(roles).toEqual(['Researcher', 'Reviewer']);
  });

  it('EXCLUDES Admin (DB-provisioned only)', async () => {
    getMock.mockResolvedValueOnce({
      data: [
        { id: 2, name: 'Admin' },
        { id: 1, name: 'Researcher' },
      ],
    });

    const roles = await roleService.fetchBusinessRolesForOnboarding();
    expect(roles).not.toContain('Admin');
    expect(roles).toEqual(['Researcher']);
  });

  it('handles string-array BE responses', async () => {
    getMock.mockResolvedValueOnce({
      data: ['Researcher', 'Reviewer', 'Lecturer', 'Graduate Student'],
    });

    const roles = await roleService.fetchBusinessRolesForOnboarding();
    expect(roles).toEqual(['Researcher', 'Reviewer', 'Lecturer', 'Graduate Student']);
  });

  it('handles wrapped responses ({ items: [...] })', async () => {
    getMock.mockResolvedValueOnce({
      data: { items: [{ name: 'Researcher' }, { name: 'Reviewer' }] },
    });

    const roles = await roleService.fetchBusinessRolesForOnboarding();
    expect(roles).toEqual(['Researcher', 'Reviewer']);
  });

  it('drops unknown role strings without coercing them to a known role', async () => {
    getMock.mockResolvedValueOnce({
      data: [
        { name: 'Researcher' },
        { name: 'FooBar' }, // unknown — must be dropped
        { name: 'Reviewer' },
      ],
    });

    const roles = await roleService.fetchBusinessRolesForOnboarding();
    expect(roles).toEqual(['Researcher', 'Reviewer']);
  });

  it('dedupes roles that appear twice', async () => {
    getMock.mockResolvedValueOnce({
      data: [
        { name: 'Researcher' },
        { name: 'Researcher' },
        { name: 'Reviewer' },
      ],
    });

    const roles = await roleService.fetchBusinessRolesForOnboarding();
    expect(roles).toEqual(['Researcher', 'Reviewer']);
  });

  it('preserves the BE order (no client-side sort)', async () => {
    getMock.mockResolvedValueOnce({
      data: [{ name: 'Reviewer' }, { name: 'Researcher' }, { name: 'Lecturer' }],
    });

    const roles = await roleService.fetchBusinessRolesForOnboarding();
    expect(roles).toEqual(['Reviewer', 'Researcher', 'Lecturer']);
  });

  it('returns an empty array when the BE returns no usable roles (does not throw)', async () => {
    getMock.mockResolvedValueOnce({ data: [] });
    const roles = await roleService.fetchBusinessRolesForOnboarding();
    expect(roles).toEqual([]);
  });

  it('propagates BE failures — never falls back to a hardcoded list', async () => {
    getMock.mockRejectedValueOnce(new Error('BE down'));
    await expect(roleService.fetchBusinessRolesForOnboarding()).rejects.toThrow('BE down');
  });
});

describe('roleService.isOnboardingSelectable', () => {
  it('returns true for business roles on the allowed list', () => {
    for (const r of ALLOWED_ONBOARDING_ROLES) {
      expect(roleService.isOnboardingSelectable(r)).toBe(true);
    }
  });

  it('returns false for Admin / Guest / unknown strings', () => {
    expect(roleService.isOnboardingSelectable('Admin')).toBe(false);
    expect(roleService.isOnboardingSelectable('Guest')).toBe(false);
    expect(roleService.isOnboardingSelectable('')).toBe(false);
    expect(roleService.isOnboardingSelectable(null)).toBe(false);
  });
});