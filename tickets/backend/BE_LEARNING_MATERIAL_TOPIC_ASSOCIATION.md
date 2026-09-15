# BE Ticket: Learning Material Topic Association

> **Status: RESOLVED** — Resolved by BE team. FE integration complete (Sep 2026). Notification i18n (English + Vietnamese prefixes) added.

## ID

BE-LEARNING-MATERIAL-TOPIC-ASSOCIATION-01

## Priority

High - required to make the Lecturer Research Topic "Manage Materials" workflow topic-scoped and production-ready.

## Background

The Lecturer Research Topics page provides a "Manage Materials" modal for adding and viewing learning materials for a specific research topic.

The current `LearningMaterial` API does not expose a `topicId` field:

- `LearningMaterialCreateRequest` contains `lecturerId`, `title`, `fileUrl`, `description`, and `subFieldId`, but no `topicId`.
- `LearningMaterialResponse` contains the same material metadata, but no `topicId`.
- `GET /api/LearningMaterial` returns the lecturer's general material library rather than materials attached to one topic.

As a result, the frontend cannot persist the relationship between a material and a research topic. The current modal must list all materials owned by the lecturer, which can display unrelated materials under every topic. The frontend currently shows a temporary backend-gap notice describing this limitation.

The frontend must not invent or emulate this relationship with local state. The association must be persisted and returned by the backend.

## Goal

Provide an authenticated and authorized API contract that allows a Lecturer to:

- Create a learning material attached to a specific research topic.
- List only the materials attached to a specific research topic.
- Reuse an existing material from the lecturer's library for a topic, if the chosen data model supports library reuse.
- Remove a material from a topic without unintentionally deleting the underlying library material, if topic attachment and library ownership are separate concepts.
- Continue managing general learning materials through the existing API.

The final route names may follow existing backend conventions, but the finalized contract must be documented in Swagger and communicated to FE before the temporary frontend fallback is removed.

## Data Model Decision Required

Please confirm which relationship the BE will implement:

### Recommended: topic-material join table

Use a join table such as `ResearchTopicLearningMaterials` when one library material may be attached to multiple research topics.

Suggested columns:

- `ResearchTopicLearningMaterialId` - primary key
- `TopicId` - foreign key to the research topic
- `LearningMaterialId` - foreign key to `LearningMaterials`
- `CreatedAt`
- `UpdatedAt`, if required by the existing conventions

Recommended database constraint:

- Unique composite key on `(TopicId, LearningMaterialId)`.

This preserves the lecturer's reusable library and prevents deleting a library item merely because it was removed from one topic.

### Alternative: nullable `topicId` on `LearningMaterials`

Add a nullable `topicId` foreign key directly to `LearningMaterials` only if a material can belong to at most one research topic. This is simpler, but it conflicts with the existing "From Library" concept if the same material needs to be reused across multiple topics.

The BE implementation must explicitly confirm the selected cardinality. The frontend contract depends on this decision.

## Proposed API Contract

The exact route naming may be adjusted to match existing backend conventions. The following behavior is required.

### 1. List materials for a topic

`GET /api/ResearchTopic/{topicId}/learning-materials`

Authenticated Lecturer who owns the topic, or an authorized Admin. Other roles may be allowed read-only access according to the platform's existing topic visibility rules.

**Response:** `200 OK`

```json
[
  {
    "learningMaterialId": 18,
    "topicId": 37,
    "lecturerId": 12,
    "title": "Distributed Systems Syllabus",
    "fileUrl": "https://firebasestorage.googleapis.com/example/syllabus.pdf",
    "description": "Week 1 reference material",
    "createdAt": "2026-09-14T00:00:00Z",
    "updatedAt": "2026-09-14T00:00:00Z"
  }
]
```

Rules:

- Return only materials attached to the requested topic.
- Do not return every material owned by the lecturer.
- Return an empty array with `200 OK` when the topic has no materials.
- Return `404 Not Found` for a topic that does not exist, if that matches existing API conventions.
- Do not expose materials from another lecturer's private topic through an arbitrary `topicId`.

### 2. Attach an existing library material to a topic

`POST /api/ResearchTopic/{topicId}/learning-materials`

Authenticated Lecturer who owns the topic and the material.

**Request body:**

```json
{
  "learningMaterialId": 18
}
```

**Response:** `201 Created`

```json
{
  "topicId": 37,
  "learningMaterialId": 18,
  "attachedAt": "2026-09-14T00:00:00Z"
}
```

Rules:

- The authenticated user must be the owner of the topic and must own the material, unless explicit sharing permissions allow the operation.
- Reject a missing topic or material with `404 Not Found`.
- Reject an invalid ownership or authorization attempt with `403 Forbidden`.
- Make repeated attachment idempotent, or return a documented `409 Conflict` for an existing association.
- Do not duplicate the underlying `LearningMaterial` row.

### 3. Create and attach a new material

Either extend the existing endpoint:

`POST /api/LearningMaterial`

or add a topic-scoped create endpoint:

`POST /api/ResearchTopic/{topicId}/learning-materials/create`

The final Swagger contract must make the topic association explicit. If the existing endpoint is extended, the request should include:

```json
{
  "lecturerId": 12,
  "topicId": 37,
  "title": "Distributed Systems Syllabus",
  "fileUrl": "https://firebasestorage.googleapis.com/example/syllabus.pdf",
  "description": "Week 1 reference material"
}
```

The response must include the persisted `topicId` and the canonical material identifier:

```json
{
  "learningMaterialId": 18,
  "topicId": 37,
  "lecturerId": 12,
  "title": "Distributed Systems Syllabus",
  "fileUrl": "https://firebasestorage.googleapis.com/example/syllabus.pdf",
  "description": "Week 1 reference material",
  "createdAt": "2026-09-14T00:00:00Z"
}
```

Rules:

- Derive the acting Lecturer from the authenticated identity where possible; do not trust an arbitrary owner ID from the client for authorization.
- Validate that the topic exists and belongs to the acting Lecturer.
- Validate `fileUrl` as an allowed `http` or `https` URL. The backend must independently validate this even though the frontend validates it.
- Preserve nullable description behavior if that matches the existing schema.
- Document whether `subFieldId` remains supported. It should not be required for the topic association workflow because it is not a user-facing field in the current modal.

### 4. Detach a material from a topic

`DELETE /api/ResearchTopic/{topicId}/learning-materials/{learningMaterialId}`

Authenticated Lecturer who owns the topic, or an authorized Admin.

**Response:** `204 No Content` or the existing project-standard success response.

Rules:

- Remove only the topic association when a join table is used.
- Do not delete the underlying library material as a side effect of detaching it from a topic.
- Return `404 Not Found` when the association does not exist, unless the endpoint is explicitly idempotent.
- Return `403 Forbidden` when the caller is not authorized to manage the topic.

If the BE chooses a direct nullable `topicId` column instead of a join table, document the equivalent detach behavior and what happens to materials that are already reused or shared.

## Existing API Compatibility

- Preserve `GET /api/LearningMaterial` for the general lecturer library.
- Preserve existing create, update, and delete behavior for library materials unless the selected association model requires a documented versioned change.
- Do not silently change `GET /api/LearningMaterial` to become topic-scoped.
- Add the topic association fields to Swagger request and response schemas before FE integration.
- Keep existing `learningMaterialId` naming consistent with the current response schema. If the API also returns `id`, document both fields and designate one canonical field.

## Authorization and Validation

The backend must enforce all authorization rules server-side:

- A Lecturer may manage materials only for topics they own or are explicitly authorized to manage.
- A Lecturer may attach only materials they own or are allowed to reuse.
- A user must not be able to access another user's topic materials by changing `topicId` in the URL.
- Reject invalid or unsafe `fileUrl` values; allow only the URL schemes supported by the platform.
- Validate that referenced topic and material IDs are positive integers.
- Prevent duplicate associations.
- Use a transaction for creating a new material and its topic association, or clean up the material if association creation fails.

## Migration and Existing Data

- Add the required foreign keys and indexes for the selected model.
- Define the delete behavior explicitly. Recommended behavior is to delete the topic association when a topic is deleted while retaining the lecturer's reusable library material, unless business rules require otherwise.
- Existing `LearningMaterials` rows must remain readable after deployment.
- Existing rows should be treated as unassigned until a migration or administrative backfill explicitly associates them with topics.
- Do not assign all existing lecturer materials to every topic as a fallback.
- If a direct nullable `topicId` column is selected, the migration must be backward-compatible and allow `NULL` for existing records.

## Frontend Integration Notes

After the API is available, the frontend will:

- Replace the current all-materials fallback in `LearningMaterialModal` with the topic-scoped list endpoint.
- Send the current research topic ID when creating or attaching a material.
- Use the attach endpoint for the "From Library" source instead of treating it as a new material URL.
- Keep Link and Upload sources as URL-producing inputs. The uploaded Firebase URL will be sent to the BE as `fileUrl`.
- Remove the temporary backend-gap banner after the topic-scoped API is verified in Swagger and against the running environment.
- Keep the list internally scrollable when many materials are returned.

No frontend change should be considered complete until the final BE contract is available in Swagger.

## Acceptance Criteria

- [ ] The selected data model supports the required topic/material cardinality and is documented.
- [ ] A Lecturer can list only the materials attached to a topic.
- [ ] A Lecturer can attach an existing owned library material to a topic without duplicating it.
- [ ] A Lecturer can create a new material attached to a topic.
- [ ] The create and list responses include the canonical topic and material identifiers.
- [ ] A Lecturer can detach a material from a topic without unintended deletion of the reusable library material.
- [ ] Unauthorized users cannot read or mutate another Lecturer's topic-material associations.
- [ ] Duplicate associations are rejected or handled idempotently according to the documented contract.
- [ ] Invalid topic IDs, material IDs, and unsafe file URLs are rejected with documented status codes.
- [ ] Existing general library endpoints remain backward-compatible.
- [ ] Swagger documents every route, request body, response body, authorization requirement, and error response.
- [ ] Existing learning-material records survive the migration and are not incorrectly assigned to topics.
- [ ] FE can remove the temporary backend-gap banner after verifying the production contract.

## BE Deliverables

- Database migration and foreign keys/indexes for the selected association model.
- API implementation and authorization checks.
- Updated request/response DTOs.
- Swagger/OpenAPI documentation.
- Automated tests covering authorization, duplicate attachment, topic filtering, create/attach, detach, invalid URLs, and migration compatibility.
- A short contract note identifying the final route names and whether the implementation uses a direct `topicId` column or a join table.
