import { useRef, useState } from 'react';
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
import { extractServerMessage } from '../../utils/validationRules';
import authService from '../../services/auth.service';
import styles from './ForgotPassword.module.css';
import ARSLogo from '../../assets/images/ARS_Logo.png';

/**
 * Render a user-facing error for the `forgot-password` flow when the BE
 * has not yet exposed the public (anonymous) surface. The live Swagger
 * today only documents the auth-protected endpoints, so this flow
 * returns 401 against the production backend. We surface that clearly
 * to the user instead of letting axios's generic message leak in.
 */
function forgotPasswordError(err: unknown, fallback: string): string {
  return extractServerMessage(err, fallback);
}

const ForgotPassword = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null);
  // In-flight dedupe — block duplicate submits from rapid clicks while
  // the BE request is still pending.
  const inFlightRef = useRef(false);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordFormData>({
    resolver: yupResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  });

  const onSubmit = async (data: ForgotPasswordFormData) => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setIsLoading(true);
    setError(null);
    try {
      const cleanEmail = data.email.trim();
      await authService.forgotPassword({ email: cleanEmail });
      sessionStorage.setItem('ars_forgot_email', cleanEmail);
      setSubmittedEmail(cleanEmail);
      navigate(ROUTES.VERIFY_OTP, { state: { email: cleanEmail } });
    } catch (err: unknown) {
      const msg = forgotPasswordError(
        err,
        'Unable to send reset code. Please try again.',
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