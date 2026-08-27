import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ROUTES } from './paths';
import { resolvePostAuthRoute, type PostAuthSnapshot } from '../utils/postAuthRoute';

export const PrivateRoute = () => {
  const { isAuthenticated } = useAuth();

  return isAuthenticated ? <Outlet /> : <Navigate to={ROUTES.LOGIN} replace />;
};

export const PublicRoute = () => {
  const { user, isAuthenticated, effectiveRole } = useAuth();
  const location = useLocation();

  // If the user is unauthenticated OR is explicitly on an auth action route,
  // do NOT intercept and redirect them.
  const isAuthActionPath =
    location.pathname === ROUTES.REGISTER ||
    location.pathname === ROUTES.VERIFY_EMAIL ||
    location.pathname === ROUTES.FORGOT_PASSWORD ||
    location.pathname === ROUTES.VERIFY_OTP ||
    location.pathname === ROUTES.RESET_PASSWORD;

  if (!isAuthenticated || isAuthActionPath) return <Outlet />;

  // Build the snapshot the centralized resolver expects. We forward
  // every BE-derived routing signal we have on the persisted user blob so
  // a freshly-logged-in first-time Google user can be routed to the
  // onboarding page WITHOUT a second `GET /api/User/{id}` round-trip
  // (Agent 30 follow-up correction — see `utils/postAuthRoute.ts`).
  //
  // The resolver applies the exact priority:
  //   1. isNewUser===true AND requiresOnboarding===true
  //      AND effectiveRole===null AND approved role list empty
  //      → /complete-google-registration
  //   2. approved + active + known role → /admin or /forum
  //   3. submitted pending → /forum as Guest
  //   4. malformed snapshot → /login
  //
  // `user.roles` is the BE-returned `AuthResponse.roles` list. The auth
  // context mirrors it onto the persisted user record (see
  // `authStore.user.roles` and the `value.user.roles` forwarding in
  // `context/AuthContext.tsx`), so it MUST be forwarded here — without
  // it the exact priority would reduce to the looser three-condition
  // form and an explicit-onboarding-signal user who already has an
  // accepted role would be silently sent to /complete-google-registration
  // instead of the workspace.
  const snapshot: PostAuthSnapshot = {
    role: user?.role ?? null,
    roleId: user?.roleId ?? null,
    isActive: user?.isActive ?? null,
    verificationStatus: user?.verificationStatus ?? null,
    effectiveRole: (effectiveRole ?? null) as PostAuthSnapshot['effectiveRole'],
    isNewUser: user?.isNewUser ?? null,
    requiresOnboarding: user?.requiresOnboarding ?? null,
    approvedRoles: user?.roles ?? null,
  };

  const destination = resolvePostAuthRoute(snapshot);

  if (import.meta.env?.DEV) {
    // eslint-disable-next-line no-console
    console.info('[PublicRoute:diag] Authenticated user redirect', {
      snapshot,
      destination,
    });
  }

  return <Navigate to={destination} replace />;
};

export default PrivateRoute;