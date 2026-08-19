/**
 * Service tests for forumPost.service + forumComment.service.
 *
 * Axios is mocked so the services run in isolation. The tests verify:
 *   - getAll forwards the BE filter object to axios.get as `params`.
 *   - getAll returns [] when the BE responds with a non-array payload.
 *   - getById targets `/api/ForumPost/{id}`.
 *   - create POSTs the create-request DTO.
 *   - comment.getByPostId fetches all comments and filters client-side by forumPostId.
 *   - comment.create/update/delete hit the right endpoints with the right verbs.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const { mockGet, mockPost, mockPut, mockDelete } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockPost: vi.fn(),
  mockPut: vi.fn(),
  mockDelete: vi.fn(),
}));

vi.mock('../../services/axios', () => ({
  default: {
    get: (...args: unknown[]) => mockGet(...args),
    post: (...args: unknown[]) => mockPost(...args),
    put: (...args: unknown[]) => mockPut(...args),
    delete: (...args: unknown[]) => mockDelete(...args),
  },
}));

import { forumPostService } from '../../services/forumPost.service';
import { forumCommentService } from '../../services/forumComment.service';

describe('forumPostService', () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockPost.mockReset();
  });

  it('getAll forwards filters as axios params', async () => {
    mockGet.mockResolvedValueOnce({ data: [] });
    await forumPostService.getAll({ category: 'ml', sort: 'newest', search: 'ai' });
    expect(mockGet).toHaveBeenCalledWith('/api/ForumPost', {
      params: { category: 'ml', sort: 'newest', search: 'ai' },
    });
  });

  it('getAll returns [] when BE responds with a non-array payload', async () => {
    mockGet.mockResolvedValueOnce({ data: { items: [] } });
    const result = await forumPostService.getAll();
    expect(result).toEqual([]);
  });

  it('getById targets /api/ForumPost/{id}', async () => {
    mockGet.mockResolvedValueOnce({ data: { id: 7, title: 'Hello' } });
    await forumPostService.getById(7);
    expect(mockGet).toHaveBeenCalledWith('/api/ForumPost/7');
  });

  it('create POSTs the ForumPostCreateRequest to /api/ForumPost', async () => {
    mockPost.mockResolvedValueOnce({ data: { id: 1 } });
    await forumPostService.create({
      title: 'My paper',
      content: 'Body',
      tags: ['#ML'],
    });
    expect(mockPost).toHaveBeenCalledWith('/api/ForumPost', {
      title: 'My paper',
      content: 'Body',
      tags: ['#ML'],
    });
  });
});

describe('forumCommentService', () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockPost.mockReset();
    mockPut.mockReset();
    mockDelete.mockReset();
  });

  it('getByPostId fetches all comments and filters by forumPostId', async () => {
    mockGet.mockResolvedValueOnce({
      data: [
        { id: 1, forumPostId: 7, content: 'A' },
        { id: 2, forumPostId: 8, content: 'B' },
        { id: 3, forumPostId: 7, content: 'C' },
      ],
    });
    const result = await forumCommentService.getByPostId(7);
    expect(mockGet).toHaveBeenCalledWith('/api/ForumComment');
    expect(result).toHaveLength(2);
    expect(result.map((c) => c.id)).toEqual([1, 3]);
  });

  it('create POSTs the ForumCommentCreateRequest', async () => {
    mockPost.mockResolvedValueOnce({ data: { id: 1 } });
    await forumCommentService.create({
      userId: 2,
      forumPostId: 7,
      content: 'Hello',
    });
    expect(mockPost).toHaveBeenCalledWith('/api/ForumComment', {
      userId: 2,
      forumPostId: 7,
      content: 'Hello',
    });
  });

  it('update PUTs the ForumCommentUpdateRequest to /api/ForumComment/{id}', async () => {
    mockPut.mockResolvedValueOnce({ data: { id: 5 } });
    await forumCommentService.update(5, { content: 'edited' });
    expect(mockPut).toHaveBeenCalledWith('/api/ForumComment/5', {
      content: 'edited',
    });
  });

  it('delete hits DELETE /api/ForumComment/{id}', async () => {
    mockDelete.mockResolvedValueOnce({});
    await forumCommentService.delete(5);
    expect(mockDelete).toHaveBeenCalledWith('/api/ForumComment/5');
  });

  it('getByPostId returns [] when BE returns a non-array payload', async () => {
    mockGet.mockResolvedValueOnce({ data: { items: [] } });
    const result = await forumCommentService.getByPostId(7);
    expect(result).toEqual([]);
  });
});