# FE Ticket: Fix ORCID Connect Browser Handoff and Callback Flow

## Summary

The current FE ORCID flow does not complete when a user clicks **Connect ORCID** from Profile/Account Settings.

Observed behavior:

```text
Profile
→ Click "Connect ORCID"
→ button loads briefly
→ user stays on the same page
→ ORCID authorization page never opens
→ ORCID status remains "Not connected"
```

This ticket is for **Frontend only**. The backend OAuth flow already exposes the required start/status/callback behavior in the current BE source.

---

## Priority

**High**

This blocks:

- optional ORCID account linking for authenticated Researcher / Lecturer / Graduate Student users
- required verified ORCID linking for Reviewer flows
- verified ORCID identity display in Profile
- downstream Admin/OpenAlex verification flows that depend on a verified account ORCID

---

## Scope

### Included

- Correct handling of `POST /api/Auth/orcid/account/start`
- Correct handling of `POST /api/Auth/orcid/registration/start`
- Browser navigation to the returned ORCID authorization URL
- Add a frontend callback route for the backend-owned ORCID callback handoff
- Account-link callback completion
- Registration callback completion and `orcidTicket` handoff
- Refresh ORCID status after successful account linking
- Safe error/cancel handling

### Excluded

- Changing backend ORCID OAuth logic
- Calling ORCID REST APIs directly from React
- Storing ORCID provider tokens in the browser
- Implementing ORCID unlink/disconnect
- Changing OpenAlex Admin lookup logic

---

# Current Problem Found in FE

## 1. `startAccountOrcidLink()` ignores the backend response

Current file:

```text
src/services/orcid.service.ts
```

Current implementation:

```ts
export async function startAccountOrcidLink(): Promise<void> {
  await api.post<void>(API_ENDPOINTS.AUTH.ORCID_ACCOUNT_START);
}
```

This sends the request but discards the response.

The current backend returns a normal `200 OK` response containing an authorization URL. It does **not** rely on Axios automatically navigating the top-level browser.

Expected response shape:

```ts
interface OrcidLinkStartResponse {
  authorizationUrl: string;
  context: string;
  expiresAt: string;
}
```

Example:

```json
{
  "authorizationUrl": "https://orcid.org/oauth/authorize?...",
  "context": "ACCOUNT_LINK",
  "expiresAt": "2026-09-01T05:00:00Z"
}
```

The FE must explicitly navigate the top-level browser:

```ts
window.location.assign(response.data.authorizationUrl);
```

The same issue exists in:

```ts
startRegistrationOrcidLink()
```

---

# Backend Contract to Consume

## Authenticated account linking

### Request

```http
POST /api/Auth/orcid/account/start
Authorization: Bearer <ARS JWT>
```

No body.

The backend derives the user ID from the JWT. The FE must not send `userId`.

### Success

```http
200 OK
```

Expected body:

```json
{
  "authorizationUrl": "https://orcid.org/oauth/authorize?...",
  "context": "ACCOUNT_LINK",
  "expiresAt": "..."
}
```

### Relevant errors

```text
401 UNAUTHENTICATED
404 USER_NOT_FOUND
409 ACCOUNT_ALREADY_HAS_ORCID
503 ORCID_NOT_CONFIGURED
400 ORCID_LINK_START_FAILED
```

---

## Registration linking

### Request

```http
POST /api/Auth/orcid/registration/start
```

No JWT required.

No body.

### Success

```http
200 OK
```

Expected body:

```json
{
  "authorizationUrl": "https://orcid.org/oauth/authorize?...",
  "context": "REGISTRATION",
  "expiresAt": "..."
}
```

The FE must navigate the browser to `authorizationUrl`.

---

# Required FE Changes

## 1. Update ORCID start service

File:

```text
src/services/orcid.service.ts
```

Add a typed response:

```ts
export interface OrcidLinkStartResponse {
  authorizationUrl: string;
  context: string;
  expiresAt: string;
}
```

Add a small navigation helper:

```ts
const navigateToOrcidAuthorization = (authorizationUrl: string): void => {
  const target = new URL(authorizationUrl);

  const isAllowedHost =
    target.protocol === 'https:' &&
    (
      target.hostname === 'orcid.org' ||
      target.hostname.endsWith('.orcid.org')
    );

  if (!isAllowedHost) {
    throw new Error('Invalid ORCID authorization URL returned by the server.');
  }

  window.location.assign(target.toString());
};
```

Update registration start:

```ts
export async function startRegistrationOrcidLink(): Promise<void> {
  const response =
    await api.post<OrcidLinkStartResponse>(
      API_ENDPOINTS.AUTH.ORCID_REGISTRATION_START
    );

  navigateToOrcidAuthorization(
    response.data.authorizationUrl
  );
}
```

Update authenticated account start:

```ts
export async function startAccountOrcidLink(): Promise<void> {
  const response =
    await api.post<OrcidLinkStartResponse>(
      API_ENDPOINTS.AUTH.ORCID_ACCOUNT_START
    );

  navigateToOrcidAuthorization(
    response.data.authorizationUrl
  );
}
```

Important:

- Do not use `fetch` or Axios against `api.orcid.org`.
- Browser navigation to the backend-provided ORCID authorization page is expected.
- Do not persist authorization `code`, OAuth `state`, access token, or refresh token.

---

# 2. Add ORCID callback route

Current FE routes do not contain an ORCID OAuth callback landing page.

Update:

```text
src/routes/paths.ts
```

Add:

```ts
ORCID_OAUTH_CALLBACK: '/auth/orcid/callback',
```

---

## 3. Add callback page

Create:

```text
src/pages/OrcidCallback/OrcidCallback.tsx
```

The backend callback is:

```http
GET /api/Auth/orcid/callback
```

ORCID redirects to the backend.

The backend processes the OAuth code/state server-side and then redirects the browser to the FE callback URL using a URL fragment.

Example account-link success:

```text
/auth/orcid/callback
#success=true
&context=ACCOUNT_LINK
&status=COMPLETED
&orcidId=0000-0000-0000-0000
&displayName=Example%20Name
```

Example registration success:

```text
/auth/orcid/callback
#success=true
&context=REGISTRATION
&status=AUTHENTICATED
&orcidId=0000-0000-0000-0000
&displayName=Example%20Name
&registrationTicket=<opaque-ticket>
```

Example error:

```text
/auth/orcid/callback
#success=false
&context=ACCOUNT_LINK
&status=FAILED
&errorCode=...
&errorMessage=...
```

The FE callback page should parse:

```text
success
context
status
orcidId
displayName
registrationTicket
errorCode
errorMessage
```

Use:

```ts
new URLSearchParams(window.location.hash.replace(/^#/, ''))
```

Do not send any callback value back to ORCID.

---

# 4. Account-link callback behavior

If:

```text
success=true
context=ACCOUNT_LINK
```

navigate with replace:

```ts
navigate('/profile?orcid=verified', {
  replace: true,
});
```

The Profile page should then use the existing backend status endpoint:

```http
GET /api/Auth/orcid/status
```

to obtain the authoritative current state.

Do not mark the account verified from fragment values alone.

Expected status response includes:

```json
{
  "userId": 123,
  "isConnected": true,
  "isVerified": true,
  "orcidId": "0000-0000-0000-0000",
  "displayName": "Example Name",
  "verifiedAt": "...",
  "canConnect": false
}
```

The existing `OrcidIdentityPanel` already uses backend status as the authoritative display state. Keep that behavior.

---

# 5. Registration callback behavior

If:

```text
success=true
context=REGISTRATION
```

and `registrationTicket` is present:

1. Store only the opaque registration ticket temporarily:

```ts
sessionStorage.setItem(
  'orcidRegistrationTicket',
  registrationTicket
);
```

2. Navigate back to:

```text
/register?orcid=verified
```

3. Do not store ORCID provider code/state/token.

---

# 6. Register page must consume the ORCID registration ticket

File:

```text
src/pages/Register/Register.tsx
```

The existing FE type already supports:

```ts
orcidTicket?: string;
```

in `RegisterPayload`.

When the Register page is restored after the ORCID callback:

```ts
const orcidTicket =
  sessionStorage.getItem(
    'orcidRegistrationTicket'
  );
```

When submitting:

```ts
const payload: RegisterPayload = {
  email: form.email,
  password: form.password,
  fullName: form.fullName,
  phoneNumber: form.phoneNumber,
  role: form.role,
  pdfUrl,
  ...(orcidTicket ? { orcidTicket } : {}),
};
```

After a successful registration:

```ts
sessionStorage.removeItem(
  'orcidRegistrationTicket'
);
```

For **Reviewer** registration, FE should block final submit when a valid ORCID verification ticket has not been obtained.

For non-Reviewer roles, ORCID remains optional.

Backend remains the authority and must still reject invalid/missing Reviewer tickets even if FE validation is bypassed.

---

# 7. Register the callback page in `App.tsx`

File:

```text
src/App.tsx
```

Import or lazy-load the callback component.

Add a public route:

```tsx
<Route
  path={ROUTES.ORCID_OAUTH_CALLBACK}
  element={<OrcidCallback />}
/>
```

It must be outside authenticated-only route guards because the registration callback happens before a user has an ARS JWT.

The callback page itself decides where to continue based on `context`.

---

# Files FE Dev Must Review

Required:

```text
src/services/orcid.service.ts
src/routes/paths.ts
src/App.tsx
src/pages/OrcidCallback/OrcidCallback.tsx   // NEW
src/pages/Register/Register.tsx
```

Also verify but avoid unnecessary changes:

```text
src/components/orcid/OrcidIdentityPanel.tsx
src/hooks/useOrcidIdentity.ts
src/types/auth.ts
src/utils/constants.ts
```

`src/types/auth.ts` already contains optional `orcidTicket`; do not create a duplicate field/type.

`src/utils/constants.ts` already contains:

```text
/api/Auth/orcid/registration/start
/api/Auth/orcid/account/start
/api/Auth/orcid/status
/api/Auth/orcid/callback
```

---

# Expected Account-Link Flow

```text
Profile
  ↓
Connect ORCID
  ↓
POST /api/Auth/orcid/account/start + JWT
  ↓
200 { authorizationUrl }
  ↓
window.location.assign(authorizationUrl)
  ↓
ORCID authorization page
  ↓
ORCID redirects to:
GET /api/Auth/orcid/callback
  ↓
BE validates state + exchanges code + saves verified ORCID
  ↓
BE redirects browser to:
FE /auth/orcid/callback#...
  ↓
FE callback page
  ↓
/profile?orcid=verified
  ↓
GET /api/Auth/orcid/status
  ↓
Verified badge
```

---

# Expected Reviewer Registration Flow

```text
/register
  ↓
Role = Reviewer
  ↓
Connect ORCID
  ↓
POST /api/Auth/orcid/registration/start
  ↓
200 { authorizationUrl }
  ↓
window.location.assign(...)
  ↓
ORCID
  ↓
BE callback
  ↓
FE /auth/orcid/callback
  ↓
registrationTicket saved in sessionStorage
  ↓
/register?orcid=verified
  ↓
POST /api/Auth/register
{
  ...,
  "role": "Reviewer",
  "orcidTicket": "<ticket>"
}
  ↓
remove ticket after successful registration
```

---

# Manual Verification Checklist

## Test A — Existing Lecturer/Researcher account

1. Log in.
2. Open `/profile`.
3. Confirm status initially says `Not connected`.
4. Open DevTools → Network.
5. Click `Connect ORCID`.
6. Verify:

```text
POST /api/Auth/orcid/account/start
```

returns `200`.

7. Confirm response contains non-empty `authorizationUrl`.
8. Confirm browser navigates to `https://orcid.org/...`.
9. Authorize.
10. Confirm browser returns through backend callback and lands back on FE.
11. Confirm FE calls:

```text
GET /api/Auth/orcid/status
```

12. Confirm result:

```text
isConnected = true
isVerified = true
orcidId != null
verifiedAt != null
```

13. Confirm Profile shows `Verified`.

---

## Test B — Refresh safety

After Test A:

1. Hard refresh `/profile`.
2. ORCID must still display `Verified`.
3. State must come from backend status, not local storage.

---

## Test C — Reviewer registration

1. Open `/register`.
2. Select Reviewer.
3. Attempt submit without ORCID ticket.
4. FE should prevent completion and show a clear validation message.
5. Click Connect ORCID.
6. Complete ORCID authorization.
7. Confirm callback returns a `registrationTicket`.
8. Confirm ticket is temporarily stored in `sessionStorage`.
9. Submit Reviewer registration.
10. Confirm request body includes `orcidTicket`.
11. On success, confirm ticket is removed.

---

## Test D — Non-Reviewer registration

For:

```text
Researcher
Lecturer
Graduate Student
```

registration must remain possible without an ORCID ticket.

ORCID linking may still be offered as optional.

---

## Test E — Cancel/error

Cancel at ORCID or simulate callback failure.

Expected:

- no local verified state
- no fake ORCID status
- no registration ticket left behind
- user sees a usable error message
- user can retry

---

# Acceptance Criteria

- [ ] Clicking **Connect ORCID** causes an authenticated user to leave ARS and reach the ORCID authorization page.
- [ ] FE uses the backend-returned `authorizationUrl`; it does not assume Axios will redirect the browser.
- [ ] `/auth/orcid/callback` exists and loads without redirect-loop or 404.
- [ ] Account-link callback returns the user to Profile.
- [ ] Profile refreshes `GET /api/Auth/orcid/status` after the callback.
- [ ] Profile never derives verified state solely from callback fragment data.
- [ ] Reviewer registration receives and submits the backend-issued `orcidTicket`.
- [ ] Non-Reviewer registration does not require ORCID.
- [ ] No ORCID authorization code, OAuth state, provider access token, or refresh token is stored in localStorage/sessionStorage.
- [ ] No React/Axios request is made directly to ORCID APIs.
- [ ] Existing Google OAuth routes and unrelated authentication flows are unchanged.
- [ ] No unrelated files are reformatted.

---

# Environment / Deployment Check

Backend environment must point back to the actual deployed FE callback:

```text
ORCID_FRONTEND_CALLBACK_URL=https://<actual-fe-domain>/auth/orcid/callback
```

For example:

```text
ORCID_FRONTEND_CALLBACK_URL=https://fe-ars.vercel.app/auth/orcid/callback
```

The ORCID Developer Console callback/redirect URI must remain the **backend** callback:

```text
https://arsplatform.onrender.com/api/Auth/orcid/callback
```

Do not configure the ORCID provider to call the React callback directly.

---

# Notes for FE Dev

The checked-in FE Swagger contract/documentation may still describe the ORCID start endpoint as having an unspecified `200` body. Do not implement based only on that stale description.

The current backend source explicitly returns the result of the ORCID link service through `Ok(result)`, and the intended browser handoff is the returned `authorizationUrl`.

When debugging, inspect the actual Network response from:

```text
POST /api/Auth/orcid/account/start
```

before changing backend code.
