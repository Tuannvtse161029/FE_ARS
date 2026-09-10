// useSubscription — single source of truth for the current user's
// annual-fee subscription state.
//
// Responsibilities:
//   • Decide whether the subscription gate applies to the current user
//     (Researcher or Lecturer only).
//   • Fetch the BE's authoritative subscription snapshot on mount via
//     `annualFeeService.getMyCurrentSubscription()` and expose a `refetch`
//     so callers can re-sync after PayOS returns.
//   • Derive `isActive` from the BE response (status + `daysRemaining`)
//     — never trust the cached blob alone.
//   • Surface normal network errors so pages render the documented
//     error banner instead of pretending the API works.
//
// Admins, Reviewers, Graduate Students, and Guests are never blocked by
// this hook — `isApplicable` returns `false` for them and `isActive`
// stays `true` so existing guards do not change behavior.
//
// TEMPORARY DISABLED STATE: when `AppConfig.features.enableSubscriptionAccess`
// is `false`, `isActive` always returns `true` so Researcher and Lecturer
// retain full access. See `src/config/app.ts` for the feature flag.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import type { UserRole } from '../types/auth';
import { annualFeeService } from '../services/annualFee.service';
import type { CurrentAnnualFeeSubscription } from '../types/annualFee';
import { AppConfig } from '../config/app';

export interface UseSubscriptionResult {
  /** Initial subscription fetch in flight. */
  isLoading: boolean;
  /** Network / parse error from the BE. */
  error: Error | null;
  /** Whether the subscription gate applies to the current user's role. */
  isApplicable: boolean;
  /** True only when the user has an ACTIVE subscription that has not expired. */
  isActive: boolean;
  /**
   * Whether the subscription is expired.
   *
   * Trust the BE's `isExpired` flag first. When that is absent (e.g. older BE
   * or test mock), fall back to client-side date math using:
   *   1. `expiresAt` — the new canonical field from `UserSubscriptions`
   *      (the BE migrated `ExpiresAt` here from the `User` / purchase row).
   *   2. `purchase?.expiryDate` — the legacy field; retained for backward
   *      compatibility when the BE still returns a purchase row.
   *
   * Both date reads are guarded against null/undefined so this never crashes
   * even when `purchase` is `null` or the date field is absent.
   */
  isExpired: boolean;
  /** True when the BE returned no subscription at all. */
  isMissing: boolean;
  /** Force a refetch (e.g. after PayOS returns). */
  refetch: () => Promise<void>;
  /** Latest BE-derived subscription snapshot, or null when none. */
  current: CurrentAnnualFeeSubscription | null;
}

const SUBSCRIBED_ROLES: ReadonlySet<UserRole> = new Set([
  'Researcher',
  'Lecturer',
]);

export const useSubscription = (): UseSubscriptionResult => {
  const { user, effectiveRole } = useAuth();

  const role: UserRole | null =
    (effectiveRole as UserRole | null) ??
    (typeof user?.role === 'string' && user.role.length > 0
      ? (user.role as UserRole)
      : null);

  const isApplicable = role !== null && SUBSCRIBED_ROLES.has(role);

  const [current, setCurrent] = useState<CurrentAnnualFeeSubscription | null>(
    null,
  );
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
      const subscription =
        await annualFeeService.getMyCurrentSubscription();
      setCurrent(subscription ?? null);
    } catch (caught) {
      setCurrent(null);
      setError(
        caught instanceof Error
          ? caught
          : new Error('Failed to load subscription state.'),
      );
    } finally {
      setIsLoading(false);
    }
  }, [isApplicable]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  /**
   * isExpired — derive from BE flag first; fall back to client date math.
   *
   * The BE migrated `ExpiresAt` from `User` / `AnnualFeePurchase` onto the
   * `UserSubscriptions` row surfaced as `expiresAt` in the
   * `MySubscriptionResponse`. Read that field as the canonical signal.
   * The legacy `purchase?.expiryDate` is kept as a backward-compat fallback.
   */
  const isExpired = useMemo<boolean>(() => {
    if (!current) return false;
    // BE-authoritative flag always wins.
    if (current.isExpired) return true;
    // Primary: expiresAt from UserSubscriptions (the new canonical location).
    const expiresAt = current.expiresAt ?? current.purchase?.expiryDate ?? null;
    if (expiresAt) {
      return Date.parse(expiresAt) <= Date.now();
    }
    return false;
  }, [current]);

  const isMissing = !current;

  // When the feature flag is off, always return `true` so Researcher and
  // Lecturer retain full access. This covers both SubscriptionRouteGuard
  // (redirect) and SubscriptionAccessGuard (locked fallback) without
  // requiring changes to either.
  const isActive = useMemo<boolean>(() => {
    if (!AppConfig.features.enableSubscriptionAccess) return true;
    return !isApplicable || (current != null && !current.isExpired);
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
