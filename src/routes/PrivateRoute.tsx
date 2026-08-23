import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ROUTES } from './paths';
import { resolvePostAuthRoute, type PostAuthSnapshot } from '../utils/postAuthRoute';

export const PrivateRoute = () => {
  const { isAuthenticated } = useAuth();

  return isAuthenticated ? <Outlet /> : <Navigate to={ROUTES.LOGIN} replace />;
};

// Agent 30 — Route authenticated users to their role-appropriate landing
// page through the centralized `resolvePostAuthRoute` helper. This used to
// hard-code ROUTES.FORUM here (sending Admin users to /forum instead of
// /admin, see Phase C defect 3A) AND silently routed first-time Google
// users to /forum (bypassing the /complete-google-registration onboarding
// page that `AuthContext.loginWithGoogle` was in the middle of pushing
// them to). The unified resolver now applies the same priority rule
// across every auth entry path so a freshly-logged-in user never lands
// on /forum before they have completed onboarding.
//
// The previous behaviour (defect 3A fix) is preserved — an Admin who
// opens a stale /login tab lands on /admin, not /forum. The new behaviour
// (Agent 30) is additive — a first-time Google user lands on
// /complete-google-registration instead of /forum, even when the
// `PublicRoute` re-renders during the in-flight login transition.
export const PublicRoute = () => {
  const { user, isAuthenticated, effectiveRole } = useAuth();

  if (!isAuthenticated) return <Outlet />;

  // Build the snapshot the centralized resolver expects. We intentionally
  // forward `effectiveRole` so the derived Guest branch fires for users
  // whose account is still pending Admin approval — exactly what the
  // `AuthContext.loginWithGoogle` first-time branch writes into the
  // store. This makes `PublicRoute` honour the priority:
  //   1. onboarding (role-null + roleId-null) → /complete-google-registration
  //   2. approved Admin                     → /admin
  //   3. approved non-Admin                 → /forum
  //   4. pending / unverified / Guest       → /forum (as Guest)
  const snapshot: PostAuthSnapshot = {
    role: user?.role ?? null,
    roleId: user?.roleId ?? null,
    isActive: user?.isActive ?? null,
    verificationStatus: user?.verificationStatus ?? null,
    effectiveRole: (effectiveRole ?? null) as PostAuthSnapshot['effectiveRole'],
  };

  return <Navigate to={resolvePostAuthRoute(snapshot)} replace />;
};

export default PrivateRoute;