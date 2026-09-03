import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '../../components/Button';
import { FieldError } from '../../components/FieldError';
import { StepIndicator } from './components/StepIndicator';
import { ROUTES } from '../../routes/paths';
import { validateOtp } from '../../utils/validationRules';
import authService from '../../services/auth.service';
import { extractServerMessage } from '../../utils/validationRules';
import { useI18n } from '../../i18n/I18nContext';
import styles from './VerifyOtp.module.css';
import ARSLogo from '../../assets/images/ARS_Logo.png';

const OTP_CELL_COUNT = 6;
const RESEND_COOLDOWN = 60;

interface LocationState {
  email?: string;
}

/**
 * Render a user-facing error for the `forgot-password` / `verify-otp` /
 * `reset-password` endpoints when the BE has not yet exposed a public
 * (anonymous) surface. The live Swagger today only documents the auth-
 * protected `/api/Auth/send-approval-email?email=...` endpoint, so the
 * existing password-reset flow returns 401. We surface that clearly to
 * the user instead of letting axios's generic "Request failed with
 * status code 401" leak into the UI.
 */
function authFlowError(err: unknown, fallback: string): string {
  return extractServerMessage(err, fallback);
}

const VerifyOtp = () => {
  const { t } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state ?? {}) as LocationState;
  const email = state.email || sessionStorage.getItem('ars_forgot_email') || '';

  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const [otp, setOtp] = useState<string[]>(Array(OTP_CELL_COUNT).fill(''));
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [otpError, setOtpError] = useState<string | null>(null);

  // In-flight dedupe refs — guard against double-submit from rapid clicks
  // and from React 18 strict-mode double-invokes. The values persist for
  // the lifetime of the component; resending / verifying while a prior
  // request is still in-flight is a no-op.
  const verifyInFlightRef = useRef(false);
  const resendInFlightRef = useRef(false);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  useEffect(() => {
    if (!email) {
      navigate(ROUTES.FORGOT_PASSWORD, { replace: true });
    }
  }, [email, navigate]);

  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  const handleChange = (index: number, value: string) => {
    const digit = value.replace(/\D/g, '').slice(-1);
    setOtp((prev) => {
      const next = [...prev];
      next[index] = digit;
      return next;
    });
    if (digit && index < OTP_CELL_COUNT - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < OTP_CELL_COUNT - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_CELL_COUNT);
    if (!pasted) return;
    const next = Array(OTP_CELL_COUNT).fill('');
    pasted.split('').forEach((char, i) => {
      next[i] = char;
    });
    setOtp(next);
    const lastFilled = Math.min(pasted.length, OTP_CELL_COUNT - 1);
    inputRefs.current[lastFilled]?.focus();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (verifyInFlightRef.current || isLoading) return;
    const code = otp.join('');
    const otpValidation = validateOtp(code);
    if (otpValidation) {
      setOtpError(otpValidation);
      setError(null);
      return;
    }
    setOtpError(null);
    setError(null);
    verifyInFlightRef.current = true;
    setIsLoading(true);
    try {
      sessionStorage.setItem('ars_forgot_otp', code);
      sessionStorage.setItem('ars_forgot_email', email);
      navigate(ROUTES.RESET_PASSWORD, { state: { email, otpCode: code } });
    } catch (err: unknown) {
      const msg = authFlowError(err, t('reset.errorInvalidCode', 'Invalid code. Please try again.'));
      setError(msg);
      setOtp(Array(OTP_CELL_COUNT).fill(''));
      inputRefs.current[0]?.focus();
    } finally {
      verifyInFlightRef.current = false;
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    if (resendInFlightRef.current) return;
    resendInFlightRef.current = true;
    setError(null);
    setOtpError(null);
    try {
      await authService.resendOtp(email);
      setResendCooldown(RESEND_COOLDOWN);
      setOtp(Array(OTP_CELL_COUNT).fill(''));
      inputRefs.current[0]?.focus();
    } catch (err: unknown) {
      const msg = authFlowError(err, t('reset.errorResendCode', 'Unable to resend code. Please try again.'));
      setError(msg);
    } finally {
      resendInFlightRef.current = false;
    }
  };

  const isComplete = otp.every((d) => d.length === 1);

  return (
    <div className={styles.page}>
      <div className={styles.logoHeader}>
        <div className={styles.logoWrapper}>
          <img src={ARSLogo} alt="ARS Logo" className={styles.logoImage} />
        </div>
        <span className={styles.brandText}>{t('app.brandName', 'ARS - Academic Research Sharing')}</span>
      </div>

      <StepIndicator currentStep={2} />

      <div className={styles.header}>
        <h1 className={styles.title}>{t('reset.checkEmail', 'Check your email')}</h1>
        <p className={styles.subtitle}>
          {t('reset.sentCodeTo', 'We sent a 6-digit verification code to')} <strong>{email}</strong>. {t('reset.enterCodeBelow', 'Enter the code below to continue.')}
        </p>
      </div>

      <form className={styles.form} onSubmit={handleSubmit}>
        {error && (
          <div className={styles.formError} role="alert">
            {error}
          </div>
        )}

        <div className={styles.otpRow} role="group" aria-label={t('reset.verificationCodeLabel', 'Verification code')}>
          {otp.map((digit, index) => (
            <input
              key={index}
              ref={(el) => {
                inputRefs.current[index] = el;
              }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => {
                handleChange(index, e.target.value);
                if (otpError) setOtpError(null);
              }}
              onKeyDown={(e) => handleKeyDown(index, e)}
              onPaste={handlePaste}
              disabled={isLoading}
              className={`${styles.otpBox} ${digit ? styles.otpBoxFilled : ''} ${otpError ? styles.otpBoxError : ''}`}
              aria-label={`${t('reset.digitLabel', 'Digit')} ${index + 1}`}
              aria-invalid={Boolean(otpError)}
              aria-describedby={otpError ? 'otp-error' : undefined}
            />
          ))}
        </div>
        <FieldError id="otp-error" message={otpError} testId="verify-otp-error" />

        <Button
          type="submit"
          variant="primary"
          size="lg"
          fullWidth
          isLoading={isLoading}
          disabled={!isComplete}
          className={styles.submitButton}
        >
          {t('reset.verifyButton', 'Verify')}
        </Button>

        <div className={styles.resendRow}>
          <span className={styles.resendLabel}>{t('reset.didNotReceive', "Didn't receive the code?")}</span>
          <button
            type="button"
            onClick={handleResend}
            disabled={resendCooldown > 0}
            className={styles.resendButton}
          >
            {resendCooldown > 0 ? `${t('reset.resendIn', 'Resend in')} ${resendCooldown}s` : t('reset.resendCodeButton', 'Resend code')}
          </button>
        </div>

        <div className={styles.footer}>
          <Link to={ROUTES.FORGOT_PASSWORD} className={styles.backLink}>
            {t('common.back', 'Back')}
          </Link>
        </div>
      </form>
    </div>
  );
};

export default VerifyOtp;