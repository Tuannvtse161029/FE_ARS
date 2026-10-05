/**
 * Hook-level tests for src/hooks/useUserAvatar.ts.
 *
 * The forum surface uses this hook to look up the post / comment
 * author's avatar from the `User` table (NOT the `Profile` table,
 * which is stale because `Profile.tsx::handleAvatarSave` only writes
 * to `User.avatarUrl`).
 *
 * Coverage:
 *   - Null / non-positive id → no fetch, avatarUrl is null.
 *   - Valid id → calls `userService.getById(id)` and returns the
 *     resolved `User.avatarUrl`.
 *   - Module-scoped promise cache dedupes concurrent calls for the
 *     same id.
 *   - Silent failure on 4xx/5xx → `avatarUrl` stays null, no throw.
 *   - String `''` and null `User.avatarUrl` collapse to `null` so the
 *     UI falls back to initials instead of rendering a broken image.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

const { getByIdMock } = vi.hoisted(() => ({ getByIdMock: vi.fn() }));

vi.mock('../../../src/services/user.service', () => ({
  userService: { getById: getByIdMock },
}));

import { useUserAvatar } from '../../../src/hooks/useUserAvatar';

describe('useUserAvatar', () => {
  beforeEach(() => {
    getByIdMock.mockReset();
  });

  it('returns null without fetching when userId is null', async () => {
    const { result } = renderHook(() => useUserAvatar(null));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.avatarUrl).toBeNull();
    expect(getByIdMock).not.toHaveBeenCalled();
  });

  it('returns null without fetching when userId is non-positive', async () => {
    const { result } = renderHook(() => useUserAvatar(0));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.avatarUrl).toBeNull();
    expect(getByIdMock).not.toHaveBeenCalled();
  });

  it('fetches /api/User/{id} once and returns the resolved avatarUrl', async () => {
    getByIdMock.mockResolvedValueOnce({
      id: 7,
      username: 'emily',
      email: 'emily@example.com',
      fullName: 'Emily Lecturer',
      avatarUrl: 'https://cdn.example.com/avatars/emily.png',
      roleId: 4,
      roleName: 'Lecturer',
      isActive: true,
    });
    const { result } = renderHook(() => useUserAvatar(7));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(getByIdMock).toHaveBeenCalledTimes(1);
    expect(getByIdMock).toHaveBeenCalledWith(7);
    expect(result.current.avatarUrl).toBe('https://cdn.example.com/avatars/emily.png');
  });

  it('preserves `lucide:<id>` symbolic avatar URLs (AvatarVisual handles the prefix)', async () => {
    getByIdMock.mockResolvedValueOnce({
      id: 12,
      username: 'grad',
      email: 'grad@example.com',
      fullName: 'Grad Student',
      avatarUrl: 'lucide:graduation',
      roleId: 3,
      roleName: 'Graduate Student',
      isActive: true,
    });
    const { result } = renderHook(() => useUserAvatar(12));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.avatarUrl).toBe('lucide:graduation');
  });

  it('collapses an empty-string User.avatarUrl to null (initials fallback)', async () => {
    getByIdMock.mockResolvedValueOnce({
      id: 13,
      username: 'noavatar',
      email: 'na@example.com',
      fullName: 'No Avatar',
      avatarUrl: '',
      roleId: 3,
      roleName: 'Graduate Student',
      isActive: true,
    });
    const { result } = renderHook(() => useUserAvatar(13));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.avatarUrl).toBeNull();
  });

  it('dedupes concurrent calls for the same id (module-scoped promise cache)', async () => {
    getByIdMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(
            () =>
              resolve({
                id: 22,
                username: 'concurrent',
                email: 'c@example.com',
                fullName: 'Concurrent User',
                avatarUrl: 'https://cdn.example.com/avatars/c.png',
                roleId: 4,
                roleName: 'Lecturer',
                isActive: true,
              }),
            0,
          );
        }),
    );

    const first = renderHook(() => useUserAvatar(22));
    const second = renderHook(() => useUserAvatar(22));
    await waitFor(() =>
      expect(first.result.current.isLoading && second.result.current.isLoading).toBe(
        false,
      ),
    );

    expect(getByIdMock).toHaveBeenCalledTimes(1);
    first.unmount();
    second.unmount();
  });

  it('silent failure on 4xx: no throw, avatarUrl stays null', async () => {
    getByIdMock.mockRejectedValueOnce(new Error('404 Not Found'));
    const { result } = renderHook(() => useUserAvatar(42));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.avatarUrl).toBeNull();
  });

  it('silent failure on 5xx: same shape (avatarUrl null, no throw)', async () => {
    getByIdMock.mockRejectedValueOnce(new Error('503 Service Unavailable'));
    const { result } = renderHook(() => useUserAvatar(99));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.avatarUrl).toBeNull();
  });

  it('changing userId from null to a valid id triggers a fetch', async () => {
    getByIdMock.mockResolvedValueOnce({
      id: 5,
      username: 'late',
      email: 'late@example.com',
      fullName: 'Late Loader',
      avatarUrl: 'https://cdn.example.com/avatars/late.png',
      roleId: 4,
      roleName: 'Lecturer',
      isActive: true,
    });
    const { result, rerender } = renderHook(({ id }: { id: number | null }) => useUserAvatar(id), {
      initialProps: { id: null as number | null },
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(getByIdMock).not.toHaveBeenCalled();

    rerender({ id: 5 });
    await waitFor(() => expect(result.current.avatarUrl).toBe('https://cdn.example.com/avatars/late.png'));
    expect(getByIdMock).toHaveBeenCalledTimes(1);
    expect(getByIdMock).toHaveBeenCalledWith(5);
  });

  it('changing userId between two valid ids swaps avatars without leaking state', async () => {
    getByIdMock.mockImplementation((id: number) =>
      Promise.resolve({
        id,
        username: `u${id}`,
        email: `u${id}@example.com`,
        fullName: `User ${id}`,
        avatarUrl: `https://cdn.example.com/avatars/u${id}.png`,
        roleId: 4,
        roleName: 'Lecturer',
        isActive: true,
      }),
    );

    const { result, rerender } = renderHook(({ id }: { id: number | null }) => useUserAvatar(id), {
      initialProps: { id: 1 as number | null },
    });
    await waitFor(() => expect(result.current.avatarUrl).toBe('https://cdn.example.com/avatars/u1.png'));

    rerender({ id: 2 });
    await waitFor(() => expect(result.current.avatarUrl).toBe('https://cdn.example.com/avatars/u2.png'));
    // The first avatar must not leak onto the second render.
    expect(result.current.avatarUrl).not.toBe('https://cdn.example.com/avatars/u1.png');
  });
});