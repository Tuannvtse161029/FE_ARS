import { useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '../../components/Button';
import { ROUTES } from '../../routes/paths';
import { useEmailVerification } from '../../hooks/useEmailVerification';
import { isVerifyEmailToken } from '../../services/emailVerification.service';
import ARSLogo from '../../assets/images/ARS_Logo.png';
import { Check, Mail, X } from 'lucide-react';
import styles from './EmailVerificationLanding.module.css';

/**
 * EmailVerificationLanding
 *
 * Public landing surface for `/verify-email?token=...`. Reads the token
 * exactly once from the query string and forwards it to the
 * `useEmailVerification` hook. The hook owns dedup / classification;
 * this component only renders the outcome.
 *
 * Anti-pattern guards:
 *   - The token is consumed once and never persisted to storage.
 *   - The verification call only fires once even when React 18 strict
 *     mode double-invokes the effect — the hook's in-flight ref blocks
 *     the second invocation.
 *   - The "Resend approval email" CTA only appears on `expired` /
 *     `invalid_token`; it never appears when the verification is still
 *     in flight.
 */
export const EmailVerificationLanding = (): JSX.Element => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { state, verify } = useEmailVerification();
  const rawToken = searchParams.get('token') ?? '';

  useEffect(() => {
    // Fire EXACTLY once per page mount. The hook dedupes any
    // concurrent calls so strict-mode / re-mount cannot fire twice.
    if (!isVerifyEmailToken(rawToken)) {
      return;
    }
    // The hook guards against duplicate in-flight calls via inFlightRef;
    // it is safe to call verify() unconditionally here.
    void verify(rawToken);
    // We deliberately depend on the literal token string only — the
    // `verify` callback identity is stable so re-renders triggered by
    // hook state changes do not re-fire the network request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawToken]);

  const renderBody = () => {
    if (!isVerifyEmailToken(rawToken)) {
      return (
        <div className={styles.body} data-status="invalid_token">
          <div
            className={`${styles.iconCircle} ${styles.iconCircleError}`}
            aria-hidden="true"
          >
            <X size={28} />
          </div>
          <h1 className={styles.title}>Invalid verification link</h1>
          <p className={styles.subtitle}>
            The verification link you used is malformed or incomplete. Please
            return to your inbox and click the link we sent you.
          </p>
          <div className={styles.actions}>
            <Button
              variant="primary"
              size="lg"
              fullWidth
              onClick={() => navigate(ROUTES.LOGIN, { replace: true })}
              className={styles.primaryButton}
              data-testid="verify-email-go-login"
            >
              Back to sign in
            </Button>
          </div>
        </div>
      );
    }

    if (state.status === 'verifying') {
      return (
        <div className={styles.body} data-status="verifying">
          <div className={styles.spinner} aria-hidden="true" />
          <h1 className={styles.title}>Verifying your email…</h1>
          <p className={styles.subtitle}>
            Hang tight while we confirm your verification link with the ARS
            backend.
          </p>
        </div>
      );
    }

    if (state.status === 'verified') {
      return (
        <div className={styles.body} data-status="verified">
          <div
            className={`${styles.iconCircle} ${styles.iconCircleSuccess}`}
            aria-hidden="true"
          >
            <Check size={28} />
          </div>
          <h1 className={styles.title}>Email verified</h1>
          <p className={styles.subtitle}>
            Your email is now verified. You can sign in to continue setting up
            your account.
          </p>
          <div className={styles.successBox} role="status">
            Your account is now visible to the administrators for review.
          </div>
          <div className={styles.actions}>
            <Button
              variant="primary"
              size="lg"
              fullWidth
              onClick={() => navigate(ROUTES.LOGIN, { replace: true })}
              className={styles.primaryButton}
              data-testid="verify-email-go-login"
            >
              Continue to sign in
            </Button>
          </div>
        </div>
      );
    }

    // Failure states — expired / invalid_token / network_error / server_error
    const isInvalid = state.status === 'expired' || state.status === 'invalid_token';
    return (
      <div className={styles.body} data-status={state.status}>
        <div
          className={`${styles.iconCircle} ${styles.iconCircleError}`}
          aria-hidden="true"
        >
          <Mail size={28} />
        </div>
        <h1 className={styles.title}>
          {isInvalid ? 'Verification link expired' : 'Verification failed'}
        </h1>
        <p className={styles.subtitle}>
          {isInvalid
            ? 'This verification link is no longer valid. Request a new one and try again.'
            : 'We could not complete your email verification. Please try again in a moment.'}
        </p>
        {state.errorMessage && (
          <div className={styles.errorBox} role="alert">
            {state.errorMessage}
          </div>
        )}
        <div className={styles.actions}>
          <Link to={ROUTES.LOGIN} className={styles.secondaryButton}>
            Back to sign in
          </Link>
        </div>
      </div>
    );
  };

  return (
    <div className={styles.page}>
      <div className={styles.logoHeader}>
        <div className={styles.logoWrapper}>
          <img src={ARSLogo} alt="ARS Logo" className={styles.logoImage} />
        </div>
        <span className={styles.brandText}>
          ARS - Academic Research Sharing
        </span>
      </div>
      {renderBody()}
    </div>
  );
};

export default EmailVerificationLanding;
