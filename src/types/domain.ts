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

// ── PayOS Payment ────────────────────────────────────────────────────────────
// Shapes mirror the deployed Swagger contract at
// https://arsplatform.onrender.com/swagger/index.html (ARSPlatform API v1).
// Field names are taken verbatim from the OpenAPI document — do NOT rename.
// All payment statuses below come from PayOS's documented redirect convention
// (?status=PAID|PENDING|CANCELLED|FAILED); the BE echoes them and the FE
// reads them at /payment/return. No backend-confirmed enum exists yet, so we
// treat status as a string and only branch on the documented values.
export type PayOSPaymentStatus =
  | 'PAID'
  | 'PENDING'
  | 'CANCELLED'
  | 'FAILED'
  | 'PROCESSING'
  | string;

export interface PaymentCreateRequest {
  amount: number;
  description?: string | null;
  userId?: number | null;
  walletId?: number | null;
  returnUrl?: string | null;
  cancelUrl?: string | null;
}

// `/api/Payment/create-link` response. The Swagger spec marks the response as
// `200 OK` without an explicit schema, but the BE echoes this shape (verified
// against the previously shipped FE). `checkoutUrl` is the PayOS redirect URL
// the browser must follow. `orderCode` is the numeric PayOS order code, used
// as the authoritative identifier when reconciling the return URL.
export interface PaymentLink {
  checkoutUrl: string;
  orderCode: number | string;
  qrCode?: string;
  status?: PayOSPaymentStatus;
}

// Result from `/api/Payment/success` and `/api/Payment/cancel`. The Swagger
// spec doesn't define a schema; we declare the fields the FE actually reads.
export interface PaymentStatusResult {
  orderCode?: number | string;
  status?: PayOSPaymentStatus;
  amount?: number;
  message?: string;
  code?: string;
}

// PayOS webhook payload schema (backend-only; FE never receives this — kept
// here so devs can mock the type when unit-testing webhook handlers).
export interface PayOSWebhookData {
  orderCode?: number;
  amount?: number;
  description?: string | null;
  reference?: string | null;
  transactionDateTime?: string | null;
  currency?: string | null;
  paymentLinkId?: string | null;
  code?: string | null;
  desc?: string | null;
}

export interface PayOSWebhookRequest {
  code?: string | null;
  desc?: string | null;
  data?: PayOSWebhookData;
  signature?: string | null;
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
// Strict shape derived from the live Swagger contract
// (`/api/Notification`). The Swagger schema only exposes `id`, `userId`,
// `message`, `isRead`, and an optional `createdAt`. There is intentionally
// NO `type`, NO `targetUrl`, NO `relatedEntityId`, NO bulk endpoints.
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

// ── Wallet ───────────────────────────────────────────────────────────────────
export interface Wallet {
  // `id` is the primary key; `walletId` is the BE's own identifier field
  // returned in the Swagger response. Both are present in the JSON but are
  // semantically distinct per the BE schema — they happen to be equal for the
  // first wallet created for a user.
  id: number;
  walletId?: number;
  userId: number;
  balance: number;
  currency?: string;
  updatedAt?: string;
}

export interface WalletCreateRequest {
  userId?: number | null;
  balance?: number | null;
}
