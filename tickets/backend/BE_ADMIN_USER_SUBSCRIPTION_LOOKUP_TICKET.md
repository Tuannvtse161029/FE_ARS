# Backend Ticket: Admin Subscription Lookup for Arbitrary User

## ID

BE-ANNUALFEE-ADMIN-USER-SUBSCRIPTION

## Priority

High — the admin View User Details modal currently displays "Pending — admin endpoint unavailable" for every Researcher / Lecturer profile because the FE has no way to inspect another user's annual-fee subscription from the documented Swagger surface.

## Background

The admin Accounts screen (`/admin/accounts` → View Profile) shows a Subscription card for users holding the Researcher or Lecturer role. The card needs two pieces of data:

1. Whether the target user currently has an active subscription.
2. The expiry date of that subscription.

Today the only documented endpoint that returns subscription state is `/api/AnnualFees/my-subscription`, which is bound to the caller's JWT. Calling it from an Admin with a `?userId={id}` query parameter is silently ignored by the BE: the BE always returns the Admin's own subscription state. Live confirmation on staging (`https://arsplatform.onrender.com`):

- Admin calls `GET /api/AnnualFees/my-subscription?userId=22` (Dr. Jane Smith) → `{"message": "No active subscription."}` — this is the Admin's own state, not Dr. Jane Smith's.
- Dr. Jane Smith calls `GET /api/AnnualFees/my-subscription` directly → `{"purchase": null, "annualFee": null, "daysRemaining": 264, "isExpired": false}`. The BE tracks her subscription internally but does not expose it through any admin-facing surface.
- `/api/AnnualFees/{id}/subscribers` returns an empty list for every plan (`/AnnualFees/2/subscribers`, `3`, `4`, `5` all return `{items: [], totalCount: 0}`), so the FE cannot enumerate plan members to derive Dr. Jane Smith's status.
- `/api/User/{id}` returns `accountTier: null` for Dr. Jane Smith (and every other user) even though the auth login response includes `subscriptionExpiresAt: "2027-06-10T08:48:50.78"` for her.

The BE clearly holds the subscription state internally (the user's own `/my-subscription` proves it), but the admin path is missing.

## Goal

Expose an authenticated, admin-only endpoint that returns the current subscription snapshot for an arbitrary user id, so the admin View Profile modal can render the real status and expiry date for Researcher and Lecturer profiles.

## Required Endpoint

`GET /api/AnnualFees/admin/users/{userId}/subscription`

### Authorization

- Require an authenticated caller with the System Admin role.
- Return `401` for unauthenticated callers.
- Return `403` for authenticated non-admin callers (Lecturer, Researcher, Reviewer, Graduate Student).

### Path Parameter

| Name | Type | Required | Notes |
| --- | --- | --- | --- |
| `userId` | integer | yes | The target user's id. Must be a positive 32-bit integer that matches an existing user. |

### Success Response — 200 OK

The response shape must mirror `MySubscriptionResponse` (`purchase`, `annualFee`, `daysRemaining`, `isExpired`) plus a top-level `expiresAt` ISO timestamp. Dr. Jane Smith's live snapshot today is:

```json
{
  "purchase": null,
  "annualFee": null,
  "daysRemaining": 264,
  "isExpired": false,
  "expiresAt": "2027-06-10T08:48:50.78"
}
```

Documented schema:

```json
{
  "userId": 22,
  "purchase": {
    "transactionId": 0,
    "userId": 22,
    "annualFeeId": 3,
    "amount": 900000,
    "status": "Completed",
    "description": "Researcher Yearly",
    "paymentDescription": "Annual subscription",
    "paymentMethod": "PayOS",
    "paymentOrderId": "...",
    "createdAt": "2026-09-11T08:48:50.78",
    "expiryDate": "2027-06-10T08:48:50.78",
    "annualFee": null
  },
  "annualFee": {
    "id": 3,
    "name": "Researcher Yearly",
    "userRole": "Researcher",
    "price": 900000,
    "billingCycle": "Annual",
    "startDate": "0001-01-01T00:00:00",
    "endDate": null,
    "status": true,
    "createdAt": "2026-09-10T08:25:20.2009557",
    "updatedAt": "2026-09-10T08:25:20.200971"
  },
  "daysRemaining": 264,
  "isExpired": false,
  "expiresAt": "2027-06-10T08:48:50.78"
}
```

`purchase` and `annualFee` may be `null` for users whose subscription is tracked internally but not linked to a purchase record (the live Dr. Jane Smith case). When `purchase` is `null` but `daysRemaining > 0`, the FE will derive the expiry from `daysRemaining`. The top-level `expiresAt` MUST be returned whenever the user has an active or expired subscription, regardless of whether `purchase` is populated, so the FE does not have to recompute.

### Error Responses

| Condition | Status | Body |
| --- | --- | --- |
| Missing or non-numeric `userId` | `400` | `{ "message": "userId is required." }` |
| `userId` does not match any user | `404` | `{ "message": "User not found." }` |
| Caller is authenticated but not an Admin | `403` | `{ "message": "Admin role required." }` |
| Caller is unauthenticated | `401` | Standard auth challenge response |

The endpoint must not return a "no subscription" payload with `200`. Users without a subscription must produce a clear `404` (or a documented "no subscription" body) so the FE can distinguish "BE has no data" from "BE errored".

## Behavioural Notes

- The endpoint must read the same internal source that powers `/api/AnnualFees/my-subscription`. The login response already exposes `subscriptionExpiresAt`; the same field should feed this endpoint.
- It must work for any user the Admin can already see on the Accounts screen, including users whose `accountTier` is `null` and whose `/AnnualFees/{id}/subscribers` membership is empty.
- It must return the same value the target user would see on their own Subscription tab; do not downgrade or filter it for the Admin context.
- Do not include any new fields beyond `purchase`, `annualFee`, `daysRemaining`, `isExpired`, `expiresAt`, and a top-level `userId`. The FE already normalizes this shape.
- Audit-log the Admin's id, the target userId, the request timestamp, and the response status. Do not log the subscription payload.

## Acceptance Criteria

- Admin can fetch the subscription snapshot for `userId=22` (Dr. Jane Smith) and receive `isExpired: false`, `daysRemaining: 264`, `expiresAt` populated to `2027-06-10`.
- Non-admin authenticated callers receive `403` and never see another user's subscription.
- Unauthenticated callers receive `401`.
- Unknown userId returns `404`.
- The endpoint sits behind the existing JWT middleware and Swagger documents it under the `AnnualFee` tag.
- `/api/AnnualFees/my-subscription` continues to behave exactly as it does today (user-scoped, no admin override).
- The admin `ViewProfileModal` Subscription card transitions from "Pending — admin endpoint unavailable" to "Active" with the formatted expiry date once this endpoint is live and the FE switches over.
