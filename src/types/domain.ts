// Domain types for the new Swagger endpoints.
// Keep these aligned with https://arsplatform.onrender.com/swagger/v1/swagger.json

// ── Research field taxonomy ──────────────────────────────────────────────────
export interface MajorField {
  id: number;
  name: string;
  description?: string | null;
  subFields?: SubField[];
}

export interface MajorFieldCreateRequest {
  name?: string | null;
  description?: string | null;
}

export interface SubField {
  id: number;
  majorFieldId: number;
  name: string;
  description?: string | null;
}

export interface SubFieldCreateRequest {
  majorFieldId?: number | null;
  name?: string | null;
  description?: string | null;
}

// ── GradingRubric ─────────────────────────────────────────────────────────────
/**
 * A single scoring criterion within a SubField's GradingRubric.
 * The `code` field is the stable identifier used by Reviewer evaluations —
 * changing it will break existing DetailedEvaluation records.
 */
export interface GradingRubricCriterion {
  code: string;
  title: string;
  description: string;
  maxScore: number;
  order: number;
  standardReferences: string[];
}

/** SubField with rubric data as returned by GET /api/SubField and GET /api/SubField/{id}. */
export interface SubFieldWithRubric {
  id?: number;
  subFieldId: number;
  majorFieldId?: number | null;
  name: string;
  majorFieldName: string;
  description?: string | null;
  gradingRubric: GradingRubricCriterion[];
}

/** Request body for PUT /api/SubField/{id}. */
export interface SubFieldUpdateRequest {
  majorFieldId?: number | null;
  name?: string | null;
  description?: string | null;
  gradingRubric?: GradingRubricCriterion[] | null;
}

/** Request body for PATCH /api/SubField/{id}/rubric. */
export interface PatchRubricRequest {
  gradingRubric: GradingRubricCriterion[];
}



// ── Follower ─────────────────────────────────────────────────────────────────
export interface Follower {
  id?: number;
  followerId: number;
  followerName?: string | null;
  followerEmail?: string | null;
  followerAvatarUrl?: string | null;
  followedId: number;
  followedName?: string | null;
  followedEmail?: string | null;
  followedAvatarUrl?: string | null;
  createdAt?: string | null;
}

export interface FollowerResponse extends Follower {}

export interface FollowerCreateRequest {
  followedId: number;
}

export interface FollowCountsResponse {
  userId: number;
  followersCount: number;
  followingCount: number;
}

export interface FollowerPagedResult {
  items?: FollowerResponse[] | null;
  totalCount: number;
  pageNumber: number;
  pageSize: number;
  totalPages: number;
  hasPrevious: boolean;
  hasNext: boolean;
}

// ── Notification ─────────────────────────────────────────────────────────────
// Strict shape aligned with live Swagger contract (`/api/Notification`).
export interface NotificationItem {
  id: number;
  notificationId?: number;
  userId?: number | null;
  message?: string | null;
  isRead?: boolean | null;
  createdAt?: string | null;
}

export interface NotificationResponse extends NotificationItem {}

export interface UnreadNotificationCountResponse {
  unreadCount: number;
}

export interface NotificationResponsePagedResult {
  items?: NotificationResponse[] | null;
  totalCount: number;
  pageNumber: number;
  pageSize: number;
  totalPages: number;
  hasPrevious: boolean;
  hasNext: boolean;
}

export interface NotificationCreateRequest {
  userId?: number | null;
  message?: string | null;
  isRead?: boolean | null;
}

export interface NotificationUpdateRequest {
  userId?: number | null;
  message?: string | null;
  isRead?: boolean | null;
}

// ── UserRole ─────────────────────────────────────────────────────────────────
export interface UserRoleItem {
  id: number;
  userId: number;
  roleId: number;
  userRole1?: string | null;
}

export interface UserRoleCreateRequest {
  userId?: number | null;
  roleId?: number | null;
  userRole1?: string | null;
}

// ── CommentVote ──────────────────────────────────────────────────────────────
export interface CommentVote {
  id: number;
  userId: number;
  forumCommentId: number;
}

export interface CommentVoteCreateRequest {
  userId: number;
  forumCommentId: number;
}
