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

const Login = () => {
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
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: yupResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
      selectedRole: '',
      // rememberMe is now managed by react-hook-form (and forwarded to
      // AuthContext.login()). Storage bucket selection happens in
      // persistAuthAndNavigate, which calls storage.setRememberMe() BEFORE
      // storage.setToken()/setUser() so the token lands in the correct store.
      rememberMe: false,
    },
  });

  const onSubmit = async (data: LoginFormData) => {
    // Pass the full form payload (now including rememberMe and selectedRole) through to the AuthContext.
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
      await loginWithGoogle(response);
    } catch (err: unknown) {
      const fallback =
        'Google sign-in failed. Please try again or use the email & password option.';
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
      {/* Brand & Logo Header — centered masthead, journal inside-cover feel */}
      <header className={styles.logoSection}>
        <img src={ARSLogo} alt="ARS Logo" className={styles.logoImage} />
        <span className={styles.brandText}>Academic Research System</span>
      </header>

      {/* Page Title */}
      <header className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Nice to see you again</h1>
      </header>

      {/* Login Form */}
      <form onSubmit={handleSubmit(onSubmit)} className={styles.form}>
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
              placeholder="name@institution.edu"
              error={errors.email?.message}
              autoComplete="email"
              disabled={isLoading || googlePending}
              className={styles.loginInput}
            />
          )}
        />

        <div className={styles.passwordFieldWrapper}>
          <Controller
            name="password"
            control={control}
            render={({ field }) => (
              <Input
                {...field}
                type={showPassword ? 'text' : 'password'}
                label="Password"
                placeholder="Enter password"
                error={errors.password?.message}
                autoComplete="current-password"
                disabled={isLoading || googlePending}
                className={styles.loginInput}
                rightIcon={
                  <button
                    type="button"
                    className={styles.passwordToggle}
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                }
              />
            )}
          />
        </div>

        <div className={styles.roleFieldWrapper}>
          <label className={styles.fieldLabel} htmlFor="selectedRole">
            Sign in as Role <span className={styles.optionalTag}>(Optional)</span>
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
              >
                <option value="">Auto-detect Role (Default)</option>
                {availableRoles
                  .filter((role) => role.name !== 'Admin')
                  .map((role) => (
                    <option key={role.roleId ?? role.name} value={role.name}>
                      {role.name}
                    </option>
                  ))}
              </select>
            )}
          />
          {errors.selectedRole?.message && (
            <span className={styles.fieldError}>{errors.selectedRole.message}</span>
          )}
          <span className={styles.fieldHint}>
            Holding multiple roles? Select your role here. You can log out anytime to switch roles.
          </span>
          {rolesError && <span className={styles.fieldError}>{rolesError}</span>}
        </div>

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
                />
                <span className={styles.toggleSlider}></span>
                <span className={styles.toggleLabel}>Remember me</span>
              </label>
            )}
          />
          <Link to={ROUTES.FORGOT_PASSWORD} className={styles.forgotLink}>
            Forgot password?
          </Link>
        </div>

        <Button
          type="submit"
          variant="primary"
          size="lg"
          fullWidth
          isLoading={isLoading}
          className={styles.submitButton}
        >
          Sign in
        </Button>

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

        <div className={styles.footer}>
          <p className={styles.footerText}>
            Don't have an account?{' '}
            <Link to={ROUTES.REGISTER} className={styles.registerLink}>
              Sign up now
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
