# BE Ticket — Nullable `endTime` + Manual "Mark as Completed" for Seminars

## ID

BE-SEMINAR-ENDTIME-01

## Priority

**High** — blocks the lecturer's core UX: a seminar cannot currently be ended by the lecturer at a time of their choosing. The seminar auto-flip to "Completed" 1 hour after start because the FE sends a `startTime + 1h` placeholder as `endTime`. This creates silent, incorrect state in the database and in the UI.

## Background

The ARS Seminar feature allows a Lecturer or Researcher to schedule and host online seminars with Google Meet integration, invite participants, collect dynamic feedback, and generate AI summaries.

The current BE Swagger contract marks `endTime` as **required** on `POST /api/Seminar`. The FE therefore sends `startTime + 1 hour` as a placeholder so the create call is accepted. This causes two problems:

1. **Incorrect database state**: `Seminars.EndTime` is set to 1 hour after start even though the seminar is still running.
2. **Silent auto-completion**: After exactly 1 hour, `deriveEffectiveStatus()` (FE) flips the seminar to `COMPLETED` based on `endTime < now` — regardless of whether the meeting has actually ended.

There is no endpoint for a lecturer to explicitly end a seminar at a time of their choosing.

The BE should make `endTime` nullable and add a manual "complete" endpoint so the FE can drop the placeholder entirely. The FE `deriveEffectiveStatus()` logic will then work correctly: `endTime = null` means "open-ended" (lecturer hasn't ended it yet); `endTime = now` (set by the complete endpoint) means "explicitly ended".

## Goal

1. Make `endTime` nullable on `POST /api/Seminar` and `PUT /api/Seminar/{id}`.
2. Add a lecturer-only endpoint to explicitly complete a seminar (sets `endTime = DateTime.UtcNow`, flips status to `"Completed"`).

## API Changes Required

### 1. `POST /api/Seminar` — make `endTime` nullable

**Current request body:**
```json
{
  "startTime": "2026-09-20T02:00:00Z",
  "endTime": "2026-09-20T03:00:00Z",
  "content": "..."
}
```

**Updated request body:**
```json
{
  "startTime": "2026-09-20T02:00:00Z",
  "endTime": null,
  "content": "..."
}
```

`endTime` becomes optional (`string | null`). When `null`, the seminar is created in an open-ended "upcoming" state. The BE may default the DB column to `NULL`.

### 2. `PUT /api/Seminar/{id}` — make `endTime` nullable

The update endpoint should also accept `endTime: null` (to correct a mistakenly set end time) and `endTime: string` (to set a specific end time manually).

### 3. New endpoint: `POST /api/Seminar/{id}/complete`

**Role:** Lecturer or Researcher who owns the seminar (organizer check required).

**Request body:** none (empty).

**Behaviour:**
1. Verify caller is the organizer of the seminar (`Seminars.OrganizerId` matches JWT user ID). Return `403` if not.
2. Set `Seminars.EndTime = DateTime.UtcNow`.
3. Set `Seminars.Status = "Completed"` (or equivalent canonical status).
4. Return the updated `SeminarResponse`.

**Response:** `SeminarResponse` with `endTime = DateTime.UtcNow` and `status = "Completed"`.

**Error cases:**
- `403` — caller is not the organizer.
- `404` — seminar not found.
- `409` — seminar already has an `endTime` (already completed). Return a conflict error with a descriptive message.

**Optional (nice-to-have):** also send a post-seminar email to all participants who had `InvitationStatus != DECLINED`.

### 4. GET endpoints — return nullable `endTime`

All seminar GET endpoints (`GET /api/Seminar`, `GET /api/Seminar/{id}`, `GET /api/Seminar/my-invitations`, etc.) should return `endTime` as `string | null`. When `null`, the seminar is still open-ended.

## FE Impact (for FE team reference)

Once this BE ticket is complete, the FE team will:

1. Stop sending the `+1h` placeholder on `POST /api/Seminar` — omit `endTime` entirely.
2. Remove `deriveEffectiveStatus()` reliance on `endTime < now` as the sole COMPLETED signal.
3. Add a **"Mark as Completed"** button to the seminar card and detail view (visible only to the owner when `effectiveStatus` is `UPCOMING` or `IN PROGRESS`).
4. Call `POST /api/Seminar/{id}/complete` when the lecturer clicks the button.

The `deriveEffectiveStatus()` logic will work correctly with no FE changes needed:
- `endTime = null` → function returns the raw status (`UPCOMING`/`IN PROGRESS`) — seminar stays open
- `endTime = <some UTC time>` → function checks if that time has passed → `COMPLETED`

## Database Schema Note

The `Seminars.EndTime` column should allow `NULL`. If it is currently `NOT NULL`, add a migration to make it nullable. The existing placeholder rows written by the current FE will have non-null `EndTime` values — these can be left as-is (they represent past seminars that have already ended).

## Acceptance Criteria

- [ ] `POST /api/Seminar` accepts `endTime: null` without returning 400
- [ ] `POST /api/Seminar/{id}/complete` sets `endTime = now` and `status = "Completed"` for the organizer
- [ ] `POST /api/Seminar/{id}/complete` returns `403` for non-organizers
- [ ] `POST /api/Seminar/{id}/complete` returns `409` if seminar is already completed
- [ ] GET endpoints return `endTime: null` for newly created seminars without a placeholder
- [ ] Swagger docs updated to reflect `endTime` as nullable
