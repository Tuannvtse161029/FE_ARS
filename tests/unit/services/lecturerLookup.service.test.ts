/**
 * Service tests for src/services/lecturerLookup.service.ts.
 *
 * The Grad-side silent lecturer-name lookup:
 *   - Synchronously returns `Lecturer #<id>` while a fetch is in flight.
 *   - Resolves to the user's display name once `userService.getById` resolves.
 *   - Caches by id — second call returns the same promise (no extra fetch).
 *   - On rejection: stays on `Lecturer #<id>`; throws are swallowed silently.
 *   - Independent calls for different ids do not interfere.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const { getByIdMock } = vi.hoisted(() => ({ getByIdMock: vi.fn() }));

vi.mock('../../../src/services/user.service', () => ({
  userService: { getById: getByIdMock },
}));

import {
  getLecturerDisplayName,
  ensureLecturerDisplayName,
  __resetLecturerDisplayNameCacheForTests,
} from '../../../src/services/lecturerLookup.service';

describe('lecturerLookupService', () => {
  beforeEach(() => {
    getByIdMock.mockReset();
    __resetLecturerDisplayNameCacheForTests();
  });

  it('returns Lecturer #<id> synchronously while a fetch is in flight', () => {
    // Never-resolving promise simulates an in-flight request.
    getByIdMock.mockReturnValueOnce(new Promise(() => undefined));
    // First, start the probe (fire-and-forget).
    ensureLecturerDisplayName(42);
    // Synchronous read must return the fallback immediately.
    expect(getLecturerDisplayName(42)).toBe('Lecturer #42');
  });

  it('resolves to the user display name once userService.getById resolves', async () => {
    getByIdMock.mockResolvedValueOnce({
      id: 7,
      username: 'dr.full',
      email: 'full@example.com',
      fullName: 'Dr. Full Name',
      roleId: 4,
      roleName: 'Lecturer',
      isActive: true,
    });
    ensureLecturerDisplayName(7);
    // Wait for the dispatched event loop to flush.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(getLecturerDisplayName(7)).toBe('Dr. Full Name');
  });

  it('caches by id — second call does not issue another network request', async () => {
    getByIdMock.mockResolvedValueOnce({
      id: 8,
      username: 'dr.eight',
      email: 'eight@example.com',
      fullName: 'Dr. Eight',
      roleId: 4,
      roleName: 'Lecturer',
      isActive: true,
    });
    ensureLecturerDisplayName(8);
    await new Promise((resolve) => setTimeout(resolve, 0));
    // Subsequent calls are no-ops (cache hit).
    ensureLecturerDisplayName(8);
    ensureLecturerDisplayName(8);
    expect(getByIdMock).toHaveBeenCalledTimes(1);
    expect(getLecturerDisplayName(8)).toBe('Dr. Eight');
  });

  it('on rejection: stays on Lecturer #<id>; throws are swallowed silently', async () => {
    getByIdMock.mockRejectedValueOnce(new Error('Network down'));
    ensureLecturerDisplayName(99);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(getLecturerDisplayName(99)).toBe('Lecturer #99');
  });

  it('independent calls for different ids do not interfere', async () => {
    getByIdMock.mockImplementation(async (id: number) => ({
      id,
      username: `dr.${id}`,
      email: `dr${id}@example.com`,
      fullName: `Dr. ${id}`,
      roleId: 4,
      roleName: 'Lecturer',
      isActive: true,
    }));
    ensureLecturerDisplayName(11);
    ensureLecturerDisplayName(22);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(getLecturerDisplayName(11)).toBe('Dr. 11');
    expect(getLecturerDisplayName(22)).toBe('Dr. 22');
    expect(getByIdMock).toHaveBeenCalledWith(11);
    expect(getByIdMock).toHaveBeenCalledWith(22);
  });
});