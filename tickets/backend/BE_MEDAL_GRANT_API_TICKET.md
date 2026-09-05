# BE Ticket — Admin Medal Grant API (Test Data + Manual Awards)

## ID

BE-MEDAL-GRANT-01

## Priority

**High** — blocks FE acceptance testing of the Admin Medals page and prevents QA from
populating the 4 role-test accounts with the full role-aligned medal catalog. The FE
can render the medal definitions and the family-normalised icons, but cannot drive a
user's `UserMedal` rows from the browser. Until this endpoint ships, testers have to
ask BE to insert rows by hand (or via SSMS), which means every role-badge UI
verification is gated on a backend operator.

## Background

The FE ships a family-normalised medal catalog (Bronze / Silver / Gold / Platinum per
`ORCID_VERIFIED_*`, `PROLIFIC_AUTHOR_*`, `MASTER_MENTOR_*`, `REVIEW_MILESTONE_*`,
`ACADEMIC_HOST_*`, `SEMINAR_PARTICIPANT_*`, `FLAWLESS_PROGRESS_*`) and renders the
user's earned medals on the Profile page, forum post cards, and the Admin Medals
audit view.

The Swagger contract today exposes the full medal-definition CRUD
(`GET/POST/PUT/DELETE /api/Medal`, `POST /api/Medal/reset-defaults`) and two
read-only endpoints for end users (`GET /api/Medal/my-medals`,
`GET /api/Medal/user/{userId}`). There is no API path that lets an authenticated
admin write a `UserMedal` row — i.e. there is no way for a client to award, revoke,
or progress a user's medal state. This is the gap.

The FE cannot invent or assume this contract: per the project's role split, the
backend owns the schema for `UserMedal` (progress, unlock state, unlocked-at,
audit-correlation id) and the criteria-evaluation logic that decides when an unlock
is legitimate. The FE only needs a deterministic way to call the BE.

## Goal

Provide an authoritative admin endpoint set that lets the FE (and any QA / staging
script) list, grant, progress, and revoke `UserMedal` rows for a given user, with full
audit logging and idempotent behaviour. The endpoint set must also expose a
"grant-all-by-role" dev/staging helper that fills the 4 role-test accounts with the
full medal catalog matching their role so the FE can verify the UI end-to-end.

## API Contract

### 1. List a user's medals

`GET /api/Medal/user/{userId}?includeLocked=true|false`

Authorised roles: the user themself, any admin, or any lecturer who supervises the
target user via `ResearchGroup`. The endpoint already exists in Swagger; this ticket
confirms the response must include both locked and unlocked entries with the full
progress payload, not just the unlocked ones. The FE currently filters on
`unlockedAt != null` — the new shape must include locked rows too.

```json
[
  {
    "id": 1042,
    "userId": 17,
    "medalId": "medal-orcid-3",
    "code": "ORCID_VERIFIED_GOLD",
    "currentProgress": 1,
    "criteriaThreshold": 1,
    "criteriaUnit": "ORCID",
    "isUnlocked": true,
    "unlockedAt": "2026-09-05T11:00:00Z",
    "awardedByAdminId": null,
    "awardedReason": null,
    "correlationId": "evt_8f12…"
  },
  {
    "id": 1043,
    "userId": 17,
    "medalId": "medal-orcid-4",
    "code": "ORCID_VERIFIED_PLATINUM",
    "currentProgress": 0,
    "criteriaThreshold": 5,
    "criteriaUnit": "lượt trích dẫn",
    "isUnlocked": false,
    "unlockedAt": null,
    "awardedByAdminId": null,
    "awardedReason": null,
    "correlationId": null
  }
]
```

### 2. Grant a single medal to a user

`POST /api/Medal/grant`

Auth: Admin only. Idempotent per `(userId, medalId)` tuple — repeat calls return the
existing row, not a new one.

Request:

```json
{
  "userId": 17,
  "medalCode": "ORCID_VERIFIED_GOLD",
  "forceUnlocked": true,
  "awardedReason": "QA seeding for role-test account"
}
```

| Field | Type | Notes |
| --- | --- | --- |
| `userId` | int | Target user. Required. |
| `medalCode` | string | One of the codes listed in `GET /api/Medal`. Required. |
| `forceUnlocked` | bool | When `true`, set `currentProgress = criteriaThreshold` and `isUnlocked = true`. When `false`, set `currentProgress = max(currentProgress, 1)` but do not flip `isUnlocked`. |
| `awardedReason` | string | Free-form admin note. Required when `forceUnlocked = true`. Echoed into the audit log. |

Response `201 Created` (or `200 OK` if the row already existed):

```json
{
  "id": 1044,
  "userId": 17,
  "medalId": "medal-orcid-3",
  "code": "ORCID_VERIFIED_GOLD",
  "currentProgress": 1,
  "criteriaThreshold": 1,
  "criteriaUnit": "ORCID",
  "isUnlocked": true,
  "unlockedAt": "2026-09-05T11:00:00Z",
  "awardedByAdminId": 1,
  "awardedReason": "QA seeding for role-test account",
  "correlationId": "evt_8f13…"
}
```

**Server rules**

- Reject (`403`) if the caller is not an admin.
- Reject (`404`) if `userId` or `medalCode` does not exist.
- Reject (`409`) if `medalCode` does not list any of the user's current roles in its
  `roles` array. The BE is the source of truth for role alignment.
- Set `awardedByAdminId` from the JWT subject — never trust a client field.
- Generate `correlationId` server-side; echo it back.
- Write one audit log entry of action `MEDAL_GRANT` keyed by `(adminId, userId,
  medalCode, correlationId)`.
- Do not call the criteria-evaluation pipeline on a forced unlock — it must skip the
  normal "did the user really earn this?" check because the admin is overriding.

### 3. Revoke a previously granted medal

`DELETE /api/Medal/grant/{userMedalId}`

Auth: Admin only. Hard-deletes the `UserMedal` row. Idempotent — repeat calls return
`204 No Content` even when the row no longer exists.

**Server rules**

- Reject (`403`) if the caller is not an admin.
- Reject (`404`) if `userMedalId` does not refer to a row that was created via
  `/grant` (i.e. only admin-granted rows can be revoked this way). Naturally earned
  rows must be revoked through the criteria-evaluation pipeline, not this endpoint.
- Write one audit log entry of action `MEDAL_REVOKE` keyed by `(adminId,
  userMedalId, medalCode, correlationId)`.

### 4. Dev / staging helper: grant every medal matching a user's role

`POST /api/Medal/dev/grant-all-by-role`

Auth: Admin only. Endpoint must be gated by an environment flag on the BE
(`ASPNETCORE_ENVIRONMENT != Production` is fine; a dedicated `Medal:AllowDevGrants`
flag is also acceptable). Calling this in production must return `404 Not Found`,
not `403`, so the endpoint does not even exist on the wire in production.

Request:

```json
{
  "userId": 17,
  "includePlatinum": true,
  "tierFilter": "Bronze|Silver|Gold|Platinum",
  "awardedReason": "Acceptance test seeding"
}
```

| Field | Type | Notes |
| --- | --- | --- |
| `userId` | int | Target user. Required. |
| `includePlatinum` | bool | When `false`, skip the Platinum tier to keep the test scope focused. |
| `tierFilter` | enum | Optional. Restrict the grant to a single tier. Omit to grant every tier the user's role qualifies for. |
| `awardedReason` | string | Echoed into every audit log entry produced by this call. |

Response `200 OK`:

```json
{
  "userId": 17,
  "role": "Researcher",
  "awardedCount": 12,
  "skippedCount": 0,
  "rows": [
    { "id": 1044, "medalCode": "ORCID_VERIFIED_BRONZE",  "isUnlocked": true },
    { "id": 1045, "medalCode": "ORCID_VERIFIED_SILVER",  "isUnlocked": true },
    { "id": 1046, "medalCode": "ORCID_VERIFIED_GOLD",    "isUnlocked": true }
  ],
  "correlationId": "evt_8f14…"
}
```

**Server rules**

- Resolve the user's current primary role (use the same logic the role-switch endpoint
  uses — typically the highest-acquired role, or the active `UserRole` row).
- For every `Medal` row whose `roles` array contains that role, call the same logic
  as endpoint #2 (`forceUnlocked = true`, `awardedReason` from the request).
- Run inside one DB transaction. Either every grant succeeds or every grant rolls
  back. The FE never wants a half-granted test account.
- Write one parent audit log entry of action `MEDAL_GRANT_ALL_BY_ROLE` plus one child
  audit entry per row.
- Reject (`403`) if the BE is running in production (see gating above).

### 5. Dev / staging helper: revoke every admin-granted medal for a user

`DELETE /api/Medal/dev/revoke-all/{userId}`

Auth: Admin only. Same env-flag gating as endpoint #4. Used to reset a test account
between acceptance runs without dropping the user's naturally earned progress.

Response `200 OK`:

```json
{
  "userId": 17,
  "revokedCount": 12,
  "correlationId": "evt_8f15…"
}
```

## Authorization and Enforcement Requirements

- Every endpoint in this ticket must be `Admin` only.
- The FE never sends `userId`, `role`, `awardedByAdminId`, `correlationId`, or
  `unlockedAt`; the BE derives these from the JWT subject, the target row, and the
  server clock. The FE is happy to read them back in the response.
- Audit log entries produced by these endpoints must follow the same shape as the
  existing `POST /api/AuditLog` contract so the FE's `auditLogStore` keeps working
  without a code change.
- The dev-only endpoints must not be reachable from production. Gating on
  `ASPNETCORE_ENVIRONMENT != Production` is the minimum acceptable. If a more
  explicit `Medal:AllowDevGrants` flag is preferred, the BE may use that instead —
  the FE only cares that production traffic returns `404`.
- Concurrency: two simultaneous `/grant` calls for the same `(userId, medalCode)`
  must result in exactly one row, not a duplicate. Use a unique constraint on the
  underlying table and surface the duplicate-key error as `200 OK` with the existing
  row.

## Data Requirements

The BE almost certainly already has a `UserMedal` table (referenced by
`/api/Medal/my-medals` and `/api/Medal/user/{userId}`). This ticket asks the BE to
either confirm that table's shape or extend it with the minimum fields required to
satisfy the responses above:

| Column | Type | Notes |
| --- | --- | --- |
| `Id` | int | PK, identity |
| `UserId` | int | FK to `User` |
| `MedalId` | nvarchar | FK to `Medal` |
| `CurrentProgress` | int / decimal | Per medal metric. Default `0`. |
| `CriteriaThreshold` | int / decimal | Denormalised from `Medal` at grant time so a future threshold edit does not retroactively unlock past grants. |
| `CriteriaUnit` | nvarchar | Denormalised from `Medal`. |
| `IsUnlocked` | bit | Computed: `CurrentProgress >= CriteriaThreshold`. |
| `UnlockedAt` | datetime2 | Set when `IsUnlocked` first flips `true`. Never overwritten. |
| `AwardedByAdminId` | int, nullable | Null when earned naturally. |
| `AwardedReason` | nvarchar, nullable | Echoed in audit log. |
| `CorrelationId` | nvarchar, nullable | Echoed in audit log. |
| `CreatedAt` | datetime2 | Default `getutcdate()` / `UTC_TIMESTAMP()`. |
| `UpdatedAt` | datetime2 | Updated on every write. |

Add a unique constraint on `(UserId, MedalId)`. Add an index on `(UserId, IsUnlocked)`
so the read endpoints stay fast.

## Error Contract

| Status | When |
| --- | --- |
| `200 OK` | Idempotent re-grant — row already existed. |
| `201 Created` | First-time grant — new row created. |
| `204 No Content` | Successful revoke. |
| `400` | Payload missing a required field or wrong shape. |
| `403` | Caller is not an admin, or the medal's `roles` array does not contain the target user's role. |
| `404` | `userId`, `medalCode`, or `userMedalId` does not exist. Also returned by dev-only endpoints in production. |
| `409` | Concurrency conflict that the BE cannot auto-resolve. |
| `500` | Anything else — surface as `BackendGapBanner` on the FE. |

## Acceptance Criteria

- [ ] `POST /api/Medal/grant` with `forceUnlocked=true` flips `isUnlocked=true` and
      sets `unlockedAt` to the server clock — without calling the criteria-evaluation
      pipeline.
- [ ] Calling `POST /api/Medal/grant` twice for the same `(userId, medalCode)` pair
      results in one row, not two. The second call returns `200 OK` with the
      existing row.
- [ ] `POST /api/Medal/dev/grant-all-by-role` grants every medal whose `roles` array
      contains the target user's primary role, in one DB transaction.
- [ ] `POST /api/Medal/dev/grant-all-by-role` returns `404` when the BE is running in
      `ASPNETCORE_ENVIRONMENT=Production`.
- [ ] `DELETE /api/Medal/grant/{userMedalId}` removes the row and writes one
      `MEDAL_REVOKE` audit log entry. Repeat calls return `204 No Content`.
- [ ] Every admin-grant / revoke action produces an audit log entry that the FE's
      `auditLogStore` can read.
- [ ] Swagger documents all five endpoints, every field, every enum value, every
      status code, and the prod-gating behaviour of the dev-only endpoints.
- [ ] The four role-test accounts (Lecturer, Researcher, Reviewer, Graduate Student)
      can each be filled with the full role-aligned catalog in a single API call —
      no manual SQL required.

## FE References

- The FE is ready: `src/services/medal.service.ts` already exposes the read paths
  (`getMyMedals`, `getUserMedals`). Once the BE ships `grant`, the FE will add a
  `grantMedal({ userId, medalCode, forceUnlocked, awardedReason })` method that calls
  the new endpoint, plus a dev-only helper on the Admin Medals page that calls
  `/dev/grant-all-by-role` for the four test accounts when `import.meta.env.DEV` is
  `true`.
- The FE's medal icon family-normaliser
  (`normalizeMedalFamilies` in `src/services/medal.service.ts` and
  `resolveMedalIconName` in `src/pages/Admin/AdminMedals.tsx`) already collapses the
  four tiers of each family onto one shared `lucide:` icon. Once the BE reseeds the
  catalog with the correct `imageUrl`s, the four role-test accounts will display the
  shared family icon everywhere (Profile, forum cards, Admin Medals audit).
- Acceptance flow this unblocks: open the Admin Medals page in `dev`, click
  **Seed test accounts** (the FE button to be added), confirm the toast, then log in
  as each of the four test accounts and verify the Profile badges section, the forum
  flair chip, and the role workspace header all render the expected family icons.
