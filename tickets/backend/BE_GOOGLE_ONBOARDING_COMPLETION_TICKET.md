# BE Ticket: First-Time Google Account Onboarding Completion

## ID

BE-GOOGLE-ONBOARDING-03

## Priority

High

## Background

`POST /api/Auth/google-login` can create or identify a Google-authenticated account, but the current API has no documented contract to collect a first-time user's role, optional phone number, verification proof, Reviewer ORCID iD, and versioned consent receipt. Reusing `/api/Auth/register` is unsafe because the Google identity has already created or linked the account.

## Goal

Create an authenticated onboarding-completion endpoint that enriches the already-authenticated Google account and submits it for role verification.

## API Contract

Add `POST /api/Auth/complete-google-onboarding`.

### Authorization

Require the authenticated Google account's JWT. The endpoint operates only on the token subject; do not accept a user ID that can target another user.

### Request

```json
{
  "phoneNumber": "+84 901234567",
  "role": "Reviewer",
  "pdfUrl": "https://storage.example/proof.pdf",
  "orcidId": "0000-0002-1825-0097",
  "consents": [
    {
      "documentType": "PrivacyPolicy",
      "version": "2026-08-22"
    },
    {
      "documentType": "TermsOfService",
      "version": "2026-08-22"
    }
  ]
}
```

### Success Response

Return the complete BE-derived account state and a replacement JWT if role/effective-role claims change.

```json
{
  "token": "replacement-jwt-when-required",
  "userId": 123,
  "email": "google-user@example.edu",
  "fullName": "Google User",
  "role": "Reviewer",
  "roleId": 3,
  "effectiveRole": "Guest",
  "isActive": false,
  "verificationStatus": "Pending",
  "onboardingStatus": "Completed"
}
```

## Rules

- Only allow completion for an authenticated account that is eligible for first-time Google onboarding.
- Make completion idempotent. A retry after a network failure must return the persisted onboarding state rather than create duplicate role requests or consent receipts.
- Enforce allowed self-service roles. Never allow Admin self-registration/onboarding.
- Require a verification document URL and legal consent receipts.
- Apply the same ORCID normalization, checksum validation, role applicability, and duplicate policy as standard registration.
- Verify that the proof URL is an allowed storage location and conforms to the PDF/document policy. Do not fetch arbitrary private URLs blindly.
- Set and persist `verificationStatus: Pending` and `isActive: false` server-side until the relevant admin workflow completes.
- Create or update the role-verification request transactionally with profile fields and consent records.
- Return `409` for an account that has already completed onboarding if the requested change is not idempotent; do not silently overwrite an approved role/profile.
- Do not expose Google identity-provider tokens in requests or responses.

## Acceptance Criteria

- A first-time Google account can complete onboarding exactly once or retry idempotently.
- The endpoint persists requested role, phone value, proof reference, Reviewer ORCID when applicable, consent receipts, and pending verification state atomically.
- Existing registered or already-approved users cannot misuse the endpoint to replace their role.
- Invalid role, invalid proof URL, missing consent, and invalid or duplicate ORCID fail without partial persistence.
- Response contains BE-authoritative user/role/account state and a valid JWT when claims changed.
- Swagger includes success, validation, `401`, `403`, `409`, and failure schemas.
- Tests cover first completion, idempotent retry, duplicate completion, non-Reviewer ORCID, invalid checksum, and authorization subject isolation.
