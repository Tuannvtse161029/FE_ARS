# Backend Ticket: Production Publication Workflow API

## Priority

Blocker for replacing the frontend publication adapter with a complete production workflow.

## Scope

Provide an Admin-owned publication lifecycle. Researchers create and submit manuscripts; Admins screen, assign reviewers, request revisions, reject, approve, publish, and withdraw; reviewers accept or decline assignments and submit private evaluations.

## Required endpoints

- `GET /api/papers?visibility=PUBLIC&status=PUBLISHED&page=&pageSize=&query=&domain=&field=&subfield=&topic=&sort=`
- `POST /api/papers/drafts`
- `PUT /api/papers/{id}/draft`
- `POST /api/papers/{id}/submit`
- `POST /api/papers/{id}/resubmit`
- `GET /api/researcher/submissions`
- `GET /api/researcher/submissions/{id}`
- `GET /api/reviewer/assignments`
- `GET /api/reviewer/assignments/{id}`
- `POST /api/reviewer/assignments/{id}/accept`
- `POST /api/reviewer/assignments/{id}/decline`
- `POST /api/reviewer/assignments/{id}/review`
- `GET /api/admin/paper-submissions`
- `GET /api/admin/paper-submissions/{id}`
- `POST /api/admin/paper-submissions/{id}/assign-reviewer`
- `POST /api/admin/paper-submissions/{id}/request-revision`
- `POST /api/admin/paper-submissions/{id}/reject`
- `POST /api/admin/paper-submissions/{id}/approve`
- `POST /api/admin/paper-submissions/{id}/publish`
- `POST /api/admin/paper-submissions/{id}/withdraw`

## Required behavior

- Enforce roles and ownership server-side. A researcher must never submit a reviewer ID or read another researcher's manuscript.
- Enforce the lifecycle: `DRAFT`, `SUBMITTED`, `ADMIN_SCREENING`, `READY_FOR_REVIEWER`, `REVIEWER_ASSIGNED`, `UNDER_REVIEW`, `REVISION_REQUIRED`, `RESUBMITTED`, `REVIEWER_RECOMMENDED_ACCEPT`, `REVIEWER_RECOMMENDED_REJECT`, `ADMIN_APPROVED`, `PUBLISHED`, `ADMIN_REJECTED`, `WITHDRAWN`.
- Reviewer recommendations never publish a paper. Publication must require an Admin decision and a separate `PUBLISHED` transition.
- Public catalog responses must include only `status=PUBLISHED` and `visibility=PUBLIC`; never return private scores, comments, Admin notes, proof files, or audit details.
- Return ordered authors, institutions, DOI, OpenAlex ID, external identifier, publication date, paper type, taxonomy, topics, keywords, version, visibility, reviewer policy/name, and researcher-safe feedback.
- Make assignment acceptance/decline, review submission, Admin transitions, and publication notification creation atomic and idempotent.
- Validate file ownership/type/virus status, identifier uniqueness, author order, version supersession, deadlines, conflicts of interest, and eligible reviewer workload.
- Record actor, previous status, next status, version, reason, and timestamp for every editorial transition.

## Acceptance tests

- Researcher draft/submit/resubmit is requester-scoped and idempotent.
- Admin can screen, assign, request revision, reject, approve, publish, and withdraw with invalid transitions rejected.
- Reviewer can act only on owned assignments and cannot see another reviewer's private content.
- Public catalog excludes every non-published or private paper regardless of query parameters.
- Publication produces exactly one researcher notification and one audit event.
- Swagger documents all request/response/error schemas and `401`, `403`, `404`, `409`, and validation responses.
