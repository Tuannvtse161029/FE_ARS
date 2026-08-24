/**
 * Tests for the shared registration roles constant — single source of
 * truth for the user-selectable role list used by both
 * `/register` (email/password) and
 * `/complete-google-registration` (first-time Google).
 *
 * Critical contracts (must NOT drift between the two pages):
 *   - Exactly four roles: Researcher, Reviewer, Lecturer, Graduate Student.
 *   - Admin is excluded (DB-provisioned only).
 *   - Guest is excluded (effective-time variant, not a persisted role).
 *   - `isRequestableRole` is true for those four and false otherwise.
 */
import { describe, it, expect } from 'vitest';
import {
  REGISTRATION_ROLES,
  isRequestableRole,
  type RequestableRole,
} from '../../../src/utils/registrationRoles';

describe('REGISTRATION_ROLES (shared user-selectable role list)', () => {
  it('contains exactly the four business roles allowed for self-registration', () => {
    expect([...REGISTRATION_ROLES]).toEqual([
      'Researcher',
      'Reviewer',
      'Lecturer',
      'Graduate Student',
    ]);
    expect(REGISTRATION_ROLES).toHaveLength(4);
  });

  it('never includes Admin (DB-provisioned only)', () => {
    expect(REGISTRATION_ROLES).not.toContain('Admin');
  });

  it('never includes Guest (effective-time variant, not a persisted role)', () => {
    expect(REGISTRATION_ROLES).not.toContain('Guest');
  });

  it('preserves the documented display order', () => {
    expect(REGISTRATION_ROLES[0]).toBe('Researcher');
    expect(REGISTRATION_ROLES[1]).toBe('Reviewer');
    expect(REGISTRATION_ROLES[2]).toBe('Lecturer');
    expect(REGISTRATION_ROLES[3]).toBe('Graduate Student');
  });

  it('exposes a typed RequestableRole alias equal to its member literal union', () => {
    // Compile-time guard — each value is assignable to RequestableRole.
    const sample: RequestableRole = REGISTRATION_ROLES[0];
    expect(sample).toBe('Researcher');
  });
});

describe('isRequestableRole (shared predicate)', () => {
  it('returns true for every entry in REGISTRATION_ROLES', () => {
    for (const r of REGISTRATION_ROLES) {
      expect(isRequestableRole(r)).toBe(true);
    }
  });

  it('returns false for Admin', () => {
    expect(isRequestableRole('Admin')).toBe(false);
  });

  it('returns false for Guest', () => {
    expect(isRequestableRole('Guest')).toBe(false);
  });

  it('returns false for empty / null / undefined / non-string', () => {
    expect(isRequestableRole('')).toBe(false);
    expect(isRequestableRole(null)).toBe(false);
    expect(isRequestableRole(undefined)).toBe(false);
    expect(isRequestableRole(0)).toBe(false);
    expect(isRequestableRole({})).toBe(false);
  });

  it('returns false for unknown role strings (no coercion)', () => {
    expect(isRequestableRole('MysteryRole')).toBe(false);
    expect(isRequestableRole('researcher')).toBe(false); // case-sensitive
  });
});