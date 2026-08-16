// Domain types for the new Swagger endpoints.
// Keep these aligned with https://arsplatform.onrender.com/swagger/v1/swagger.json

// ── Research field taxonomy ──────────────────────────────────────────────────
export interface MajorField {
  id: number;
  name: string;
  description?: string | null;
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

// ── PayOS Payment ────────────────────────────────────────────────────────────
export interface PaymentCreateRequest {
  amount: number;
  description?: string | null;
  userId?: number | null;
  walletId?: number | null;
  returnUrl?: string | null;
  cancelUrl?: string | null;
}

export interface PaymentLink {
  checkoutUrl: string;
  orderCode: number | string;
  qrCode?: string;
  status?: string;
}

// ── Follower ─────────────────────────────────────────────────────────────────
export interface Follower {
  id: number;
  followerId: number;
  followedId: number;
  createdAt?: string;
}

export interface FollowerCreateRequest {
  followedId: number;
}

// ── Notification ─────────────────────────────────────────────────────────────
export interface NotificationItem {
  id: number;
  userId: number;
  message: string;
  isRead: boolean;
  createdAt?: string;
}

export interface NotificationCreateRequest {
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

// ── Wallet ───────────────────────────────────────────────────────────────────
export interface Wallet {
  id: number;
  userId: number;
  balance: number;
  currency?: string;
  updatedAt?: string;
}

export interface WalletCreateRequest {
  userId?: number | null;
  balance?: number | null;
}
