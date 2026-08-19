// TypeScript types for the Forum Post and Forum Comment endpoints.
// All field names are taken verbatim from the deployed Swagger contract at
// https://arsplatform.onrender.com/swagger/index.html. The Swagger schema
// is the authoritative reference — these types intentionally stay narrow
// rather than fabricating likes/views/commentCount fields that the API
// does not return (do not extend based on assumptions).

// ── ForumPost ────────────────────────────────────────────────────────────────
// Note: Swagger does NOT return likes, views, or commentCount for a post.
// Any count metadata shown in the UI must come from the dedicated
// endpoints (e.g. comment list length for comments), not invented here.
export interface ForumPost {
  id: number;
  title?: string | null;
  content?: string | null;
  abstract?: string | null;
  category?: string | null;
  tags?: string[] | null;
  attachedPdfUrl?: string | null;
  attachedImageUrl?: string | null;
  // `authorId` is not guaranteed by the current Swagger contract — the BE
  // may omit it. The FE treats it as optional and falls back to "Unknown
  // author" when absent. If the BE later confirms it always returns it,
  // we can tighten this type.
  authorId?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface ForumPostCreateRequest {
  title?: string | null;
  content?: string | null;
  abstract?: string | null;
  category?: string | null;
  tags?: string[] | null;
  attachedPdfUrl?: string | null;
  attachedImageUrl?: string | null;
}

// ── ForumComment ────────────────────────────────────────────────────────────
// Author display info (full name, avatar URL) is NOT in the comment payload
// per Swagger. The FE must call userService.getById(comment.userId) when it
// needs to render an author byline. For now, the FE shows "User {id}" as
// the fallback.
export interface ForumComment {
  id: number;
  userId?: number | null;
  paperId?: number | null;
  forumPostId?: number | null;
  content?: string | null;
  replyId?: number | null;
  upvoteCount?: number | null;
  createdAt?: string;
}

export interface ForumCommentCreateRequest {
  userId?: number | null;
  paperId?: number | null;
  forumPostId?: number | null;
  content?: string | null;
  replyId?: number | null;
  upvoteCount?: number | null;
}

export interface ForumCommentUpdateRequest {
  userId?: number | null;
  paperId?: number | null;
  content?: string | null;
  replyId?: number | null;
  upvoteCount?: number | null;
}

// ── UI-side filter params for the forum list page ───────────────────────────
// These mirror the Swagger `category`, `sort`, and `search` query params
// declared on GET /api/ForumPost. Kept as a separate type so the hook can
// accept partial inputs.
export interface ForumPostFilters {
  category?: string;
  sort?: string;
  search?: string;
}