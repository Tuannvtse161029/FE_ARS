import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { Input } from '../../components/Input';
import { Button } from '../../components/Button';
import { useAuth } from '../../context/AuthContext';
import { loginSchema, type LoginFormData } from '../../utils/validation';
import { ROUTES } from '../../routes/paths';
import RoleSelectionModal from './components/RoleSelectionModal';
import styles from './Login.module.css';
import ARSLogo from '../../assets/images/ARS_Logo.png';
import { Eye, EyeOff } from 'lucide-react';
import { GoogleSignInButton } from '../../components/auth/GoogleSignInButton';
import { GoogleLoginError } from '../../services/googleAuth.service';
import type { GoogleCredentialResponse } from '../../types/googleAuth';
import { authService } from '../../services/auth.service';
import { roleService, type RoleItem } from '../../services/role.service';
import { useT } from '../../i18n/I18nContext';
import { useShortcuts } from '../../hooks/useShortcuts';
import { storage } from '../../utils/storage';

const Login = () => {
  const t = useT();
  const {
    login,
    loginWithGoogle,
    isLoading,
    error,
    user,
    pendingRoleSelection,
    confirmRoleSelection,
    cancelRoleSelection,
  } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [availableRoles, setAvailableRoles] = useState<RoleItem[]>([]);
  const [rolesError, setRolesError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void roleService.fetchRoles()
      .then((roles) => {
        if (!cancelled) setAvailableRoles(roles);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setAvailableRoles([]);
        setRolesError(err instanceof Error ? err.message : 'Unable to load roles.');
      });
    return () => { cancelled = true; };
  }, []);

  // GIS-credential Google sign-in UI state. The double-submit guard is a
  // ref so double-clicks cannot enter the GIS callback twice; the loading
  // state is mirrored in React so the button can render a spinner.
  const googleInFlightRef = useRef(false);
  const [googlePending, setGooglePending] = useState(false);
  const [googleError, setGoogleError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: yupResolver(loginSchema),
    defaultValues: {
      email: storage.getSavedEmail() || '',
      password: '',
      selectedRole: '',
      rememberMe: storage.getRememberMe() || Boolean(storage.getSavedEmail()),
    },
  });

  // Pre-fill remembered email and checkbox state on load
  useEffect(() => {
    const saved = storage.getSavedEmail();
    const remember = storage.getRememberMe();
    if (saved) {
      setValue('email', saved);
    }
    if (remember || Boolean(saved)) {
      setValue('rememberMe', true);
    }
  }, [setValue]);

  // Part 2 — keyboard shortcuts for the login form:
  //   Ctrl+Enter  → submit the form
  //   Esc         → reset all fields to default values
  useShortcuts([
    {
      key: 'Enter',
      modifier: 'mod',
      label: 'Submit form',
      description: 'Sign in without clicking the button.',
      group: 'form',
      allowInInputs: true,
      handler: () => { void handleSubmit(onSubmit)(); },
    },
    {
      key: 'Escape',
      label: 'Clear form',
      description: 'Reset all fields.',
      group: 'form',
      allowInInputs: true,
      handler: () => reset(),
    },
  ]);

  const onSubmit = async (data: LoginFormData) => {
    if (data.rememberMe) {
      storage.setRememberMe(true);
      storage.setSavedEmail(data.email);
    } else {
      storage.setRememberMe(false);
      storage.removeSavedEmail();
    }
    await login(data);
  };

  // ── GIS credential Google sign-in handler ───────────────────────────────
  //
  // The agreed FE ↔ BE contract is the GIS credential flow:
  //
  //   1. The user clicks the "Sign in with Google" button (rendered by GIS).
  //   2. GIS returns a `CredentialResponse` whose `credential` field is a
  //      signed Google ID token (JWT).
  //   3. We POST `{ credential }` to `POST /api/Auth/google-login` via
  //      `AuthContext.loginWithGoogle`. The BE validates the credential,
  //      finds or creates the user, and returns the ARS session.
  //   4. `loginWithGoogle` handles routing: first-time users land on
  //      `/complete-google-registration`, pending/rejected users land on
  //      `/forum`, accepted users land on their workspace.
  //
  // Hard rules:
  //   - The `credential` is forwarded EXACTLY once. We never log it, echo
  //     it back to the UI, or store it beyond the in-flight submission.
  //   - The callback fires inside `AuthContext.loginWithGoogle` — this
  //     handler only releases the in-flight lock and surfaces recoverable
  //     errors.
  //   - The legacy Authorization Code redirect flow (Agent 54) is no longer
  //     invoked from the Login page.
  // ── End GIS credential Google sign-in handler ───────────────────────────
  const handleGoogleCredential = async (
    response: GoogleCredentialResponse,
  ): Promise<void> => {
    if (googleInFlightRef.current) return;
    setGoogleError(null);
    googleInFlightRef.current = true;
    setGooglePending(true);

    try {
      // Null-safe guest logout so a guest leaves anonymous state behind.
      authService.logout();
      await loginWithGoogle(response, { rememberMe: storage.getRememberMe() });
    } catch (err: unknown) {
      const fallback = t(
        'login.googleError',
        'Google sign-in failed. Please try again or use the email & password option.',
      );
      const message =
        err instanceof GoogleLoginError && err.message
          ? err.message
          : err instanceof Error && err.message
            ? err.message
            : fallback;
      setGoogleError(message);
    } finally {
      googleInFlightRef.current = false;
      setGooglePending(false);
    }
  };

  return (
    <div className={styles.loginPage}>
      {/* ── Compact Masthead — Journal Imprint ───────────────────────── */}
      <header className={styles.logoSection}>
        <div className={styles.logoRow}>
          <img src={ARSLogo} alt="ARS" className={styles.logoImage} />
          <span className={styles.brandText}>
            {t('landing.brandName', 'Academic Research Sharing')}
          </span>
        </div>
        <hr className={styles.logoRule} aria-hidden="true" />
      </header>

      {/* ── Page Title — Serif, Editorial Weight ─────────────────── */}
      <header className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>
          {t('auth.welcomeBack', 'Welcome back')}
        </h1>
      </header>

      {/* ── Login Form ──────────────────────────────────────────── */}
      <form onSubmit={handleSubmit(onSubmit)} className={styles.form} noValidate>
        {error && (
          <div className={styles.formError} role="alert">
            {error}
          </div>
        )}

        {/* Email field */}
        <Controller
          name="email"
          control={control}
          render={({ field }) => (
            <Input
              {...field}
              type="email"
              label={t('auth.email', 'Email address')}
              placeholder=" "
              floatLabel
              error={errors.email?.message}
              autoComplete="email"
              disabled={isLoading || googlePending}
              className={styles.loginInput}
            />
          )}
        />

        {/* Password field */}
        <div className={styles.passwordFieldWrapper}>
          <Controller
            name="password"
            control={control}
            render={({ field }) => (
              <Input
                {...field}
                type={showPassword ? 'text' : 'password'}
                label={t('auth.password', 'Password')}
                placeholder=" "
                floatLabel
                error={errors.password?.message}
                autoComplete="current-password"
                disabled={isLoading || googlePending}
                className={styles.loginInput}
                rightIcon={
                  <button
                    type="button"
                    className={styles.passwordToggle}
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={
                      showPassword
                        ? t('login.hidePassword', 'Hide password')
                        : t('login.showPassword', 'Show password')
                    }
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                }
              />
            )}
          />
        </div>

        {/* Role selector — optional, amber left-border accent */}
        <div className={styles.roleFieldWrapper}>
          <label className={styles.fieldLabel} htmlFor="selectedRole">
            {t('login.signInAsRole', 'Sign in as Role')}{' '}
            <span className={styles.optionalTag}>
              ({t('login.optional', 'optional')})
            </span>
          </label>
          <Controller
            name="selectedRole"
            control={control}
            defaultValue=""
            render={({ field }) => (
              <select
                {...field}
                id="selectedRole"
                className={styles.roleSelect}
                disabled={isLoading || googlePending}
                aria-describedby="role-hint"
              >
                <option value="">
                  {t('login.autoDetectRole', 'Auto-detect role')}
                </option>
                {availableRoles
                  .filter((role) => role.name !== 'Admin')
                  .map((role) => (
                    <option key={role.roleId ?? role.name} value={role.name}>
                      {t(`role.${role.name}`, role.name)}
                    </option>
                  ))}
              </select>
            )}
          />
          <span id="role-hint" className={styles.fieldHint}>
            {t(
              'login.roleHint',
              'Select a role here. You can log out and switch anytime.',
            )}
          </span>
          {errors.selectedRole?.message && (
            <span className={styles.fieldError}>
              {errors.selectedRole.message}
            </span>
          )}
          {rolesError && (
            <span className={styles.fieldError}>{rolesError}</span>
          )}
        </div>

        {/* Remember me + Forgot password */}
        <div className={styles.rememberRow}>
          <Controller
            name="rememberMe"
            control={control}
            defaultValue={false}
            render={({ field }) => (
              <label className={styles.toggleWrapper}>
                <input
                  type="checkbox"
                  name="rememberMe"
                  className={styles.toggleInput}
                  checked={Boolean(field.value)}
                  onChange={(e) => field.onChange(e.target.checked)}
                  onBlur={field.onBlur}
                  ref={field.ref}
                  id="remember-me"
                />
                <span className={styles.toggleSlider} aria-hidden="true" />
                <span className={styles.toggleLabel} htmlFor="remember-me">
                  {t('auth.rememberMe', 'Remember me')}
                </span>
              </label>
            )}
          />
          <Link to={ROUTES.FORGOT_PASSWORD} className={styles.forgotLink}>
            {t('auth.forgotPassword', 'Forgot password?')}
          </Link>
        </div>

        {/* Submit */}
        <Button
          type="submit"
          variant="primary"
          size="lg"
          fullWidth
          isLoading={isLoading}
          className={styles.submitButton}
        >
          {t('auth.signInButton', 'Sign in')}
        </Button>

        {/* Google sign-in */}
        <div className={styles.googleButtonWrapper}>
          <GoogleSignInButton
            onCredential={handleGoogleCredential}
            disabled={isLoading || googlePending}
            pending={googlePending}
            errorMessage={googleError}
            intent="signin"
          />
        </div>
        {googleError && (
          <div className={styles.formError} role="alert">
            {googleError}
          </div>
        )}

        {/* Footer link */}
        <div className={styles.footer}>
          <p className={styles.footerText}>
            {t('auth.noAccount', "Don't have an account?")}{' '}
            <Link to={ROUTES.REGISTER} className={styles.registerLink}>
              {t('auth.signUpHere', 'Sign up now')}
            </Link>
          </p>
        </div>
      </form>

      {/* Multi-role selection modal — appears after BE login returns > 1 role */}
      <RoleSelectionModal
        open={Boolean(pendingRoleSelection)}
        username={user?.username ?? pendingRoleSelection?.authResponse.username}
        roles={pendingRoleSelection?.roles ?? []}
        onConfirm={confirmRoleSelection}
        onCancel={cancelRoleSelection}
      />
    </div>
  );
};

export default Login;
