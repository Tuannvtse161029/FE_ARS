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
