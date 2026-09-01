# ORCID and OpenAlex Swagger Contract

## Source and Scope

This document records the checked-in `swagger.json` contract inspected on 2026-08-30. It is the API source used for this refresh. The document contains no global OpenAPI security scheme and none of the operations below declares operation-level security; endpoint summaries nevertheless state JWT-derived identity or Admin-only intent where noted.

## ORCID OAuth

`POST /api/Auth/orcid/registration/start` starts ORCID linking during local registration. It has no request body and declares only `200 OK` with no response schema. The summary states that the server creates an OAuth session with `Context = REGISTRATION` and no user ID.

`POST /api/Auth/orcid/account/start` starts linking for an authenticated ARS account. It has no request body and declares only `200 OK` with no response schema. The summary states that the server derives the user ID from the JWT and must not accept a frontend user ID.

`GET /api/Auth/orcid/status` returns `OrcidStatusResponse` on `200 OK`:

- `userId: int32`
- `isConnected: boolean`
- `isVerified: boolean`
- `orcidId: string | null`
- `verifiedAt: date-time | null`
- `canConnect: boolean`

`GET /api/Auth/orcid/callback` is the provider callback. Its optional query parameters are `code: string`, `state: string`, and `error: string`; it declares only `200 OK` with no response schema.

No `unlink`, disconnect, revoke, token-refresh, or provider-token endpoint is present in this Swagger document. The start operations also declare no URL or redirect response payload. An Axios call can initiate the endpoint but cannot follow a browser navigation unless the server returns a redirect response that the contract currently does not describe.

## Admin ORCID and OpenAlex Lookup

`POST /api/Admin/orcid-lookup` is the only documented OpenAlex-backed endpoint. Its summary says it retrieves OpenAlex academic data using a verified ORCID for the user associated with a role request. The request body is `OrcidLookupRequest` with only `roleRequestId: int32`, minimum `1`; the schema forbids extra properties.

It returns `OrcidLookupResponse` for `200`, `400`, `404`, `409`, `429`, `502`, and `503`. The shape is:

- `orcidId: string | null`
- `lookupStatus: string | null`
- `sourceFetchedAt: date-time`
- `author: OpenAlexAuthorResponse`
- `metrics: OpenAlexMetricsResponse`
- `affiliations: OpenAlexAffiliationResponse[] | null`
- `lastKnownInstitutions: OpenAlexInstitutionResponse[] | null`
- `topics: OpenAlexTopicResponse[] | null`
- `countsByYear: OpenAlexYearCountResponse[] | null`
- `works: OpenAlexWorkResponse[] | null`
- `missingSections: string[] | null`
- `providerWarnings: string[] | null`
- `message: string | null`
- `retryAfterSeconds: int32 | null`

`OpenAlexAuthorResponse` fields: `openAlexId`, `orcid`, `displayName`, `fullName`, `alternativeNames`, `rawAuthorNames`, and `externalUrl`. All are nullable; the two array fields are nullable arrays of strings.

`OpenAlexMetricsResponse` fields: `worksCount: int32`, `citedByCount: int32`, `hIndex: int32 | null`, `i10Index: int32 | null`, and `twoYearMeanCitedness: double | null`.

`OpenAlexWorkResponse` fields: `openAlexId`, `title`, `doi`, `publicationYear`, `publicationDate`, `type`, `citedByCount`, `sourceName`, `isOpenAccess`, `openAccessStatus`, `isRetracted`, and `externalUrl`. `citedByCount` and `isRetracted` are non-null; all remaining fields are nullable.

`OpenAlexAffiliationResponse` contains nullable `institutionOpenAlexId`, `institutionName`, `ror`, `countryCode`, `type`, and `years: int32[]`. `OpenAlexInstitutionResponse` contains nullable `openAlexId`, `displayName`, `ror`, `countryCode`, and `type`. `OpenAlexTopicResponse` contains nullable IDs/names for topic, subfield, field, and domain plus non-null `count: int32`. `OpenAlexYearCountResponse` has non-null `year`, `worksCount`, `oaWorksCount`, and `citedByCount` int32 values.

There is no standalone OpenAlex work lookup, paper-metadata import, DOI lookup, OpenAlex ID lookup, confirmation/import persistence operation, or AI endpoint in the documented contract. The frontend must not call OpenAlex or ORCID provider APIs directly as a substitute.

## Authentication and Registration

`POST /api/Auth/register` accepts `RegisterRequest`. Required fields are `email` (email), `password` (minimum 6), `fullName`, `phoneNumber` (pattern `^[+\\d\\s\\-()]{8,20}$`), `role`, and `pdfUrl` (URI). Optional `orcidTicket` is nullable and has maximum length 200. It declares `200 OK` with no response schema.

`POST /api/Auth/login` accepts `LoginRequest`: required `email` and `password`, with optional nullable `role`. It declares `200 OK` with no response schema.

`POST /api/Auth/google-login` accepts `GoogleLoginRequest` with required non-empty `credential`. It declares `200 OK` with no response schema.

`POST /api/Auth/complete-google-registration` accepts `CompleteGoogleRegistrationRequest`; required non-empty fields are `credential`, `phoneNumber` using the same phone pattern, `role`, and URI `pdfUrl`. It declares `200 OK` with no response schema. It has no `orcidTicket`, consent, or profile field.

`POST /api/Auth/select-role` exists with `SelectRoleRequest`, but this refresh did not change its existing service mapping.

Because Swagger declares no response DTO for register, login, Google login, or complete Google registration, fields such as token, role state, onboarding flags, and verification state are not contract-confirmed by this source.

## Current User and Profile Data

`GET /api/User` returns `UserResponsePagedResult`; `GET /api/User/{id}` returns `UserResponse`. `UserResponse` fields are `id`, `email`, `fullName`, `googleId`, `avatarUrl`, `isEmailVerified`, `isActive`, `accountTier` as nullable int32, `verificationStatus`, `proofDocumentUrl`, `orcidId`, non-null `isOrcidVerified`, `orcidVerifiedAt`, `createdAt`, `updatedAt`, and `roleName`. All except `id` and `isOrcidVerified` are nullable. It does not include `username`, `roleId`, `roles`, `effectiveRole`, `suspendedUntil`, `isNewUser`, or `requiresOnboarding`.

`GET /api/Profile` returns an array of `ProfileResponse`, not a current-user singleton. `GET /api/Profile/{id}` returns one `ProfileResponse`. `PUT` and `PATCH /api/Profile/{id}` accept `ProfileUpdateRequest` and return `ProfileResponse`. `ProfileResponse` includes `userId`, `fullName`, `academicTitle`, `email`, `phoneNumber`, `institution`, `bio`, `keywords`, `avatarInitials`, `orcidId`, `isOrcidVerified`, and `orcidVerifiedAt`. The `ProfileUpdateRequest` accepts `userId`, `fullName`, `academicTitle`, `phoneNumber`, `institution`, `bio`, `keywords`, `avatarInitials`, `dateOfBirth`, `gender`, and `address`; all are optional in the schema.

`GET /api/ProfessionalProfile/{id}` returns `ProfessionalProfileResponse`, including ORCID verification data and OpenAlex-style metrics: `hindex`, `totalCitations`, `publicationCount`, `syncStatus`, academic field IDs/names, `reviewFee`, and `isAvailable`. No endpoint explicitly syncs those metrics.

## Role Requests and Errors

`GET /api/RoleRequest` returns `RoleRequestResponse[]`. `GET /api/RoleRequest/{id}` returns `RoleRequestResponse` or `404 ProblemDetails`. `POST /api/RoleRequest/{id}/approve` and `POST /api/RoleRequest/{id}/deny` each accept `RoleRequestDecisionRequest`, which only permits nullable `notes`, and return `RoleRequestResponse` on `200`.

The approval and denial endpoints also document `400`, `404`, and `409` as `ProblemDetails`. `ProblemDetails` contains nullable `type`, `title`, `status` (int32), `detail`, and `instance`; extra properties are permitted. The OpenAPI document provides no enum for role-request `status` or `requestType`.

## Papers

`GET /api/Paper` returns `PaperResponsePagedResult`; `POST /api/Paper` accepts `PaperCreateRequest` and returns `PaperResponse`. `GET`, `PUT`, and `DELETE /api/Paper/{id}` use an int32 path parameter. The update endpoint accepts `PaperUpdateRequest` and returns `PaperResponse`; delete declares `200 OK` without a body schema.

Both create and update require `title` (1-250 characters) and `abstract` (1-2000 characters). Optional nullable fields are `fileUrl` (maximum 500), `issn`, `isOpenAccess`, `quartile` (maximum 50), and `subFieldId`. Update additionally permits nullable `status` (maximum 30). The schemas forbid extra fields.

`PaperResponse` has `id`, nullable `title`, `abstract`, `fileUrl`, `issn`, `isOpenAccess`, `quartile`, `status`, `createdAt`, `updatedAt`, `subFieldId`, `authorId`, and `authorName`. There are no DOI, OpenAlex ID, AI result, authors list, institutions, keywords, topic, publication date, or visibility fields in this DTO.

## Contract Blockers

- The Swagger document has no documented ORCID unlink/disconnect flow.
- OAuth start operations lack a documented redirect URL or response body; integration cannot reliably choose Axios versus browser navigation from the contract.
- Login and registration success bodies are unspecified, so existing frontend auth response fields are not supported by this source.
- Standalone OpenAlex lookup/import, imported-metadata confirmation, and AI operations are absent.
- Paper DTOs do not support the richer publication metadata currently represented in publication UI types.
- No global or operation-level OpenAPI security declaration exists, despite summaries that refer to JWT-derived identity and Admin-only behavior.
