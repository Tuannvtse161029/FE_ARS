import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { Input } from '../../components/Input';
import { Button } from '../../components/Button';
import { StepIndicator } from './components/StepIndicator';
import { ROUTES } from '../../routes/paths';
import { useI18n } from '../../i18n/I18nContext';
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
  const { t } = useI18n();
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
      setSuccessMessage(t('reset.successMessage', 'Password reset successfully! Redirecting to login...'));
      setTimeout(() => {
        navigate(ROUTES.LOGIN, { replace: true });
      }, 1500);
    } catch (err: unknown) {
      const msg = resetPasswordError(
        err,
        t('reset.errorReset', 'Unable to reset password. Please try again.')
      );
      setError(msg);
    } finally {
      inFlightRef.current = false;
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <header className={styles.logoSection}>
        <img src={ARSLogo} alt="ARS Logo" className={styles.logoImage} />
        <span className={styles.brandText}>{t('app.brandName', 'ARS - Academic Research Sharing')}</span>
      </header>

      <StepIndicator currentStep={3} />

      <header className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>{t('reset.title', 'Reset Password')}</h1>
        <p className={styles.pageSubtitle}>
          {t('reset.subtitleNewPassword', 'Set a new password for your account. Make sure it\'s strong and easy to remember.')}
        </p>
      </header>

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
                label={t('reset.newPassword', 'New Password')}
                placeholder={t('reset.newPasswordPlaceholder', 'Enter new password')}
                error={errors.newPassword?.message}
                autoComplete="new-password"
                disabled={isLoading}
                className={styles.passwordInput}
                rightIcon={
                  <button
                    type="button"
                    className={styles.passwordToggle}
                    onClick={() => setShowNewPassword((s) => !s)}
                    aria-label={showNewPassword ? t('login.hidePassword', 'Hide password') : t('login.showPassword', 'Show password')}
                  >
                    {showNewPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                }
              />
            )}
          />
          <p className={styles.passwordHint}>
            {t('reset.passwordHint', 'Password must contain at least 8 characters, including one uppercase letter and one number.')}
          </p>
        </div>

        <Controller
          name="confirmPassword"
          control={control}
          render={({ field }) => (
            <Input
              {...field}
              type={showConfirmPassword ? 'text' : 'password'}
              label={t('reset.confirmPassword', 'Confirm New Password')}
              placeholder={t('reset.confirmPasswordPlaceholder', 'Re-enter new password')}
              error={errors.confirmPassword?.message}
              autoComplete="new-password"
              disabled={isLoading}
              className={styles.passwordInput}
              rightIcon={
                <button
                  type="button"
                  className={styles.passwordToggle}
                  onClick={() => setShowConfirmPassword((s) => !s)}
                  aria-label={showConfirmPassword ? t('login.hidePassword', 'Hide password') : t('login.showPassword', 'Show password')}
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
          {t('reset.resetButton', 'Reset Password')}
        </Button>

        <div className={styles.footer}>
          <Link to={ROUTES.VERIFY_OTP} className={styles.backLink}>
            {t('reset.reenterCode', 'Re-enter code')}
          </Link>
          <span className={styles.footerDivider} aria-hidden="true">/</span>
          <Link to={ROUTES.LOGIN} className={styles.backLink}>
            {t('reset.backToLogin', 'Back to login')}
          </Link>
        </div>
      </form>
    </div>
  );
};

export default ResetPassword;