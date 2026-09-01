# Backend Ticket: ORCID OAuth and OpenAlex Integration Contract

## Summary

Complete and document the ORCID OAuth and OpenAlex integration contracts needed by the Academic Research Sharing (ARS) frontend.

Only the Reviewer role must complete a verified ORCID link before registration or Reviewer role activation can continue. ORCID remains optional for Graduate Student, Researcher, Lecturer, and System Admin roles.

The frontend must consume only ARS backend APIs. It must never call ORCID or OpenAlex directly and must never receive or persist ORCID authorization codes, access tokens, refresh tokens, or client credentials.

## Current Live Swagger Coverage

The live Swagger document currently exposes these ORCID operations:

- `POST /api/Auth/orcid/registration/start`
- `POST /api/Auth/orcid/account/start`
- `GET /api/Auth/orcid/status`
- `GET /api/Auth/orcid/callback`

It also exposes one OpenAlex-backed operation:

- `POST /api/Admin/orcid-lookup`

`POST /api/Admin/orcid-lookup` accepts an `OrcidLookupRequest` containing `roleRequestId` and returns an `OrcidLookupResponse` with author data, bibliometric metrics, affiliations, institutions, topics, yearly counts, works, provider warnings, and retry information.

## Problem Statement

The existing Swagger paths establish the intended backend ownership, but important browser-flow and business-rule details are undocumented or unavailable to the frontend:

- ORCID start endpoints declare `200 OK` but no response body, redirect behavior, or `Location` header contract.
- The OAuth callback does not declare its browser redirect destination, success result, cancellation result, or expired-state behavior.
- `GET /api/Auth/orcid/status` requires an authenticated user, but a person registering as a Reviewer does not yet have a JWT.
- `POST /api/Auth/register` contains an optional `orcidTicket` field, but Swagger does not define how the ticket is created, validated, expired, or associated with a completed ORCID OAuth session.
- The current Google onboarding request does not include an ORCID verification artifact.
- The Admin lookup requires `roleRequestId`, but the Admin verification screen may only have a user ID unless the backend supplies the associated role request.
- `lookupStatus` and `syncStatus` are unconstrained strings, and error responses are not sufficiently specified for deterministic frontend behavior.

## Scope

### Included

- Backend-owned ORCID OAuth authorization, callback, state validation, token exchange, and identity verification.
- A frontend-safe way to start OAuth and resume the browser after callback completion.
- A short-lived, single-use proof that permits a verified ORCID link to be attached during Reviewer registration before a JWT exists.
- Enforcement that only Reviewer registration and Reviewer role requests require verified ORCID.
- Authenticated current-account ORCID link-status retrieval.
- Admin access to verified ORCID and OpenAlex evidence for an actual role request.
- OpenAlex response normalization, status semantics, error handling, cache/rate-limit behavior, and authorization documentation.

### Excluded

- Direct frontend calls to `orcid.org` or `api.openalex.org`.
- Sending ORCID client credentials, provider tokens, authorization codes, or OAuth state values to React.
- A frontend-created ORCID verification result.
- Requiring ORCID for non-Reviewer roles.

## Required Business Rules

1. A Reviewer must have `isOrcidVerified = true` before the backend accepts Reviewer registration or approves/activates a Reviewer role request.
2. Graduate Student, Researcher, Lecturer, and System Admin must be able to register and continue without ORCID verification.
3. An existing authenticated user may optionally connect ORCID from their account profile, regardless of role.
4. The backend must derive the authenticated user ID from the bearer token. Frontend request bodies must not include a user ID for account linking, status lookup, unlinking, or role enforcement.
5. ORCID verification must mean the backend has successfully completed the OAuth callback and associated the verified ORCID iD with the intended ARS account or pending registration. A manually typed ORCID iD is not verification.
6. A verified ORCID iD may be linked to only one ARS account unless the backend explicitly supports a documented transfer process.
7. OpenAlex lookup must use the backend-verified ORCID iD only. It must not accept a raw ORCID iD supplied by the frontend.

## API Contract Requirements

### 1. Start Registration ORCID OAuth

Keep or revise `POST /api/Auth/orcid/registration/start` and publish its exact behavior.

The endpoint must be callable without a JWT and must return one of the following explicitly documented contracts:

- Recommended: `200 OK` with `{ "authorizationUrl": "https://..." }`. The frontend navigates the top-level browser with `window.location.assign(authorizationUrl)`.
- Alternative: a browser-navigable endpoint returning `302 Found` with a `Location` header pointing to ORCID. If this option is chosen, document the method and frontend navigation method.

The response must not include OAuth client secrets, provider access tokens, refresh tokens, authorization codes, or internal user identifiers.

Document `400`, `409`, `429`, `502`, and `503` responses where applicable, using a consistent error body.

### 2. ORCID Callback

Keep `GET /api/Auth/orcid/callback` as a backend-owned endpoint. The callback receives provider query parameters and must validate OAuth state, exchange the authorization code server-side, validate the identity, and persist the pending or authenticated account association.

The frontend must not parse, forward, or store the callback `code` or `state`.

After completion, the backend must redirect the top-level browser to a documented frontend route, for example:

- registration completion: `/register?orcid=verified`
- account completion: `/profile?orcid=verified`
- cancellation/failure: the originating route with a non-sensitive result code

The redirect must not expose authorization codes, access tokens, refresh tokens, or raw internal state values. Document success, user cancellation, provider denial, invalid state, expired state, duplicate ORCID, and provider outage outcomes.

### 3. Reviewer Registration Verification Ticket

The backend must define the existing optional `RegisterRequest.orcidTicket` field as a short-lived, opaque, single-use verification ticket, or replace it with an equivalent documented field.

Minimum rules:

- The ticket is issued only after the registration OAuth callback succeeds.
- The ticket is bound to the pending registration browser/session and verified ORCID identity.
- It has an explicit expiry time and can only be consumed once.
- It cannot be forged from an ORCID iD typed in the browser.
- When `role = "Reviewer"`, `POST /api/Auth/register` must reject an absent, invalid, expired, reused, mismatched, or unverified ticket with a stable `400` or `409` error code.
- When role is not Reviewer, the registration request must succeed without a ticket.
- On successful Reviewer registration, the backend persists the normalized ORCID iD, `isOrcidVerified = true`, and `orcidVerifiedAt`.
- The registration success response must document whether the account requires email verification, administrative approval, or another next step.

Publish the ticket field type, maximum length, lifecycle, error values, and post-registration response DTO in Swagger.

### 4. Google Registration Alignment

Define how Reviewer-only ORCID enforcement works for `POST /api/Auth/complete-google-registration`.

Choose and document one consistent approach:

- Add the same `orcidTicket` field and apply the same Reviewer-only validation; or
- Require authenticated account linking after Google identity is established, then reject Reviewer onboarding until `GET /api/Auth/orcid/status` reports verified.

The rule must be identical in outcome for password registration and Google onboarding: Reviewer requires backend-verified ORCID; every other role does not.

### 5. Account Linking and Status

`POST /api/Auth/orcid/account/start` must require bearer authentication and derive the current user from the JWT.

`GET /api/Auth/orcid/status` must require bearer authentication and return this stable response shape:

```json
{
  "userId": 123,
  "isConnected": true,
  "isVerified": true,
  "orcidId": "0000-0002-1825-0097",
  "verifiedAt": "2026-08-30T00:00:00Z",
  "canConnect": false
}
```

Document the meaning of each boolean, especially the difference between `isConnected`, `isVerified`, and `canConnect`. Document `401`, `403`, and any duplicate-link conflict response.

Add an authenticated unlink operation only if product policy permits it, for example `DELETE /api/Auth/orcid/account`. It must document whether unlinking is forbidden for an active Reviewer role, removes only provider tokens, preserves audit history, and handles already-unlinked accounts.

### 6. Role Request Enforcement

When a user requests, activates, or switches to Reviewer, the backend must enforce verified ORCID using server-side account data.

Document the exact endpoint where the rule is enforced and the error response returned when ORCID is missing. The frontend can use `GET /api/Auth/orcid/status` for guidance, but it must not be the authority that grants Reviewer access.

A user already assigned the Reviewer role but without verified ORCID needs an explicitly documented migration policy. Options include temporary grandfathering, a deadline-based block, or immediate role restriction. The backend/product owners must choose one.

## OpenAlex Contract Requirements

### 1. Admin Role-Request Lookup

Keep `POST /api/Admin/orcid-lookup` as an Admin-authorized backend proxy to OpenAlex.

The request must accept a real role-request identifier:

```json
{
  "roleRequestId": 456
}
```

The Admin data source must provide the associated `roleRequestId` to the verification screen. If that is not possible, publish a separate documented backend endpoint that accepts a user ID and resolves the applicable role request server-side. The frontend must never place `userId` into `roleRequestId`.

The backend must obtain the ORCID iD from its verified account data and reject lookup when ORCID is missing or not verified.

### 2. Response Semantics

Keep the existing `OrcidLookupResponse` fields and publish an enum for `lookupStatus`. Recommended stable values:

- `SUCCESS`
- `ORCID_NOT_VERIFIED`
- `PROFILE_NOT_FOUND`
- `DUPLICATE_ORCID`
- `RATE_LIMITED`
- `PROVIDER_UNAVAILABLE`
- `PROVIDER_ERROR`

Document which fields are guaranteed for each status. Provider sections such as author, metrics, affiliations, topics, and works must remain nullable or be accompanied by `missingSections` and `providerWarnings` when partial data is returned.

Document the meaning and authority of:

- `sourceFetchedAt`
- `retryAfterSeconds`
- `missingSections`
- `providerWarnings`
- `externalUrl`

`externalUrl` must identify its source and allowed host. The frontend will render it as an external link only after the contract specifies this.

### 3. Errors, Caching, and Rate Limits

Document consistent response bodies and semantics for these cases:

- `400`: malformed or ineligible request
- `401`: missing or invalid JWT
- `403`: caller is not an Admin
- `404`: role request or verified profile not found
- `409`: duplicate/conflicting verified ORCID association
- `429`: rate limited, with `retryAfterSeconds`
- `502`: invalid provider response or upstream gateway failure
- `503`: OpenAlex temporarily unavailable

The backend should cache OpenAlex data by normalized ORCID with a documented time-to-live and return `sourceFetchedAt` so the frontend can show when the evidence was fetched. The backend owns provider rate-limit handling and retries.

### 4. Optional Researcher Work Lookup

Swagger currently does not publish a standalone OpenAlex work lookup or import endpoint. If the product requires researchers to import publication metadata from an OpenAlex work ID, publish a separate contract before frontend work begins.

The contract must define:

- the final endpoint and HTTP method
- accepted work identifier formats
- authorization rules
- normalized metadata response
- whether user confirmation is required before persistence
- duplicate-paper behavior
- cache and rate-limit behavior
- all error responses

## Security and Privacy Requirements

- Store ORCID client credentials only in backend secret storage; never return them to the frontend.
- Store provider access and refresh tokens only server-side and encrypt them at rest if retained.
- Validate OAuth state server-side and bind it to the intended registration or authenticated-account context.
- Use an allowlist for backend callback redirect destinations to prevent open redirects.
- Normalize ORCID iDs before uniqueness checks and persistence.
- Log audit events for link, verified callback, duplicate-link rejection, unlink, and Admin OpenAlex lookup. Do not log OAuth authorization codes or provider tokens.
- Return only the minimum ORCID and OpenAlex data needed by each caller.

## Swagger Documentation Requirements

Update the live OpenAPI document to include:

- response schemas for both ORCID start endpoints, the callback outcome, register, login, and Google onboarding success/failure results
- `401` and `403` responses and bearer-security requirements for all authenticated ORCID and Admin lookup operations
- the registration ticket contract and Reviewer-only validation errors
- a `lookupStatus` enum and error-body schemas for the OpenAlex lookup
- field requiredness and nullability that match actual runtime behavior
- documented callback redirect destinations and browser-safe completion parameters

## Acceptance Criteria

1. A non-Reviewer can complete password registration without initiating ORCID OAuth.
2. A Reviewer cannot complete password registration without a valid backend-issued ORCID verification ticket.
3. A Reviewer with a valid ticket completes registration and later receives `isConnected = true`, `isVerified = true`, normalized `orcidId`, and a non-null `verifiedAt` from the authenticated status endpoint.
4. An expired, reused, invalid, mismatched, or unverified ticket is rejected with a documented API response.
5. Google onboarding enforces the same Reviewer-only ORCID rule.
6. The frontend can initiate ORCID OAuth through a documented browser navigation mechanism without directly contacting ORCID.
7. The callback is fully backend-owned and redirects users back to a documented frontend page without exposing provider credentials, authorization codes, or raw OAuth state.
8. Account linking uses the JWT-derived user identity only; no frontend user ID is accepted.
9. `GET /api/Auth/orcid/status` is authenticated and returns stable, documented status fields.
10. The backend rejects Reviewer role activation or approval when the account lacks verified ORCID, even if the frontend was bypassed.
11. An Admin can request OpenAlex evidence using a valid `roleRequestId`; the backend uses only the associated verified ORCID iD.
12. The Admin lookup documents all status values, partial-data handling, authorization, rate limiting, cache timestamp, and provider error behavior.
13. Swagger reflects the deployed behavior and includes the response DTOs and security requirements above.

## Frontend Dependency

Frontend implementation can enable the complete Reviewer ORCID journey only after the backend publishes and deploys the OAuth start result, callback return behavior, and registration/Google onboarding verification handoff.

Until then, the frontend can display ORCID status for authenticated users and render the optional account-link action, but it cannot safely treat an Axios `POST` to a start endpoint as a complete browser OAuth flow or prove pre-registration Reviewer verification.
