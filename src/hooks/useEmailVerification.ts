// useEmailVerification hook — Agent email-verification.
//
// Drives the deep-link landing page that fires after a user clicks the
// verification link in their registration email. The hook is intentionally
// conservative:
//
//   • It calls `emailVerificationService.verifyEmailToken` EXACTLY ONCE
//     per `(token, status)` pair, even under React 18 StrictMode (which
//     double-invokes effects in development) or a route re-mount.
//   • It tracks in-flight status so a second mount (e.g. from a back-
//     button + forward-button navigation) cannot race the first call.
//   • It surfaces BE errors in a stable shape so the page can render the
//     `EmailVerificationLanding` UI without depending on axios details.
//
// It does NOT store the OTP/token anywhere; the token is captured by
// closure inside the hook's `verify` callback and dropped on completion.

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  emailVerificationService,
  isVerifyEmailToken,
  type VerifyEmailResult,
} from '../services/emailVerification.service';

export type EmailVerificationStatus =
  | 'idle'
  | 'verifying'
  | 'verified'
  | 'invalid_token'
  | 'expired'
  | 'network_error'
  | 'server_error';

export interface EmailVerificationState {
  status: EmailVerificationStatus;
  /** True while a verify-email call is in-flight. */
  isVerifying: boolean;
  /**
   * True after the hook has fired its first call for the supplied token.
   * Useful for tests and for the page to avoid re-triggering an effect.
   */
  hasAttempted: boolean;
  /** Human-readable error message from the BE, if any. */
  errorMessage: string | null;
}

export interface UseEmailVerificationApi {
  state: EmailVerificationState;
  /**
   * Manually re-trigger verification. Safe to call repeatedly — the hook
   * dedupes while a previous call is in-flight.
   */
  verify: (token: string) => Promise<VerifyEmailResult | null>;
  /** Clear the last error / status so the UI can re-attempt. */
  reset: () => void;
}

const INITIAL_STATE: EmailVerificationState = {
  status: 'idle',
  isVerifying: false,
  hasAttempted: false,
  errorMessage: null,
};

/**
 * Categorise a thrown error from the BE into a stable UI status.
 * The mapping is intentionally minimal — anything we cannot classify
 * falls back to `server_error` so the page can render a generic retry
 * surface instead of crashing on an unmapped axios shape.
 */
function classifyError(err: unknown): {
  status: Exclude<EmailVerificationStatus, 'idle' | 'verifying' | 'verified'>;
  message: string;
} {
  const fallback = 'We could not verify your email. Please try again.';
  if (!err || typeof err !== 'object') {
    return { status: 'server_error', message: fallback };
  }
  const maybeAxios = err as {
    response?: { status?: number; data?: { message?: unknown } };
    message?: string;
  };
  const httpStatus = maybeAxios.response?.status;
  const beMessage =
    typeof maybeAxios.response?.data?.message === 'string'
      ? maybeAxios.response.data.message
      : typeof maybeAxios.message === 'string'
        ? maybeAxios.message
        : null;

  if (httpStatus === 400 || httpStatus === 404 || httpStatus === 422) {
    return {
      status: 'expired',
      message: beMessage ?? 'This verification link is invalid or has expired.',
    };
  }
  if (httpStatus === 401 || httpStatus === 403) {
    return {
      status: 'invalid_token',
      message: beMessage ?? 'This verification link is not authorized.',
    };
  }
  if (typeof httpStatus === 'number' && httpStatus >= 500) {
    return {
      status: 'server_error',
      message: beMessage ?? fallback,
    };
  }
  // No HTTP response — network error / offline.
  if (!httpStatus) {
    return {
      status: 'network_error',
      message: beMessage ?? 'Network error. Please check your connection.',
    };
  }
  return {
    status: 'server_error',
    message: beMessage ?? fallback,
  };
}

export function useEmailVerification(): UseEmailVerificationApi {
  const [state, setState] = useState<EmailVerificationState>(INITIAL_STATE);

  // In-flight dedupe. Survives StrictMode double-invokes and rapid
  // re-mounts because the ref is bound to the hook closure, not to the
  // effect lifecycle.
  const inFlightRef = useRef<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const verify = useCallback(
    async (rawToken: string): Promise<VerifyEmailResult | null> => {
      const token = (rawToken ?? '').trim();
      if (!isVerifyEmailToken(token)) {
        setState({
          status: 'invalid_token',
          isVerifying: false,
          hasAttempted: true,
          errorMessage: 'This verification link is malformed.',
        });
        return null;
      }
      // Dedup: while a request for this exact token is in-flight, drop
      // the second call. Same token + different request is not possible
      // because the BE rejects duplicates anyway.
      if (inFlightRef.current === token) {
        return null;
      }
      inFlightRef.current = token;
      setState((prev) => ({
        ...prev,
        status: 'verifying',
        isVerifying: true,
        errorMessage: null,
      }));
      try {
        const result = await emailVerificationService.verifyEmailToken(token);
        if (!mountedRef.current) return result;
        setState({
          status: 'verified',
          isVerifying: false,
          hasAttempted: true,
          errorMessage: null,
        });
        return result;
      } catch (err) {
        if (!mountedRef.current) return null;
        const { status, message } = classifyError(err);
        setState({
          status,
          isVerifying: false,
          hasAttempted: true,
          errorMessage: message,
        });
        return null;
      } finally {
        inFlightRef.current = null;
      }
    },
    [],
  );

  const reset = useCallback(() => {
    setState(INITIAL_STATE);
    inFlightRef.current = null;
  }, []);

  return { state, verify, reset };
}

export default useEmailVerification;
