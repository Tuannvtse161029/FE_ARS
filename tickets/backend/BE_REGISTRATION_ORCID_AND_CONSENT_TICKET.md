# BE Ticket: Atomic Reviewer Registration With ORCID and Consent Receipt

## ID

BE-REG-ORCID-CONSENT-01

## Priority

High

## Background

The frontend currently consumes `POST /api/Auth/register`, whose documented `RegisterRequest` rejects additional properties. Reviewer onboarding now captures a locally validated ORCID iD and requires explicit acceptance of Privacy Policy and Terms, but neither value can be persisted through the current API.

## Goal

Allow an account registration to atomically persist the requested role, Reviewer ORCID iD when applicable, verification proof URL, and versioned legal-consent receipt.

## API Contract

Extend `POST /api/Auth/register` or introduce a versioned replacement such as `POST /api/Auth/register/v2`. Publish the final choice in Swagger.

### Request

```json
{
  "username": "reviewer@example.edu",
  "email": "reviewer@example.edu",
  "password": "example",
  "fullName": "Example Reviewer",
  "phoneNumber": "+84 901234567",
  "role": "Reviewer",
  "pdfUrl": "https://storage.example/proof.pdf",
  "orcidId": "0000-0002-1825-0097",
  "consents": [
    {
      "documentType": "PrivacyPolicy",
      "version": "2026-08-22",
      "acceptedAt": "2026-08-22T15:00:00Z"
    },
    {
      "documentType": "TermsOfService",
      "version": "2026-08-22",
      "acceptedAt": "2026-08-22T15:00:00Z"
    }
  ]
}
```

### Success Response

Return the created user identity and authoritative account state. Do not fabricate or infer a role on the frontend.

```json
{
  "token": "jwt",
  "userId": 123,
  "username": "Example Reviewer",
  "email": "reviewer@example.edu",
  "role": "Reviewer",
  "roleId": 3,
  "effectiveRole": "Guest",
  "isActive": false,
  "verificationStatus": "Pending",
  "orcidId": "0000-0002-1825-0097"
}
```

## Validation and Security Requirements

- Require email, password, full name, requested role, proof URL, and both current legal-consent documents.
- Allow `orcidId` only for `Reviewer`; reject it for other roles rather than silently storing it.
- Normalize accepted ORCID values to `NNNN-NNNN-NNNN-NNNC`, accepting the canonical ID or a full `https://orcid.org/...` URL.
- Validate the ORCID ISO 7064 MOD 11-2 checksum server-side. Frontend validation is advisory only.
- Enforce uniqueness for a normalized ORCID among active/non-deleted reviewer profiles according to product policy. Return `409 Conflict` with a stable machine-readable error code on duplicates.
- Persist consent server-side with immutable document type, version, accepted timestamp, user ID, registration source, and request/audit metadata permitted by privacy policy.
- Persist all registration data and consent receipts transactionally. If any validation or persistence step fails, do not create a partial account.
- Do not trust client-supplied `isActive`, `verificationStatus`, role IDs, or consent timestamps as authoritative values. Set pending state on the server.
- Avoid logging passwords, tokens, or proof document URLs at info level.

## Data Requirements

- Add nullable `OrcidId` or equivalent normalized ORCID field in the user/profile domain, with an appropriate unique index if duplicate ownership is prohibited.
- Add a consent-receipt entity/table with a uniqueness constraint appropriate to the legal model, at minimum `(UserId, DocumentType, Version)`.
- Store the verification document reference under the existing user/verification domain; authorize its retrieval separately.

## Acceptance Criteria

- A valid Reviewer registration persists the normalized ORCID, requested role, proof reference, and both consent receipts in one transaction.
- A non-Reviewer request with `orcidId` is rejected with a documented validation error.
- Invalid ORCID format, invalid checksum, or duplicate ORCID produces a documented `400` or `409` response without creating an account.
- Missing, stale, or incomplete consent receipts prevent registration.
- A successful new account returns `isActive: false`, `verificationStatus: "Pending"`, and the BE-authoritative `effectiveRole`.
- Swagger documents request and response schemas, validation errors, and authentication behavior.
- Automated tests cover success, checksum failure, URL normalization, duplicate ORCID, role mismatch, missing consent, and transaction rollback.
