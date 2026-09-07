# Live Submission Retest

Date: 2026-09-08. Frontend: localhost:3000, phuongpdse140481_FE working tree.
Swagger UI: https://arsplatform.onrender.com/swagger/index.html
Definition: https://arsplatform.onrender.com/swagger/v1/swagger.json
API base: https://arsplatform.onrender.com

## Confirmed Contract

PaperCreateRequest.paperType is required and matches ^(Journal|Conference)$.
Research article, Methodology article and Review article describe article
categories and are not accepted values for that field. An independent category
field requires a backend contract; do not map it silently to Journal.

## Controlled Live Results

- Researcher, Admin and Reviewer authentication returned HTTP 200. Credentials
  and access tokens are intentionally omitted.
- Existing test fixture research-paper-with-figures.pdf uploaded successfully.
- Local selected-file preview rendered five pages with navigation controls.
- First browser submission created paper 48 (Submitted, Journal), then failed
  because the frontend unnecessarily attempted PUT status Draft. Author metadata
  was present in authoritative GET detail even though list data had empty authors.
- Fixed direct submission to accept the authoritative Submitted create result
  and skip the subsequent Draft and Waiting for Review writes.
- Browser retest created paper 49, navigated to its detail successfully and
  rendered the persisted five-page PDF.
- A separate Admin API session retrieved paper 49 as Submitted / Journal with
  bibliographic author Workflow Test Author and the persisted manuscript URL.
- No assignment, review, publication, deletion or visibility change was made.

## Remaining Backend Work

The create endpoint immediately submits. Save Draft is not established by this
contract and the observed Draft PUT did not persist. Specify a supported draft
creation operation before offering a trustworthy server draft flow.

Admin approval-for-review and independent deactivate/reactivate remain blocked
as described in PUBLICATION_INCIDENT_BACKEND_REQUEST.md. Full lifecycle is not
verified. Papers 48 and 49 are intentionally labeled controlled test records and
left intact for backend inspection. Do not treat them as actual research.
