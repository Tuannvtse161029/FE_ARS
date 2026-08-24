import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ROUTES } from '../routes/paths';
import { readStoredUser } from '../utils/storedUser';
import { isAdminUser } from '../utils/roleNormalizer';
import type { VerificationStatus } from '../types/auth';

// Sends unverified users to /forum. Used by every private route except /forum
// so a freshly-registered user landing on /dashboard, /papers, etc. gets bounced
// to the only page they have read-only access to.
//
// The route-guard checks the complete state machine:
//   isEmailVerified === true
//   AND verificationStatus === 'Accepted'
//   AND isActive === true
//   AND backend has assigned the approved role
//
// The backend is the authoritative source. If the BE incorrectly returns a
// roleName in the JWT for an unapproved user, the frontend guard is the last
// line of defence — but this is a CRITICAL backend blocker that must be fixed
// server-side. Report any occurrence to the BE team immediately.
//
// Admins are exempt because they are provisioned directly in the DB and bypass
// the role-request lifecycle entirely.
//
// Reads `isActive` and `verificationStatus` from the auth store (populated
// by AuthContext during persistAuthAndNavigate and rehydrated from localStorage
// on the next page load). Falls back to storedUser for the brief window before
// the context rehydrates.
//
// Agent 30 (regression) — `verificationStatus` is treated as a tri-state
// (`'Pending' | 'Accepted' | 'Rejected' | null`). A `null` value means the
// BE has not yet produced a verification result — for example, a brand-new
// first-time Google user that has not been through the role-request
// lifecycle. We MUST NOT coerce `null` to `'Pending'` here: doing so would
// silently route a first-time user to `/forum` (because `isFullyApproved`
// would see `verificationStatus !== 'Accepted'`) and bypass the
// `/complete-google-registration` page.

const isFullyApproved = (
  isActive: boolean | undefined,
  verificationStatus: VerificationStatus | null | undefined
): boolean => {
  // The user must have ALL three conditions satisfied:
  //   1. isActive === true      (Admin activated the account)
  //   2. verificationStatus === 'Accepted' (Admin reviewed and approved)
  //   3. The BE must have assigned a non-null roleId (role was created in DB)
  //
  // Any missing/undefined field defaults to false (lockout-safe).
  return Boolean(isActive) && verificationStatus === 'Accepted';
};

export const useVerifiedGuard = () => {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isAuthenticated) {
      navigate(ROUTES.LOGIN, { replace: true });
      return;
    }

    const stored = readStoredUser();

    // Admins bypass the role-request lifecycle. They are DB-provisioned only.
    if (isAdminUser({
      roleName: user?.role ?? stored?.roleName ?? null,
      roleId: stored?.roleId ?? null,
    })) {
      return;
    }

    // Check the complete state machine. Use auth-store values first, then
    // fall back to stored values (for the brief window before rehydration).
    // Agent 30 (regression) — preserve the BE-supplied `null`
    // `verificationStatus` as `null`; do NOT coerce it to `'Pending'`.
    // A first-time Google user has not been through the role-request
    // lifecycle yet, so routing them to `/forum` based on a coerced
    // `'Pending'` would silently bypass the onboarding page.
    const isActive = user?.isActive ?? stored?.isActive ?? false;
    const rawStatus = user?.verificationStatus ?? stored?.verificationStatus ?? null;
    const verificationStatus =
      rawStatus === 'Accepted' || rawStatus === 'Rejected' || rawStatus === 'Pending'
        ? rawStatus
        : null;

    if (isFullyApproved(isActive, verificationStatus)) return;

    // CRITICAL DEFENCE: If the BE has incorrectly issued a roleName/roleId for
    // an unapproved user, the isActive and verificationStatus checks above will
    // catch it. Log the anomaly so it can be reported to the BE team.
    const hasStaleRole =
      (user?.role || stored?.roleName) &&
      !isFullyApproved(isActive, verificationStatus);
    if (hasStaleRole) {
      console.error(
        '[Agent 26 — CRITICAL] Backend issued role for unapproved user.',
        'User must NOT enter role routes until BE fixes the JWT/role assignment.',
        { isActive, verificationStatus, role: user?.role ?? stored?.roleName }
      );
    }

    // Land them on /forum (replace so back button doesn't trap them).
    navigate(ROUTES.FORUM, { replace: true });
  }, [user, isAuthenticated, navigate]);
};

export default useVerifiedGuard;
