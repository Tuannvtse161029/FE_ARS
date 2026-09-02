/**
 * profileExtras.service.ts — fetches a user's published papers and forum
 * posts for display on the public profile page.
 *
 * The BE Swagger does NOT publish an authorId / userId filter on either
 * `GET /api/Paper` or `GET /api/ForumPost`. Both endpoints return
 * the authorId field in their response payloads (confirmed against the
 * live BE). The safest, contract-compliant approach is to:
 *
 *   1. Fetch the first N items from each endpoint (no invented params).
 *   2. Filter client-side by authorId / userId.
 *   3. Return up to 3 items per section (profile page is a preview).
 *
 * A BE ticket should be opened to add `GET /api/Paper/by-author/{userId}`
 * and `GET /api/ForumPost/by-author/{userId}` so this can be replaced
 * with proper server-side filtering.
 *
 * API sources:
 *   GET /api/Paper         — paperService.getAll (paged, returns items[])
 *   GET /api/ForumPost     — forumPostService.getAll (array)
 *
 * NEVER hardcode localhost; always route through the shared `api` instance
 * which reads VITE_API_BASE_URL.
 */

import { paperService, type Paper } from './paper.service';
import { forumPostService } from './forumPost.service';
import type { ForumPost } from '../types/forum.types';

const FETCH_PAGE_SIZE = 24; // fetch enough to filter + take 3 in most cases
const MAX_PREVIEW = 3;      // max items shown per section on the profile card

export interface ProfilePublicationPreview {
  id: number;
  title: string;
  publishedAt: string | null;
  doi: string | null;
  abstract: string | null;
}

export interface ProfileForumPostPreview {
  id: number;
  title: string;
  createdAt: string | null;
  commentCount: number;
  likeCount: number;
  category: string | null;
  tags: string[];
}

export interface ProfileExtrasResult {
  publications: ProfilePublicationPreview[];
  forumPosts: ProfileForumPostPreview[];
}

/** Returns the first N published papers authored by `userId`. */
async function fetchUserPublications(userId: number): Promise<ProfilePublicationPreview[]> {
  try {
    const result = await paperService.getAll({
      pageNumber: 1,
      pageSize: FETCH_PAGE_SIZE,
    });

    const items = Array.isArray(result?.items) ? result.items : [];
    const authored = items.filter(
      (paper: Paper) =>
        paper.authorId === userId &&
        paper.status?.trim().toUpperCase() === 'PUBLISHED',
    );

    return authored
      .slice(0, MAX_PREVIEW)
      .map((paper: Paper): ProfilePublicationPreview => ({
        id: paper.id,
        title: paper.title ?? `Paper #${paper.id}`,
        publishedAt: paper.updatedAt ?? paper.createdAt ?? null,
        doi: paper.doi ?? null,
        abstract: paper.abstract ?? null,
      }));
  } catch {
    return [];
  }
}

/** Returns the first N forum posts authored by `userId`. */
async function fetchUserForumPosts(userId: number): Promise<ProfileForumPostPreview[]> {
  try {
    const posts: ForumPost[] = await forumPostService.getAll({ sort: 'newest' });

    const authored = posts.filter((post: ForumPost) => post.authorId === userId);

    return authored
      .slice(0, MAX_PREVIEW)
      .map((post: ForumPost): ProfileForumPostPreview => ({
        id: post.id,
        title: post.title ?? '(untitled post)',
        createdAt: post.createdAt ?? post.timestamp ?? null,
        commentCount: post.commentCount ?? post.comments ?? 0,
        likeCount: post.likeCount ?? post.likes ?? 0,
        category: post.category ?? null,
        tags: Array.isArray(post.tags) ? post.tags : [],
      }));
  } catch {
    return [];
  }
}

export const profileExtrasService = {
  /**
   * Fetch both sections in parallel. Fails silently on each individual
   * section — a failed papers fetch does not block the forum posts from
   * rendering.
   */
  async getByUserId(userId: number): Promise<ProfileExtrasResult> {
    const [publications, forumPosts] = await Promise.all([
      fetchUserPublications(userId),
      fetchUserForumPosts(userId),
    ]);
    return { publications, forumPosts };
  },
};

export default profileExtrasService;
