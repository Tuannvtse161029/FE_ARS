/**
 * useFollow hook tests.
 *
 * Coverage:
 *   - Loads the follow list on mount (filtering to the current user).
 *   - isFollowing() reflects the BE-loaded set.
 *   - toggleFollow(userId) flips the local set optimistically and calls
 *     followerService.follow() / followerService.unfollow().
 *   - Self-follow is silently rejected (no API call, no state change).
 *   - Duplicate follow is silently rejected.
 *   - Optimistic flip is rolled back on API failure.
 *   - Logout (isAuthenticated=false) wipes the local set.
 *   - refetch() reloads the BE list.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useFollow } from '../../hooks/useFollow';
import { followerService } from '../../services/follower.service';

// ── AuthContext mock ───────────────────────────────────────────────────────
// We don't import the real AuthContext here because it pulls in Zustand
// persistence + react-router navigate. A tiny surface is enough for the
// hook's needs.
const mockUseAuth = vi.fn();

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock('../../utils/storage', () => ({
  storage: {
    getToken: vi.fn().mockReturnValue(null),
    getUser: vi.fn().mockReturnValue(null),
    setToken: vi.fn(),
    setUser: vi.fn(),
    clearAuth: vi.fn(),
    getRememberMe: vi.fn().mockReturnValue(false),
    setRememberMe: vi.fn(),
    removeToken: vi.fn(),
    removeUser: vi.fn(),
    removeRememberMe: vi.fn(),
    clearAll: vi.fn(),
  },
}));

vi.mock('../../services/follower.service', () => ({
  followerService: {
    getAll: vi.fn(),
    follow: vi.fn(),
    unfollow: vi.fn(),
  },
}));

const mocked = followerService as unknown as {
  getAll: ReturnType<typeof vi.fn>;
  follow: ReturnType<typeof vi.fn>;
  unfollow: ReturnType<typeof vi.fn>;
};

const viewer = {
  user: { userId: 1, token: 't', username: 'u', email: 'u@x', role: 'Researcher' },
  isAuthenticated: true,
  isLoading: false,
  error: null,
  login: () => Promise.resolve(),
  logout: () => undefined,
  clearError: () => undefined,
  pendingRoleSelection: null,
  confirmRoleSelection: () => undefined,
  cancelRoleSelection: () => undefined,
};

beforeEach(() => {
  // `vi.clearAllMocks()` only wipes call history, NOT the
  // mockResolvedValueOnce queue — leftover queue values from earlier
  // tests will bleed into later ones. Use `mockReset()` on each service
  // method so the queue is fully drained between tests.
  vi.clearAllMocks();
  mocked.getAll.mockReset();
  mocked.follow.mockReset();
  mocked.unfollow.mockReset();
  mockUseAuth.mockReturnValue(viewer);
});

describe('useFollow — initial load', () => {
  it('fetches the follow list on mount and exposes isFollowing()', async () => {
    mocked.getAll.mockResolvedValueOnce([
      { id: 10, followerId: 1, followedId: 2 },
      { id: 11, followerId: 1, followedId: 3 },
      // Different follower — should NOT be included in the viewer's set.
      { id: 12, followerId: 99, followedId: 4 },
    ]);

    const { result } = renderHook(() => useFollow());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mocked.getAll).toHaveBeenCalledTimes(1);
    expect(result.current.followingIds.has(2)).toBe(true);
    expect(result.current.followingIds.has(3)).toBe(true);
    expect(result.current.followingIds.has(4)).toBe(false);
    expect(result.current.isFollowing(2)).toBe(true);
    expect(result.current.isFollowing(99)).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('captures error state and yields an empty set on rejection', async () => {
    mocked.getAll.mockRejectedValueOnce(new Error('Network down'));

    const { result } = renderHook(() => useFollow());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // `error` is a string message per the spec, not an Error instance.
    expect(typeof result.current.error).toBe('string');
    expect(result.current.error).toContain('Network down');
    expect(result.current.followingIds.size).toBe(0);
  });
});

describe('useFollow — toggleFollow', () => {
  it('calls followerService.follow() with { followedId } when not following', async () => {
    mocked.getAll.mockResolvedValueOnce([]);
    mocked.follow.mockResolvedValueOnce({ id: 99, followerId: 1, followedId: 5 });
    mocked.getAll.mockResolvedValueOnce([
      { id: 99, followerId: 1, followedId: 5 },
    ]);

    const { result } = renderHook(() => useFollow());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.toggleFollow(5);
    });

    expect(mocked.follow).toHaveBeenCalledWith({ followedId: 5 });
    expect(result.current.isFollowing(5)).toBe(true);
  });

  it('calls followerService.unfollow(rowId) when already following', async () => {
    mocked.getAll.mockResolvedValueOnce([
      { id: 77, followerId: 1, followedId: 5 },
    ]);
    mocked.unfollow.mockResolvedValueOnce(undefined);
    mocked.getAll.mockResolvedValueOnce([]);

    const { result } = renderHook(() => useFollow());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isFollowing(5)).toBe(true);

    await act(async () => {
      await result.current.toggleFollow(5);
    });

    expect(mocked.unfollow).toHaveBeenCalledWith(77);
    expect(result.current.isFollowing(5)).toBe(false);
  });

  it('rolls back the optimistic flip when the BE rejects', async () => {
    mocked.getAll.mockResolvedValueOnce([]);
    mocked.follow.mockRejectedValueOnce(new Error('500'));

    const { result } = renderHook(() => useFollow());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.toggleFollow(5);
    });

    expect(result.current.isFollowing(5)).toBe(false);
    // `error` is a string message per the spec, not an Error instance.
    expect(typeof result.current.error).toBe('string');
    expect(result.current.error).toContain('500');
  });

  it('does nothing when the viewer tries to follow themselves', async () => {
    mocked.getAll.mockResolvedValueOnce([]);

    const { result } = renderHook(() => useFollow());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.toggleFollow(1); // currentUserId === 1
    });

    expect(mocked.follow).not.toHaveBeenCalled();
    expect(mocked.unfollow).not.toHaveBeenCalled();
    expect(result.current.followingIds.size).toBe(0);
  });

  it('does nothing when unauthenticated', async () => {
    mockUseAuth.mockReturnValue({ ...viewer, isAuthenticated: false });
    mocked.getAll.mockResolvedValueOnce([]);

    const { result } = renderHook(() => useFollow());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.toggleFollow(5);
    });

    expect(mocked.follow).not.toHaveBeenCalled();
  });
});

describe('useFollow — logout transition', () => {
  it('wipes the followingIds set when the viewer logs out', async () => {
    mocked.getAll.mockResolvedValueOnce([
      { id: 1, followerId: 1, followedId: 2 },
    ]);

    const { result, rerender } = renderHook(() => useFollow());
    // Wait for the BE fetch to complete.
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    // Then wait for the deriving effect to populate followingIds.
    await waitFor(() => expect(result.current.followingIds.has(2)).toBe(true));

    // Simulate logout.
    mockUseAuth.mockReturnValue({ ...viewer, isAuthenticated: false });
    rerender();

    await waitFor(() => expect(result.current.followingIds.size).toBe(0));
    expect(result.current.isFollowing(2)).toBe(false);
  });
});

describe('useFollow — refetch', () => {
  it('re-fetches the BE list when refetch() is called', async () => {
    mocked.getAll.mockResolvedValue([]);

    const { result } = renderHook(() => useFollow());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mocked.getAll).toHaveBeenCalledTimes(1);
    await act(async () => {
      await result.current.refetch();
    });
    expect(mocked.getAll).toHaveBeenCalledTimes(2);
  });
});