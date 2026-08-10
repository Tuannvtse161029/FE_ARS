import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '../../components/Button';
import { StepIndicator } from './components/StepIndicator';
import { ROUTES } from '../../routes/paths';
import authService from '../../services/auth.service';
import styles from './VerifyOtp.module.css';
import ARSLogo from '../../assets/images/ARS_Logo.png';

const OTP_LENGTH = 6;
const RESEND_COOLDOWN = 60;

interface LocationState {
  email?: string;
}

const VerifyOtp = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state ?? {}) as LocationState;
  const email = state.email ?? '';

  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);

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
    if (digit && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH);
    if (!pasted) return;
    const next = Array(OTP_LENGTH).fill('');
    pasted.split('').forEach((char, i) => {
      next[i] = char;
    });
    setOtp(next);
    const lastFilled = Math.min(pasted.length, OTP_LENGTH - 1);
    inputRefs.current[lastFilled]?.focus();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = otp.join('');
    if (code.length !== OTP_LENGTH) {
      setError('Please enter the complete 6-digit code');
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const { resetToken } = await authService.verifyOtp({ email, otp: code });
      navigate(ROUTES.RESET_PASSWORD, { state: { resetToken } });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Invalid or expired code. Please try again.';
      setError(msg);
      setOtp(Array(OTP_LENGTH).fill(''));
      inputRefs.current[0]?.focus();
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    setError(null);
    try {
      await authService.forgotPassword(email);
      setResendCooldown(RESEND_COOLDOWN);
      setOtp(Array(OTP_LENGTH).fill(''));
      inputRefs.current[0]?.focus();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unable to resend code. Please try again.';
      setError(msg);
    }
  };

  const isComplete = otp.every((d) => d.length === 1);

  return (
    <div className={styles.page}>
      <div className={styles.logoHeader}>
        <div className={styles.logoWrapper}>
          <img src={ARSLogo} alt="ARS Logo" className={styles.logoImage} />
        </div>
        <span className={styles.brandText}>ARS - Academic Research Sharing</span>
      </div>

      <StepIndicator currentStep={2} />

      <div className={styles.header}>
        <h1 className={styles.title}>Check your email</h1>
        <p className={styles.subtitle}>
          We sent a 6-digit verification code to <strong>{email}</strong>. Enter the code below to continue.
        </p>
      </div>

      <form className={styles.form} onSubmit={handleSubmit}>
        {error && (
          <div className={styles.formError} role="alert">
            {error}
          </div>
        )}

        <div className={styles.otpRow} role="group" aria-label="Verification code">
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
              onChange={(e) => handleChange(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              onPaste={handlePaste}
              disabled={isLoading}
              className={`${styles.otpBox} ${digit ? styles.otpBoxFilled : ''}`}
              aria-label={`Digit ${index + 1}`}
            />
          ))}
        </div>

        <Button
          type="submit"
          variant="primary"
          size="lg"
          fullWidth
          isLoading={isLoading}
          disabled={!isComplete}
          className={styles.submitButton}
        >
          Verify
        </Button>

        <div className={styles.resendRow}>
          <span className={styles.resendLabel}>Didn't receive the code?</span>
          <button
            type="button"
            onClick={handleResend}
            disabled={resendCooldown > 0}
            className={styles.resendButton}
          >
            {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend code'}
          </button>
        </div>

        <div className={styles.footer}>
          <Link to={ROUTES.FORGOT_PASSWORD} className={styles.backLink}>
            Back
          </Link>
        </div>
      </form>
    </div>
  );
};

export default VerifyOtp;