# BE Ticket: Fix Multi-Role Selection and Role Switching

## ID

BE-ROLE-SELECTION-01

## Priority

High

## Summary

Users with more than one assigned role can receive multiple roles from login, but choosing a role must produce a server-authoritative active session. The backend must validate the selection against the user's assigned roles, issue updated role claims, and keep the selected role consistent after refresh and subsequent API requests.

The frontend already displays the role-selection UI and sends the selected role through the existing authentication flow. The current behavior is unsafe/incomplete if the selection only changes frontend state or if the backend returns a role that is not actually assigned to the user.

## Current Problem

The frontend needs a reliable contract for this flow:

```text
Login
  -> Backend returns all roles assigned to the authenticated user
  -> Frontend displays the role picker when there is more than one role
  -> User selects one assigned role
  -> Backend validates and switches the active role
  -> Backend returns a replacement JWT/session with the selected role claims
  -> Frontend routes using the authoritative effective role
```

Observed or expected failure cases include:

- A user receives multiple roles but selecting one does not update server-side claims.
- A selected role is accepted even though it is not assigned to the authenticated user.
- A role switch returns `403` during or immediately after Google onboarding.
- The selected role is lost after page refresh because the JWT and user response disagree.
- The login response contains an incomplete or unstable `roles` array, so the frontend cannot present the correct choices.

## Required Backend Contract

### 1. Return Complete Assigned Roles During Login

For password login and Google login, return every currently assigned role for the authenticated user. The list must contain only roles represented by the user's `UserRole` records.

Example response fields:

```json
{
  "token": "ars-jwt",
  "userId": 123,
  "email": "user@example.com",
  "roles": ["Researcher", "Reviewer"],
  "role": null,
  "roleId": null,
  "effectiveRole": "Guest",
  "isActive": true,
  "verificationStatus": "Accepted",
  "requiresRoleSelection": true
}
```

For a single-role user, return one role and set `requiresRoleSelection` to `false`. Do not return Admin or any role that is not assigned to the user.

The API must document whether role names are canonical case-sensitive values and must consistently return the corresponding `roleId` values when role IDs are exposed.

### 2. Add or Correct the Active-Role Switch Endpoint

Implement or correct the documented endpoint:

```text
POST /api/auth/switch-role
```

Suggested request:

```json
{
  "roleId": 3
}
```

The final request field may be `role`, but Swagger must document one canonical contract. Prefer `roleId` because it identifies the persisted `Role` record without relying on display-name casing.

Suggested success response:

```json
{
  "token": "replacement-jwt",
  "userId": 123,
  "email": "user@example.com",
  "roles": ["Researcher", "Reviewer"],
  "role": "Reviewer",
  "roleId": 3,
  "effectiveRole": "Reviewer",
  "isActive": true,
  "verificationStatus": "Accepted"
}
```

The replacement token is required whenever the active role is represented in JWT claims. If the backend uses a server-side session instead, return the updated session state and document how the frontend retrieves it.

### 3. Enforce Authorization and Assignment Ownership

The endpoint must:

- Require a valid ARS JWT.
- Derive the user ID from the JWT subject; never trust a client-supplied user ID.
- Allow switching only to a role assigned to that authenticated user.
- Return `400` for malformed or missing role input.
- Return `403` when the requested role is not assigned to the user or the account is not eligible to use it.
- Return `401` for an absent, invalid, or expired token.
- Never allow a client to self-select Admin or escalate privileges.
- Preserve the complete assigned-role list in the success response.

### 4. Handle Pending and Onboarding Accounts

A first-time Google user with no assigned role must not be forced through a role switch before completing onboarding. The onboarding completion endpoint should create the pending role request; it should not grant active business-role access before approval.

For an onboarding or pending account:

- `/api/auth/switch-role` must return a documented response, not an ambiguous `403` caused by missing profile data.
- Before approval, the account must retain `effectiveRole: "Guest"` and `isActive: false`.
- After admin approval, a new login or documented role-switch response must return the approved role and claims.
- If a pending user has multiple pending requests, define which role is authoritative and return that state consistently.

## Acceptance Criteria

- [ ] Password and Google login return the complete set of roles assigned to the user.
- [ ] The frontend shows the role picker only when more than one eligible assigned role is returned.
- [ ] Selecting an assigned role calls the documented role-switch endpoint.
- [ ] Selecting an unassigned role is rejected server-side and cannot change JWT claims.
- [ ] A successful switch returns a replacement JWT or documented updated session containing the selected active role.
- [ ] The selected role survives refresh and is consistent with `/api/user/{id}` or the documented current-user endpoint.
- [ ] Admin cannot be obtained through a client-supplied role ID or role name.
- [ ] Missing/invalid token, malformed input, unassigned role, and inactive/pending-account responses are documented with `401`, `400`, and `403` schemas as applicable.
- [ ] First-time Google onboarding remains accessible without an assigned role and does not grant active role access before approval.
- [ ] Swagger documents request/response schemas, JWT claim behavior, authorization rules, and all error cases.
- [ ] Backend tests cover single-role login, multi-role login, valid switch, unassigned-role rejection, Admin escalation rejection, expired token, pending account, and refresh consistency.

## Frontend Integration Notes

The frontend currently uses these canonical role values for selectable business roles:

```text
Researcher
Reviewer
Lecturer
Graduate Student
```

Admin is not user-selectable during onboarding or role switching. The frontend consumes the backend's assigned roles and must not fabricate role options or role IDs.

Once the backend contract is available in Swagger, the frontend will wire the role-picker confirmation to `/api/auth/switch-role` and persist the returned authoritative token and user state.

## API Documentation Reference

Current Swagger:

<https://arsplatform.onrender.com/swagger/index.html>

Please update Swagger together with the implementation and confirm the exact endpoint path, request field, response shape, status codes, and JWT/session behavior.

## Definition of Done

The backend team has completed this ticket when an account with multiple assigned roles can log in, select one assigned role, receive a server-authoritative active session, refresh the application without losing that selection, and receive a clear documented response for onboarding, pending, unauthorized, and invalid-selection cases.
