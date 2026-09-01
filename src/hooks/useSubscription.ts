// useSubscription — single source of truth for the current user's
// subscription state.
//
// Responsibilities:
//   • Decide whether the subscription gate applies to the current user
//     (Researcher or Lecturer only).
//   • Fetch the BE's authoritative subscription snapshot on mount and
//     expose a `refetch` so callers can re-sync after PayOS returns.
//   • Derive `isActive` from the BE status AND an in-the-future
//     `expiresAt` — never trust the cached blob alone.
//   • Surface a stable, typed `SubscriptionBackendUnavailableError` so
//     pages render the documented banner instead of pretending the API
//     works.
//
// Admins, Reviewers, Graduate Students, and Guests are never blocked by
// this hook — `isApplicable` returns `false` for them and `isActive`
// stays `true` so existing guards do not change behavior.
//
// TEMPORARY DISABLED STATE: when `AppConfig.features.enableSubscriptionAccess`
// is `false`, `isActive` always returns `true` so Researcher and Lecturer
// retain full access. See `src/config/app.ts` for the feature flag.
//
// The backend ticket at `docs/BACKEND_ANNUAL_SUBSCRIPTION_API_TICKET.md`
// tracks the work required before this feature can be re-enabled.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import type { UserRole } from '../types/auth';
import { subscriptionService } from '../services/subscription.service';
import type { UserSubscription } from '../types/subscription';
import { SubscriptionBackendUnavailableError } from '../types/subscription';
import { AppConfig } from '../config/app';

export interface UseSubscriptionResult {
  /** Initial subscription fetch in flight. */
  isLoading: boolean;
  /** Network / parse error, or a typed `SubscriptionBackendUnavailableError`. */
  error: Error | null;
  /** Whether the subscription gate applies to the current user's role. */
  isApplicable: boolean;
  /** True only when the user has an ACTIVE subscription that has not expired. */
  isActive: boolean;
  /** True when the user has a subscription row but it is past `expiresAt`. */
  isExpired: boolean;
  /** True when the BE returned no subscription at all. */
  isMissing: boolean;
  /** Force a refetch (e.g. after PayOS returns). */
  refetch: () => Promise<void>;
  /** Latest BE-derived subscription snapshot, or null when none. */
  current: UserSubscription | null;
}

const SUBSCRIBED_ROLES: ReadonlySet<UserRole> = new Set([
  'Researcher',
  'Lecturer',
]);

const isInFuture = (iso: string | undefined | null): boolean => {
  if (!iso) return false;
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return false;
  return ts > Date.now();
};

export const useSubscription = (): UseSubscriptionResult => {
  const { user, effectiveRole } = useAuth();

  const role: UserRole | null =
    (effectiveRole as UserRole | null) ??
    (typeof user?.role === 'string' && user.role.length > 0
      ? (user.role as UserRole)
      : null);

  const isApplicable = role !== null && SUBSCRIBED_ROLES.has(role);

  const [current, setCurrent] = useState<UserSubscription | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  const refetch = useCallback(async (): Promise<void> => {
    if (!isApplicable) {
      // Non-applicable roles always see an active gate (lockout-safe
      // default that does not change behavior for Admin / Reviewer /
      // Graduate Student / Guest).
      setCurrent(null);
      setError(null);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const subscription = await subscriptionService.getCurrentSubscription();
      if (!subscription) {
        setCurrent(null);
      } else {
        setCurrent(subscription);
      }
    } catch (caught) {
      if (caught instanceof SubscriptionBackendUnavailableError) {
        setError(caught);
        setCurrent(null);
      } else {
        const wrapped =
          caught instanceof Error
            ? caught
            : new Error('Failed to load subscription state.');
        setError(wrapped);
        setCurrent(null);
      }
    } finally {
      setIsLoading(false);
    }
  }, [isApplicable]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const isExpired = useMemo<boolean>(() => {
    if (!current) return false;
    if (current.status === 'EXPIRED') return true;
    if (current.status !== 'ACTIVE') return false;
    return !isInFuture(current.expiresAt);
  }, [current]);

  const isMissing = !current;

  // When the feature flag is off, always return `true` so Researcher and
  // Lecturer retain full access. This covers both SubscriptionRouteGuard
  // (redirect) and SubscriptionAccessGuard (locked fallback) without
  // requiring changes to either.
  const isActive = useMemo<boolean>(() => {
    if (!AppConfig.features.enableSubscriptionAccess) return true;
    return !isApplicable || (current?.status === 'ACTIVE' && isInFuture(current.expiresAt));
  }, [isApplicable, current]);

  return {
    isLoading,
    error,
    isApplicable,
    isActive,
    isExpired,
    isMissing,
    refetch,
    current,
  };
};

export default useSubscription;
