import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { Input } from '../../components/Input';
import { Button } from '../../components/Button';
import { StepIndicator } from './components/StepIndicator';
import { ROUTES } from '../../routes/paths';
import {
  forgotPasswordSchema,
  type ForgotPasswordFormData,
} from '../../utils/validation';
import authService from '../../services/auth.service';
import styles from './ForgotPassword.module.css';
import ARSLogo from '../../assets/images/ARS_Logo.png';

const ForgotPassword = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordFormData>({
    resolver: yupResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  });

  const onSubmit = async (data: ForgotPasswordFormData) => {
    setIsLoading(true);
    setError(null);
    try {
      await authService.forgotPassword(data.email);
      setSubmittedEmail(data.email);
      navigate(ROUTES.VERIFY_OTP, { state: { email: data.email } });
    } catch (err: unknown) {
      // Stubbed for now — surface the BE-not-ready error inline so the form
      // remains usable once the backend is wired up.
      const msg = err instanceof Error ? err.message : 'Unable to send reset code. Please try again.';
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

      <StepIndicator currentStep={1} />

      <div className={styles.header}>
        <h1 className={styles.title}>Forgot your password?</h1>
        <p className={styles.subtitle}>
          Enter the email associated with your account and we'll send you a verification code to reset your password.
        </p>
      </div>

      <form className={styles.form} onSubmit={handleSubmit(onSubmit)}>
        {error && (
          <div className={styles.formError} role="alert">
            {error}
          </div>
        )}

        <Controller
          name="email"
          control={control}
          render={({ field }) => (
            <Input
              {...field}
              type="email"
              label="Email"
              placeholder="Enter your email"
              error={errors.email?.message}
              autoComplete="email"
              disabled={isLoading}
              className={styles.emailInput}
            />
          )}
        />

        {submittedEmail && (
          <p className={styles.helperText}>
            We sent a code to <strong>{submittedEmail}</strong>.
          </p>
        )}

        <Button
          type="submit"
          variant="primary"
          size="lg"
          fullWidth
          isLoading={isLoading}
          className={styles.submitButton}
        >
          Send reset code
        </Button>

        <div className={styles.footer}>
          <Link to={ROUTES.LOGIN} className={styles.backLink}>
            Back to sign in
          </Link>
        </div>
      </form>
    </div>
  );
};

export default ForgotPassword;