import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ROUTES } from '../routes/paths';
import { readStoredUser } from '../utils/storedUser';
import { isAdminUser } from '../utils/roleNormalizer';

// Sends unverified users (`isActive !== true`) to /forum. Used by every
// private route except /forum so a freshly-registered user landing on
// /dashboard, /papers, etc. gets bounced to the only page they have
// read-only access to.
//
// Reads `isActive` from the auth store (which is populated by AuthContext
// during persistAuthAndNavigate and rehydrated from localStorage on the
// next page load). Falls back to localStorage via `readStoredUser` so a
// stale rehydration that hasn't yet round-tripped through the context
// still gets the right answer.
//
// Admins are exempt from the verified check because they are provisioned
// directly in the DB (per the schema reference) and bypass the role-request
// flow. The Admin route guard (useAdminGuard) handles role-based gating
// separately.

export const useVerifiedGuard = () => {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Not logged in at all — PrivateRoute covers this, but be defensive
    // in case the guard is mounted standalone.
    if (!isAuthenticated) {
      navigate(ROUTES.LOGIN, { replace: true });
      return;
    }

    // Admins are provisioned in the DB and never go through the role-request
    // lifecycle. Honour that even if `isActive` somehow reads as false.
    const stored = readStoredUser();
    if (isAdminUser({ roleName: user?.role ?? stored?.roleName ?? null, roleId: stored?.roleId ?? null })) {
      return;
    }

    const isActive = user?.isActive ?? stored?.isActive ?? true;
    if (isActive) return;

    // Land them on /forum with replace so the back button doesn't trap
    // them in a redirect loop.
    navigate(ROUTES.FORUM, { replace: true });
  }, [user, isAuthenticated, navigate]);
};

export default useVerifiedGuard;
