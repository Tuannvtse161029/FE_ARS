import { useState } from 'react';
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
import authService from '../../services/auth.service';
import styles from './ResetPassword.module.css';
import ARSLogo from '../../assets/images/ARS_Logo.png';

interface LocationState {
  resetToken?: string;
}

const EyeIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const EyeOffIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
);

const ResetPassword = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state ?? {}) as LocationState;
  const resetToken = state.resetToken ?? '';

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordFormData>({
    resolver: yupResolver(resetPasswordSchema),
    defaultValues: { newPassword: '', confirmPassword: '' },
  });

  const onSubmit = async (data: ResetPasswordFormData) => {
    setIsLoading(true);
    setError(null);
    try {
      await authService.resetPassword({ token: resetToken, newPassword: data.newPassword });
      navigate(ROUTES.LOGIN, { replace: true });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unable to reset password. Please try again.';
      setError(msg);
    } finally {
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
                    {showNewPassword ? <EyeOffIcon /> : <EyeIcon />}
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
                  {showConfirmPassword ? <EyeOffIcon /> : <EyeIcon />}
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