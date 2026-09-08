# BE Ticket: Research Group Active / Inactive Status

## ID

BE-RESEARCH-GROUP-ACTIVE-01

## Priority

High

## Background

The Lecturer Research Group console (ResearchGroup.tsx) has a UI affordance to **deactivate** a research group, which removes it from the active list and archives it. The frontend currently sends `isActive: false` via `PUT /api/ResearchGroup/{id}`, but the backend does not persist this value — there is no `is_active` column on the `ResearchGroups` table, and the `ResearchGroup` entity model does not expose it.

Deactivating a group does not delete any data. It is a visibility flag used by the lecturer to declutter their workspace. The group and all its members, topics, and phased reports remain intact in the database.

## Goal

Persist the `isActive` flag per `ResearchGroup` so that:

- Lecturers can deactivate and re-activate groups from the UI.
- The `GET /api/ResearchGroup` endpoints return the current `isActive` value so the UI reflects the correct state on page load and after navigation.

## Database Requirement

Add an `is_active` column to the `ResearchGroups` table.

```sql
ALTER TABLE ResearchGroups
ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT 1;
```

Default new groups to `is_active = 1` (active). Existing rows are migrated to `1`.

## API Contract

### 1. Update Research Group (extended)

`PUT /api/ResearchGroup/{id}`

Accept and persist the `isActive` field in the existing update request body. No new fields are required beyond what already exists in the request DTO — simply read and persist `isActive` from the request body when supplied.

**Request body** (unchanged shape, `isActive` added):

```json
{
  "lecturerId": 12,
  "topicId": 5,
  "name": "NLP Research Group A",
  "description": "Exploring BERT for scientific paper summarisation.",
  "deadline": "2026-09-30",
  "assignedAt": "2026-07-01T00:00:00Z",
  "materialsUrl": null,
  "isActive": false
}
```

**Response**: the updated `ResearchGroup` object including `isActive`.

**Behaviour**:

- When `isActive` is omitted from the request body, **preserve the existing value** (do not reset to `true`).
- Validate the lecturer owns this group (authorisation).
- Return `404` if the group does not exist.
- Return `403` if the JWT subject is not the owning lecturer or an admin.

### 2. Create Research Group (updated)

`POST /api/ResearchGroup`

Set `is_active = 1` on the new row (or allow the column default to handle it). No change to the request contract is needed.

**Response**: the created `ResearchGroup` object with `isActive: true`.

### 3. Get All Research Groups (extended)

`GET /api/ResearchGroup`

Return all groups (active and inactive) for the authenticated lecturer, including the `isActive` field in each item.

**Response body**:

```json
[
  {
    "id": 1,
    "lecturerId": 12,
    "topicId": 5,
    "name": "NLP Research Group A",
    "description": "Exploring BERT for scientific paper summarisation.",
    "deadline": "2026-09-30",
    "assignedAt": "2026-07-01T00:00:00Z",
    "materialsUrl": null,
    "isActive": true,
    "createdAt": "2026-06-15T00:00:00Z",
    "updatedAt": "2026-09-08T10:00:00Z"
  },
  {
    "id": 2,
    "lecturerId": 12,
    "topicId": 3,
    "name": "Old Archived Group",
    "description": "Completed in 2025.",
    "deadline": "2025-06-30",
    "assignedAt": "2025-01-10T00:00:00Z",
    "materialsUrl": null,
    "isActive": false,
    "createdAt": "2025-01-01T00:00:00Z",
    "updatedAt": "2025-07-01T00:00:00Z"
  }
]
```

### 4. Get Research Group by ID (extended)

`GET /api/ResearchGroup/{id}`

Return the single `ResearchGroup` object including `isActive`.

### 5. Dedicated toggle endpoint (optional convenience)

`PATCH /api/ResearchGroup/{id}/active`

A thin endpoint that toggles `isActive` without requiring the full group payload. This is simpler for the FE toggle flow and avoids the risk of partial-update validation failures on the PUT endpoint.

**Request body**:

```json
{
  "isActive": false
}
```

**Response**: the updated `ResearchGroup` object.

## Data Model

Update the `ResearchGroup` entity to include `isActive` / `is_active`:

| Property | Type | Nullable | Default |
|---|---|---|---|
| `is_active` | `bool` | `NOT NULL` | `1` (true) |

The column must be included in the entity model and mapped in all relevant queries (`SELECT *` or explicit column list).

## Authorization

- All endpoints require a valid lecturer JWT.
- Lecturers can only deactivate/reactivate their own groups.
- Admins may view and toggle any group's `isActive`.
- Return `403` for cross-lecturer operations.
- Return `401` for unauthenticated requests.

## FE Integration Note

The frontend `researchGroupService.setActive(groupId, isActive)` already calls `GET /api/ResearchGroup/{id}` followed by `PUT /api/ResearchGroup/{id}` with the full group payload including `isActive`. The FE types (`ResearchGroupUpdateRequest.isActive`) and the `ResearchGroup` response interface are already in place. No FE changes are needed once this BE work is complete.

The FE's `ResearchGroupUpdateRequest` makes all fields optional except `topicId` and `lecturerId`. When the BE requires a full payload, the FE already sends all known fields. If the BE prefers a partial update contract, implement the dedicated `PATCH /api/ResearchGroup/{id}/active` endpoint (item #5 above) and the FE can be updated to call that instead.

## Acceptance Criteria

- The `is_active` column exists and has the correct default for new rows.
- Existing groups are migrated to `is_active = 1`.
- `PUT /api/ResearchGroup/{id}` persists `isActive` and returns it in the response.
- Omitting `isActive` from a PUT request preserves the existing value.
- `GET /api/ResearchGroup` and `GET /api/ResearchGroup/{id}` include `isActive` in every response object.
- `POST /api/ResearchGroup` creates a group with `isActive: true`.
- Deactivating a group does not affect related data (topic, members, phased reports).
- Lecturers cannot deactivate groups they do not own.
- Swagger documents all changes including the new field on request and response schemas.
- Tests cover: create with default `isActive`, update `isActive` to false, update `isActive` to true, omit `isActive` on update preserves existing value, and cross-lecturer rejection.
