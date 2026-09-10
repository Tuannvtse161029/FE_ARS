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
import { Loader, AlertTriangle } from 'lucide-react';
import { useSubscription } from '../hooks/useSubscription';
import { ROUTES } from './paths';

export const SubscriptionRouteGuard = () => {
  const { isApplicable, isActive, isLoading, error, current, refetch } = useSubscription();

  // Re-sync on mount if no cached snapshot is present
  useEffect(() => {
    if (!isApplicable) return;
    void refetch();
  }, [isApplicable, refetch]);

  if (!isApplicable) {
    return <Outlet />;
  }

  // 1. Loading state check MUST precede redirect check.
  // Never redirect while subscription status is still indeterminate.
  if (isLoading) {
    return (
      <div
        role="status"
        aria-live="polite"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '60vh',
          gap: 'var(--space-3, 12px)',
          color: 'var(--ars-ink-muted, #64748b)',
          fontSize: 'var(--font-size-sm, 0.875rem)',
        }}
      >
        <Loader
          size={24}
          style={{
            animation: 'spin 1s linear infinite',
            color: 'var(--ars-yellow-accent, #f6ad55)',
          }}
          aria-hidden
        />
        <span>Checking subscription…</span>
      </div>
    );
  }

  // 2. Network error recovery: do not kick active users out on transient network error.
  if (error && !current) {
    return (
      <div
        role="alert"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '50vh',
          gap: 'var(--space-4, 16px)',
          padding: 'var(--space-6, 24px)',
          textAlign: 'center',
        }}
      >
        <AlertTriangle size={36} color="var(--ars-amber-warning, #f59e0b)" aria-hidden />
        <h2 style={{ fontSize: 'var(--font-size-lg, 1.125rem)', fontWeight: 600, margin: 0 }}>
          Unable to verify subscription
        </h2>
        <p style={{ color: 'var(--ars-ink-muted, #64748b)', maxWidth: 460, margin: 0 }}>
          We could not verify your subscription status due to a connection error. Please try again.
        </p>
        <button
          type="button"
          onClick={() => void refetch()}
          style={{
            padding: '8px 20px',
            backgroundColor: 'var(--ars-yellow-accent, #f6ad55)',
            border: 'none',
            borderRadius: '4px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  // 3. Subscription confirmed missing or expired: redirect to subscription page.
  if (!isActive) {
    return <Navigate to={ROUTES.SUBSCRIPTION} replace />;
  }

  return <Outlet />;
};

export default SubscriptionRouteGuard;
