// SubscriptionAccessGuard — wraps protected Researcher / Lecturer routes
// and components to enforce the paid-subscription gate.
//
// Renders one of three children based on the current user's subscription
// state:
//
//   1. `children`         — when the user is allowed in (no role match,
//                            or subscription ACTIVE AND not expired).
//   2. `lockedFallback`   — when the gate applies but the subscription
//                            is missing, inactive, or expired. The
//                            fallback should explain the lock and link
//                            to /subscription.
//   3. `loadingFallback`  — while the initial subscription fetch is in
//                            flight (default: a neutral spinner).
//
// The guard is intentionally explicit — it never silently renders the
// children while locked, so a Researcher / Lecturer never sees a hidden
// empty workspace. The route-level wrapper (`SubscriptionRouteGuard`)
// redirects locked users to /subscription instead of rendering the
// fallback inline.

import type { ReactNode } from 'react';
import { useSubscription } from '../../hooks/useSubscription';

export interface SubscriptionAccessGuardProps {
  children: ReactNode;
  /** Inline fallback for locked state. Use `SubscriptionLockedState` for the default. */
  lockedFallback?: ReactNode;
  /** Spinner / placeholder rendered while the initial fetch is in flight. */
  loadingFallback?: ReactNode;
}

export const SubscriptionLockedState = ({
  redirectPath = '/subscription',
}: {
  redirectPath?: string;
}) => (
  <div
    role="alert"
    data-component="SubscriptionLockedState"
    style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-3)',
      maxWidth: 560,
      margin: 'var(--space-8) auto',
      padding: 'var(--space-6)',
      border: '1px solid var(--status-warning-border, var(--border-strong))',
      borderRadius: 'var(--radius-md, 4px)',
      background:
        'var(--status-warning-bg, var(--surface-paper-muted))',
      color: 'var(--status-warning-text, var(--ink-primary))',
    }}
  >
    <h2 style={{ margin: 0 }}>Your ARS subscription is inactive or has expired.</h2>
    <p style={{ margin: 0 }}>
      Renew your subscription to continue using Researcher / Lecturer features.
    </p>
    <a
      href={redirectPath}
      style={{
        alignSelf: 'flex-start',
        display: 'inline-block',
        padding: 'var(--space-2) var(--space-4)',
        border: '1px solid var(--ars-blue-action, #007AFF)',
        borderRadius: 'var(--radius-sm, 4px)',
        background: 'transparent',
        color: 'var(--ars-blue-action, #007AFF)',
        fontWeight: 'var(--font-weight-semibold, 600)',
        textDecoration: 'none',
      }}
    >
      View subscription plans
    </a>
  </div>
);

const defaultLoading = (
  <div
    role="status"
    aria-live="polite"
    style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '40vh',
      color: 'var(--ars-ink-muted, #64748b)',
      fontSize: 'var(--font-size-sm, 0.875rem)',
    }}
  >
    Checking subscription…
  </div>
);

export const SubscriptionAccessGuard = ({
  children,
  lockedFallback,
  loadingFallback,
}: SubscriptionAccessGuardProps) => {
  const { isApplicable, isActive, isLoading } = useSubscription();

  if (!isApplicable) {
    return <>{children}</>;
  }

  if (isLoading) {
    return <>{loadingFallback ?? defaultLoading}</>;
  }

  if (!isActive) {
    return <>{lockedFallback ?? <SubscriptionLockedState />}</>;
  }

  return <>{children}</>;
};

export default SubscriptionAccessGuard;
