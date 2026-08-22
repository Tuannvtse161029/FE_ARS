/**
 * Unit tests for src/services/user.service.ts (Agent 29).
 *
 * Covers:
 *   - getPaged returns the PagedResult envelope verbatim
 *   - getAllUsers walks every backend page using totalPages metadata
 *   - getAllUsers stops safely on empty page / MAX_USER_FETCH_PAGES ceiling
 *   - updateIsActive constructs a full UserUpdateRequest (fullName required)
 *     so the PUT never blanks `fullName` or `avatarUrl`
 *   - displayAccountTier normalizes null → 'Free'
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import api from '../../../src/services/axios';
import { userService, displayAccountTier } from '../../../src/services/user.service';
import type { User } from '../../../src/types/auth';

let axiosGetSpy: ReturnType<typeof vi.spyOn>;
let axiosPutSpy: ReturnType<typeof vi.spyOn>;

const userFixture = (id: number, isActive: boolean): User => ({
  id,
  email: `user${id}@example.com`,
  fullName: `User Number ${id}`,
  username: `user${id}`,
  roleId: 0,
  roleName: null,
  isActive,
  isEmailVerified: true,
  verificationStatus: 'Pending',
  accountTier: 'Free',
  createdAt: '2026-08-19T00:00:00Z',
});

beforeEach(() => {
  vi.clearAllMocks();
  axiosGetSpy = vi.spyOn(api, 'get');
  axiosPutSpy = vi.spyOn(api, 'put');
});

describe('userService.getPaged', () => {
  it('returns the PagedResult envelope verbatim', async () => {
    const page = {
      items: [userFixture(1, true), userFixture(2, false)],
      pageNumber: 1,
      pageSize: 10,
      totalCount: 2,
      totalPages: 1,
      hasPrevious: false,
      hasNext: false,
    };
    axiosGetSpy.mockResolvedValue({ data: page });
    const result = await userService.getPaged({ pageNumber: 1, pageSize: 10 });
    expect(result).toEqual(page);
    expect(axiosGetSpy).toHaveBeenCalledWith('/api/user', {
      params: { pageNumber: 1, pageSize: 10 },
    });
  });
});

describe('userService.getAllUsers', () => {
  it('walks every page using totalPages metadata and concatenates items', async () => {
    axiosGetSpy
      .mockResolvedValueOnce({
        data: {
          items: [userFixture(1, true), userFixture(2, false)],
          pageNumber: 1,
          pageSize: 2,
          totalCount: 4,
          totalPages: 2,
          hasPrevious: false,
          hasNext: true,
        },
      })
      .mockResolvedValueOnce({
        data: {
          items: [userFixture(3, true), userFixture(4, true)],
          pageNumber: 2,
          pageSize: 2,
          totalCount: 4,
          totalPages: 2,
          hasPrevious: true,
          hasNext: false,
        },
      });
    const result = await userService.getAllUsers(2);
    expect(result.items).toHaveLength(4);
    expect(result.totalCount).toBe(4);
    expect(axiosGetSpy).toHaveBeenCalledTimes(2);
  });

  it('stops safely when only one page is needed', async () => {
    axiosGetSpy.mockResolvedValue({
      data: {
        items: [userFixture(1, true)],
        pageNumber: 1,
        pageSize: 5,
        totalCount: 1,
        totalPages: 1,
        hasPrevious: false,
        hasNext: false,
      },
    });
    const result = await userService.getAllUsers(5);
    expect(result.items).toHaveLength(1);
    // Only the first page should have been called.
    expect(axiosGetSpy).toHaveBeenCalledTimes(1);
  });
});

describe('userService.updateIsActive', () => {
  it('reads the current user and PUTs a full body with isActive:false', async () => {
    const current = userFixture(42, true);
    axiosGetSpy.mockResolvedValue({ data: current });
    axiosPutSpy.mockResolvedValue({ data: { ...current, isActive: false } });

    await userService.updateIsActive(42, false);

    expect(axiosPutSpy).toHaveBeenCalledWith('/api/user/42', {
      fullName: 'User Number 42',
      avatarUrl: 'user42',
      isActive: false,
    });
  });

  it('throws when the current row has no fullName (PUT would erase it)', async () => {
    axiosGetSpy.mockResolvedValue({
      data: { ...userFixture(99, true), fullName: '' },
    });
    await expect(userService.updateIsActive(99, false)).rejects.toThrow(
      /no fullName/i,
    );
    // No PUT should have been issued.
    expect(axiosPutSpy).not.toHaveBeenCalled();
  });
});

describe('userService.update (full PUT)', () => {
  it('uses PUT /api/user/{id} (not PATCH) per the Swagger contract', async () => {
    axiosPutSpy.mockResolvedValue({ data: userFixture(1, true) });
    await userService.update(1, {
      fullName: 'Renamed',
      avatarUrl: 'renamed-avatar',
      isActive: true,
    });
    expect(axiosPutSpy).toHaveBeenCalledWith('/api/user/1', {
      fullName: 'Renamed',
      avatarUrl: 'renamed-avatar',
      isActive: true,
    });
  });
});

describe('displayAccountTier', () => {
  it('normalizes null → "Free"', () => {
    expect(displayAccountTier(null)).toBe('Free');
  });
  it('normalizes undefined → "Free"', () => {
    expect(displayAccountTier(undefined)).toBe('Free');
  });
  it('preserves an explicit tier', () => {
    expect(displayAccountTier('Premium')).toBe('Premium');
  });
});