import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ROUTES } from '../routes/paths';

// Sends unverified users (`isActive !== true`) to /forum. Used by every
// private route except /forum so a freshly-registered user landing on
// /dashboard, /papers, etc. gets bounced to the only page they have
// read-only access to.
//
// Reads `isActive` from the auth store (which is populated by AuthContext
// during persistAuthAndNavigate and rehydrated from localStorage on the
// next page load). Falls back to localStorage the same way useAdminGuard
// does so a stale rehydration that hasn't yet round-tripped through the
// context still gets the right answer.
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

    // Pull isActive from the store (or storage as a fallback during the
    // rehydration window). Both signals come from the same `User.isActive`
    // field; using the store first keeps the guard reading the live state.
    const stored = (() => {
      try {
        const raw =
          localStorage.getItem('ars_user') || sessionStorage.getItem('ars_user');
        return raw ? (JSON.parse(raw) as { isActive?: boolean }) : null;
      } catch {
        return null;
      }
    })();

    const isActive = user?.isActive ?? stored?.isActive ?? true;

    // Admins are exempt: they're provisioned in the DB and have no
    // role-request lifecycle. Their isActive signal from the BE should be
    // true, but we also short-circuit on the roleName to handle the case
    // where the BE hasn't yet shipped isActive at all.
    const isAdmin = user?.role === 'Admin';
    if (isActive || isAdmin) {
      return;
    }

    // Land them on /forum with replace so the back button doesn't trap
    // them in a redirect loop.
    navigate(ROUTES.FORUM, { replace: true });
  }, [user, isAuthenticated, navigate]);
};

export default useVerifiedGuard;
