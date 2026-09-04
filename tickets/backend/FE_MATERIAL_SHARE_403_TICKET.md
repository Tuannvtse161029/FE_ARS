# Backend Ticket — Learning Material Share Returns 403

## Priority

**High** — the Materials "Share" button is a flagship lecturer feature and is currently
broken end-to-end. Every share attempt returns `403 Forbidden`. The button has shipped in
the FE for the entire lecturer cohort, so the broken UX is visible today.

## Summary

When a Lecturer opens any learning material on the new Materials page
(`/lecturer/materials`), clicks **Share**, picks one or more colleagues, and submits, the
FE calls `POST /api/SharedMaterial` and the BE responds with `403 Forbidden`. The FE
sends the material's id in a field named `paperId`, but the BE schema treats `paperId`
as a foreign key to the `Papers` table. Because no `Paper` row exists for a learning
material id, the BE either fails an authorization check (the lecturer does not own a
Paper with that id) or rejects the payload as a constraint violation.

The FE never sends `paperId` for a learning material — it sends the material's own id
because the share UI is a learning-material feature. The two domains collide in the
same endpoint and the BE cannot distinguish them.

This is a **BE contract bug**, not an FE bug. The FE needs the BE to expose a contract
that lets it share learning materials cleanly.

## Reproduction

1. Sign in as a lecturer (role = `Lecturer`) who owns at least one learning material.
2. Navigate to **Materials** in the Lecturer workspace.
3. Click **Share** on any material card.
4. Pick a colleague and confirm.
5. Observe the FE toast: *"Could not share the material. Please try again."* — open the
   browser dev tools to confirm the `POST /api/SharedMaterial` call returned
   `403 Forbidden`.

The same flow succeeds for the *paper* sharing surface that lives on the Admin → Reviewer
workspace, because that surface sends a real paper id into `paperId`. The Materials
surface was added later and reused the same endpoint by accident.

## Current FE payload (broken)

```http
POST /api/SharedMaterial HTTP/1.1
Host: arsplatform.onrender.com
Authorization: Bearer <lecturer-jwt>
Content-Type: application/json

{
  "lecturerId": 17,
  "paperId": 42,                        // ← actually a LearningMaterial id
  "sharedWithColleagueId": 28,
  "sharedAt": "2026-09-05T10:30:00Z",
  "status": "PENDING"
}
```

The BE's `SharedMaterialCreateRequest` requires `paperId` to reference a row in the
`Papers` table. The FE never intends to send that — it intends to send a learning
material id, but the existing endpoint name and field shape leave no way to do so
without confusing the two domains.

## Desired behaviour

The FE wants to call one of the two shapes below (the BE may pick either — both are
accepted on the FE side):

### Option A — repurpose `POST /api/SharedMaterial`

Rename the payload field to `learningMaterialId`. Keep `paperId` as a deprecated alias
so the existing research-paper share flow keeps working until it is migrated.

```http
POST /api/SharedMaterial HTTP/1.1
{
  "lecturerId": 17,
  "learningMaterialId": 42,
  "sharedWithColleagueId": 28,
  "sharedAt": "2026-09-05T10:30:00Z",
  "status": "PENDING"
}
```

### Option B — sibling endpoint

Stand up `POST /api/LearningMaterialShare` (and the matching list/get/patch/delete
endpoints) so the two domains never share a table.

Either option must satisfy the rest of this ticket.

## Required endpoints

The FE expects the full share lifecycle to be backed by these endpoints. The exact
path is at the BE's discretion — pick one of Option A or Option B above and keep the
verb set below.

### Lecturer roster (used to populate the recipient picker)

`GET /api/Lecturer` *(or `GET /api/User/lecturers` — the BE may pick either)*

The current implementation calls `GET /api/User?role=Lecturer` and the BE returns
`403 Forbidden` because `/api/User` is Admin-only (Swagger summary: *"Lấy danh sách
người dùng phân trang (Dành cho Admin)"*). The lecturer JWT does not have access.

**Required shape** (paged to match the existing User contract):

```http
GET /api/Lecturer?pageNumber=1&pageSize=100 HTTP/1.1
Host: arsplatform.onrender.com
Authorization: Bearer <lecturer-jwt>

200 OK
{
  "items": [
    { "id": 17, "fullName": "Dr. An",  "email": "an@example.com"  },
    { "id": 28, "fullName": "Dr. Bình","email": "binh@example.com" }
  ],
  "totalCount": 12,
  "pageNumber": 1,
  "pageSize": 100,
  "totalPages": 1
}
```

**Server rules**

- Reject (`403`) if the caller is not a lecturer — this is a lecturer-only lookup.
- Exclude suspended users (`isActive = false`) by default; pass
  `?includeInactive=true` if the FE ever needs the full list.
- Exclude the caller from the response so the FE never has to filter them out
  client-side (current FE does so defensively, but the BE is the source of truth).
- Return an empty `items` array (not `404`) when the role has no members yet.

### Create a share

`POST /api/SharedMaterial` *(or `POST /api/LearningMaterialShare`)*

| Field | Type | Notes |
| --- | --- | --- |
| `lecturerId` | int | Sender. Must equal the JWT subject. |
| `learningMaterialId` | int | The material being shared. Required. |
| `sharedWithColleagueId` | int | Recipient (must have role `Lecturer`). |
| `sharedAt` | ISO-8601 | Client timestamp; the BE should echo it back. |
| `status` | string enum | Always `PENDING` from the FE. |

**Server behaviour**

- Reject (`403`) if the caller is not a lecturer or does not own the material.
- Reject (`404`) if the referenced material id does not exist.
- Reject (`409`) if a `PENDING` share already exists between the same pair for the
  same material.
- Stamp `expiresAt = sharedAt + 30 days` (server-side; the FE never sends it).
- Echo the full record back with `createdAt` / `updatedAt`.

### Recipient accepts or declines

`PATCH /api/SharedMaterial/{id}` *(or `PATCH /api/LearningMaterialShare/{id}`)*

| Field | Type | Notes |
| --- | --- | --- |
| `status` | enum | `ACCEPTED` or `DECLINED`. |
| `respondedAt` | ISO-8601 | Set by the recipient's client. |

**Server behaviour**

- Reject (`403`) if the caller is not the recipient.
- Reject (`409`) if the share has already been responded to, revoked, or expired.

### Sender revokes before expiry

`DELETE /api/SharedMaterial/{id}` *(or `DELETE /api/LearningMaterialShare/{id}`)*

- Reject (`403`) if the caller is not the sender.
- Hard-delete the row (preferred) **or** mark it `REVOKED` (then `GET` filters it out).
- The FE accepts either — the UI label is "Stop sharing" in both cases.

### List shares for the current user

`GET /api/SharedMaterial` *(or `GET /api/LearningMaterialShare`)*

Returns rows where the caller is **either** the sender or the recipient. The FE wants
the response annotated with the following computed fields so the UI does not have to
re-derive them client-side:

| Computed field | Type | Notes |
| --- | --- | --- |
| `direction` | `"outbound"` \| `"inbound"` | Outbound = I am the sender; inbound = I am the recipient. |
| `canRevoke` | bool | True when the caller is the sender **and** the row is still `PENDING`. |
| `canRespond` | bool | True when the caller is the recipient **and** the row is `PENDING`. |
| `daysRemaining` | int \| null | Days until `expiresAt`; null when already expired / responded. |
| `effectiveStatus` | enum | `EXPIRED` if past `expiresAt`; otherwise the stored `status`. |

The list endpoint must accept an optional `?includeExpired=true` query so the lecturer
can see history (audit-trail view).

## Status state machine

```

PENDING  ──► ACCEPTED   (recipient taps Accept; valid until expiresAt)
PENDING  ──► DECLINED   (recipient taps Deny; terminal)
PENDING  ──► REVOKED    (sender cancels before recipient responds; terminal)
PENDING  ──► EXPIRED    (30-day timer reached without response; terminal)
ACCEPTED ──► EXPIRED    (30-day timer reached after acceptance; terminal)
```

The server is responsible for flipping `PENDING → EXPIRED` and `ACCEPTED → EXPIRED` on
read. The FE never sends `EXPIRED`. The FE is happy if the BE names `REVOKED` as
`CANCELLED` instead — either is mapped to the same UI affordance.

## Error contract

| Status | When |
| --- | --- |
| `400` | Payload missing a required field or wrong shape. |
| `403` | Caller is not authorized for this action (not the sender, not the recipient, not the owner of the material). |
| `404` | Referenced material id does not exist. |
| `409` | Duplicate `PENDING` share for the same (sender, recipient, material). |
| `500` | Anything else — surface as `BackendGapBanner` on the FE. |

## Acceptance criteria

- [ ] The Materials page **Share** action stops returning `403` for a learning material.
- [ ] The Materials page **Share** modal can populate the recipient picker from a
      lecturer-facing roster endpoint — no more `403 Forbidden` on `/api/User`.
- [ ] The existing research-paper share flow (if any) keeps working — no regression.
- [ ] Recipient sees the new share in their **Shared Materials** tab and can accept or
      decline.
- [ ] Sender can **Stop sharing** an active share before the 30-day timer.
- [ ] After 30 days the share transitions to `EXPIRED` on read, even if the recipient
      previously accepted.
- [ ] Duplicate `PENDING` shares for the same pair return `409`.
- [ ] Swagger documents every endpoint, every field, every status value, and every
      error response.
- [ ] The FE can remove its `paperId` fallback once this ships — there should be no
      reason for the FE to keep sending the legacy field.

## FE references

- UI visualisation of the desired contract: open any Materials card → **Share** → the
  "View API contract" link in the share modal subtitle. The component is
  `src/components/lecturer/ShareApiContractPreview.tsx` — the rendered preview is
  generated from the same payload / state-machine spec above.
- The FE side is wired and ready: `src/services/sharedMaterial.service.ts` already
  targets `POST /api/SharedMaterial`, and `src/pages/Lecturer/Materials.tsx` calls it
  in `submitShare()`. Once the BE returns `201`, the rest of the flow lights up
  automatically — no further FE work is required.
- Related FE work shipped in this ticket:
  - Interactive "Used by …" chip on every learning material card → opens the
    `MaterialUsageModal` listing every topic / phase that links back to the material.
  - Deep-link highlighting: clicking a row in the modal navigates to the
    Research Topics table or Configure Milestones page with `?highlight=true` and the
    matching row pulses so the lecturer can spot it.
