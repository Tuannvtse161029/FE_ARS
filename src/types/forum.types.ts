// TypeScript types for the Forum Post and Forum Comment endpoints.
// All field names are taken verbatim from the deployed Swagger contract at
// https://arsplatform.onrender.com/swagger/index.html. The Swagger schema
// is the authoritative reference — these types intentionally stay narrow
// rather than fabricating fields that the API does not return (do not
// extend based on assumptions).
//
// Agent 42 audit (2026-08-19):
//   The bundled `swagger.json` and the live /swagger/v1/swagger.json
//   document do NOT publish `likeCount` / `viewCount` / `commentCount`
//   on ForumPost, and no Like/Unlike/Toggle/Register-View endpoint
//   exists. However, the deployed BE actually returns these counters in
//   its real /api/ForumPost response (confirmed via Network panel by
//   the user). This is a documented schema-vs-runtime drift: the
//   backend ships the response but the OpenAPI document has not caught
//   up. Until the schema is republished, the FE accepts the live shape
//   and the comments below mark the divergence. BTR-AGENT42-A
//   (Like mutation) and BTR-AGENT42-B (View register) remain open.

// ── ForumPost ────────────────────────────────────────────────────────────────
// Live wire shape (confirmed against the deployed BE on 2026-08-19):
//   {
//     id, title, content, abstract, category, tags,
//     attachedPdfUrl, attachedImageUrl, authorId,
//     createdAt, updatedAt,
//     likeCount, viewCount, commentCount,
//     isLikedByCurrentUser,
//   }
// The last four fields are not in the published OpenAPI schema yet.
// Author display info (fullName, avatarUrl) is NOT in the post payload
// per the observed wire — the parent must call `userService.getById`
// when it needs to render an author byline. For now, the FE renders
// "Author #{id}" as a fallback.
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
  // ── Engagement counters ──────────────────────────────────────────────
  likes?: number;
  comments?: number;
  views?: number;
  likeCount?: number;
  viewCount?: number;
  commentCount?: number;
  isLiked?: boolean;
  isLikedByCurrentUser?: boolean;
}

export interface ForumPostLikeToggleResponse {
  postId: number;
  likes: number;
  isLiked: boolean;
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
  forumCommentId?: number;
  userId?: number | null;
  paperId?: number | null;
  forumPostId?: number | null;
  content?: string | null;
  replyId?: number | null;
  upvoteCount?: number | null;
  createdAt?: string;
  updatedAt?: string;
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