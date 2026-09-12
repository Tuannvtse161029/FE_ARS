# [SEC-BE-004] SessionStorage/localStorage Cross-Bucket Fallback for effectiveRole

## Priority: LOW (Verification Required)

## Security Classification: Role Confusion / Session Fixation

## Date Opened
2026-09-12

## Status
**OPEN** — Requires BE team confirmation of logout behavior

## Source
Security review of ARS_FE codebase (VERIFY-004)  
Issue location: `src/store/authSlice.ts:50-69`

## Issue Summary

The ARS auth store reads auth state from a two-tier storage chain:

```typescript
// src/store/authSlice.ts:50-51
? (localStorage.getItem(name) || sessionStorage.getItem(name))
: (sessionStorage.getItem(name) || localStorage.getItem(name));
```

- **Without "Remember Me"**: The JWT and user data are written to `sessionStorage` only
- **With "Remember Me"**: Data is written to `localStorage` only
- **Read**: The code falls back to the other bucket if the primary is empty

The smart adapter reads across both buckets intentionally (to handle mixed-session scenarios), but there is a potential regression scenario:

**Scenario A — Remember Me OFF → ON:**
1. User logs in with "Remember Me OFF" → JWT stored in `sessionStorage`
2. User closes tab, reopens (sessionStorage cleared)
3. User logs in with "Remember Me ON" → JWT stored in `localStorage`
4. Next tab with old `sessionStorage` JWT would have stale role → smart adapter falls back to `localStorage` correctly ✓

**Scenario B — Remember Me ON → OFF (potential issue):**
1. User has "Remember Me ON" → JWT in `localStorage` with role X
2. User navigates to logout, but logout does not clear `localStorage`
3. User logs in with "Remember Me OFF" → new JWT in `sessionStorage` with role Y
4. A stale tab with the old `sessionStorage` JWT (role X) would still be active
5. The smart adapter on that stale tab might fall back to the stale `localStorage` blob

## Required BE/Investigation Action

1. **Confirm logout behavior**: Does the `/api/auth/logout` endpoint (and the FE `authService.logout()`) clear **both** `localStorage` and `sessionStorage` auth keys deterministically?

2. **Check the auth rehydration flow**: Does the Zustand store on initialization (`initFromStorage`) handle the case where one bucket has a stale JWT and the other is empty? Which bucket takes precedence and is that correct?

3. **Consider explicit cleanup**: The logout function should clear both buckets explicitly:

```typescript
// In logout function
localStorage.removeItem('ars-auth-storage');
sessionStorage.removeItem('ars-auth-storage');
localStorage.removeItem('ars_user');
sessionStorage.removeItem('ars_user');
localStorage.removeItem('ars_token');
sessionStorage.removeItem('ars_token');
```

## Risk Assessment

- **Likelihood**: LOW — requires a very specific sequence of tab mixing and logout
- **Impact**: MEDIUM — a stale session tab could use an old role
- **Exploitability**: LOW — difficult to exploit without physical/device access

## Recommendation

Add explicit cleanup of **both** storage buckets in the logout flow and add a comment to `authSlice.ts` documenting the intended behavior of the cross-bucket fallback.
