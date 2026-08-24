// Google sign-in button.
//
// The agreed FE ↔ BE contract is the GIS credential flow:
//   1. The user clicks "Sign in with Google".
//   2. `useGoogleIdentity` renders the official Google button and wires the
//      GIS `callback` to the supplied `onCredential` handler.
//   3. The handler POSTs the opaque `credential` to `POST /api/Auth/google-login`
//      via `googleAuthService.postGoogleLogin`. The BE validates the Google
//      ID token, finds or creates the ARS user, and returns the ARS session.
//
// For backwards compatibility the deprecated Authorization Code redirect
// flow (`onBegin` + `pending`) is still accepted — see `Login.googleOAuth` and
// `GoogleCallback`. New code should always prefer the credential mode.

import { useEffect } from 'react';
import { Button } from '../../components/Button';
import { GoogleIcon } from '../../assets/icons/GoogleIcon';
import { useGoogleIdentity } from '../../hooks/useGoogleIdentity';
import { isGoogleLoginInFlight } from '../../utils/googleLoginGuard';
import styles from './GoogleSignInButton.module.css';

export interface GoogleSignInButtonProps {
  /**
   * Credential flow — receives the GIS `CredentialResponse`. The caller MUST
   * POST `response.credential` exactly once to `/api/Auth/google-login`. When
   * this prop is provided the component renders the official Google button
   * (powered by `useGoogleIdentity`).
   */
  onCredential?: (response: import('../../types/googleAuth').GoogleCredentialResponse) => void;
  /** Called when the user dismisses the GIS popup without picking an account. */
  onCancel?: () => void;
  /** Disable interaction (e.g. while a submission is in flight). */
  disabled?: boolean;
  /** Optional override of the visible label. Defaults to "Sign in with Google". */
  label?: string;
  /** Optional error message slot, used when OAuth cannot be started. */
  errorMessage?: string | null;
  /**
   * @deprecated Authorization Code flow handler. Retained for the legacy
   * Login redirect path; new surfaces should use `onCredential`.
   */
  onBegin?: () => void;
  /** @deprecated Authorization Code flow in-flight flag. */
  pending?: boolean;
  /**
   * Optional button UX overrides forwarded to `useGoogleIdentity`.
   * Only applies to the credential flow (`onCredential` provided).
   */
  buttonOptions?: {
    type?: 'standard' | 'icon';
    theme?: 'outline' | 'filled_blue' | 'filled_black';
    size?: 'large' | 'medium' | 'small';
    text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
    shape?: 'rectangular' | 'pill' | 'circle' | 'square';
  };
  /** Visible on the credential flow only. Forwarded to GIS as `text`. */
  intent?: 'signin' | 'signup';
}

export const GoogleSignInButton = ({
  onCredential,
  onCancel,
  disabled = false,
  label = 'Sign in with Google',
  errorMessage,
  onBegin,
  pending = false,
  buttonOptions,
  intent = 'signin',
}: GoogleSignInButtonProps) => {
  // Credential flow — render the official GIS button. The hook loads
  // accounts.google.com/gsi/client exactly once per session and exposes a
  // container ref the official button attaches to.
  const {
    status: gisStatus,
    buttonContainerRef,
    isReady: gisReady,
    errorMessage: gisErrorMessage,
  } = useGoogleIdentity({
    onCredential: onCredential ?? (() => {}),
    onCancel,
    buttonOptions: {
      type: buttonOptions?.type ?? 'standard',
      theme: buttonOptions?.theme ?? 'outline',
      size: buttonOptions?.size ?? 'large',
      text:
        buttonOptions?.text ??
        (intent === 'signup' ? 'signup_with' : 'signin_with'),
      shape: buttonOptions?.shape ?? 'rectangular',
    },
  });

  // Defensive: when the parent unmounts mid-render (route change), make sure
  // GIS stops auto-selecting on the next mount.
  useEffect(() => {
    return () => {
      try {
        window.google?.accounts?.id?.disableAutoSelect();
      } catch {
        /* GIS may not be initialised yet — safe to ignore */
      }
    };
  }, []);

  // Agent 30 (regression) — while a Google-login exchange is in flight
  // anywhere in the app, render an overlay on top of the button
  // container so a rapid second click cannot fire a second credential
  // callback. The shared `acquireGoogleLoginSession` guard dedupes
  // the underlying POST; this overlay provides the visible "do not
  // click again" affordance. We deliberately do NOT pass `disabled`
  // into GIS itself — it would still receive the click and fire a
  // second callback. The overlay sits above the GIS iframe and
  // captures pointer events for the duration of the in-flight window.
  const globalInFlight = isGoogleLoginInFlight();

  // When the credential handler is provided, render the GIS-mounted button.
  if (onCredential) {
    const visibleError = errorMessage ?? gisErrorMessage;
    const showSpinner = pending || (gisStatus === 'loading' && !gisReady) || globalInFlight;

    return (
      <div className={styles.wrap}>
        <div
          ref={buttonContainerRef}
          className={styles.gisMount}
          data-testid="google-gis-button"
          data-status={gisStatus}
          data-inflight={globalInFlight ? 'true' : 'false'}
          aria-busy={gisStatus === 'loading' || globalInFlight}
        />
        {/* In-flight overlay — covers the GIS button container so a
            second click is intercepted before GIS can fire another
            credential callback. The overlay sits at z-index above the
            GIS iframe, is fully transparent for pointer events on the
            underlying GIS button (it captures them itself) but captures
            clicks for the duration of the in-flight exchange. */}
        {globalInFlight ? (
          <div
            className={styles.inflightOverlay}
            data-testid="google-inflight-overlay"
            aria-hidden="true"
          />
        ) : null}
        {/* Fallback button — shown if GIS is unavailable so the user still has
            a non-Google path forward (the page already offers email/password). */}
        {gisStatus === 'unavailable' || gisStatus === 'no-client-id' ? (
          <Button
            type="button"
            variant="outline"
            size="lg"
            fullWidth
            disabled
            className={styles.fallbackButton}
          >
            <GoogleIcon />
            <span>{label}</span>
          </Button>
        ) : null}
        {showSpinner && gisReady ? (
          <p className={styles.helper} role="status">
            Completing your Google sign-in…
          </p>
        ) : null}
        {visibleError && (
          <p className={styles.error} role="alert">
            {visibleError}
          </p>
        )}
      </div>
    );
  }

  // Legacy redirect flow — kept so existing Login/Register redirect wiring
  // doesn't break. The official GIS button is intentionally NOT rendered here.
  return (
    <div className={styles.wrap}>
      <Button
        type="button"
        variant="outline"
        size="lg"
        fullWidth
        onClick={onBegin}
        disabled={disabled || pending}
        isLoading={pending}
        className={styles.fallbackButton}
        data-testid="google-sign-in-button"
      >
        <GoogleIcon />
        <span>{label}</span>
      </Button>
      {errorMessage && (
        <p className={styles.error} role="alert">
          {errorMessage}
        </p>
      )}
    </div>
  );
};

export default GoogleSignInButton;