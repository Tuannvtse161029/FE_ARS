# Publication Incident: Backend Contract Requests

Date: 2026-09-07. Frontend branch: phuongpdse140481_FE.
Inspected base revision: ac9b1ba7c371431b8e1a1891e4f0e52eada5f80f.
Reproduction scope: local dirty checkout, not the deployed Vercel revision.
Contract source: https://arsplatform.onrender.com/swagger/v1/swagger.json.

## Evidence Boundary

The evidence below comes from live Swagger and source inspection. No authenticated
production mutation or full Researcher/Admin/Reviewer lifecycle was performed.
No actual manuscript, assignment, or evaluation ID is claimed as reproduced.
Do not treat the sample DTO shapes as captured production requests.

## Approval for Peer Review

Current frontend previously sent authorshipVerificationStatus and related fields
to PUT /api/Paper/{id}. The live PaperUpdateRequest excludes these properties,
requires title, abstract, and paperType, and disallows additional properties.
The existing POST /api/Paper/{id}/verify-authorship performs OpenAlex/ORCID checks;
it does not document a manual editorial approval operation.

Required backend decision: document an authorized Admin approval operation,
permitted source statuses, persisted result, and distinct authorship outcome.
Return the authoritative paper identifier and editorial status. A response still
showing Pending must not be reported as approval success.

Proposed semantic response, subject to backend approval:

```typescript
interface EditorialApprovalResult {
  paperId: number;
  editorialStatus: string; // Backend must publish the allowed enum.
  approvedForReviewAt: string;
}
```

Verification steps: create a controlled submitted manuscript, record its paper
ID/status, approve as Admin, GET detail and list, hard refresh, and confirm the
persisted transition. Attempt the same action as Researcher/Reviewer and require
authorization failure. Current frontend blocks the undocumented mutation.

## Independent Public Visibility

Current contract provides a free-form Paper.status string but no independent
activity field or documented deactivate/reactivate endpoints. The old frontend
overwrote Published with Inactive; this loses the publication axis.

Required backend contract: an Admin-only visibility mutation preserving the
Published editorial status, with an authoritative response including paperId,
editorialStatus, isActive, and publishedAt. Public catalog queries must exclude
inactive records, while Admin listing supports both states. Reactivation must
not invoke a second publication or review lifecycle. Proposed request:

```typescript
interface PublicationVisibilityRequest { isActive: boolean }
```

The backend must choose/document the endpoint and validation. The frontend now
exposes explicit errors for these unsupported operations instead of rewriting
status or republishing an inactive record. Legacy Inactive records remain hidden
from public discovery and retain their authoritative status in Admin joins.

## Review Submission Atomicity and Retry

Documented operations are POST /api/DetailedEvaluation followed by PUT
/api/ReviewRequest/{reviewRequestId}. These are separate requests. If evaluation
creation succeeds and assignment completion fails, the client cannot roll back
or safely create another review to recover.

Required: document atomic review submission or idempotent retry by exact
reviewRequestId; define draft/submitted status, finalDecision enum, and canonical
result containing reviewRequestId and detailedEvaluationId. Preserve entered
content on failure and keep the paper/assignment intact. No reviewer operation
may create, erase, replace, or publish the manuscript.

Reviewer identifiers are User.UserId per GET /api/Paper/by-reviewer/{reviewerId}.
Backend must enforce ownership on assignment detail, mutation, and evaluation
access. Frontend now verifies exact assignment ID and reviewer user ID and never
falls back to another reviewer's assignment.

## Metadata Contract

Confirmed persisted mappings:

| UI field | API key |
| --- | --- |
| Title | Paper.title |
| Abstract | Paper.abstract |
| Bibliographic authors | Paper.authors[].authorName |
| Author ORCID | Paper.authors[].orcidId |
| Author order (response) | Paper.authors[].authorOrder |
| Submitting account | Paper.authorId; never a bibliographic author fallback |
| Paper type | Paper.paperType: Journal or Conference |
| DOI | Paper.doi |
| OpenAlex work | Paper.openAlexWorkId |
| External publication date | Paper.publicationDate |
| Publication source | Paper.sourceName |
| ISSN | Paper.issnValue |
| Classification identifier | Paper.subFieldId |
| Manuscript URL | Paper.fileUrl |
| Assignment ID | ReviewRequest.reviewRequestId |
| Assigned paper | ReviewRequest.paperId |
| Reviewer account | ReviewRequest.reviewerId |
| Review deadline | ReviewRequest.deadline |
| Review type | ReviewRequest.type |
| Review link | DetailedEvaluation.reviewRequestId |
| Recommendation | DetailedEvaluation.finalDecision, only with an actual evaluation |

Still missing from the audited paper DTO: institution relationships, keywords,
topics, explicit ARS submittedAt/publishedAt, manuscript version/file size/name,
and a complete named taxonomy relationship. Specify create/update/response keys
before implementing persistence. The UI must not invent these values or recover
them from localStorage. In particular, Paper.updatedAt is not a publication date
and ReviewRequest.createdAt is not the original manuscript submission date.

## Transition Mapping

| Action | Role | Existing endpoint and identifiers | Confirmation / next action |
| --- | --- | --- | --- |
| Create manuscript | Researcher | POST /api/Paper; required title/abstract/paperType | GET created paper; preserve bibliographic authors |
| Save draft / submit | Researcher | PUT /api/Paper/{paperId} | GET verifies requested existing status string; backend lifecycle enum remains undocumented |
| Approve for review | Admin | No confirmed editorial operation | Blocked pending contract |
| Manual assignment | Admin | POST /api/Paper/{paperId}/assign-reviewers-manual, paperId/reviewerIds | Refetch paper and assignment records |
| Accept / decline | Assigned Reviewer | PUT /api/ReviewRequest/{reviewRequestId} | GET verifies response and ownership; existing In Progress/Declined strings require backend enum confirmation |
| Acknowledge responsibilities | Assigned Reviewer | No separate persistence endpoint | Local acknowledgement, separate from assignment acceptance |
| Submit review | Assigned Reviewer, in progress | POST /api/DetailedEvaluation; PUT /api/ReviewRequest/{reviewRequestId} | Confirm evaluation link and Completed assignment; Admin may inspect |
| Final publish | Admin | Existing PUT /api/Paper/{paperId} with Published | GET must confirm Published; never automatically invoked by reviewer |
| Reject manuscript | Admin | Existing PUT /api/Paper/{paperId} with Rejected | GET must confirm result; authorship state unchanged |
| Deactivate / reactivate | Admin | No independent activity contract | Blocked pending contract |

Status strings above describe existing client behavior, not Swagger enums.
Swagger exposes free strings and does not establish the full business lifecycle.
