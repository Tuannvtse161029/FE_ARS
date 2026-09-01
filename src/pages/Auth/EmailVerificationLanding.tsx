/*
 * EmailVerificationLanding — ARS Research Constellation
 *
 * ── DIRECTION CONTRACT ─────────────────────────────────────────────────
 * THESIS: Email verification is the editorial "proof" stage of
 *   registration — the moment between "submitted" and "approved". The
 *   page should read like the inside cover of an academic journal:
 *   a small mono section marker, a serif heading, and a typewriter-style
 *   OTP entry. The default category (rounded card + blue button) is
 *   refused in favour of editorial restraint on warm paper.
 * OWN-WORLD: ARS Constellation tokens — warm paper (`--ars-paper-card`),
 *   deep ink (`--ars-ink`), amber accent (`--accent-primary`). Six
 *   OTP cells with hairline borders and a 1px amber underline that
 *   appears on focus. Mono caption for email/secondary metadata.
 * STORY: The visitor lands here either via the link in their email
 *   (verified immediately by the BE) or via the post-Register OTP
 *   screen. They enter a 6-digit code, see "Verified", and are
 *   returned to sign-in so the Admin can approve them. In
 *   development, a clearly-labelled "Skip for development" button
 *   short-circuits the OTP step.
 * FIRST VIEWPORT: section marker "STAGE 02 / VERIFICATION" + serif
 *   heading "Confirm your registration." + email cited as "To: …" in
 *   mono + six OTP cells in a single horizontal row + amber primary
 *   action + small footnote "Didn't receive the code?" with resend
 *   timer + dev-only skip affordance (when bypass flag is on).
 * FORM: Operate (the user completes a task). Single-screen interaction,
 *   keyboard-first, no animation beyond focus + state changes.
 * FINISH: unreviewed and undocumented is unfinished; this build ends
 *   with the finish review, the verdict, DESIGN.md, and every shipping
 *   raster carrying its provenance.
 * ────────────────────────────────────────────────────────────────────
 *
 * Behaviour
 *   - Reads `?token=...` from the URL exactly once and hands it to
 *     `useEmailVerification`.
 *   - Renders one of five states: verifying-token, verified,
 *     failed-link, otp-success, or the interactive OTP screen.
 *   - The OTP screen has a 6-cell input with paste / backspace /
 *     arrow-key support, resend cooldown, and (when the bypass flag is
 *     `false`) a clearly-labelled "Skip for development" button.
 *
 * Security
 *   - The token is NEVER persisted to localStorage / sessionStorage.
 *   - The page never calls /api/Email/send-test.
 *   - The dev skip button calls `markLocalRegistrationComplete()`,
 *     which only mutates local storage under the well-known sentinel
 *     `ars_dev_skip_otp`. It does NOT call any BE endpoint that would
 *     bypass the OTP gate on the server.
 */

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { Button } from '../../components/Button';
import { ROUTES } from '../../routes/paths';
import { useEmailVerification } from '../../hooks/useEmailVerification';
import { isVerifyEmailToken } from '../../services/emailVerification.service';
import authService from '../../services/auth.service';
import {
  registrationOtpBypassAllowed,
} from '../../config/featureFlags';
import {
  Check,
  ArrowLeft,
  CircleAlert,
  ShieldOff,
  RefreshCcw,
} from 'lucide-react';
import styles from './EmailVerificationLanding.module.css';

const OTP_CELL_COUNT = 6;
const RESEND_COOLDOWN = 60;
/**
 * Sentinel key written to sessionStorage when the user takes the
 * development-only "Skip OTP" path. The login screen reads this to
 * mark the local registration complete without a BE round-trip.
 */
const DEV_SKIP_SENTINEL = 'ars_dev_skip_otp';

interface LocationState {
  email?: string;
  fullName?: string;
}

interface OtpSuccessState {
  /** The email that was verified. Displayed in the success card. */
  email: string;
}

export const EmailVerificationLanding = (): JSX.Element => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const rawToken = searchParams.get('token') ?? '';

  const locationState = (location.state ?? {}) as LocationState;
  const [email, setEmail] = useState<string>(() => {
    return (
      locationState.email ||
      searchParams.get('email') ||
      sessionStorage.getItem('ars_registered_email') ||
      ''
    );
  });

  // Deep-link verification hook
  const { state: linkState, verify: verifyLink } = useEmailVerification();

  // OTP State
  const [otp, setOtp] = useState<string[]>(Array(OTP_CELL_COUNT).fill(''));
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [otpSuccess, setOtpSuccess] = useState<OtpSuccessState | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(RESEND_COOLDOWN);
  const [isResending, setIsResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);

  // 1. If direct ?token= is provided, run token verification
  useEffect(() => {
    if (isVerifyEmailToken(rawToken)) {
      void verifyLink(rawToken);
    }
  }, [rawToken, verifyLink]);

  // 2. Resend countdown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown((prev) => prev - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  // Auto focus first OTP input
  useEffect(() => {
    if (!rawToken) {
      inputRefs.current[0]?.focus();
    }
  }, [rawToken]);

  // Handle OTP typing
  const handleOtpChange = (index: number, val: string) => {
    const digit = val.replace(/\D/g, '').slice(-1);
    setOtp((prev) => {
      const next = [...prev];
      next[index] = digit;
      return next;
    });
    setErrorMessage(null);

    if (digit && index < OTP_CELL_COUNT - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < OTP_CELL_COUNT - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_CELL_COUNT);
    if (!pasted) return;
    const next = Array(OTP_CELL_COUNT).fill('');
    pasted.split('').forEach((char, i) => {
      if (i < OTP_CELL_COUNT) next[i] = char;
    });
    setOtp(next);
    setErrorMessage(null);
    const nextFocusIndex = Math.min(pasted.length, OTP_CELL_COUNT - 1);
    inputRefs.current[nextFocusIndex]?.focus();
  };

  // ── Helpers ───────────────────────────────────────────────────────────────

  /** Set the otpSuccess state, clean up session sentinels, redirect to login. */
  const completeOtpSuccess = (verifiedEmail: string) => {
    setOtpSuccess({ email: verifiedEmail });
    try {
      sessionStorage.removeItem('ars_registered_email');
      sessionStorage.removeItem(DEV_SKIP_SENTINEL);
    } catch {
      /* ignore */
    }
    setTimeout(() => {
      navigate(ROUTES.LOGIN, { replace: true, state: { email: verifiedEmail } });
    }, 1500);
  };

  // Submit OTP Verification
  const handleVerifyOtp = async (e: FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setErrorMessage('Please enter your registered email address.');
      return;
    }

    const code = otp.join('');
    if (code.length !== OTP_CELL_COUNT) {
      setErrorMessage(`Please enter all ${OTP_CELL_COUNT} digits of your OTP code.`);
      return;
    }

    setIsVerifyingOtp(true);
    setErrorMessage(null);

    try {
      await authService.verifyRegistrationOtp(cleanEmail, code);
      completeOtpSuccess(cleanEmail);
    } catch (err: unknown) {
      const maybeAxios = err as {
        response?: { data?: { message?: unknown } };
        message?: string;
      };
      const msg =
        (typeof maybeAxios?.response?.data?.message === 'string'
          ? maybeAxios.response.data.message
          : typeof maybeAxios?.message === 'string'
            ? maybeAxios.message
            : null) ??
        'Verification code is invalid or has expired. Please check and try again.';
      setErrorMessage(msg);
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  // Resend OTP Code
  const handleResendCode = async () => {
    const cleanEmail = email.trim();
    if (resendCooldown > 0 || isResending || !cleanEmail) return;
    setIsResending(true);
    setErrorMessage(null);
    setResendSuccess(false);

    try {
      await authService.sendRegistrationOtp(cleanEmail);
      setResendSuccess(true);
      setResendCooldown(RESEND_COOLDOWN);
      setTimeout(() => setResendSuccess(false), 5000);
    } catch (err: unknown) {
      setErrorMessage('Failed to resend verification code. Please try again in a moment.');
    } finally {
      setIsResending(false);
    }
  };

  /**
   * Development-only OTP bypass.
   *
   * Sets the `ars_dev_skip_otp` sentinel in sessionStorage and routes
   * the user back to the login page. The login page (or the next page
   * that consumes the sentinel) recognises the bypass and treats the
   * registration as locally complete without a BE round-trip.
   *
   * The bypass is gated by the `VITE_REQUIRE_REGISTRATION_OTP` env var
   * (default `false` in development, flipped to `true` for production).
   * The button is rendered only when `registrationOtpBypassAllowed()`
   * returns true.
   */
  const handleSkipForDev = () => {
    if (!registrationOtpBypassAllowed()) return;
    const cleanEmail = email.trim();
    try {
      sessionStorage.setItem(
        DEV_SKIP_SENTINEL,
        JSON.stringify({ email: cleanEmail, at: new Date().toISOString() }),
      );
    } catch {
      /* ignore */
    }
    completeOtpSuccess(cleanEmail);
  };

  // ── Render: Deep-link Token Mode (verifying) ────────────────────────────
  if (rawToken && isVerifyEmailToken(rawToken) && linkState.status === 'verifying') {
    return (
      <section
        className={styles.shell}
        aria-busy="true"
        aria-live="polite"
        data-testid="verify-email-verifying"
      >
        <p className={styles.sectionMarker}>
          <span className={styles.markerNum}>01</span>
          <span className={styles.markerLabel}>/ Verification</span>
        </p>
        <h1 className={styles.heading}>Confirming your registration…</h1>
        <p className={styles.lede}>
          Hang tight while we confirm the verification link with the ARS backend.
        </p>
        <div className={styles.progressRail} aria-hidden="true">
          <span className={styles.progressDot} />
          <span className={styles.progressDot} />
          <span className={styles.progressDot} />
        </div>
      </section>
    );
  }

  // ── Render: Deep-link Token Mode (verified) ─────────────────────────────
  if (rawToken && isVerifyEmailToken(rawToken) && linkState.status === 'verified') {
    return (
      <section
        className={styles.shell}
        aria-live="polite"
        data-testid="verify-email-deep-verified"
      >
        <p className={styles.sectionMarker}>
          <span className={styles.markerNum}>01</span>
          <span className={styles.markerLabel}>/ Verification</span>
        </p>
        <div className={styles.statusBadge} data-tone="success">
          <Check size={18} aria-hidden="true" />
          <span>Verified</span>
        </div>
        <h1 className={styles.heading}>Email verified successfully.</h1>
        <p className={styles.lede}>
          Your account is confirmed. An administrator will review your registration
          before role-restricted areas unlock.
        </p>
        <div className={styles.actions}>
          <Button
            variant="primary"
            size="lg"
            fullWidth
            onClick={() => navigate(ROUTES.FORUM, { replace: true })}
            data-testid="verify-email-go-forum"
          >
            Continue to Forum
          </Button>
          <Button
            variant="ghost"
            size="lg"
            fullWidth
            onClick={() => navigate(ROUTES.LOGIN, { replace: true })}
            data-testid="verify-email-go-login"
          >
            Sign in instead
          </Button>
        </div>
      </section>
    );
  }

  // ── Render: Deep-link Token Mode (failed / expired / malformed) ────────
  if (rawToken && isVerifyEmailToken(rawToken) && linkState.status !== 'verifying') {
    const tone =
      linkState.status === 'expired' || linkState.status === 'invalid_token'
        ? 'danger'
        : 'warning';
    const headline =
      linkState.status === 'expired'
        ? 'This verification link has expired.'
        : linkState.status === 'invalid_token'
          ? 'This verification link is not authorised.'
          : linkState.status === 'network_error'
            ? 'Network error — please reconnect.'
            : 'We could not verify your email.';
    return (
      <section
        className={styles.shell}
        aria-live="polite"
        data-testid="verify-email-deep-failed"
      >
        <p className={styles.sectionMarker}>
          <span className={styles.markerNum}>01</span>
          <span className={styles.markerLabel}>/ Verification</span>
        </p>
        <div className={styles.statusBadge} data-tone={tone}>
          <CircleAlert size={18} aria-hidden="true" />
          <span>{headline}</span>
        </div>
        <h1 className={styles.heading}>{headline}</h1>
        <p className={styles.lede}>
          {linkState.errorMessage ?? 'The verification link in your email did not work.'}
        </p>
        <div className={styles.actions}>
          <Button
            variant="primary"
            size="lg"
            fullWidth
            onClick={() => navigate(ROUTES.LOGIN, { replace: true })}
            data-testid="verify-email-go-login"
          >
            Back to Sign In
          </Button>
        </div>
      </section>
    );
  }

  // ── Render: OTP Success State ──────────────────────────────────────────
  if (otpSuccess) {
    return (
      <section className={styles.shell} aria-live="polite" data-testid="verify-email-otp-success">
        <p className={styles.sectionMarker}>
          <span className={styles.markerNum}>02</span>
          <span className={styles.markerLabel}>/ Verified</span>
        </p>
        <div className={styles.statusBadge} data-tone="success">
          <Check size={18} aria-hidden="true" />
          <span>Verified</span>
        </div>
        <h1 className={styles.heading}>Email verified.</h1>
        <p className={styles.lede}>
          Your email{' '}
          <span className={styles.emailCite}>{otpSuccess.email || 'on file'}</span> has
          been verified. Returning you to sign in so you can access your account after
          administrator review.
        </p>
        <div className={styles.actions}>
          <Button
            variant="primary"
            size="lg"
            fullWidth
            onClick={() => navigate(ROUTES.FORUM, { replace: true })}
            data-testid="verify-email-go-forum"
          >
            Continue to Forum
          </Button>
        </div>
      </section>
    );
  }

  // ── Render: Interactive OTP Verification Screen ────────────────────────
  const isOtpComplete = otp.every((d) => d.length === 1);

  return (
    <section className={styles.shell} data-testid="verify-email-otp-form">
      <p className={styles.sectionMarker}>
        <span className={styles.markerNum}>02</span>
        <span className={styles.markerLabel}>/ Verification</span>
      </p>
      <h1 className={styles.heading}>Confirm your registration.</h1>
      <p className={styles.lede}>
        We sent a 6-digit code to{' '}
        <span className={styles.emailCite}>{email || 'your email address'}</span>.
        Enter it below to complete your registration.
      </p>

      <form className={styles.form} onSubmit={handleVerifyOtp} noValidate>
        {errorMessage && (
          <div className={styles.formError} role="alert">
            <CircleAlert size={16} aria-hidden="true" />
            <span>{errorMessage}</span>
          </div>
        )}

        {resendSuccess && (
          <div className={styles.successBox} role="status">
            A new 6-digit code has been sent to your email.
          </div>
        )}

        {/* If email is empty, show input field */}
        {!email && (
          <div className={styles.emailField}>
            <label className={styles.emailLabel} htmlFor="verification-email">
              Registered email
            </label>
            <input
              id="verification-email"
              type="email"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={styles.emailInput}
            />
          </div>
        )}

        {/* 6 OTP Cells */}
        <fieldset className={styles.otpFieldset}>
          <legend className={styles.otpLegend}>Six-digit code</legend>
          <div className={styles.otpRow}>
            {otp.map((digit, idx) => (
              <input
                key={idx}
                ref={(el) => {
                  inputRefs.current[idx] = el;
                }}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={1}
                value={digit}
                onChange={(e) => handleOtpChange(idx, e.target.value)}
                onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                onPaste={handleOtpPaste}
                className={`${styles.otpBox} ${digit ? styles.otpBoxFilled : ''} ${
                  errorMessage ? styles.otpBoxError : ''
                }`}
                disabled={isVerifyingOtp}
                aria-label={`Digit ${idx + 1} of ${OTP_CELL_COUNT}`}
                autoComplete="one-time-code"
              />
            ))}
          </div>
        </fieldset>

        <Button
          type="submit"
          variant="primary"
          size="lg"
          fullWidth
          isLoading={isVerifyingOtp}
          disabled={!isOtpComplete || isVerifyingOtp}
          className={styles.submitButton}
          data-testid="verify-email-submit"
        >
          {isVerifyingOtp ? 'Verifying…' : 'Verify & continue'}
        </Button>

        {/* Dev-only bypass. Visible when the env var disables OTP for
            development. Never rendered in production. */}
        {registrationOtpBypassAllowed() ? (
          <div
            className={styles.devSkipBlock}
            data-testid="verify-email-dev-skip"
            role="region"
            aria-label="Development-only OTP bypass"
          >
            <div className={styles.devSkipNotice}>
              <span className={styles.devSkipBadge}>
                <ShieldOff size={12} aria-hidden="true" />
                <span>Development bypass</span>
              </span>
              <p className={styles.devSkipCopy}>
                The <code className={styles.codeChip}>VITE_REQUIRE_REGISTRATION_OTP</code>{' '}
                flag is <strong>off</strong> in this build. You can complete the
                registration without entering an OTP. Production will require a code.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="md"
              fullWidth
              onClick={handleSkipForDev}
              leftIcon={<ArrowLeft size={16} aria-hidden="true" />}
              disabled={isVerifyingOtp}
              data-testid="verify-email-skip-for-dev"
            >
              Skip for development
            </Button>
          </div>
        ) : null}

        <div className={styles.resendRow}>
          <span className={styles.resendLabel}>Didn’t receive the code?</span>
          {resendCooldown > 0 ? (
            <span className={styles.resendTimer} data-testid="verify-email-resend-timer">
              Resend in {resendCooldown}s
            </span>
          ) : (
            <button
              type="button"
              onClick={handleResendCode}
              disabled={isResending || !email}
              className={styles.resendButton}
              data-testid="verify-email-resend"
            >
              {isResending ? (
                <RefreshCcw size={14} aria-hidden="true" />
              ) : (
                <RefreshCcw size={14} aria-hidden="true" />
              )}
              <span>{isResending ? 'Sending…' : 'Resend code'}</span>
            </button>
          )}
        </div>

        <div className={styles.footer}>
          <Link to={ROUTES.LOGIN} className={styles.backLink}>
            <ArrowLeft size={16} className={styles.backIcon} aria-hidden="true" />
            Back to Sign In
          </Link>
        </div>
      </form>
    </section>
  );
};

export default EmailVerificationLanding;
