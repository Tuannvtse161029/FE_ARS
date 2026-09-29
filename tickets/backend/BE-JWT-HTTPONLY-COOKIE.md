# BE Ticket — Move ARS JWT to HttpOnly Secure cookie

**Status:** Draft (FE side shipped as `src/utils/secureToken.ts` interim mitigation)
**Owner:** BE team
**Priority:** High (closes the only remaining vector for token extraction
from a shared / compromised browser)
**Related:** Session-2 frontend hardening (plan
`hide_jwt_and_minimize_user_blob_in_browser_storage`)

## Why this ticket exists

The ARS SPA currently stores the JWT in `localStorage` / `sessionStorage`
under the `ars_token` key (and now, after the Session-2 patch, an
encrypted envelope under `ars_token_enc_v1` whose decryption key is held
in a JS module-scope variable). The screenshot scenario — copy-pasting
the raw token out of DevTools and replaying it against `/api/user/{id}`
— is no longer possible in the encrypted-envelope world, but a
determined attacker who can run arbitrary JS in the page (XSS, malicious
extension) can still recover the cleartext from the JS heap.

The only complete fix is for the BE to issue the JWT as an
`HttpOnly; Secure; SameSite=Strict` cookie so JavaScript never sees it.

## What the BE needs to ship

### 1. `POST /api/Auth/login` (and the matching Google / OAuth flows)

- Continue to return the JWT in the JSON body for now (the FE still
  reads it), but ALSO set:
  - `Set-Cookie: ars_at=<access JWT>; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=3600`
  - `Set-Cookie: ars_rt=<refresh JWT>; HttpOnly; Secure; SameSite=Strict; Path=/api/auth; Max-Age=604800`
- The FE can be configured to ignore the body token and rely solely on
  cookies via `withCredentials: true` on the axios instance. We will
  flip this switch in a coordinated release after the BE ships.

### 2. `POST /api/Auth/refresh-token` (new)

- Reads `ars_rt` from the request cookies.
- Validates the refresh token (single-use rotation; reuse triggers
  family-revocation).
- Returns a fresh access token and a fresh refresh token; sets both
  cookies with the same flags as the login response.
- 401s when the refresh token is missing, expired, or revoked.

### 3. `POST /api/Auth/logout` (new)

- Reads both cookies.
- Revokes the refresh-token family server-side.
- Clears both cookies (`Set-Cookie: ars_at=; Max-Age=0` and similar).
- Idempotent: a logout with already-cleared cookies still 204s.

### 4. CORS

- The BE must respond with `Access-Control-Allow-Credentials: true` to
  requests whose `Origin` is one of the deployed FE origins
  (Vercel preview + production). The FE will set `withCredentials: true`
  on the shared axios instance; without the BE's CORS update the
  browser will block the cookie from being attached.
- `Access-Control-Allow-Origin` MUST be the request's `Origin` header
  echoed back when credentials are allowed — the wildcard `*` is
  incompatible with credentialed requests per the Fetch spec.

## FE impact when this ships

1. Delete `src/utils/secureToken.ts`.
2. Set `withCredentials: true` on the shared `axios.create` instance in
   `src/services/axios.ts`.
3. The 401 interceptor swaps the current redirect path for a
   `POST /api/auth/refresh-token` → retry-original-request flow. The
   secureToken rehydration hook in `main.tsx` becomes a real call.
4. `src/utils/storage.ts` collapses to the user-blob + remember-me
   helpers; the token branch is removed.
5. `ars_token_enc_v1` and `ars_token_refresh_v1` keys are swept on the
   first FE release after the BE cookie deploy.

## Acceptance criteria

- [ ] `curl --cookie-jar /tmp/cookies.txt -X POST https://arsplatform.onrender.com/api/auth/login -d '{"email":"...","password":"..."}' -H 'Content-Type: application/json'` returns the cookies in `/tmp/cookies.txt`.
- [ ] A subsequent `curl --cookie /tmp/cookies.txt https://arsplatform.onrender.com/api/user/{id}` returns the user record (cookies are attached; the `Authorization` header is no longer required).
- [ ] `DevTools → Application → Cookies` shows `ars_at` and `ars_rt`. `DevTools → Application → Session / Local Storage` shows no JWT-shaped strings.
- [ ] `curl -X POST https://arsplatform.onrender.com/api/auth/refresh-token --cookie /tmp/cookies.txt` returns fresh cookies and 200.
- [ ] After logout, `curl -X POST https://arsplatform.onrender.com/api/auth/refresh-token --cookie /tmp/cookies.txt` returns 401 (refresh family revoked).
- [ ] Replay of an old `ars_rt` returns 401 (reuse-detection).

## Out of scope for this ticket

- Token-binding to client fingerprints (mTLS, DPoP). That is a separate
  hardening track and only needed if the threat model moves beyond
  "casual DevTools / shared workstation."
- CSRF tokens. The `SameSite=Strict` cookie flag is the primary
  mitigation; a CSRF token can be layered on later if the FE ever
  embeds third-party iframes.
