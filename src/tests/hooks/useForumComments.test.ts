/**
 * useForumComments + useForumCommentMutations hook tests.
 *
 * Coverage:
 *   - useForumComments loads comments for the supplied postId.
 *   - On rejection, captures error and yields an empty list.
 *   - useForumCommentMutations create/update/remove route to the service.
 *   - Each mutation returns null / false on failure and exposes an error.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import {
  useForumComments,
  useForumCommentMutations,
} from '../../hooks/useForumComments';
import { forumCommentService } from '../../services/forumComment.service';

vi.mock('../../services/forumComment.service', () => ({
  forumCommentService: {
    getByPostId: vi.fn(),
    getAll: vi.fn(),
    getById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

const mocked = forumCommentService as unknown as {
  getByPostId: ReturnType<typeof vi.fn>;
  create: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
};

describe('useForumComments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads comments for the given postId', async () => {
    mocked.getByPostId.mockResolvedValueOnce([
      { id: 1, forumPostId: 7, content: 'A' },
    ]);
    const { result } = renderHook(() => useForumComments(7));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.comments).toHaveLength(1);
    expect(mocked.getByPostId).toHaveBeenCalledWith(7);
  });

  it('returns [] on rejection and captures error', async () => {
    mocked.getByPostId.mockRejectedValueOnce(new Error('Network'));
    const { result } = renderHook(() => useForumComments(7));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.comments).toEqual([]);
    expect(result.current.error).toBeInstanceOf(Error);
  });
});

describe('useForumCommentMutations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('create() forwards to forumCommentService.create and returns the BE response', async () => {
    mocked.create.mockResolvedValueOnce({ id: 11, content: 'hi' });
    const { result } = renderHook(() => useForumCommentMutations());
    let created;
    await act(async () => {
      created = await result.current.create({ content: 'hi' });
    });
    expect(created).toEqual({ id: 11, content: 'hi' });
  });

  it('update() forwards to forumCommentService.update', async () => {
    mocked.update.mockResolvedValueOnce({ id: 11, content: 'edited' });
    const { result } = renderHook(() => useForumCommentMutations());
    let updated;
    await act(async () => {
      updated = await result.current.update(11, { content: 'edited' });
    });
    expect(updated).toEqual({ id: 11, content: 'edited' });
    expect(mocked.update).toHaveBeenCalledWith(11, { content: 'edited' });
  });

  it('remove() returns true on success, false on failure', async () => {
    mocked.delete.mockResolvedValueOnce({});
    const { result } = renderHook(() => useForumCommentMutations());
    let ok;
    await act(async () => {
      ok = await result.current.remove(11);
    });
    expect(ok).toBe(true);

    mocked.delete.mockRejectedValueOnce(new Error('500'));
    await act(async () => {
      ok = await result.current.remove(11);
    });
    expect(ok).toBe(false);
    expect(result.current.error).toBeInstanceOf(Error);
  });
});