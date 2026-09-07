# Publication Incident Handoff to Test Triage / Agent 17

The independent QA retry limit was reached for the researcher form suite.
Latest observed result: 10 passed, 1 failed. The failed assertion received a
literal {id} from the translation mock; QA corrected interpolation in
tests/unit/publication/researcher/ResearcherSubmissionForm.test.tsx but did not
perform a fourth run. This correction remains unverified and must not be counted
as a passing test. See PUBLICATION_INCIDENT_QA.md for commands and other results.

The final synchronous form submission guard compiled but needs a dedicated
double-click runtime check. Full lifecycle verification remains blocked on the
backend contract in PUBLICATION_INCIDENT_BACKEND_REQUEST.md. The old publication
Playwright test must not be used unchanged because it substitutes a reviewer ID
and logs protected data. No production records were changed for this incident.

## Incident-Owned Production Files

- src/services/paper.service.ts
- src/services/reviewRequest.service.ts
- src/services/detailedEvaluation.service.ts
- src/features/publication/api/publication.adapter.ts
- src/features/publication/types/publication.ts
- src/utils/reviewRequestPolicy.ts
- src/components/PdfViewer/PdfViewer.tsx
- src/features/publication/researcher/ResearcherSubmissionForm.tsx
- src/features/publication/researcher/ResearcherSubmissionDetail.tsx
- src/features/publication/admin/AdminPaperSubmissions.tsx
- src/features/publication/admin/AdminPaperSubmissionDetail.tsx
- src/features/publication/admin/AdminPublicationLists.tsx
- src/features/publication/admin/AdminPaperPreviewModal.tsx
- src/features/publication/admin/PublicationConfirmation.tsx
- src/features/publication/admin/RejectPaperModal.tsx
- src/features/publication/admin/RejectPaperModal.module.css
- src/features/publication/reviewer/ReviewerAssignments.tsx
- src/features/publication/reviewer/ReviewerAssignmentDetail.tsx
- src/features/publication/reviewer/reviewer.module.css
- src/components/reviewer/ReviewerPolicyModal.tsx
- src/components/Button/Button.module.css
- src/styles/ars-tokens.css
- src/i18n/dictionaries/en.ts
- src/i18n/dictionaries/vi.ts

Several files already contained user edits at incident start. Preserve those
edits; this list describes incident ownership, not whole-file authorship.
