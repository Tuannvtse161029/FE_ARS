import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { Input } from '../../components/Input';
import { Button } from '../../components/Button';
import { StepIndicator } from './components/StepIndicator';
import { ROUTES } from '../../routes/paths';
import {
  resetPasswordSchema,
  type ResetPasswordFormData,
} from '../../utils/validation';
import { extractServerMessage } from '../../utils/validationRules';
import authService from '../../services/auth.service';
import styles from './ResetPassword.module.css';
import ARSLogo from '../../assets/images/ARS_Logo.png';
import { Eye, EyeOff } from 'lucide-react';

interface LocationState {
  email?: string;
  otpCode?: string;
}

function resetPasswordError(err: unknown, fallback: string): string {
  return extractServerMessage(err, fallback);
}

const ResetPassword = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state ?? {}) as LocationState;
  const email = state.email || sessionStorage.getItem('ars_forgot_email') || '';
  const otpCode = state.otpCode || sessionStorage.getItem('ars_forgot_otp') || '';

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const inFlightRef = useRef(false);

  useEffect(() => {
    if (!email || !otpCode) {
      navigate(ROUTES.FORGOT_PASSWORD, { replace: true });
    }
  }, [email, otpCode, navigate]);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordFormData>({
    resolver: yupResolver(resetPasswordSchema),
    defaultValues: { newPassword: '', confirmPassword: '' },
  });

  const onSubmit = async (data: ResetPasswordFormData) => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setIsLoading(true);
    setError(null);
    setSuccessMessage(null);
    try {
      await authService.resetPassword({
        email: email.trim(),
        otpCode: otpCode.trim(),
        newPassword: data.newPassword,
        confirmPassword: data.confirmPassword,
      });
      sessionStorage.removeItem('ars_forgot_email');
      sessionStorage.removeItem('ars_forgot_otp');
      setSuccessMessage('Password reset successfully! Redirecting to login...');
      setTimeout(() => {
        navigate(ROUTES.LOGIN, { replace: true });
      }, 1500);
    } catch (err: unknown) {
      const msg = resetPasswordError(
        err,
        'Unable to reset password. Please try again.',
      );
      setError(msg);
    } finally {
      inFlightRef.current = false;
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.logoHeader}>
        <div className={styles.logoWrapper}>
          <img src={ARSLogo} alt="ARS Logo" className={styles.logoImage} />
        </div>
        <span className={styles.brandText}>ARS - Academic Research Sharing</span>
      </div>

      <StepIndicator currentStep={3} />

      <div className={styles.header}>
        <h1 className={styles.title}>Reset Password</h1>
        <p className={styles.subtitle}>
          Set a new password for your account. Make sure it&apos;s strong and easy to remember.
        </p>
      </div>

      <form className={styles.form} onSubmit={handleSubmit(onSubmit)}>
        {error && (
          <div className={styles.formError} role="alert">
            {error}
          </div>
        )}

        {successMessage && (
          <div className={styles.formSuccess} role="status">
            {successMessage}
          </div>
        )}

        <div className={styles.fieldGroup}>
          <Controller
            name="newPassword"
            control={control}
            render={({ field }) => (
              <Input
                {...field}
                type={showNewPassword ? 'text' : 'password'}
                label="New Password"
                placeholder="Enter new password"
                error={errors.newPassword?.message}
                autoComplete="new-password"
                disabled={isLoading}
                className={styles.passwordInput}
                rightIcon={
                  <button
                    type="button"
                    className={styles.passwordToggle}
                    onClick={() => setShowNewPassword((s) => !s)}
                    tabIndex={-1}
                    aria-label={showNewPassword ? 'Hide password' : 'Show password'}
                  >
                    {showNewPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                }
              />
            )}
          />
          <p className={styles.passwordHint}>
            Password must contain at least 8 characters, including one uppercase letter and one number.
          </p>
        </div>

        <Controller
          name="confirmPassword"
          control={control}
          render={({ field }) => (
            <Input
              {...field}
              type={showConfirmPassword ? 'text' : 'password'}
              label="Confirm New Password"
              placeholder="Re-enter new password"
              error={errors.confirmPassword?.message}
              autoComplete="new-password"
              disabled={isLoading}
              className={styles.passwordInput}
              rightIcon={
                <button
                  type="button"
                  className={styles.passwordToggle}
                  onClick={() => setShowConfirmPassword((s) => !s)}
                  tabIndex={-1}
                  aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                >
                  {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              }
            />
          )}
        />

        <Button
          type="submit"
          variant="primary"
          size="lg"
          fullWidth
          isLoading={isLoading}
          className={styles.submitButton}
        >
          Reset Password
        </Button>

        <div className={styles.footer}>
          <Link to={ROUTES.LOGIN} className={styles.backLink}>
            Back to login
          </Link>
        </div>
      </form>
    </div>
  );
};

export default ResetPassword;