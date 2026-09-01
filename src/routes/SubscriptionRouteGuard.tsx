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

import { Navigate, Outlet } from 'react-router-dom';
import { useSubscription } from '../hooks/useSubscription';
import { ROUTES } from './paths';

export const SubscriptionRouteGuard = () => {
  const { isApplicable, isActive, isLoading } = useSubscription();

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
