# BE Ticket: Admin-Only ORCID Public Metadata Lookup Proxy

## ID

BE-ORCID-LOOKUP-02

## Priority

High

## Background

Administrators need an `AI ORCID Check` action for Reviewer role requests. The browser must not call ORCID or OpenAlex directly because provider credentials, rate limits, request auditing, and response normalization belong on the server. The endpoint is now present in live Swagger; the remaining integration gap is documented in `BE_ADMIN_ORCID_ROLE_REQUEST_ID_TICKET.md`.

## Goal

Provide an authenticated, auditable, admin-only endpoint that validates an ORCID iD and returns normalized public metadata from ORCID and optional OpenAlex enrichment.

## API Contract

`POST /api/Admin/orcid-lookup` is now shipped. Keep this ticket as the implementation and contract record.

### Authorization

- Require an authenticated user with the System Admin role.
- Return `401` for unauthenticated callers and `403` for authenticated non-admin callers.

### Request

```json
{
  "roleRequestId": 123
}
```

The server resolves and validates the ORCID attached to the role request. The
frontend must not substitute a user ID for `roleRequestId`.

### Success Response

```json
{
  "orcidId": "0000-0002-1825-0097",
  "lookupStatus": "Found",
  "sourceFetchedAt": "2026-08-22T15:00:00Z",
  "author": {
    "openAlexId": "https://openalex.org/A123",
    "orcid": "0000-0002-1825-0097",
    "displayName": "Public name when supplied",
    "fullName": "Optional"
  },
  "metrics": {
    "worksCount": 12,
    "citedByCount": 85,
    "hIndex": 5,
    "i10Index": 4
  },
  "affiliations": [
    {
      "institutionName": "Public institution",
      "countryCode": "VN",
      "years": [2020, 2021]
    }
  ],
  "works": [
    {
      "title": "Public work title",
      "publicationYear": 2024,
      "doi": "10.0000/example",
      "externalUrl": "https://doi.org/10.0000/example"
    }
  ],
  "missingSections": ["biography"],
  "providerWarnings": []
}
```

## Provider and Privacy Requirements

- Query only public data exposed by ORCID and OpenAlex. Do not scrape pages or process OAuth tokens for this workflow.
- Keep provider URLs, API keys, rate-limit settings, and timeouts in server configuration or secret storage. Never expose them to the frontend.
- Prefer an ORCID-to-OpenAlex association returned by a documented provider field; do not perform unreliable name-based identity matching.
- Treat lookup data as review aid only. The endpoint must not approve, reject, modify, or otherwise transition a role request.
- Return clear partial-data responses rather than failing the whole request when a public field is absent.
- Do not persist the full third-party response unless retention, audit, and privacy policies explicitly require it. If caching is approved, cache normalized public results with a TTL and source timestamp.

## Error Contract

Use stable `lookupStatus` values and an appropriate HTTP response:

- `InvalidOrcid` -> `400`
- `NotFound` -> `404`
- `RateLimited` -> `429`, include `retryAfterSeconds` when known
- `ProviderUnavailable` -> `503`
- `ProviderError` -> `502`

Example failure:

```json
{
  "orcidId": "0000-0002-1825-0097",
  "lookupStatus": "RateLimited",
  "message": "Public metadata lookup is temporarily rate limited.",
  "retryAfterSeconds": 60
}
```

## Audit Requirements

Record the requesting admin ID, target reviewer/user or role-request ID when supplied, normalized ORCID, timestamp, outcome, provider status, and correlation ID. Do not record provider secrets or unnecessary raw personal data.

## Acceptance Criteria

- Admin can request normalized metadata for a valid ORCID.
- Non-admin access is denied.
- Invalid checksum, malformed IDs, and ORCID URLs are handled server-side consistently.
- Public metadata includes person information, employment, works, and OpenAlex metrics only when providers supply them.
- Provider `404`, `429`, timeout, and malformed-response conditions map to documented responses without leaking provider internals.
- No role-request state changes occur from this endpoint.
- Swagger documents the endpoint, schemas, authorization, and error responses.
- Tests cover authorization, normalization, all status mappings, partial data, provider timeouts, and audit logging.
