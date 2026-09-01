# ORCID OAuth Contract Blocker

The frontend has consumed the Swagger contract currently available in `swagger.json`:

- `POST /api/Auth/orcid/account/start`
- `GET /api/Auth/orcid/status`
- `GET /api/Auth/orcid/callback`

`GET /api/Auth/orcid/status` defines `userId`, `isConnected`, `isVerified`, `orcidId`, `verifiedAt`, and `canConnect`. The frontend uses `isConnected && isVerified && orcidId` as the only eligibility signal for Reviewer requests.

The start endpoint documents no response body or redirect behavior. The callback documents only provider query parameters and no approved frontend result. The API does not document an unlink endpoint. For that reason, the frontend does not start a redirect, handle authorization codes or state, persist OAuth credentials, or offer a disconnect action.

## Backend Requirements

The backend team must publish the following contract before the frontend can enable Connect ORCID:

1. The response behavior for `POST /api/Auth/orcid/account/start`, including the server-approved browser redirect URL or an explicit redirect response.
2. The frontend callback URL and a result shape that contains no authorization code, access token, or refresh token.
3. A backend-owned completion signal so the callback page can discard query values and then refetch `GET /api/Auth/orcid/status`.
4. `DELETE /api/Auth/orcid/account` or an equivalent authenticated unlink endpoint, including conflict and already-unlinked responses.
5. Defined response status codes for cancellation, provider denial, invalid or expired state, network failure, and an ORCID linked to another ARS account.

The frontend must not infer any of these details or exchange OAuth codes in React.
