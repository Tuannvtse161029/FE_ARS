// SubscriptionRouteGuard — route-level wrapper that redirects locked
// Researcher / Lecturer users to /subscription instead of rendering a
// locked-state component inline.
//
// Pairs with `RoleRouteGuard` and `PrivateRoute`:
//
//   <Route element={<RoleRouteGuard allow={['Researcher']} />}>
//     <Route element={<SubscriptionRouteGuard />}>
//       <Route path={ROUTES.RESEARCHER_SUBMISSIONS} element={...} />
//     </Route>
//   </Route>
//
// Admin / Reviewer / Graduate Student / Guest are never redirected here.
//
// IMPORTANT: this guard calls `refetch()` on mount so it never reads a
// stale `null` (e.g. when the user lands here after PayOS returns, or
// after the page re-mounts following a logout/login cycle). The guard
// must never redirect while the BE answer is still in flight — doing
// so sends an active subscriber back to /subscription on every page
// load. `isLoading` is checked BEFORE `!isActive` so the redirect
// decision only fires once we know the user is actually locked out.

import { useEffect } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useSubscription } from '../hooks/useSubscription';
import { ROUTES } from './paths';

export const SubscriptionRouteGuard = () => {
  const { isApplicable, isActive, isLoading, refetch } = useSubscription();

  // Always re-sync on mount so a fresh page load (and especially the
  // Post-PayOS return) never reads a stale "no subscription" cached
  // state. Without this, a user with an active subscription who lands
  // on a guarded route before the hook's mount effect finishes can
  // get bounced to /subscription despite having paid.
  useEffect(() => {
    if (!isApplicable) return;
    void refetch();
  }, [isApplicable, refetch]);

  if (!isApplicable) {
    return <Outlet />;
  }

  if (isLoading) {
    return (
      <div
        role="status"
        aria-live="polite"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '60vh',
          color: 'var(--ars-ink-muted, #64748b)',
          fontSize: 'var(--font-size-sm, 0.875rem)',
        }}
      >
        Checking subscription…
      </div>
    );
  }

  if (!isActive) {
    return <Navigate to={ROUTES.SUBSCRIPTION} replace />;
  }

  return <Outlet />;
};

export default SubscriptionRouteGuard;
