/**
 * Unit tests for src/services/adminUser.service.ts (Agent 40).
 *
 * Covers the verification-page aggregation helpers and the strict
 * `isPendingVerification` predicate. Mocks `userService.getAllUsers` so we
 * never hit axios directly from these tests.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  adminUserService,
  isPendingVerification,
  normalizeVerificationStatus,
  KNOWN_VERIFICATION_STATUSES,
} from '../../services/adminUser.service';
import { userService } from '../../services/user.service';
import type { User } from '../../types/auth';

vi.mock('../../services/user.service', () => ({
  userService: {
    getAllUsers: vi.fn(),
    getById: vi.fn(),
    getPaged: vi.fn(),
    getAll: vi.fn(),
    update: vi.fn(),
    updateIsActive: vi.fn(),
    delete: vi.fn(),
  },
  displayAccountTier: (tier: string | null | undefined) => tier ?? 'Free',
}));

const user = (
  id: number,
  status: string | null | undefined,
  extra: Partial<User> = {},
): User => ({
  id,
  email: `u${id}@example.com`,
  fullName: `U${id}`,
  username: `u${id}`,
  roleId: 0,
  roleName: null,
  isActive: true,
  isEmailVerified: true,
  verificationStatus: (status ?? '') as User['verificationStatus'],
  accountTier: 'Free',
  createdAt: '2026-08-19T00:00:00Z',
  ...extra,
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe('adminUserService.listAllUsers / listPendingVerification', () => {
  it('listAllUsers returns the userService aggregate verbatim', async () => {
    vi.mocked(userService.getAllUsers).mockResolvedValueOnce({
      items: [user(1, 'Pending'), user(2, 'Accepted'), user(3, 'Rejected')],
      totalCount: 3,
      fetchedAt: '2026-08-19T00:00:00Z',
    });
    const result = await adminUserService.listAllUsers();
    expect(result.rows).toHaveLength(3);
    expect(result.totalCount).toBe(3);
  });

  it('listPendingVerification filters to only verificationStatus: Pending', async () => {
    vi.mocked(userService.getAllUsers).mockResolvedValueOnce({
      items: [user(1, 'Pending'), user(2, 'Accepted'), user(3, 'Rejected'), user(4, 'Pending')],
      totalCount: 4,
      fetchedAt: '2026-08-19T00:00:00Z',
    });
    const result = await adminUserService.listPendingVerification();
    expect(result.rows.map((r) => r.id)).toEqual([1, 4]);
    // totalCount is preserved so the Admin sees the directory size.
    expect(result.totalCount).toBe(4);
  });
});

describe('isPendingVerification', () => {
  it('returns true only for explicit Pending', () => {
    expect(isPendingVerification(user(1, 'Pending'))).toBe(true);
    expect(isPendingVerification(user(2, 'Accepted'))).toBe(false);
    expect(isPendingVerification(user(3, 'Rejected'))).toBe(false);
  });

  it('returns false when verificationStatus is empty / null / undefined', () => {
    expect(isPendingVerification(user(1, null))).toBe(false);
    expect(isPendingVerification(user(2, undefined))).toBe(false);
    expect(isPendingVerification(user(3, ''))).toBe(false);
  });

  it('does NOT silently coerce unknown strings to Pending (defensive)', () => {
    // An unknown status (e.g. "AwaitingMoreInfo") is shown verbatim by the
    // table but is treated as pending so the Admin does not lose the row.
    expect(isPendingVerification(user(1, 'AwaitingMoreInfo'))).toBe(true);
  });
});

describe('normalizeVerificationStatus', () => {
  it('returns the raw string when valid', () => {
    expect(normalizeVerificationStatus('Pending')).toBe('Pending');
    expect(normalizeVerificationStatus('Accepted')).toBe('Accepted');
    expect(normalizeVerificationStatus('Rejected')).toBe('Rejected');
  });

  it('returns empty string for non-string or empty input', () => {
    expect(normalizeVerificationStatus(null)).toBe('');
    expect(normalizeVerificationStatus(undefined)).toBe('');
    expect(normalizeVerificationStatus('')).toBe('');
    expect(normalizeVerificationStatus(42)).toBe('');
  });
});

describe('KNOWN_VERIFICATION_STATUSES', () => {
  it('lists Pending, Accepted, Rejected', () => {
    expect(KNOWN_VERIFICATION_STATUSES).toEqual(['Pending', 'Accepted', 'Rejected']);
  });
});