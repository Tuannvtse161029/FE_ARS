# BE Ticket: Expose the ORCID Lookup Correlation ID

## Problem

The live `POST /api/Admin/orcid-lookup` endpoint requires `{ roleRequestId }`,
but the live `GET /api/User` response used by the Admin verification screen
does not expose a role-request identifier. It only exposes `id` (the user ID).
The frontend must not send `userId` as `roleRequestId`, because those are
different resources and can target the wrong request.

## Required change

Choose one documented contract:

- add `roleRequestId` to the Admin verification/role-request response, or
- change the lookup request to accept the user ID and resolve the pending role
  request server-side from the authenticated Admin context.

Publish the selected request/response schema in Swagger. The response should
continue to return the existing `OrcidLookupResponse` payload.
