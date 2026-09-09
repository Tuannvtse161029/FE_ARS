# BE Ticket: Make OpenAlex ID Optional on Paper Acceptance

## ID

BE-PAPER-OPENALEX-OPTIONAL-01

## Priority

Medium

## Background

The current API endpoint for accepting a researcher-submitted paper (`POST /api/admin/paper-submissions/{id}/approve`) requires an `openAlexId` field to be present in the request payload. If `openAlexId` is `null` or missing, the API returns a validation error and the paper cannot be accepted.

However, the project's business rule states that **OpenAlex is optional**. Researchers may submit papers that are not indexed in OpenAlex. In such cases, an Admin must manually verify the paper's legitimacy by:

- Checking the DOI and cross-referencing with platforms such as Google Scholar, Crossref, or ResearchGate
- Verifying the title, authors, abstract, and publication date
- Manually confirming the paper's legitimacy

The current API enforcement contradicts this business rule and blocks the valid manual-verification workflow.

## Goal

Make `openAlexId` optional on the paper acceptance endpoint, and track the verification method used so the system can distinguish between auto-verified and manually-verified papers.

## API Contract

### 1. Accept a paper submission

`POST /api/admin/paper-submissions/{id}/approve`

**Current behavior:** `openAlexId` is required; request fails if omitted.

**Expected behavior:** `openAlexId` is optional. When omitted, the paper is accepted via manual verification.

Request body — update to make `openAlexId` nullable:

```json
{
  "openAlexId": "A1234567890",    // optional; omit or null if not available
  "adminNote": "Verified manually via Crossref DOI lookup."
}
```

Response — include `verificationMethod` in the accepted paper record:

```json
{
  "paperId": 123,
  "status": "ADMIN_APPROVED",
  "openAlexId": null,
  "verificationMethod": "manual",
  "approvedAt": "2026-09-09T10:00:00Z",
  "approvedBy": "admin@ars.edu"
}
```

When `openAlexId` is provided:

```json
{
  "paperId": 123,
  "status": "ADMIN_APPROVED",
  "openAlexId": "A1234567890",
  "verificationMethod": "openAlex",
  "approvedAt": "2026-09-09T10:00:00Z",
  "approvedBy": "admin@ars.edu"
}
```

### 2. Get paper submission detail (update response)

`GET /api/admin/paper-submissions/{id}`

Return `verificationMethod` in the response so the Admin UI can display the appropriate verification badge:

```json
{
  "paperId": 123,
  "title": "...",
  "openAlexId": null,
  "verificationMethod": "manual",
  ...
}
```

## Authorization and Enforcement Requirements

- Verify the JWT subject has the Admin role.
- If `openAlexId` is provided, optionally validate that it is a well-formed OpenAlex ID. Reject malformed IDs with `400 Bad Request`.
- Do not require `openAlexId` — accept `null` or omit the field.
- Set `verificationMethod` server-side based on whether `openAlexId` is present (`"openAlex"`) or absent (`"manual"`). Do not trust a client-supplied `verificationMethod` value.
- If `openAlexId` is provided but the Admin also supplies a `adminNote`, accept the paper normally — `adminNote` is for audit context only.
- Make the acceptance idempotent: re-approving an already-approved paper with the same `openAlexId` returns the existing record, not a new one.

## Data Requirements

### Database

Add a nullable `verification_method` column to the `Papers` table (or equivalent):

```sql
ALTER TABLE Papers
ADD COLUMN verification_method VARCHAR(20) NULL;
-- Values: 'openAlex' | 'manual'
```

The column should be back-filled for existing approved papers (set to `"openAlex"` if they have an `openAlexId`, `"manual"` otherwise).

### Swagger Documentation

- `openAlexId` field must be marked as **optional** (not required) on the approve request schema.
- `verificationMethod` field must appear in the approve response schema.
- Document the `400` validation error for malformed `openAlexId` (when provided).

## Frontend Impact

Once this API change is live, the FE team will:

- Pass `openAlexId` when present (current behavior, no change)
- Omit `openAlexId` from the request body when the researcher did not provide one (current FE adapter already does this conditionally — the BE is the blocker)
- Display a "Manually Verified" badge in the Admin paper detail view when `verificationMethod === "manual"`
- Update `src/features/publication/types/publication.ts` to include `verificationMethod` in the type definitions

**FE files involved:**
- `src/features/publication/admin/AdminPaperSubmissionDetail.tsx` — badge display
- `src/features/publication/api/publication.adapter.ts` — acceptance adapter call
- `src/features/publication/types/publication.ts` — type definition

## Acceptance Criteria

- [ ] Admin can accept a paper when `openAlexId` is omitted or `null`
- [ ] The accepted paper record includes `verificationMethod = "manual"` in the database and API response
- [ ] When `openAlexId` is provided, `verificationMethod = "openAlex"`
- [ ] Swagger schema reflects `openAlexId` as optional
- [ ] Existing flow (paper with OpenAlex ID) continues to work unchanged
- [ ] API returns `400` for malformed `openAlexId` (when provided)
- [ ] Swagger documents all success, `400`, `401`, `403`, `404`, and `409` responses

## References

- Backend API docs: `https://arsplatform.onrender.com/swagger/index.html`
- DB schema reference: `docs/local-only/erd-schema-reference.md`
- FE ticket / context: `docs/local-only/api-gap-ticket-for-be.md`
