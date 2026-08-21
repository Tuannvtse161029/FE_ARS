// Agent 54 — Reusable Google sign-in button.
//
// The new BE OAuth flow (Agent 54) replaces the legacy GIS credential
// swap. The button no longer loads `accounts.google.com/gsi/client`;
// instead it issues `window.location.assign(GET /api/Auth/google-oauth-login)`
// when clicked. The BE handles the redirect to Google, the user consents,
// and the BE then redirects the browser back to
// `/auth/google/callback?code=...` (handled by `GoogleCallback.tsx`).
//
// Backward compatibility:
//   - `onCredential` is still accepted but ignored (legacy Agent 52 hooks
//     wired it through `useGoogleIdentity`). We keep the prop so a future
//     GIS fallback does not require a parent rewrite.
//   - `onBegin` is the new handler. The Login page wires it to
//     `googleOAuthService.beginGoogleOAuth()` with a guarded in-flight lock.
//
// The button still surfaces a recoverable loading / disabled state while
// the redirect is in flight, and never persists anything before the BE
// callback fires.
import { Button } from '../../components/Button';
import { GoogleIcon } from '../../assets/icons/GoogleIcon';
import styles from './GoogleSignInButton.module.css';

export interface GoogleSignInButtonProps {
  /** Legacy hook — ignored under the Agent 54 OAuth flow. */
  onCredential?: (response: unknown) => void;
  /** Called when the user dismisses the Google popup without selecting an account. */
  onCancel?: () => void;
  /** Disable interaction (e.g. while a submission is in flight). */
  disabled?: boolean;
  /** Optional override of the visible label. Defaults to "Sign in with Google". */
  label?: string;
  /** Optional error message slot, used when OAuth cannot be started. */
  errorMessage?: string | null;
  /** Agent 54 — invoked when the user clicks the button. */
  onBegin?: () => void;
  /** Agent 54 — true while the OAuth redirect is in flight. */
  pending?: boolean;
}

export const GoogleSignInButton = ({
  onCredential: _onCredential,
  onCancel: _onCancel,
  disabled = false,
  label = 'Sign in with Google',
  errorMessage,
  onBegin,
  pending = false,
}: GoogleSignInButtonProps) => {
  // Agent 54 — the GIS loader hook is intentionally NOT called here. The
  // new BE flow does not load `accounts.google.com/gsi/client` and we
  // never show the legacy GIS-rendered button.

  const showSpinner = pending;
  const visibleError = errorMessage;

  return (
    <div className={styles.wrap}>
      <Button
        type="button"
        variant="outline"
        size="lg"
        fullWidth
        onClick={onBegin}
        disabled={disabled || pending}
        isLoading={showSpinner}
        className={styles.fallbackButton}
        data-testid="google-sign-in-button"
      >
        <GoogleIcon />
        <span>{label}</span>
      </Button>
      {visibleError && (
        <p className={styles.error} role="alert">
          {visibleError}
        </p>
      )}
    </div>
  );
};

export default GoogleSignInButton;