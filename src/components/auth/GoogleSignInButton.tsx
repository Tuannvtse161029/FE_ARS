// Agent 52 — Reusable Google sign-in button.
//
// Wraps `useGoogleIdentity` and renders the GIS button + a Cancel/disabled
// state when GIS is unavailable or the parent has gated the action.
// The parent owns submission state (`disabled`) — this button does not
// decide whether the user can submit.

import { type CSSProperties } from 'react';
import { useGoogleIdentity, type GoogleIdentityStatus } from '../../hooks/useGoogleIdentity';
import type { GoogleCredentialResponse } from '../../types/googleAuth';
import { Button } from '../../components/Button';
import { GoogleIcon } from '../../assets/icons/GoogleIcon';
import styles from './GoogleSignInButton.module.css';

export interface GoogleSignInButtonProps {
  /** Called by GIS when the user completes the sign-in flow. */
  onCredential: (response: GoogleCredentialResponse) => void;
  /** Called when the user dismisses the GIS popup without selecting an account. */
  onCancel?: () => void;
  /** Disable interaction (e.g. while a submission is in flight). */
  disabled?: boolean;
  /** Optional override of the visible label. Defaults to "Sign in with Google". */
  label?: string;
  /** Optional error message slot, used when GIS is unavailable. */
  errorMessage?: string | null;
}

const wrapStyle: CSSProperties = {
  minHeight: 44,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

function statusMessage(status: GoogleIdentityStatus): string | null {
  switch (status) {
    case 'loading':
      return null; // Loading indicator handled below.
    case 'no-client-id':
      return 'Google sign-in is not configured for this environment.';
    case 'unavailable':
      return 'Google sign-in is temporarily unavailable. Please try again later.';
    default:
      return null;
  }
}

export const GoogleSignInButton = ({
  onCredential,
  onCancel,
  disabled = false,
  label = 'Sign in with Google',
  errorMessage,
}: GoogleSignInButtonProps) => {
  const { status, buttonContainerRef, isReady, errorMessage: hookError } = useGoogleIdentity({
    onCredential,
    onCancel,
  });

  const visibleError = errorMessage ?? hookError ?? statusMessage(status);

  // GIS rendered successfully → show the official button.
  if (isReady && !disabled) {
    return (
      <div className={styles.wrap} style={wrapStyle}>
        <div ref={buttonContainerRef} className={styles.gisMount} />
      </div>
    );
  }

  // GIS still loading or disabled → show our fallback button so the UI is
  // never stuck on a blank slot.
  const showSpinner = status === 'loading';
  return (
    <div className={styles.wrap}>
      <Button
        type="button"
        variant="outline"
        size="lg"
        fullWidth
        onClick={() => {
          // When the official button is disabled / loading, our fallback
          // can only surface an error message — it never bypasses the
          // GIS flow because the user must tap the official button to
          // emit a credential. We prevent accidental click-throughs by
          // leaving the fallback button as a no-op visual placeholder.
        }}
        disabled
        isLoading={showSpinner}
        className={styles.fallbackButton}
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