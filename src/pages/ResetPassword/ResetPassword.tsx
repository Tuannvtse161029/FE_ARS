import { useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { AxiosError } from 'axios';
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
  resetToken?: string;
}

/**
 * Render a user-facing error for the `reset-password` flow when the BE
 * has not yet exposed the public (anonymous) surface. The live Swagger
 * today only documents the auth-protected endpoints, so this flow
 * returns 401 against the production backend.
 */
function resetPasswordError(err: unknown, fallback: string): string {
  if (err instanceof AxiosError && (err.response?.status === 401 || err.response?.status === 403)) {
    return 'Password reset is not yet available. Please contact support or try again later.';
  }
  return extractServerMessage(err, fallback);
}

const ResetPassword = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state ?? {}) as LocationState;
  const resetToken = state.resetToken ?? '';

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const inFlightRef = useRef(false);

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
    try {
      await authService.resetPassword({ resetToken, newPassword: data.newPassword });
      navigate(ROUTES.LOGIN, { replace: true });
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