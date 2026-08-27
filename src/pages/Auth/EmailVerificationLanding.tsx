import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { Button } from '../../components/Button';
import { ROUTES } from '../../routes/paths';
import { useEmailVerification } from '../../hooks/useEmailVerification';
import { isVerifyEmailToken } from '../../services/emailVerification.service';
import authService from '../../services/auth.service';
import ARSLogo from '../../assets/images/ARS_Logo.png';
import { Check, Mail, ArrowLeft } from 'lucide-react';
import styles from './EmailVerificationLanding.module.css';

const OTP_CELL_COUNT = 6;
const RESEND_COOLDOWN = 60;

interface LocationState {
  email?: string;
  fullName?: string;
}

export const EmailVerificationLanding = (): JSX.Element => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const rawToken = searchParams.get('token') ?? '';

  const locationState = (location.state ?? {}) as LocationState;
  const [email] = useState<string>(
    locationState.email || searchParams.get('email') || ''
  );

  // Deep-link verification hook
  const { state: linkState, verify: verifyLink } = useEmailVerification();

  // OTP State
  const [otp, setOtp] = useState<string[]>(Array(OTP_CELL_COUNT).fill(''));
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [otpSuccess, setOtpSuccess] = useState(false);
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

  // Submit OTP Verification
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = otp.join('');
    if (code.length !== OTP_CELL_COUNT) {
      setErrorMessage(`Please enter all ${OTP_CELL_COUNT} digits of your OTP code.`);
      return;
    }

    setIsVerifyingOtp(true);
    setErrorMessage(null);

    try {
      await authService.verifyRegistrationOtp(email, code);
      setOtpSuccess(true);
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        'Verification code is invalid or has expired. Please check and try again.';
      setErrorMessage(msg);
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  // Resend OTP Code
  const handleResendCode = async () => {
    if (resendCooldown > 0 || isResending || !email) return;
    setIsResending(true);
    setErrorMessage(null);
    setResendSuccess(false);

    try {
      await authService.sendRegistrationOtp(email);
      setResendSuccess(true);
      setResendCooldown(RESEND_COOLDOWN);
      setTimeout(() => setResendSuccess(false), 5000);
    } catch (err: any) {
      setErrorMessage('Failed to resend verification code. Please try again in a moment.');
    } finally {
      setIsResending(false);
    }
  };

  // ── Render: Deep-link Token Mode ───────────────────────────
  if (rawToken && isVerifyEmailToken(rawToken)) {
    if (linkState.status === 'verifying') {
      return (
        <div className={styles.page}>
          <div className={styles.body}>
            <div className={styles.spinner} aria-hidden="true" />
            <h1 className={styles.title}>Verifying your email…</h1>
            <p className={styles.subtitle}>
              Hang tight while we confirm your verification link with the ARS backend.
            </p>
          </div>
        </div>
      );
    }

    if (linkState.status === 'verified') {
      return (
        <div className={styles.page}>
          <div className={styles.body}>
            <div className={`${styles.iconCircle} ${styles.iconCircleSuccess}`}>
              <Check size={32} />
            </div>
            <h1 className={styles.title}>Email verified successfully!</h1>
            <p className={styles.subtitle}>
              Thank you for verifying your email address. Your account is now confirmed.
            </p>
            <div className={styles.actions}>
              <Button
                variant="primary"
                size="lg"
                fullWidth
                onClick={() => navigate(ROUTES.LOGIN, { replace: true })}
                className={styles.primaryButton}
              >
                Proceed to Sign In
              </Button>
            </div>
          </div>
        </div>
      );
    }
  }

  // ── Render: OTP Success State ──────────────────────────────
  if (otpSuccess) {
    return (
      <div className={styles.page}>
        <div className={styles.logoHeader}>
          <div className={styles.logoWrapper}>
            <img src={ARSLogo} alt="ARS Logo" className={styles.logoImage} />
          </div>
          <span className={styles.brandText}>Academic Research System</span>
        </div>

        <div className={styles.body}>
          <div className={`${styles.iconCircle} ${styles.iconCircleSuccess}`}>
            <Check size={32} />
          </div>
          <h1 className={styles.title}>Email Verified!</h1>
          <p className={styles.subtitle}>
            Your email <strong>{email}</strong> has been successfully verified. Your account registration is complete and is in queue for administrator activation.
          </p>
          <div className={styles.actions}>
            <Button
              variant="primary"
              size="lg"
              fullWidth
              onClick={() => navigate(ROUTES.LOGIN, { replace: true })}
              className={styles.primaryButton}
            >
              Sign In to Your Account
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ── Render: Interactive OTP Verification Screen ────────────
  const isOtpComplete = otp.every((d) => d.length === 1);

  return (
    <div className={styles.page}>
      <div className={styles.logoHeader}>
        <div className={styles.logoWrapper}>
          <img src={ARSLogo} alt="ARS Logo" className={styles.logoImage} />
        </div>
        <span className={styles.brandText}>Academic Research System</span>
      </div>

      <div className={styles.header}>
        <div className={`${styles.iconCircle} ${styles.iconCirclePending}`} style={{ margin: '0 auto 16px auto' }}>
          <Mail size={30} />
        </div>
        <h1 className={styles.title}>Verify Your Email</h1>
        <p className={styles.subtitle}>
          We've sent a 6-digit verification OTP code to{' '}
          <strong style={{ color: 'var(--ars-ink, #0f172a)' }}>
            {email || 'your email address'}
          </strong>
          . Enter the code below to complete your registration.
        </p>
      </div>

      <form className={styles.form} onSubmit={handleVerifyOtp} noValidate>
        {errorMessage && (
          <div className={styles.formError} role="alert">
            {errorMessage}
          </div>
        )}

        {resendSuccess && (
          <div className={styles.successBox} role="status">
            A new 6-digit verification code has been sent to your email!
          </div>
        )}

        {/* 6 OTP Cells */}
        <div className={styles.otpRow} role="group" aria-label="6-digit verification code">
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

        <Button
          type="submit"
          variant="primary"
          size="lg"
          fullWidth
          isLoading={isVerifyingOtp}
          disabled={!isOtpComplete || isVerifyingOtp}
          className={styles.submitButton}
        >
          Verify & Complete Registration
        </Button>

        <div className={styles.resendRow}>
          <span className={styles.resendLabel}>Didn't receive the code?</span>
          {resendCooldown > 0 ? (
            <span className={styles.resendTimer}>Resend in {resendCooldown}s</span>
          ) : (
            <button
              type="button"
              onClick={handleResendCode}
              disabled={isResending || !email}
              className={styles.resendButton}
            >
              {isResending ? 'Sending...' : 'Resend Code'}
            </button>
          )}
        </div>

        <div className={styles.footer}>
          <Link to={ROUTES.LOGIN} className={styles.backLink}>
            <ArrowLeft size={16} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
            Back to Sign In
          </Link>
        </div>
      </form>
    </div>
  );
};

export default EmailVerificationLanding;
