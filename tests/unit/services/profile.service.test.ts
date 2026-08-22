/**
 * Service-level tests for src/services/profile.service.ts.
 *
 * Contract under test (swagger.json:2426-2589 + 5717-5822):
 *   - GET /api/Profile              → current user's profile
 *   - GET /api/Profile/{id}         → profile by id
 *   - PUT /api/Profile/{id}         → full update
 *   - PATCH /api/Profile/{id}       → partial update
 *
 * Hard guarantees exercised here:
 *   1. The update body contains ONLY the keys Swagger publishes in
 *      `ProfileUpdateRequest` — frontend-only keys (e.g. `id`, `createdAt`,
 *      a made-up `password`) MUST be stripped by `pickProfileUpdateFields`.
 *   2. The `userId` in the body is always the authenticated user's id —
 *      never a value the caller supplied. Even if the candidate object
 *      carries a different `userId`, the body MUST overwrite it.
 *   3. The update path targets `/api/Profile/{authenticatedUserId}` and
 *      never a client-controlled id.
 *   4. `pickProfileUpdateFields` is the single chokepoint for the wire
 *      shape; we test it independently to lock down the field whitelist.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const apiMock = vi.hoisted(() => ({
  get: vi.fn(),
  put: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
}));

vi.mock('../../../src/services/axios', () => ({
  default: apiMock,
}));

import {
  profileService,
} from '../../../src/services/profile.service';
import {
  pickProfileUpdateFields,
  PROFILE_UPDATE_KEYS,
  type ProfileUpdateRequest,
} from '../../../src/types/profile';

describe('profile.service', () => {
  beforeEach(() => {
    apiMock.get.mockReset();
    apiMock.put.mockReset();
    apiMock.patch.mockReset();
    apiMock.delete.mockReset();
  });

  describe('pickProfileUpdateFields (payload whitelist)', () => {
    it('includes every Swagger-published ProfileUpdateRequest key', () => {
      expect(PROFILE_UPDATE_KEYS).toEqual([
        'userId',
        'fullName',
        'academicTitle',
        'phoneNumber',
        'institution',
        'bio',
        'keywords',
        'avatarInitials',
        'dateOfBirth',
        'gender',
        'address',
      ]);
    });

    it('forces userId to the authenticated id even when caller supplies another', () => {
      const body = pickProfileUpdateFields(
        // The caller maliciously (or accidentally) tries to overwrite userId.
        { userId: 9999, fullName: 'Hacker' } as unknown as Partial<ProfileUpdateRequest>,
        42,
      );
      expect(body.userId).toBe(42);
      expect(Object.keys(body).sort()).toEqual(['fullName', 'userId']);
    });

    it('strips frontend-only keys not present in the Swagger schema', () => {
      const body = pickProfileUpdateFields(
        {
          fullName: 'Dr. Test',
          // The following are NOT in ProfileUpdateRequest — they MUST be stripped:
          id: 7,
          createdAt: '2026-01-01',
          updatedAt: '2026-01-02',
          email: 'should-not-be-sent@ars.test',
          role: 'Admin',
          isActive: true,
          password: 'hunter2',
          token: 'jwt-leak',
          csrf: 'x',
          // And an unknown random key:
          unicorn: 'rainbow',
        } as unknown as Partial<ProfileUpdateRequest>,
        11,
      );
      expect(body).toEqual({ userId: 11, fullName: 'Dr. Test' });
      expect(Object.keys(body)).not.toContain('id');
      expect(Object.keys(body)).not.toContain('email');
      expect(Object.keys(body)).not.toContain('password');
      expect(Object.keys(body)).not.toContain('unicorn');
    });

    it('preserves a null value for a documented field (BE clears the column)', () => {
      const body = pickProfileUpdateFields(
        { phoneNumber: null, bio: null },
        5,
      );
      expect(body).toEqual({ userId: 5, phoneNumber: null, bio: null });
    });

    it('preserves an empty array for keywords (BE clears the list)', () => {
      const body = pickProfileUpdateFields({ keywords: [] }, 5);
      expect(body).toEqual({ userId: 5, keywords: [] });
    });

    it('preserves a non-empty keywords array verbatim', () => {
      const body = pickProfileUpdateFields(
        { keywords: ['Distributed Systems', 'AI'] },
        5,
      );
      expect(body).toEqual({ userId: 5, keywords: ['Distributed Systems', 'AI'] });
    });

    it('always emits userId even when the candidate object is empty', () => {
      const body = pickProfileUpdateFields({}, 99);
      expect(body).toEqual({ userId: 99 });
    });
  });

  describe('getCurrent', () => {
    it('targets GET /api/Profile (no id in path) and coerces the response', async () => {
      apiMock.get.mockResolvedValueOnce({
        data: {
          id: 1,
          userId: 42,
          fullName: 'Dr. Auth',
          academicTitle: 'Prof.',
          keywords: ['AI', 'Distributed Systems'],
          updatedAt: '2026-08-22T00:00:00Z',
        },
      });

      const profile = await profileService.getCurrent(42);
      expect(apiMock.get).toHaveBeenCalledWith('/api/Profile');
      expect(profile.userId).toBe(42);
      expect(profile.fullName).toBe('Dr. Auth');
      expect(profile.academicTitle).toBe('Prof.');
      expect(profile.keywords).toEqual(['AI', 'Distributed Systems']);
      expect(profile.updatedAt).toBe('2026-08-22T00:00:00Z');
      expect(profile.institution).toBeNull();
      expect(profile.bio).toBeNull();
    });

    it('tolerates a partially-implemented BE response (null + missing fields)', async () => {
      apiMock.get.mockResolvedValueOnce({ data: { userId: 7 } });
      const profile = await profileService.getCurrent(7);
      expect(profile.userId).toBe(7);
      expect(profile.fullName).toBeNull();
      expect(profile.keywords).toBeNull();
    });

    it('falls back to the authenticated id when the BE response omits userId', async () => {
      apiMock.get.mockResolvedValueOnce({ data: { fullName: 'Anonymous' } });
      const profile = await profileService.getCurrent(123);
      expect(profile.userId).toBe(123);
    });
  });

  describe('update', () => {
    it('PUTs to /api/Profile/{authenticatedUserId} with only Swagger-published keys', async () => {
      apiMock.put.mockResolvedValueOnce({
        data: { userId: 42, fullName: 'Dr. New' },
      });

      await profileService.update(42, {
        fullName: 'Dr. New',
        // Random extras that should NOT reach the wire:
        password: 'leak',
        csrf: 'leak',
      } as unknown as Partial<ProfileUpdateRequest>);

      expect(apiMock.put).toHaveBeenCalledTimes(1);
      const [path, body] = apiMock.put.mock.calls[0];
      expect(path).toBe('/api/Profile/42');
      expect(body).toEqual({ userId: 42, fullName: 'Dr. New' });
      expect(body).not.toHaveProperty('password');
      expect(body).not.toHaveProperty('csrf');
    });

    it('uses PATCH when preferPatch is true', async () => {
      apiMock.patch.mockResolvedValueOnce({
        data: { userId: 7, keywords: ['ML'] },
      });

      await profileService.update(
        7,
        { keywords: ['ML'] } as Partial<ProfileUpdateRequest>,
        { preferPatch: true },
      );

      expect(apiMock.patch).toHaveBeenCalledWith('/api/Profile/7', {
        userId: 7,
        keywords: ['ML'],
      });
      expect(apiMock.put).not.toHaveBeenCalled();
    });

    it('always targets the authenticated user id in the URL (not a candidate value)', async () => {
      apiMock.put.mockResolvedValueOnce({ data: { userId: 42 } });
      // Even if the candidate carried a different userId, the path id MUST
      // come from the authenticatedUserId parameter.
      await profileService.update(
        42,
        { userId: 9999 } as unknown as Partial<ProfileUpdateRequest>,
      );
      expect(apiMock.put.mock.calls[0][0]).toBe('/api/Profile/42');
      expect(apiMock.put.mock.calls[0][1]).toEqual({ userId: 42 });
    });

    it('coerces the BE response into a Profile', async () => {
      apiMock.put.mockResolvedValueOnce({
        data: {
          id: 9,
          userId: 42,
          fullName: 'Dr. New',
          updatedAt: '2026-08-22T00:00:00Z',
        },
      });
      const updated = await profileService.update(42, { fullName: 'Dr. New' });
      expect(updated.userId).toBe(42);
      expect(updated.id).toBe(9);
      expect(updated.fullName).toBe('Dr. New');
      expect(updated.updatedAt).toBe('2026-08-22T00:00:00Z');
    });

    it('rejects calls that include unknown keys by stripping them before PUT', async () => {
      apiMock.put.mockResolvedValueOnce({ data: { userId: 1 } });
      await profileService.update(
        1,
        {
          fullName: 'OK',
          // The Swagger schema is `additionalProperties: false` — anything
          // outside the documented list would normally get a 400 from the BE.
          // The FE defends against this by stripping unknowns.
          madeUpField: 'value',
          token: 'leak',
        } as unknown as Partial<ProfileUpdateRequest>,
      );
      const sentBody = apiMock.put.mock.calls[0][1];
      expect(sentBody).toEqual({ userId: 1, fullName: 'OK' });
      expect(Object.keys(sentBody).sort()).toEqual(['fullName', 'userId']);
    });
  });
});