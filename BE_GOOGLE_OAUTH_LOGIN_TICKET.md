# BE Ticket: Separate Google Login from Google Meet Authorization

## Summary

The current Google OAuth flow used from the ARS login page is entering the Google Meet authorization flow. After Google consent, the user sees a page that displays a Google refresh token and asks for `GoogleMeetSettings__RefreshToken` configuration.

That behavior is incorrect for login. The login flow must authenticate the ARS account, create or load the ARS session, and return the user to the frontend login callback. Google Meet authorization must use a separate endpoint and callback for seminar creation.

## Current Problem

The frontend login button calls:

```text
GET /api/Auth/google-oauth-login
```

The resulting callback currently behaves like Google Meet setup instead of ARS authentication. This causes these login requirements to fail:

- Existing users are not returned to the ARS application.
- Existing users cannot select an active role when multiple roles are assigned.
- New Google users cannot complete onboarding.
- New users cannot submit a role request with a verification PDF.
- The frontend cannot route an authenticated user to the Forum or role workspace.
- A login user is incorrectly exposed to a Google Meet refresh-token setup page.

## Required User Flow

```text
Login page
  -> Google authentication
  -> Existing account?
       Yes -> If multiple roles, choose active role
             -> Forum or role-specific workspace
       No  -> Choose requested role
             -> Upload verification PDF
             -> Submit role request
             -> Wait for admin approval
             -> Forum as a pending user
```

## Required Backend Changes

### 1. Separate ARS Google Login from Google Meet Authorization

The following endpoints must be used only for ARS authentication:

```text
GET /api/Auth/google-oauth-login
GET /api/Auth/google-callback
```

The login callback must not configure Google Meet and must not display or return a Google Meet refresh-token setup page.

Google Meet authorization for seminar creation must use separate endpoints, for example:

```text
GET /api/GoogleMeet/authorize
GET /api/GoogleMeet/callback
```

The final paths may differ, but the login and Google Meet flows must not share the same callback behavior.

### 2. Return an ARS Login Result

After successful Google authentication, the login callback must either:

- redirect to the frontend callback with the ARS session result, or
- establish the documented ARS session/cookie and redirect to the frontend callback so the frontend can retrieve the session.

The result must contain, directly or through a documented follow-up endpoint, the following information:

```json
{
  "token": "<ARS JWT or documented session result>",
  "userId": 123,
  "email": "user@example.com",
  "fullName": "Google User",
  "isNewUser": true,
  "requiresOnboarding": true,
  "roles": [],
  "role": null,
  "isActive": false,
  "verificationStatus": "Pending",
  "effectiveRole": "Guest"
}
```

For an existing user, the response should include the assigned roles:

```json
{
  "isNewUser": false,
  "requiresOnboarding": false,
  "roles": ["Researcher", "Reviewer"],
  "role": "Researcher",
  "isActive": true,
  "verificationStatus": "Accepted",
  "effectiveRole": "Researcher"
}
```

The backend must document the exact response shape, redirect URL behavior, token/cookie behavior, and error query parameters.

### 3. Add a Google Onboarding Submission Endpoint

A first-time Google account has already been created by the login flow. The frontend must not call `/api/Auth/register` again.

Please add and document an authenticated endpoint for completing Google onboarding, for example:

```text
POST /api/Auth/complete-google-registration
```

The final endpoint name may differ, but it must accept the Google-authenticated user's onboarding data.

Suggested request body:

```json
{
  "phoneNumber": "+84 90 123 4567",
  "role": "Researcher",
  "pdfUrl": "https://firebase-storage-url/example.pdf"
}
```

Requirements:

- Require a valid ARS authentication session.
- Derive the user ID from the authenticated session; do not trust a user ID supplied by the frontend.
- Validate that the requested role is allowed for self-service onboarding.
- Validate that `pdfUrl` is present and is a valid URL.
- Store the verification/role request for admin review.
- Set the account to the correct pending state.
- Do not grant the requested role before admin approval.
- Return the authoritative updated user/request state.
- Return a clear error if a pending request already exists.

Suggested successful response:

```json
{
  "userId": 123,
  "role": "Researcher",
  "pdfUrl": "https://firebase-storage-url/example.pdf",
  "isActive": false,
  "verificationStatus": "Pending",
  "effectiveRole": "Guest",
  "requestStatus": "Pending"
}
```

### 4. Preserve Existing-Account Role Selection

For an existing account with multiple assigned roles, the login response must return the complete assigned role list. The frontend will show a role-selection modal and use the selected role for the session.

The backend must ensure that:

- The role list contains only roles actually assigned to the user.
- A selected role cannot be used to escalate privileges.
- The selected role is reflected in the session/JWT claims if the backend supports role switching.
- A single-role account can proceed without showing the role-selection modal.

## Frontend Behavior Already Implemented

The frontend already contains:

- Google login initiation from the login page.
- `/auth/google/callback` handling.
- Existing multi-role selection UI.
- `/complete-google-registration` onboarding page.
- Role selection for new Google users.
- Firebase PDF upload through `PdfDropzone`.
- Pending-user routing to `/forum`.
- Role-specific landing routes for approved active users.

The onboarding submit button is currently disabled because no documented backend onboarding endpoint exists. Once the endpoint is available, the frontend will wire the submit action to the agreed contract.

## Acceptance Criteria

- [ ] Clicking Google login from the ARS login page never displays a Google Meet refresh-token setup page.
- [ ] Existing single-role users complete Google login and reach the appropriate ARS landing page.
- [ ] Existing multi-role users receive all assigned roles and can choose the active role.
- [ ] A new Google user is routed to the onboarding flow.
- [ ] A new user can select a role and upload a PDF proof.
- [ ] A new user can submit the role request through a documented authenticated endpoint.
- [ ] The submitted PDF URL is stored with the request and visible to admins.
- [ ] The new account remains pending and has no active business-role access before approval.
- [ ] A pending user is routed to the Forum with the pending state represented correctly.
- [ ] After admin approval, a later login returns the approved role and routes the user to the correct workspace.
- [ ] Seminar creation uses a separate Google Meet authorization flow.
- [ ] Google Meet refresh tokens are never shown in the ARS login UI or login callback.
- [ ] Swagger documents every endpoint, request body, response body, redirect URI, and error case.

## Important Security Requirements

- Do not expose Google client secrets, refresh tokens, or other provider credentials to the frontend.
- Do not include real credentials or refresh tokens in API responses intended for the browser.
- Store Google Meet refresh tokens only in backend environment/configuration storage.
- Validate the authenticated user server-side when creating a role request.
- Do not trust a client-supplied user ID or role assignment.

## API Documentation Reference

Current Swagger:

<https://arsplatform.onrender.com/swagger/index.html>

The current Swagger exposes Google authentication endpoints but does not document a Google onboarding submission endpoint. Please update Swagger together with the implementation.

## Definition of Done

The backend team has completed the ticket when the full flow can be tested from the ARS login page without manual Render configuration during login, while seminar creation can still perform its own separate Google Meet authorization when required.
