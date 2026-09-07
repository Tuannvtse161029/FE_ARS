# CRITICAL: Admin Cannot Persist Paper Authorship Verification

- Ticket: BE-PUBLICATION-VERIFY-CRITICAL
- Severity / priority: CRITICAL / P0
- Status: Open - backend investigation and implementation required
- Owner: Backend publication workflow team
- Reported: 2026-09-08
- Frontend branch: phuongpdse140481_FE
- API: https://arsplatform.onrender.com
- Swagger: https://arsplatform.onrender.com/swagger/index.html

## Business Impact

After a Researcher submits a paper, Admin cannot reliably accept its authorship
verification. The database remains pending and reviewer assignment remains
locked. This blocks the core Researcher -> Admin -> Reviewer publication flow.

Product rule: after authorship is verified, Admin can select reviewers directly.
Do not introduce another "Approve for review" prerequisite. Verification does
not publish the manuscript or constitute a reviewer recommendation.

## Expected Versus Actual

Expected: Admin clicks Accept identity / Verify authorship, the backend persists
the decision, and both paper detail and list return the verified state after
refresh, logout/login, and access from another browser.

Actual: the frontend sends the decision but the authoritative response does not
confirm it. It displays:

> The request was sent, but the backend did not confirm the authorship decision. The paper has not been marked verified locally.

An earlier frontend wrote a browser-local verification flag. Its Verified badge
was not evidence of a persisted database decision. That workaround must not be
used to satisfy this ticket.

## Evidence and Limits

The user-provided Papers database export showed:

- PaperIds 45, 46, 47: Status = Submitted;
  AuthorshipVerificationStatus = PENDING_ADMIN_REVIEW;
  AuthorshipVerifiedAt = NULL.
- Papers 45 and 47: AuthorshipVerificationReason =
  PAPER_UPDATED_REQUIRES_REVIEW.
- Paper 46: AuthorshipVerificationReason = AWAITING_ADMIN_VERIFICATION.
- Controlled test PaperIds 48 and 49: Status = Submitted;
  AuthorshipVerificationStatus = NOT_CHECKED; AuthorshipVerifiedAt = NULL.

These are historical observations. Re-read the records before reproduction:
the user may have manually changed a test record afterward. Do not reset or
overwrite existing records to reproduce this issue.

The audited Swagger PaperUpdateRequest requires title, abstract, and paperType
(Journal or Conference), but does not declare the manual authorship decision
fields. Its schema sets additionalProperties to false. A separate
POST /api/Paper/{id}/verify-authorship exists for OpenAlex/ORCID verification;
the audited description does not establish an Admin manual decision contract.

The evidence establishes a persistence/contract mismatch, not the exact backend
line responsible. No sanitized HTTP capture proving whether unknown fields were
ignored, rejected, or reset is available. Backend must inspect DTO binding,
authorization, verification-reset logic, ORM updates, and database triggers.

## Current Frontend Request

Entry points:

- src/features/publication/admin/AdminPaperSubmissions.tsx
- src/features/publication/admin/AdminPaperSubmissionDetail.tsx
- src/features/publication/api/publication.adapter.ts: verifyAuthorship
- src/services/paper.service.ts: update

Sequence:

1. GET /api/Paper/{paperId} for current metadata.
2. PUT /api/Paper/{paperId}, preserving the documented paper fields and adding
   the decision fields below.
3. GET /api/Paper/{paperId} to verify persistence.

Relevant payload fragment (illustrative, not a complete captured request):

```json
{
  "title": "<existing title>",
  "abstract": "<existing abstract>",
  "paperType": "Journal",
  "authorshipVerificationStatus": "ALLOW",
  "authorshipVerifiedAt": "<client UTC timestamp>",
  "authorshipVerificationReason": "Admin ALLOW"
}
```

Rejection currently sends REJECTED and Admin REJECTED instead. The backend
should own the verification timestamp and acting Admin identity. No tokens,
credentials, protected PDF URLs, or private reviews belong in ticket evidence.

## Required Backend Change

Provide and document an Admin-only manual decision operation. Prefer a dedicated
operation so verifying authorship does not run the ordinary metadata update path
and immediately reset verification with PAPER_UPDATED_REQUIRES_REVIEW.

Suggested contract below is a proposal, NOT an existing endpoint:

```http
PUT /api/Paper/{paperId}/authorship-decision
Authorization: Bearer <Admin token>
Content-Type: application/json
```

```typescript
interface PaperAuthorshipDecisionRequest {
  decision: 'VERIFIED' | 'REJECTED';
  reason?: string; // Required and nonblank for rejection.
}

interface PaperAuthorshipDecisionResponse {
  id: number;
  status: string; // Existing editorial state remains unchanged.
  authorshipVerificationStatus: 'VERIFIED' | 'REJECTED';
  authorshipVerifiedAt: string | null;
  authorshipVerificationReason: string | null;
}
```

Backend may choose another route or extend a suitable existing route, but must
publish the final contract in Swagger and coordinate the frontend caller change.
Use one canonical verified value. The frontend currently recognizes VERIFIED,
ALLOW, and ALLOWED as verified, but new responses should consistently use the
documented canonical value.

### Persistence and Authorization

- Atomically persist Papers.AuthorshipVerificationStatus and decision reason.
- For verification, set AuthorshipVerifiedAt using server UTC time.
- For rejection, clear AuthorshipVerifiedAt; retain rejection actor/time in the
  audit record rather than treating a rejection timestamp as verification.
- Record acting Admin, paper ID, prior/new decision, reason, and server time in
  the audit log. Derive actor identity from authentication, not request input.
- Permit manual decisions only for authenticated, authorized Admins.
- Define eligible starting verification states, including NOT_CHECKED and
  PENDING_ADMIN_REVIEW. Reject conflicting/stale decisions explicitly.
- Repeating the same accepted request must be safe and must not duplicate
  notifications or corrupt metadata.
- A genuine manuscript/author edit may invalidate verification according to the
  agreed policy; a verification-only request must not invalidate itself.
- Preserve title, abstract, bibliographic authors, creator, file URL, DOI,
  OpenAlex ID, classification, assignments, reviews, and editorial Status.
- Return explicit 400/401/403/404/409 errors as appropriate. Never return a
  claimed successful verification while leaving the persisted state pending.

## Reproduction

1. Create a clearly labeled controlled test submission as Researcher and record
   its paper ID. Use the user-provided test accounts through normal login.
2. GET the paper and record its status and verification fields only.
3. Sign in as Admin and open Paper Submissions or its editorial record.
4. Click Accept identity / Verify authorship once.
5. Capture the request method/path, non-sensitive decision payload, HTTP status,
   and response verification fields. Do not capture authorization headers.
6. GET the same paper again and compare with the database verification columns.
7. Hard-refresh and repeat the read from a separate authenticated Admin session.
8. Confirm reviewer selection becomes available after verification, without
   another approval action or any publication mutation.

## Acceptance Criteria

- [ ] A pending test paper becomes VERIFIED through the documented Admin API.
- [ ] AuthorshipVerifiedAt is populated with server UTC verification time.
- [ ] GET detail and GET list agree with the database after the write.
- [ ] Verified state survives refresh and a different authenticated session.
- [ ] Reviewer selection is available immediately after verified data reloads.
- [ ] Paper editorial Status remains Submitted when verifying a Submitted paper.
- [ ] No assignment, evaluation, or publication is created by verification.
- [ ] Rejection requires feedback and persists separately from paper rejection.
- [ ] Researcher and Reviewer attempts cannot make an Admin decision.
- [ ] Duplicate requests and failed requests preserve all paper metadata.
- [ ] Verification-only writes do not trigger verification reset logic.
- [ ] Swagger documents request/response fields, canonical values, errors, and
  role requirements; frontend is connected to that confirmed contract.
- [ ] No browser-local flag or direct database edit is required to pass testing.

## Delivery Evidence

Return the final Swagger operation, a controlled paper ID, sanitized before/after
verification fields, separate-session GET results, and focused backend test
results. This ticket is complete only when the API persists the decision and the
Admin frontend can observe it through normal reads.
