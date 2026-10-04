import { useRef } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { DelayedLoadingOverlay } from '../components/DelayedLoadingOverlay';
import { ROUTES } from './paths';
import { resolvePostAuthRoute, type PostAuthSnapshot } from '../utils/postAuthRoute';

export const PrivateRoute = () => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <DelayedLoadingOverlay isLoading label="Verifying session..." />;
  }

  return isAuthenticated ? <Outlet /> : <Navigate to={ROUTES.LOGIN} replace />;
};

export const PublicRoute = () => {
  const { user, isAuthenticated, isLoading, effectiveRole, handleSessionFailure } = useAuth();
  const location = useLocation();

  // Loop guard: if `resolvePostAuthRoute` returns the very route the
  // visitor is already on (e.g. /login ↔ /login because the snapshot
  // is malformed and falls through to Priority 4), React will keep
  // mounting PublicRoute, <Navigate replace> will fire, the URL won't
  // change, and the user sees a permanently blank page. Track how
  // many times we have bounced to the same path within this mount of
  // PublicRoute and, on the second bounce, treat the session as
  // unrecoverable: clear it via handleSessionFailure() and render the
  // <Outlet /> so the login form actually mounts.
  const bounceCountRef = useRef(0);
  const lastDestinationRef = useRef<string | null>(null);

  if (isLoading) {
    return <DelayedLoadingOverlay isLoading label="Loading..." />;
  }

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

  // Loop guard: if the destination is the same path the user is already
  // on, redirecting again will produce no URL change. This typically
  // happens for malformed persisted sessions (Priority 4 → /login) or
  // a `/login` user whose snapshot incorrectly reports them as
  // authenticated. In either case, the session is unusable — clear it
  // and render the public <Outlet /> so the login form mounts.
  const destinationMatchesCurrentPath =
    destination === location.pathname ||
    (destination === ROUTES.LOGIN && location.pathname === ROUTES.LOGIN);

  if (destinationMatchesCurrentPath) {
    bounceCountRef.current += 1;
    if (bounceCountRef.current > 1 && lastDestinationRef.current === destination) {
      // eslint-disable-next-line no-console
      console.warn(
        '[PublicRoute] Bounce loop detected on',
        location.pathname,
        '— clearing session and rendering public outlet.',
        { snapshot, destination },
      );
      handleSessionFailure();
      // Return the outlet immediately. The state update from
      // handleSessionFailure will flip isAuthenticated to false on the
      // next render, after which the top-level `if (!isAuthenticated)`
      // branch takes over and continues to render the outlet.
      return <Outlet />;
    }
  } else {
    // Destination is a different route — reset the bounce counter so
    // a future legitimate snapshot fallback to the same path on a
    // later render does not immediately trip the guard.
    bounceCountRef.current = 0;
  }
  lastDestinationRef.current = destination;

  return <Navigate to={destination} replace />;
};

export default PrivateRoute;