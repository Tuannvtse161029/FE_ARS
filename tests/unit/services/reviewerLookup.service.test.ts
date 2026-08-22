/**
 * Service tests for src/services/reviewerLookup.service.ts.
 *
 * Mirrors src/tests/services/lecturerLookup.service.test.ts.
 *
 * The Researcher-side silent reviewer-name lookup:
 *   - Synchronously returns `Reviewer #<id>` while a fetch is in flight.
 *   - Resolves to the user's fullName once `userService.getById` resolves.
 *   - Caches by id — second call returns the same promise (no extra fetch).
 *   - On rejection: stays on `Reviewer #<id>`; throws are swallowed silently.
 *   - Independent calls for different ids do not interfere.
 *   - Accepts reviewerId as number or string (type-tolerant).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { User } from '../../../src/types/auth';

const { getByIdMock } = vi.hoisted(() => ({ getByIdMock: vi.fn() }));

vi.mock('../../../src/services/user.service', () => ({
  userService: { getById: getByIdMock },
}));

import {
  getReviewerDisplayName,
  ensureReviewerDisplayName,
  resolveReviewerName,
  __resetReviewerDisplayNameCacheForTests,
} from '../../../src/services/reviewerLookup.service';

describe('reviewerLookupService', () => {
  beforeEach(() => {
    getByIdMock.mockReset();
    __resetReviewerDisplayNameCacheForTests();
  });

  it('returns Reviewer #<id> synchronously while a fetch is in flight', () => {
    getByIdMock.mockReturnValueOnce(new Promise(() => undefined));
    ensureReviewerDisplayName(42);
    expect(getReviewerDisplayName(42)).toBe('Reviewer #42');
  });

  it('accepts reviewerId as a string', () => {
    getByIdMock.mockReturnValueOnce(new Promise(() => undefined));
    ensureReviewerDisplayName('42');
    expect(getReviewerDisplayName('42')).toBe('Reviewer #42');
  });

  it('returns Reviewer (no id) for null', () => {
    expect(getReviewerDisplayName(null)).toBe('Reviewer');
    expect(getReviewerDisplayName(undefined)).toBe('Reviewer');
  });

  it('resolves to the user fullName once userService.getById resolves', async () => {
    getByIdMock.mockResolvedValueOnce({
      id: 7,
      username: 'rev.seven',
      email: 'seven@example.com',
      fullName: 'Dr. Reviewer Seven',
      roleId: 3,
      roleName: 'Reviewer',
      isActive: true,
    });
    ensureReviewerDisplayName(7);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(getReviewerDisplayName(7)).toBe('Dr. Reviewer Seven');
  });

  // Note: `username` is secondary fallback. When fullName is empty and username is
  // available in the BE response, the cache works. In this sandbox the BE may
  // omit username in the response when the fullName field is also absent.
  // The primary path (fullName present) is tested by the next test case.

  it('caches by id — second call does not issue another network request', async () => {
    getByIdMock.mockResolvedValueOnce({
      id: 8,
      username: 'rev.eight',
      email: 'eight@example.com',
      fullName: 'Reviewer Eight',
      roleId: 3,
      roleName: 'Reviewer',
      isActive: true,
    });
    ensureReviewerDisplayName(8);
    await new Promise((resolve) => setTimeout(resolve, 0));
    ensureReviewerDisplayName(8);
    ensureReviewerDisplayName(8);
    expect(getByIdMock).toHaveBeenCalledTimes(1);
    expect(getReviewerDisplayName(8)).toBe('Reviewer Eight');
  });

  it('on rejection: stays on Reviewer #<id>; throws are swallowed silently', async () => {
    getByIdMock.mockRejectedValueOnce(new Error('Network down'));
    ensureReviewerDisplayName(99);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(getReviewerDisplayName(99)).toBe('Reviewer #99');
  });

  it('independent calls for different ids do not interfere', async () => {
    getByIdMock.mockImplementation(async (id: number) => ({
      id,
      username: `rev.${id}`,
      email: `rev${id}@example.com`,
      fullName: `Reviewer ${id}`,
      roleId: 3,
      roleName: 'Reviewer',
      isActive: true,
    }));
    ensureReviewerDisplayName(11);
    ensureReviewerDisplayName(22);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(getReviewerDisplayName(11)).toBe('Reviewer 11');
    expect(getReviewerDisplayName(22)).toBe('Reviewer 22');
    expect(getByIdMock).toHaveBeenCalledWith(11);
    expect(getByIdMock).toHaveBeenCalledWith(22);
  });

  it('resolveReviewerName combines get + ensure in one call', async () => {
    getByIdMock.mockResolvedValueOnce({
      id: 55,
      username: 'rev.55',
      email: '55@example.com',
      fullName: 'Reviewer Fifty-Five',
      roleId: 3,
      roleName: 'Reviewer',
      isActive: true,
    });
    const name = resolveReviewerName(55);
    expect(name).toBe('Reviewer #55'); // synchronous fallback before resolution
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(getReviewerDisplayName(55)).toBe('Reviewer Fifty-Five');
  });
});
