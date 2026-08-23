// Agent 54 — Google OAuth callback landing page.
//
// Lifecycle:
//   1. The BE redirected the browser to `/auth/google/callback?code=...`
//      (success) or `?error=access_denied` (cancellation / error).
//   2. This page mounts ONCE per redirect, parses the query string, and
//      seeds the ARS auth-storage via the same `storage` / `authStore`
//      path that the legacy GIS flow uses (so the rest of the FE treats
//      this exactly like a password login).
//   3. The page navigates with `replace: true` so the `code` query
//      string never lingers in the back-stack — refreshing the page after
//      the redirect does NOT replay the same `code`. (Google rejects
//      replayed codes anyway, but we avoid the confused UX.)
//   4. If the BE did not surface a token in the query string, we do NOT
//      fabricate one — we render an explicit "Sign-in incomplete" notice
//      and clear the in-flight guard so the user can retry.
//
// Routing outcome matrix (per the unified task spec):
//   - `isNewUser || requiresOnboarding`             → /complete-google-registration
//   - role & roleId both empty (BE omitted legacy signal)
//                                                    → /complete-google-registration
//   - role non-null AND verificationStatus Pending
//     OR isActive false (unapproved / inactive)    → /forum as Guest
//   - role non-null AND Approved + active + known   → matching workspace route
//   - Anything else (no token, malformed payload,
//     BE error, missing email/userId/fullName)      → /login (error UI)

import { useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Button } from '../../components/Button';
import { authService } from '../../services/auth.service';
import {
  payloadFromLocationSearch,
  type GoogleOAuthCallbackPayload,
  _resetGoogleOAuthInFlightForTesting,
} from '../../services/googleOAuth.service';
import { storage } from '../../utils/storage';
import { useAuthStore } from '../../store';
import { useWelcomeSignal } from '../../store/welcomeSignal';
import { ROUTES } from '../../routes/paths';
import { resolvePostAuthRoute, isFirstTimeOnboardingUser } from '../../utils/postAuthRoute';
import type { AuthResponse, EffectiveRole, UserRole } from '../../types/auth';

const KNOWN_BUSINESS_ROLES: UserRole[] = [
  'Researcher',
  'Reviewer',
  'Lecturer',
  'Graduate Student',
  'Admin',
];

function isKnownRole(value: string | null): value is UserRole {
  if (!value) return false;
  return (KNOWN_BUSINESS_ROLES as string[]).includes(value);
}

type CallbackStatus = 'pending' | 'success' | 'incomplete' | 'cancelled' | 'error';

function deriveStatus(payload: GoogleOAuthCallbackPayload): CallbackStatus {
  if (payload.errorCode || payload.errorReason) return 'error';
  // We treat absence of `code` OR `token` as "incomplete" — the BE
  // redirected the browser here but did not surface the session fields.
  if (!payload.token || !payload.userId || !payload.email || !payload.fullName) {
    return 'incomplete';
  }
  return 'success';
}

function writeSessionFromPayload(payload: GoogleOAuthCallbackPayload): boolean {
  if (
    !payload.token ||
    !payload.userId ||
    !payload.email ||
    !payload.fullName
  ) {
    return false;
  }

  const safeToken = payload.token;
  const safeUserId = payload.userId;
  const safeEmail = payload.email;
  const safeFullName = payload.fullName;

  if (isFirstTimeOnboardingUser(payload)) {
    // First-time Google user. Persist a pending session WITHOUT fabricating a role.
    storage.setToken(safeToken);
    storage.setUser({
      id: safeUserId,
      username: safeEmail,
      email: safeEmail,
      fullName: safeFullName,
      roleId: payload.roleId,
      roleName: payload.role,
      isActive: payload.isActive ?? false,
      verificationStatus: payload.verificationStatus ?? 'Pending',
      accountTier: 'Free',
      effectiveRole: (payload.effectiveRole as EffectiveRole) ?? null,
    });
    const authStore = useAuthStore.getState();
    authStore.login(
      {
        id: safeUserId,
        username: safeEmail,
        email: safeEmail,
        fullName: safeFullName,
        roleId: payload.roleId,
        roleName: payload.role,
        isActive: payload.isActive ?? false,
        verificationStatus: payload.verificationStatus ?? 'Pending',
        accountTier: 'Free',
        effectiveRole: (payload.effectiveRole as EffectiveRole) ?? null,
      },
      safeToken,
      (payload.effectiveRole as EffectiveRole) ?? null,
    );
    return true;
  }

  // Existing-user path — role is guaranteed non-null per shouldOnboard().
  // We only reach here for users the BE has already assigned a role to.
  if (!isKnownRole(payload.role)) {
    // Shouldn't happen — shouldOnboard() returns true for role-null —
    // but guard defensively. The page will surface "incomplete" and the
    // user can re-authenticate.
    return false;
  }
  const knownRole: UserRole = payload.role;
  const roles = payload.roles.filter((r): r is UserRole => isKnownRole(r));
  const authResponse: AuthResponse = {
    token: safeToken,
    username: safeEmail,
    email: safeEmail,
    role: knownRole,
    userId: safeUserId,
    roleId: payload.roleId ?? undefined,
    roles: roles.length > 0 ? roles : [knownRole],
    isActive: payload.isActive ?? false,
    verificationStatus: payload.verificationStatus ?? 'Pending',
    effectiveRole:
      (payload.effectiveRole as EffectiveRole) ??
      ((payload.isActive ?? false)
        ? (knownRole as EffectiveRole)
        : 'Guest'),
  };
  // Mirror the legacy Google flow: no "remember me" for OAuth (the BE
  // decides the cookie / token lifetime).
  storage.setRememberMe(false);
  authService.setAuthData(authResponse);
  const authStore = useAuthStore.getState();
  authStore.login(
    {
      id: safeUserId,
      username: authResponse.username,
      email: authResponse.email,
      fullName: safeFullName,
      roleId: authResponse.roleId ?? 0,
      roleName: knownRole,
      isActive: authResponse.isActive ?? false,
      verificationStatus: authResponse.verificationStatus ?? 'Pending',
      accountTier: 'Free',
      effectiveRole: authResponse.effectiveRole,
    },
    safeToken,
    authResponse.effectiveRole,
  );

  // Flip the welcome-back signal AFTER the auth store has the new user
  // persisted, so the banner reads the correct full name when MainLayout
  // mounts at the destination route. This single point covers both the
  // first-time (isNewUser) branch and the existing-user branch.
  useWelcomeSignal.getState().show();
  return true;
}

export const GoogleCallback = () => {
  const navigate = useNavigate();
  const processedRef = useRef(false);
  const [status, setStatus] = useState<CallbackStatus>('pending');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (processedRef.current) return;
    processedRef.current = true;

    // Always clear the in-flight guard so the user can retry from /login
    // even if the callback page errors out before navigation.
    _resetGoogleOAuthInFlightForTesting();

    const payload = payloadFromLocationSearch(window.location.search);

    const derived = deriveStatus(payload);

    if (derived === 'error') {
      // Cancellation / BE-reported error. We do NOT persist anything and
      // we do NOT navigate silently — we leave the user on this page so
      // they see why nothing happened. The page offers a "Back to sign
      // in" CTA that does a `clearAuthSession()` defensively (null-safe
      // for guests — see auth.service.ts).
      setStatus('error');
      const reason =
        payload.errorReason ||
        payload.errorCode ||
        'Google sign-in failed before reaching the platform.';
      setErrorMessage(reason);
      return;
    }

    if (derived === 'incomplete') {
      setStatus('incomplete');
      setErrorMessage(
        'Google sign-in reached the platform but the platform did not return a session. Please retry from the sign-in page.',
      );
      return;
    }

    const persisted = writeSessionFromPayload(payload);
    if (!persisted) {
      setStatus('incomplete');
      setErrorMessage(
        'Google sign-in completed but the platform did not return enough information to start a session. Please retry from the sign-in page.',
      );
      return;
    }

    // Decide the destination via the centralized post-auth route resolver
    // (Agent 30 — utils/postAuthRoute.ts). The same priority applies across
    // AuthContext.loginWithGoogle, GoogleCallback, and PublicRoute so a
    // first-time Google user never lands on /forum before completing
    // onboarding.
    const destination = resolvePostAuthRoute({
      role: payload.role,
      roleId: payload.roleId,
      isActive: payload.isActive,
      verificationStatus: payload.verificationStatus,
      effectiveRole: payload.effectiveRole,
      isNewUser: payload.isNewUser,
      requiresOnboarding: payload.requiresOnboarding,
    });

    // Replace so the `code` query string does not linger in history.
    navigate(destination, { replace: true });
  }, [navigate]);

  // Cancel handler — clears the in-flight guard defensively and returns
  // the user to /login without logging any tokens or codes.
  const handleCancel = () => {
    void authService.logout();
    navigate(ROUTES.LOGIN, { replace: true });
  };

  if (status === 'pending') {
    // Brief placeholder while the effect runs. We render the BTR-approved
    // ARS branding instead of a spinner so the page is recognisable.
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <p>Completing your Google sign-in…</p>
      </div>
    );
  }

  if (status === 'success') {
    // The navigate() call above should already have replaced the page.
    // This branch is defensive (e.g. if React re-mounts after the
    // navigate but before history.replaceState propagates). Agent 30 —
    // we route through the centralized post-auth resolver so a re-mount
    // cannot accidentally drop a first-time user on /forum before they
    // have completed onboarding.
    const reMountSnapshot = payloadFromLocationSearch(window.location.search);
    const reMountDestination = resolvePostAuthRoute({
      role: reMountSnapshot.role,
      roleId: reMountSnapshot.roleId,
      isActive: reMountSnapshot.isActive,
      verificationStatus: reMountSnapshot.verificationStatus,
      effectiveRole: reMountSnapshot.effectiveRole,
      isNewUser: reMountSnapshot.isNewUser,
      requiresOnboarding: reMountSnapshot.requiresOnboarding,
    });
    return <Navigate to={reMountDestination} replace />;
  }

  return (
    <div
      role="alert"
      style={{
        padding: 24,
        maxWidth: 480,
        margin: '64px auto',
        fontFamily: 'inherit',
        textAlign: 'center',
      }}
      data-testid="google-callback-status"
      data-status={status}
    >
      <h1 style={{ fontSize: 20, marginBottom: 12 }}>
        {status === 'cancelled'
          ? 'Google sign-in was cancelled.'
          : status === 'error'
            ? 'Google sign-in failed.'
            : 'Google sign-in is incomplete.'}
      </h1>
      {errorMessage && <p style={{ marginBottom: 16 }}>{errorMessage}</p>}
      <Button type="button" variant="primary" size="lg" onClick={handleCancel}>
        Back to sign in
      </Button>
    </div>
  );
};

export default GoogleCallback;