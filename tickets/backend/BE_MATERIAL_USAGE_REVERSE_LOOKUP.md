# Material Usage Reverse Lookup

- Ticket: BE-LEARNING-MATERIAL-USAGE-REVERSE-LOOKUP
- Severity / priority: LOW / P3 (convenience endpoint)
- Status: Open - non-blocking FE workaround in place
- Owner: Backend learning-material team
- Reported: 2026-09-17
- Frontend branch: phuongpdse140481_FE
- API: https://arsplatform.onrender.com
- Swagger: https://arsplatform.onrender.com/swagger/index.html

## Background

The Lecturer's `Materials` tab tells the user whether each material is being
used by any **research topic** or **phase**, and shows a "Used by …" chip plus
a modal listing the topics that reference a given material.

Two attachment pathways exist today:

1. **Legacy** — `ResearchTopic.materialsUrl` is set to the material's
   `fileUrl` (one URL per topic).
2. **Newer** — `ResearchTopicLearningMaterial` rows are created via
   `POST /api/ResearchTopic/{id}/learning-materials` and store
   `{ learningMaterialId, topicId, fileUrl, title, … }`.

The current BE exposes only:

- `GET /api/LearningMaterial/{id}/usages` — returns phase references only.
- `GET /api/ResearchTopic/{id}/learning-materials` — returns the junctions
  for a single topic.

There is **no endpoint that, given a `learningMaterialId`, returns all
topics that reference it**. The FE has to fan out an N+1 call
(`getByTopicId(topic.id)` for every topic) to discover junction references.

## Bug Surface

When a material is attached only via the newer junction pathway, the FE
side usage counter reads `"Used by 0 topic(s), 0 phase(s)"` even though the
material is actively in use. The lecturer then deletes or rewrites the
material thinking it is orphaned.

## Proposed BE Change

Add a dedicated reverse-lookup endpoint, e.g.

```
GET /api/LearningMaterial/{id}/topic-usages
GET /api/LearningMaterial/{id}/usages  (extend to include topics)
```

Response shape (suggested):

```json
{
  "learningMaterialId": 42,
  "phases": [
    { "phaseId": 7, "phaseTitle": "Phase 1", "researchTopicId": 3, "researchTopicTitle": "Demo Research Topic" }
  ],
  "topics": [
    { "topicId": 3, "topicTitle": "Demo Research Topic", "topicStatus": "OPEN", "junctionId": 12, "createdAt": "…" }
  ]
}
```

Once this endpoint ships, the FE can:

- Replace the per-page-mount N+1 fan-out with a single call (or one call
  per "Materials" page visit, batched if there are >50 materials).
- Drop the legacy `topic.materialsUrl === url` matching path and rely on
  the junction table as the single source of truth (BE migration concern).

## Frontend Workaround (in place)

File: `src/pages/Lecturer/Materials.tsx`

- Added `topicMaterialJunctions: TopicLearningMaterialResponse[]` state.
- `loadCrossReference` now also does:
  ```ts
  const junctionLists = await Promise.all(
    canonicalTopics.map((t) =>
      topicLearningMaterialService.getByTopicId(t.id as number).catch(() => []),
    ),
  );
  setTopicMaterialJunctions(junctionLists.flat());
  ```
- `usageByUrl` counts junction rows whose `fileUrl` (and `learningMaterialId`
  when present) matches the material; `usedByTopicsForModal` shows both
  legacy and junction-based references.

The lecturer-side bug ("Testing YT Link → Not used") should already be
fixed by the workaround; the dedicated endpoint just removes the round-trip
cost.

## Acceptance Criteria

1. `GET /api/LearningMaterial/{id}/topic-usages` returns the list above.
2. Response latency is < 200 ms for materials with ≤ 1000 junction rows.
3. Pagination is included if the junction row count exceeds a reasonable
   threshold (suggested: 100 per page).
4. The FE can subsequently drop the N+1 fan-out (tracking issue to be filed
   after this endpoint ships).
