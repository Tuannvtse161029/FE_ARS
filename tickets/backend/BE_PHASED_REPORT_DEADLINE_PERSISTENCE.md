# BE Ticket — Phase Milestone `deadlineAt` Not Persisted on `POST /api/PhasedReport/topic-milestones`

## ID

BE-PHASED-REPORT-DEADLINE-01

## Priority

**High** — the lecturer milestone editor silently drops the deadline the lecturer just typed in. On reload the field is empty, the footer shows "Last deadline not set", and the phase never auto-completes on the picked date. All other milestone fields (`phaseNumber`, `milestoneTitle`, `startDate`, `requirements`, `assessmentCriteria`) round-trip correctly, so the issue is specific to the deadline column.

## Background

The ARS Lecturer "Configure Milestones" screen (`pages/Lecturer/ConfigureMilestones.tsx` → `components/lecturer/PhaseEditorPanel.tsx`) lets a lecturer define up to 5 phases per research topic. For each phase the lecturer fills in:

- `phaseNumber` (1..5)
- `milestoneTitle`
- `requirements`
- `assessmentCriteria`
- `startDate`
- `deadline` (UI field; mapped to wire `deadlineAt`)

On **Save milestones**, the FE calls `POST /api/PhasedReport/topic-milestones` (Swagger operation id `PhasedReport_SetTopicMilestones`) with a `TopicMilestonesCreateRequest` payload. The request body looks like:

```json
{
  "topicId": 37,
  "researchGroupId": 42,
  "phases": [
    {
      "phaseNumber": 1,
      "milestoneTitle": "Phase 1: Literature Review",
      "requirements": "...",
      "assessmentCriteria": "...",
      "startDate": "2026-09-12T13:26:00.000Z",
      "deadlineAt": "2026-09-15T14:00:00.000Z"
    }
  ]
}
```

**Observed behaviour after Save → reload the page:**

- `phaseNumber`, `milestoneTitle`, `requirements`, `assessmentCriteria`, `startDate` are all persisted and re-rendered correctly.
- `deadlineAt` is **silently dropped**. The deadline input on the form is empty (placeholder `mm/dd/yyyy --:-- --`) and the footer of the editor shows `Last deadline not set`.
- A second round-trip `PUT /api/PhasedReport/{id}` (used only for the learning-material URL) also does not preserve `deadlineAt`.

## Wire contract reference (per `swagger.json`)

`#/components/schemas/TopicMilestonesCreateRequest` → `phases` items → `#/components/schemas/TopicPhaseItem`:

| Field             | Type           | Nullable | Source / status |
|-------------------|----------------|----------|-----------------|
| `phaseNumber`     | int32          | no       | FE sends        |
| `milestoneTitle`  | string         | yes      | FE sends        |
| `phaseTitle`      | string         | yes      | derived on response (`readOnly`) |
| `requirements`    | string         | yes      | FE sends        |
| `assessmentCriteria` | string      | yes      | FE sends        |
| `criteria`        | string         | yes      | derived on response (`readOnly`) |
| `startDate`       | date-time      | yes      | FE sends — **persists correctly** |
| `startedAt`       | date-time      | yes      | derived on response (`readOnly`) |
| `deadlineAt`      | date-time      | yes      | FE sends — **NOT persisted** |
| `deadline`        | date-time      | yes      | FE sends (as a Swagger alias, see FE mitigation) — **also NOT persisted** |

`#/components/schemas/PhasedReportResponse` confirms `deadlineAt` is the canonical field on the response (no `readOnly`), while `deadline` is `readOnly: true` on the response.

The `additionalProperties: false` constraint on `TopicPhaseItem` means the BE rejects any unknown field (e.g. an `endDate` alias would be rejected). The FE therefore strictly uses the Swagger fields above.

## Goal

1. Persist the lecturer's picked deadline for each milestone phase to the `PhasedReports.DeadlineAt` (or equivalent) DB column.
2. Echo the saved `deadlineAt` back on `PhasedReportResponse.deadlineAt` so the FE round-trip is lossless.
3. Make `deadlineAt` survive both round-trips the FE does on Save:
   - `POST /api/PhasedReport/topic-milestones` (creates the milestone rows)
   - `PUT /api/PhasedReport/{id}` (separate per-phase update for the learning material URL — should not wipe `DeadlineAt`)
4. Confirm the response of the `GET /api/PhasedReport/topic-milestones` (or whatever endpoint the FE uses to reload phases) returns the saved `deadlineAt`.

## API Changes Required

### 1. `POST /api/PhasedReport/topic-milestones` — persist `deadlineAt`

The endpoint already accepts `TopicPhaseItem.deadlineAt` per Swagger. **Verify** that the controller binds `TopicPhaseItem.deadlineAt` to the `PhasedReports.DeadlineAt` DB column and persists it on insert/upsert.

If the controller currently binds the wrong property (e.g. it reads `Deadline` instead of `DeadlineAt` — `deadline` is the Swagger *alias* that the FE also sends defensively; see FE mitigation note below), change it to read `deadlineAt`. If the column is nullable in the DB, write whatever the FE sent (including `null`); if the column is non-nullable and `null` is sent, decide whether to keep `null` (preferable) or fall back to a sensible default.

Response shape should remain a list of `PhasedReportResponse` (or equivalent) with `deadlineAt` populated.

### 2. `PUT /api/PhasedReport/{id}` — preserve `deadlineAt`

When the FE calls `PUT /api/PhasedReport/{id}` (used by `PhaseEditorPanel.tsx` to attach a learning-material URL after milestone creation), the controller must **not null out `DeadlineAt`** if the request body omits the field.

The request body for this endpoint already accepts `deadlineAt` per `PhasedReportUpdateRequest`. **Verify** the controller treats omitted fields as "leave unchanged" instead of "set to null". If it currently overwrites missing fields with `null`, fix the partial-update semantics so `DeadlineAt` is preserved unless explicitly set in the request.

### 3. GET endpoints — return saved `deadlineAt`

Confirm `GET /api/PhasedReport/{id}`, `GET /api/PhasedReport/topic/{topicId}` (or equivalent endpoint the FE calls on page reload — see `researchTopicPhase.service.ts:getByTopic()`) return the persisted `deadlineAt` on each `PhasedReportResponse`.

## DB verification query

After running the FE Save flow on a fresh phase, the BE team should be able to confirm with a query such as:

```sql
SELECT pr.PhasedReportId, pr.TopicId, pr.PhaseNumber,
       pr.MilestoneTitle, pr.StartDate, pr.DeadlineAt,
       pr.Deadline, pr.UpdatedAt
FROM PhasedReports pr
WHERE pr.TopicId = 37
ORDER BY pr.PhaseNumber;
```

Expected: for each saved phase, `DeadlineAt` is non-null and matches the ISO string the FE sent. Currently `DeadlineAt` is `NULL` for every row the FE tried to save.

Also confirm the column definition:

```sql
SHOW CREATE TABLE PhasedReports;
-- or
SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'PhasedReports' AND COLUMN_NAME IN ('DeadlineAt', 'Deadline');
```

`DeadlineAt` should be nullable (`IS_NULLABLE = 'YES'`) so the lecturer can leave it blank if needed.

## FE Investigation Summary (already verified)

The FE team has confirmed:

1. The FE is sending `deadlineAt` and `deadline` (the Swagger alias) as ISO-8601 UTC strings, e.g. `"2026-09-15T14:00:00.000Z"`, in the `phases[]` array of the request body. Both are populated; neither is omitted or null.
2. The FE service is `phasedReportService.setTopicMilestones()` → `POST /api/PhasedReport/topic-milestones` (`src/services/researchTopicPhase.service.ts`).
3. After the BE call returns success, `PhasedReportResponse.deadlineAt` is `null` (or absent) for the rows just saved, even though the same response correctly includes `startDate`, `milestoneTitle`, `requirements`, and `assessmentCriteria`.
4. Reloading the editor shows the deadline input empty (placeholder) and the footer "Last deadline not set".

Because the wire payload is correct per Swagger and the BE selectively drops only the deadline column while keeping every other field, the bug is in the BE controller / DTO mapping / EF entity configuration for `DeadlineAt`.

## FE mitigation already applied (defensive only — not a fix)

The FE has been updated to send `deadline` (the Swagger alias) alongside `deadlineAt`, and to echo `deadlineAt` + `deadline` back on the per-phase `PUT /api/PhasedReport/{id}` body, so the second round-trip cannot wipe the column. These changes do not mask the BE bug — they only reduce the surface area. Please fix the BE persistence so the FE can drop these defensive aliases in a future cleanup.

## Acceptance Criteria

- [ ] Save a milestone phase with `deadlineAt: "2026-09-15T14:00:00.000Z"` via `POST /api/PhasedReport/topic-milestones`.
- [ ] Reload the topic via the BE GET endpoint and confirm `PhasedReportResponse.deadlineAt` equals the saved value (not null).
- [ ] Run the DB verification query above and confirm `DeadlineAt` is non-null and matches the FE-sent value.
- [ ] Call `PUT /api/PhasedReport/{id}` with only `phasedMaterialsUrl` set (no `deadlineAt` in the body) — confirm `DeadlineAt` is preserved on the row, not nulled.
- [ ] Confirm `DeadlineAt` column allows `NULL` (so a lecturer can intentionally leave the deadline blank).
- [ ] Swagger documentation is up to date with the persisted shape (no schema change required, but please verify the description of `deadlineAt` on `TopicPhaseItem` reflects that it is the canonical writable field, while `deadline` is a derived alias).
- [ ] Add a unit / integration test that POSTs a `TopicPhaseItem` with `deadlineAt` set and asserts the column is persisted.
- [ ] Add a regression test that the per-phase `PUT` does not null out `DeadlineAt` when the field is omitted from the request body.
