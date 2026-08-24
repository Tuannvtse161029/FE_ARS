/**
 * Tests for the role directory service after Agent 30 — the user-selectable
 * roles are now FE-owned (see `src/utils/registrationRoles.ts`). The BE
 * round-trip is gone, so the helper is purely a synchronous lookup
 * surfacing the shared constant.
 *
 * Critical contracts:
 *   - `Guest` is NEVER included (it's an effective-time variant, not a
 *     persisted role).
 *   - `Admin` is NEVER included (DB-provisioned only).
 *   - `Researcher`, `Reviewer`, `Lecturer`, and `Graduate Student` are the
 *     only entries — and the list is FE-owned, so a BE outage cannot
 *     leave the onboarding page with no role to choose.
 *   - `isOnboardingSelectable` is true for those four roles and false
 *     for Admin / Guest / unknown / null.
 */

import { describe, it, expect } from 'vitest';
import { roleService, ALLOWED_ONBOARDING_ROLES } from '../../../src/services/role.service';
import {
  REGISTRATION_ROLES,
  isRequestableRole,
} from '../../../src/utils/registrationRoles';

describe('roleService.fetchBusinessRolesForOnboarding (FE-owned constant)', () => {
  it('returns the four requestable roles in the documented display order', async () => {
    const roles = await roleService.fetchBusinessRolesForOnboarding();
    expect(roles).toEqual(['Researcher', 'Reviewer', 'Lecturer', 'Graduate Student']);
  });

  it('does NOT include Guest under any circumstances', async () => {
    const roles = await roleService.fetchBusinessRolesForOnboarding();
    expect(roles).not.toContain('Guest');
  });

  it('does NOT include Admin (DB-provisioned only)', async () => {
    const roles = await roleService.fetchBusinessRolesForOnboarding();
    expect(roles).not.toContain('Admin');
  });

  it('does not perform any network round-trip — resolves synchronously', async () => {
    // Promise.resolve microtask should be enough; the helper does no IO.
    const p = roleService.fetchBusinessRolesForOnboarding();
    expect(p).toBeInstanceOf(Promise);
    await expect(p).resolves.toEqual([
      'Researcher',
      'Reviewer',
      'Lecturer',
      'Graduate Student',
    ]);
  });

  it('matches the shared REGISTRATION_ROLES constant', () => {
    expect([...ALLOWED_ONBOARDING_ROLES]).toEqual([...REGISTRATION_ROLES]);
  });

  it('contains exactly four entries', async () => {
    const roles = await roleService.fetchBusinessRolesForOnboarding();
    expect(roles).toHaveLength(4);
  });
});

describe('roleService.isOnboardingSelectable', () => {
  it('returns true for every business role on the allowed list', () => {
    for (const r of ALLOWED_ONBOARDING_ROLES) {
      expect(roleService.isOnboardingSelectable(r)).toBe(true);
    }
  });

  it('returns false for Admin / Guest / unknown strings / null / undefined', () => {
    expect(roleService.isOnboardingSelectable('Admin')).toBe(false);
    expect(roleService.isOnboardingSelectable('Guest')).toBe(false);
    expect(roleService.isOnboardingSelectable('')).toBe(false);
    expect(roleService.isOnboardingSelectable(null)).toBe(false);
    expect(roleService.isOnboardingSelectable(undefined)).toBe(false);
    expect(roleService.isOnboardingSelectable('MysteryRole')).toBe(false);
  });

  it('is the same predicate as isRequestableRole from the shared util', () => {
    for (const value of [
      'Researcher',
      'Reviewer',
      'Lecturer',
      'Graduate Student',
      'Admin',
      'Guest',
      null,
      undefined,
    ] as const) {
      expect(roleService.isOnboardingSelectable(value)).toBe(
        isRequestableRole(value),
      );
    }
  });
});