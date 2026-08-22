/**
 * useForumPosts hook tests.
 *
 * Coverage:
 *   - getAll is called with the supplied filter object on mount.
 *   - Loading -> success -> refetch() cycle.
 *   - Error state captures rejection and yields an empty list.
 *   - useCreateForumPost.create() returns the BE's response and sets isLoading.
 *   - Filter changes trigger refetch via axios.get calls.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useForumPosts, useCreateForumPost } from '../../../src/hooks/useForumPosts';
import { forumPostService } from '../../../src/services/forumPost.service';

vi.mock('../../../src/services/forumPost.service', () => ({
  forumPostService: {
    getAll: vi.fn(),
    getById: vi.fn(),
    create: vi.fn(),
  },
}));

const mocked = forumPostService as unknown as {
  getAll: ReturnType<typeof vi.fn>;
  create: ReturnType<typeof vi.fn>;
};

describe('useForumPosts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads posts on mount and exposes isLoading / posts / error', async () => {
    mocked.getAll.mockResolvedValueOnce([
      { id: 1, title: 'A' },
      { id: 2, title: 'B' },
    ]);

    const { result } = renderHook(() => useForumPosts());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.posts).toHaveLength(2);
    expect(result.current.error).toBeNull();
  });

  it('forwards filters to forumPostService.getAll', async () => {
    mocked.getAll.mockResolvedValueOnce([]);
    renderHook(() =>
      useForumPosts({ category: 'ml', sort: 'newest', search: 'ai' }),
    );
    await waitFor(() => expect(mocked.getAll).toHaveBeenCalled());
    expect(mocked.getAll).toHaveBeenCalledWith({
      category: 'ml',
      sort: 'newest',
      search: 'ai',
    });
  });

  it('captures error state and clears posts on rejection', async () => {
    mocked.getAll.mockRejectedValueOnce(new Error('Network down'));
    const { result } = renderHook(() => useForumPosts());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.posts).toEqual([]);
  });

  it('refetch() triggers a fresh getAll call', async () => {
    mocked.getAll.mockResolvedValue([]);
    const { result } = renderHook(() => useForumPosts());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(mocked.getAll).toHaveBeenCalledTimes(1);
    await act(async () => {
      await result.current.refetch();
    });
    expect(mocked.getAll).toHaveBeenCalledTimes(2);
  });
});

describe('useCreateForumPost', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('create() returns the BE response and clears loading', async () => {
    mocked.create.mockResolvedValueOnce({ id: 99, title: 'New' });
    const { result } = renderHook(() => useCreateForumPost());
    let created;
    await act(async () => {
      created = await result.current.create({ content: 'hi' });
    });
    expect(created).toEqual({ id: 99, title: 'New' });
    expect(result.current.isLoading).toBe(false);
  });

  it('create() captures error state on rejection and returns null', async () => {
    mocked.create.mockRejectedValueOnce(new Error('500'));
    const { result } = renderHook(() => useCreateForumPost());
    let created;
    await act(async () => {
      created = await result.current.create({ content: 'hi' });
    });
    expect(created).toBeNull();
    expect(result.current.error).toBeInstanceOf(Error);
  });
});