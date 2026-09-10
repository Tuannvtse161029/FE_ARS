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

// Module-level shared subscription cache & in-flight promise to avoid
// duplicate network fetches and prevent false-positive lockout redirects
// across route transitions.
let memoryCache: CurrentAnnualFeeSubscription | null | undefined = undefined;
let cachedUserId: number | string | null = null;
let inFlightPromise: Promise<CurrentAnnualFeeSubscription | null> | null = null;
const subscribers = new Set<() => void>();

export const clearSubscriptionCache = (): void => {
  memoryCache = undefined;
  cachedUserId = null;
  inFlightPromise = null;
  subscribers.forEach((notify) => notify());
};

export const useSubscription = (): UseSubscriptionResult => {
  const { user, effectiveRole } = useAuth();

  const currentUserId = user?.userId ?? user?.email ?? null;

  // Invalidate cache if user changes
  if (currentUserId !== cachedUserId) {
    memoryCache = undefined;
    cachedUserId = currentUserId;
    inFlightPromise = null;
  }

  const role: UserRole | null =
    (effectiveRole as UserRole | null) ??
    (typeof user?.role === 'string' && user.role.length > 0
      ? (user.role as UserRole)
      : Array.isArray(user?.roles) && user.roles.length > 0
        ? (user.roles[0] as UserRole)
        : null);

  const isApplicable = role !== null && SUBSCRIBED_ROLES.has(role);

  const [current, setCurrent] = useState<CurrentAnnualFeeSubscription | null>(
    memoryCache !== undefined ? memoryCache : null,
  );
  // If role is applicable and we don't have a cached value yet, we MUST start in loading state
  // so route guards do not prematurely redirect before the initial fetch completes.
  const [isLoading, setIsLoading] = useState<boolean>(() => {
    if (!isApplicable) return false;
    return memoryCache === undefined;
  });
  const [error, setError] = useState<Error | null>(null);

  // Sync component state when module memoryCache changes from any subscriber
  useEffect(() => {
    const onCacheUpdate = () => {
      if (memoryCache !== undefined) {
        setCurrent(memoryCache);
        setIsLoading(false);
      }
    };
    subscribers.add(onCacheUpdate);
    return () => {
      subscribers.delete(onCacheUpdate);
    };
  }, []);

  const refetch = useCallback(async (): Promise<void> => {
    if (!isApplicable) {
      memoryCache = null;
      setCurrent(null);
      setError(null);
      setIsLoading(false);
      return;
    }

    // If there is already a fetch in flight, await it
    if (inFlightPromise) {
      try {
        const existing = await inFlightPromise;
        setCurrent(existing);
        setIsLoading(false);
        return;
      } catch (err) {
        // Continue to fresh fetch below if previous failed
      }
    }

    setIsLoading(true);
    setError(null);

    const fetchTask = annualFeeService
      .getMyCurrentSubscription()
      .then((subscription) => {
        const normalized = subscription ?? null;
        memoryCache = normalized;
        setCurrent(normalized);
        setError(null);
        subscribers.forEach((notify) => notify());
        return normalized;
      })
      .catch((caught) => {
        const err =
          caught instanceof Error
            ? caught
            : new Error('Failed to load subscription state.');
        memoryCache = null;
        setCurrent(null);
        setError(err);
        throw err;
      })
      .finally(() => {
        inFlightPromise = null;
        setIsLoading(false);
      });

    inFlightPromise = fetchTask;

    try {
      await fetchTask;
    } catch {
      // Handled in catch block above
    }
  }, [isApplicable]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  /**
   * isExpired — derive from BE flag first; fall back to client date math.
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
  // Lecturer retain full access.
  const isActive = useMemo<boolean>(() => {
    if (!AppConfig.features.enableSubscriptionAccess) return true;
    if (!isApplicable) return true;
    return current != null && !isExpired;
  }, [isApplicable, current, isExpired]);

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
