# BE Ticket — Annual Fee Management + PayOS Purchase Flow

## ID

BE-ANNUAL-FEE-01

## Priority

**High** — blocks the platform's revenue collection for premium roles. The ARS platform has removed the legacy `PremiumPackage` / `MembershipPackage` controllers; annual subscription fees are now the single monetised tier for `Researcher` and `Lecturer` roles. Without this BE implementation, the Admin Annual Fees screen and the user-facing subscription flow cannot function.

This ticket supersedes the brief placeholder at `tickets/backend/BE_ANNUAL_FEE_API_TICKET.md` and aligns with the existing FE contracts in:

- `src/types/annualFee.ts`
- `src/services/annualFee.service.ts`
- `src/utils/constants.ts` → `ENDPOINTS.ADMIN.ANNUAL_FEES`

## Background

The ARS platform collects an annual subscription fee from two roles:

- **Researcher** — uploads manuscripts, submits papers, tracks review status
- **Lecturer** — creates research groups, supervises graduate students, hosts seminars

Both roles MUST hold an active annual fee subscription to use the platform. The fee replaces the dropped `PremiumPackage` / `MembershipPackage` model.

### Pricing model

- **Currency:** VND only (no decimals, no other currencies).
- **Billing cycles:** exactly two — `SixMonth` (6 months) and `Annual` (12 months). The legacy `Quarterly` cycle from the old `BE_ANNUAL_FEE_API_TICKET.md` stub must NOT be reintroduced.
- **Pricing per (role × billing-cycle) combination:** defined and managed exclusively by Admin. The FE client cannot influence price or entitlement during checkout.

### PayOS payment flow

1. User (Researcher or Lecturer) opens the **Subscription** tab in their workspace and selects a plan.
2. FE sends `POST /api/AnnualFee/{id}/purchase` with `returnUrl` and `cancelUrl`.
3. BE creates a `PENDING_PAYMENT` purchase record, calls the PayOS API to mint a checkout URL, and returns it.
4. FE redirects the browser to the PayOS checkout URL (the PayOS-hosted QR code page).
5. User scans the QR with their banking app and confirms payment.
6. PayOS sends a server-to-server webhook to the BE (`POST /api/AnnualFee/payos-webhook` or PayOS-managed callback).
7. BE verifies the webhook signature, marks the purchase `ACTIVE`, sets `expiryDate`, and credits the user's wallet / grants platform access.
8. PayOS redirects the user back to the FE `returnUrl`.
9. FE polls `GET /api/AnnualFee/my-current` (or refetches on focus) and shows the new active subscription with the expiry date.

### Subscription visibility

The user's active subscription status must be visible in **two places** on the FE:

1. **Header profile dropdown** — a compact badge showing the plan name + expiry date (e.g. "Researcher Annual · expires 2027-03-15") so the user always knows their standing.
2. **Subscription tab** — full breakdown (plan, purchase history, expiry countdown, "Renew" CTA).

Both surfaces read from the same `GET /api/AnnualFee/my-current` endpoint. The BE only needs to expose one source of truth; the FE handles the rendering.

## Goal

1. Persist `AnnualFee` plans managed by Admin (CRUD + toggle).
2. Persist `AnnualFeePurchase` records tied to users.
3. Implement a PayOS checkout flow that mints a redirect URL on `POST /api/AnnualFee/{id}/purchase`, processes the PayOS webhook to mark the purchase `ACTIVE`, and computes `expiryDate`.
4. Expose a single `GET /api/AnnualFee/my-current` endpoint that powers both the header badge and the subscription tab.
5. Enforce that only `Researcher` and `Lecturer` roles can purchase; `GraduateStudent`, `Reviewer`, and `Admin` cannot.
6. Enforce that only `Admin` can create / edit / delete / toggle plans.

## Database Schema

### Table: `AnnualFees`

| Column         | Type           | Null     | Default | Notes                                                          |
|----------------|----------------|----------|---------|----------------------------------------------------------------|
| `id`           | `INT`          | NOT NULL | auto    | PK                                                             |
| `title`        | `NVARCHAR(200)`| NOT NULL |         | Display name, e.g. "Researcher Annual Fee"                     |
| `target_role`  | `NVARCHAR(50)` | NOT NULL |         | Enum: `Researcher` \| `Lecturer`                               |
| `price_vnd`    | `BIGINT`       | NOT NULL |         | Whole-number VND (no decimals). `CHECK price_vnd > 0`.         |
| `billing_cycle`| `NVARCHAR(20)` | NOT NULL |         | Enum: `SixMonth` \| `Annual`                                   |
| `features`     | `TEXT`         | NULL     | `NULL`  | JSON-encoded `string[]` of bullet points                       |
| `is_active`    | `BIT`          | NOT NULL | `1`     | Whether new purchases are accepted                             |
| `created_at`   | `DATETIME2`    | NOT NULL | `now()` | UTC                                                            |
| `updated_at`   | `DATETIME2`    | NOT NULL | `now()` | UTC, updated on every PUT / PATCH                              |

**Unique constraint:** `(target_role, billing_cycle)` WHERE `is_active = 1`. Only one active plan per role × cycle combination. Multiple inactive rows for the same combination are allowed (historical).

### Table: `AnnualFeePurchases`

| Column            | Type           | Null     | Default | Notes                                                                |
|-------------------|----------------|----------|---------|----------------------------------------------------------------------|
| `id`              | `INT`          | NOT NULL | auto    | PK                                                                   |
| `user_id`         | `INT`          | NOT NULL |         | FK → `Users.id` (cascade on delete)                                  |
| `annual_fee_id`   | `INT`          | NOT NULL |         | FK → `AnnualFees.id` (restrict on delete)                            |
| `purchase_date`   | `DATETIME2`    | NOT NULL | `now()` | UTC, set on row insert                                               |
| `expiry_date`     | `DATETIME2`    | NULL     | `NULL`  | UTC. NULL while `PENDING_PAYMENT`, set when status flips to `ACTIVE` |
| `status`          | `NVARCHAR(30)` | NOT NULL |         | Enum: `PENDING_PAYMENT` \| `ACTIVE` \| `EXPIRED` \| `CANCELLED` \| `FAILED` |
| `payment_method`  | `NVARCHAR(30)` | NULL     | `NULL`  | e.g. `PayOS`                                                         |
| `transaction_id`  | `NVARCHAR(100)`| NULL     | `NULL`  | PayOS order code / payment link ID                                   |
| `amount_vnd`      | `BIGINT`       | NOT NULL |         | Snapshot of price at purchase time (VND)                             |
| `created_at`      | `DATETIME2`    | NOT NULL | `now()` | UTC                                                                  |
| `updated_at`      | `DATETIME2`    | NOT NULL | `now()` | UTC, updated on status transitions                                   |

**Indexes:**

- `(user_id, status)` — fast lookup for "user's current active subscription"
- `(status, expiry_date)` — fast lookup for background expiry sweeper

**Computed column / view** (recommended but optional): `IsExpired = (status = 'ACTIVE' AND expiry_date < SYSUTCDATETIME())`.

## API Contract

All endpoints require JWT authentication. Admin endpoints additionally require the JWT `role` claim to be `Admin`. Purchase endpoints require the JWT `role` claim to be `Researcher` or `Lecturer`.

### 1. `GET /api/AnnualFee` — Admin: list all plans

**Auth:** Admin.

Returns **all** plans (active and inactive) for the Admin console.

**Response 200:**

```json
[
  {
    "id": 1,
    "title": "Researcher Annual Fee",
    "targetRole": "Researcher",
    "priceVnd": 990000,
    "billingCycle": "Annual",
    "features": ["Submit unlimited papers", "Peer review tracking", "Priority support"],
    "isActive": true,
    "createdAt": "2026-09-01T00:00:00Z",
    "updatedAt": "2026-09-08T00:00:00Z"
  }
]
```

### 2. `GET /api/AnnualFee/active` — Public: list purchasable plans

**Auth:** Any authenticated user.

Returns only `isActive = true` plans. Used by the Subscription tab to show what the user can buy.

**Response 200:** same shape as above, filtered to `isActive = true`.

### 3. `GET /api/AnnualFee/{id}` — get a single plan

**Auth:** Any authenticated user (or Admin only — choose consistently with the FE; recommend "any authenticated user" so the FE can show a plan preview before checkout).

**Response 200:** the `AnnualFee` object.

**Response 404:** plan not found.

### 4. `POST /api/AnnualFee` — Admin: create a plan

**Auth:** Admin.

**Request body:**

```json
{
  "title": "Lecturer Six-Month Fee",
  "targetRole": "Lecturer",
  "priceVnd": 1500000,
  "billingCycle": "SixMonth",
  "features": ["Create research groups", "Supervise students", "Host seminars"],
  "isActive": true
}
```

**Validation:**

- `title`: required, 1–200 chars.
- `targetRole`: required, must be `Researcher` or `Lecturer`.
- `priceVnd`: required, integer > 0, no decimals.
- `billingCycle`: required, must be `SixMonth` or `Annual`. **Reject `Quarterly`.**
- `features`: optional, `string[]`. If provided, max 50 entries, each ≤ 500 chars.
- `isActive`: optional, defaults to `true`.
- If `isActive = true` is requested, no other row with the same `(targetRole, billingCycle, isActive=true)` may exist → `409 Conflict`.

**Response 201:** the created `AnnualFee`.

**Response 400:** validation errors (with field-level details).

**Response 409:** duplicate active plan for the same role/cycle.

### 5. `PUT /api/AnnualFee/{id}` — Admin: update a plan

**Auth:** Admin.

**Request body:** same shape as `POST`. All fields required (full update; no partial PATCH on the plan entity itself — the toggle endpoint covers the partial-update use case).

**Validation:** same as `POST`, plus:

- If the update would create a duplicate active `(targetRole, billingCycle)` collision with another row → `409`.
- Updating `priceVnd` on a plan that already has purchases is allowed, but historical `AnnualFeePurchases.amount_vnd` rows are NOT rewritten (the snapshot remains for accounting).

**Response 200:** the updated `AnnualFee`.

**Response 404:** not found.

### 6. `PATCH /api/AnnualFee/{id}/toggle` — Admin: toggle plan active state

**Auth:** Admin.

**Request body:**

```json
{ "isActive": false }
```

**Behaviour:**

- Setting `isActive = false` hides the plan from `GET /api/AnnualFee/active` and rejects new `POST /api/AnnualFee/{id}/purchase` calls.
- Existing `ACTIVE` purchases on this plan remain `ACTIVE` until their natural `expiry_date` — deactivating does **not** retroactively cancel subscriptions.
- Setting `isActive = false` while another active row with the same `(targetRole, billingCycle)` would be the only active one is allowed (this is the standard "disable" flow).

**Response 200:** the updated `AnnualFee`.

### 7. `DELETE /api/AnnualFee/{id}` — Admin: delete a plan

**Auth:** Admin.

**Behaviour:**

- If any `AnnualFeePurchase` rows reference this plan (any status), **refuse the delete** with `409 Conflict` and a message explaining the plan has historical purchases. The FE should use toggle instead.
- If no purchases reference the plan, hard-delete the row.

**Response 204:** no content on success.

**Response 409:** plan has historical purchases; suggest toggle.

### 8. `POST /api/AnnualFee/{id}/purchase` — User: start a PayOS purchase

**Auth:** any authenticated user whose JWT `role` claim is `Researcher` or `Lecturer`. **Reject** for `GraduateStudent`, `Reviewer`, `Admin`, `SystemAdmin`, or any other role.

**Request body:**

```json
{
  "returnUrl": "https://arsplatform.example.com/subscription?status=success",
  "cancelUrl": "https://arsplatform.example.com/subscription?status=cancelled"
}
```

**Behaviour:**

1. Look up the plan. If not found → `404`. If `isActive = false` → `409 PlanNotPurchasable`.
2. Verify caller's role is `Researcher` or `Lecturer`. Otherwise → `403 WrongRole`.
3. Create an `AnnualFeePurchase` row with:
   - `user_id` = JWT subject
   - `annual_fee_id` = `{id}`
   - `status` = `PENDING_PAYMENT`
   - `purchase_date` = `now`
   - `expiry_date` = `NULL`
   - `amount_vnd` = snapshot of plan's current `price_vnd`
   - `payment_method` = `PayOS`
4. Call PayOS's "Create Payment Link" API with:
   - `orderCode` = the new `AnnualFeePurchase.id` (or a derived unique code)
   - `amount` = `amount_vnd`
   - `description` = `Annual Fee #{plan.id} - {plan.title}`
   - `returnUrl`, `cancelUrl` from the request body
   - `buyerName`, `buyerEmail` from the user's profile (if available)
5. Store the returned PayOS `paymentLinkId` / `orderCode` in `transaction_id`.
6. Return the checkout URL.

**Response 200:**

```json
{
  "checkoutUrl": "https://pay.payos.vn/web/...",
  "orderCode": "ARS-ANNUAL-12345",
  "purchase": {
    "id": 12345,
    "userId": 42,
    "annualFeeId": 1,
    "purchaseDate": "2026-09-09T10:00:00Z",
    "expiryDate": null,
    "status": "PENDING_PAYMENT",
    "paymentMethod": "PayOS",
    "transactionId": "ARS-ANNUAL-12345",
    "amountVnd": 990000,
    "createdAt": "2026-09-09T10:00:00Z",
    "updatedAt": "2026-09-09T10:00:00Z"
  }
}
```

**Response 403:** caller is not `Researcher` or `Lecturer`.

**Response 404:** plan not found.

**Response 409:** plan is inactive.

### 9. PayOS webhook — `POST /api/AnnualFee/payos-webhook`

**Auth:** PayOS signature verification (HMAC-SHA256 over the raw body using the configured PayOS checksum key). No JWT.

**Behaviour:**

1. Verify the `x-signature` header against the request body. Reject with `401` if invalid.
2. Parse the payload. Two event types matter:
   - `payment.success` (PayOS code `00`): mark the purchase `ACTIVE` and set `expiryDate = now + billingCycle`.
   - `payment.cancelled` / `payment.failed` (PayOS codes other than `00`): mark the purchase `FAILED` (or `CANCELLED`).
3. Look up the purchase via `transaction_id` = PayOS `orderCode`. If not found → `404`.
4. Idempotency: if the purchase is already in a terminal state (`ACTIVE`, `EXPIRED`, `CANCELLED`, `FAILED`) for this `orderCode`, acknowledge with `200` without rewriting (webhooks can re-deliver).
5. For `ACTIVE` transitions, compute `expiryDate` based on the plan's `billingCycle`:
   - `SixMonth` → `purchase_date + 6 months`
   - `Annual` → `purchase_date + 12 months`
   - Use UTC for both endpoints.
6. **Single-active-subscription policy:** if the user already has another `ACTIVE` purchase that has not expired, mark it `EXPIRED` and let the new purchase take over (the older one is superseded). The expiry of the superseded purchase is set to `now()` (the moment it was superseded, not its original `expiryDate`).
7. Update the purchase row and return `200 { "ok": true }`.

**Response 200:** `{ "ok": true }` on success.

**Response 401:** invalid signature.

### 10. `GET /api/AnnualFee/my-current` — User: current active subscription

**Auth:** any authenticated user. Powers both the **header profile badge** and the **Subscription tab**.

**Behaviour:**

1. Look up the most recent `AnnualFeePurchase` for `user_id = JWT subject` where `status = 'ACTIVE'` AND `expiry_date > now()`.
2. If multiple match (e.g. due to a race), pick the one with the latest `purchase_date`.
3. If none match, return `null`.

**Response 200 (active subscription):**

```json
{
  "purchase": {
    "id": 12345,
    "userId": 42,
    "annualFeeId": 1,
    "purchaseDate": "2026-09-09T10:00:00Z",
    "expiryDate": "2027-09-09T10:00:00Z",
    "status": "ACTIVE",
    "paymentMethod": "PayOS",
    "transactionId": "ARS-ANNUAL-12345",
    "amountVnd": 990000,
    "createdAt": "2026-09-09T10:00:00Z",
    "updatedAt": "2026-09-09T10:00:00Z"
  },
  "annualFee": {
    "id": 1,
    "title": "Researcher Annual Fee",
    "targetRole": "Researcher",
    "priceVnd": 990000,
    "billingCycle": "Annual",
    "features": ["..."],
    "isActive": true,
    "createdAt": "2026-09-01T00:00:00Z",
    "updatedAt": "2026-09-08T00:00:00Z"
  },
  "daysRemaining": 365,
  "isExpired": false
}
```

**Response 200 (no active subscription):** `null`.

### 11. `GET /api/AnnualFee/my-purchases` — User: purchase history

**Auth:** any authenticated user.

Returns all `AnnualFeePurchase` rows for `user_id = JWT subject`, newest first. Includes both `ACTIVE`, `EXPIRED`, `CANCELLED`, `FAILED`, and `PENDING_PAYMENT` statuses. Powers the Subscription tab history table.

**Response 200:** `AnnualFeePurchase[]` (without the embedded `annualFee` summary — the FE can fetch each plan by ID if needed).

### 12. Background expiry sweeper (recommended)

Implement a hosted service / `IHostedService` (or scheduled job) that runs every hour and:

1. Finds all `AnnualFeePurchase` rows with `status = 'ACTIVE' AND expiry_date <= SYSUTCDATETIME()`.
2. Sets their `status` to `EXPIRED`.
3. Optionally fires a notification ("Your annual fee subscription has expired — renew to keep using the platform").

This guarantees that even if the FE never re-fetches, the user is correctly denied access on their next protected call (see Authorization below).

## Authorization Summary

| Endpoint                              | Required role             |
|---------------------------------------|---------------------------|
| `GET /api/AnnualFee`                  | `Admin`                   |
| `GET /api/AnnualFee/active`           | Any authenticated user    |
| `GET /api/AnnualFee/{id}`             | Any authenticated user    |
| `POST /api/AnnualFee`                 | `Admin`                   |
| `PUT /api/AnnualFee/{id}`             | `Admin`                   |
| `PATCH /api/AnnualFee/{id}/toggle`    | `Admin`                   |
| `DELETE /api/AnnualFee/{id}`          | `Admin`                   |
| `POST /api/AnnualFee/{id}/purchase`   | `Researcher` \| `Lecturer`|
| `POST /api/AnnualFee/payos-webhook`   | PayOS signature           |
| `GET /api/AnnualFee/my-current`       | Any authenticated user    |
| `GET /api/AnnualFee/my-purchases`     | Any authenticated user    |

**Cross-cutting rule:** every authenticated endpoint that touches platform resources (creating research groups, submitting papers, hosting seminars, etc.) MUST also check the caller's `AnnualFeePurchase` status. If the caller is `Researcher` or `Lecturer` and their latest active subscription is `EXPIRED` or absent, return `402 Payment Required` with `{ "error": "AnnualFeeSubscriptionExpired", "redirectTo": "/subscription" }`. `Admin` and `Reviewer`/`GraduateStudent` are exempt.

This is the platform's gating mechanism — without it, expired users retain full access.

## Configuration

Add to `appsettings.json` (do NOT commit real secrets; use `appsettings.Development.json` or user-secrets):

```json
{
  "PayOS": {
    "ClientId": "<from PayOS dashboard>",
    "ApiKey": "<from PayOS dashboard>",
    "ChecksumKey": "<from PayOS dashboard>",
    "BaseUrl": "https://api.payos.vn"
  },
  "AnnualFee": {
    "ReturnUrlBase": "https://arsplatform.example.com",
    "CancelUrlBase": "https://arsplatform.example.com"
  }
}
```

The BE appends the `purchaseId` as a query string to `returnUrl` / `cancelUrl` so the FE can correlate the post-redirect state (e.g. `?status=success&purchaseId=12345`). The FE-provided URLs in the request body take precedence when supplied.

## FE Integration Note

The FE team has already wired up:

- `src/types/annualFee.ts` — full TypeScript contracts for all DTOs above.
- `src/services/annualFee.service.ts` — method signatures and URL paths that exactly match this ticket.
- `src/utils/constants.ts` → `ENDPOINTS.ADMIN.ANNUAL_FEES` — endpoint paths.
- `src/pages/Admin/AnnualFees.tsx` — Admin CRUD screen.
- `src/pages/GraduateStudent/StudentResearchGroups.tsx` and similar — researcher / lecturer surfaces where the purchase modal will be triggered.

When this BE work is complete, the FE only needs to flip the `unavailable('methodName')` placeholders to real `api.get` / `api.post` / etc. calls. No FE type or service signature changes are required — the contracts are already aligned.

**Recommended FE surfaces (for FE team's planning, not BE work):**

- **Header profile badge**: small inline component in `MainLayout` that calls `getMyCurrentSubscription()` on mount + every 5 minutes (or on window focus). Renders "Researcher Annual · expires 2027-03-15" or "No active subscription".
- **Subscription tab**: a new page in the Researcher and Lecturer workspaces. Calls `getMyCurrentSubscription()` + `getMyPurchaseHistory()` + `listAnnualFeePlans()` to render: current plan card, history table, plan catalogue with "Pay with PayOS" buttons.
- **Purchase modal**: opens when the user clicks "Renew" or "Subscribe". Calls `purchaseAnnualFee()`, receives `checkoutUrl`, redirects via `window.location.assign(checkoutUrl)`.

## Acceptance Criteria

### Database

- [ ] `AnnualFees` table exists with the schema above, including the unique active-tiers constraint.
- [ ] `AnnualFeePurchases` table exists with the schema above and the recommended indexes.
- [ ] Migration script applied to production database without data loss.

### Admin CRUD

- [ ] `GET /api/AnnualFee` returns all plans (active + inactive) for Admin, `403` for non-Admin.
- [ ] `POST /api/AnnualFee` creates a plan and rejects `Quarterly` cycle, negative/zero prices, duplicate active tiers, and invalid roles.
- [ ] `PUT /api/AnnualFee/{id}` updates a plan and rejects the same validation rules; preserves historical purchase price snapshots.
- [ ] `PATCH /api/AnnualFee/{id}/toggle` flips `isActive` without affecting existing purchases.
- [ ] `DELETE /api/AnnualFee/{id}` refuses with `409` when historical purchases exist; otherwise hard-deletes.

### Public listing

- [ ] `GET /api/AnnualFee/active` returns only `isActive = true` plans.
- [ ] `GET /api/AnnualFee/{id}` returns the plan or `404`.

### Purchase flow

- [ ] `POST /api/AnnualFee/{id}/purchase` rejects `GraduateStudent`, `Reviewer`, `Admin` with `403 WrongRole`.
- [ ] `POST /api/AnnualFee/{id}/purchase` rejects inactive plans with `409`.
- [ ] On success, a `PENDING_PAYMENT` `AnnualFeePurchase` row is created with the correct snapshot `amount_vnd`.
- [ ] The response contains a valid PayOS `checkoutUrl` that opens the PayOS QR-code page.

### Webhook

- [ ] `POST /api/AnnualFee/payos-webhook` rejects requests with invalid signatures.
- [ ] On `payment.success`, the matching purchase flips to `ACTIVE`, `expiry_date` is set per `billingCycle` (`SixMonth` → +6 months, `Annual` → +12 months).
- [ ] Webhook is idempotent — re-delivery does not double-grant.
- [ ] On `payment.failed` / `payment.cancelled`, the purchase flips to `FAILED` / `CANCELLED`.
- [ ] If the user already has an `ACTIVE` subscription when a new one activates, the older one is marked `EXPIRED` with `expiry_date = now()`.

### Current subscription

- [ ] `GET /api/AnnualFee/my-current` returns the correct active subscription for `Researcher` and `Lecturer` users with the right `daysRemaining` and `isExpired` values.
- [ ] Returns `null` for users with no active subscription, including expired / failed / cancelled rows.
- [ ] Background expiry sweeper marks `ACTIVE` rows with `expiry_date <= now()` as `EXPIRED` at least once per hour.

### Access gating

- [ ] Researcher / Lecturer users with an expired or absent annual subscription receive `402 Payment Required` from platform endpoints (research groups, papers, seminars, etc.).
- [ ] Admin / GraduateStudent / Reviewer are exempt from the gating.

### Swagger

- [ ] All endpoints, request/response schemas, and the `AnnualFee` + `AnnualFeePurchase` DTOs are documented on Swagger.
- [ ] Error responses (`400`, `401`, `403`, `404`, `409`, `402`) are listed with example payloads.
- [ ] The `PayOS webhook` endpoint clearly states it uses signature-based auth, not JWT.

### Tests

- [ ] Unit tests cover: validation rules, role enforcement, expiry calculation, idempotent webhook handling.
- [ ] Integration tests cover: full purchase flow with PayOS sandbox (success path, cancelled path, expired-superseded path).
- [ ] Manual QA: Admin creates a plan, Researcher purchases it via PayOS sandbox, webhook fires, subscription shows in header badge and Subscription tab, expiry date is correct.
