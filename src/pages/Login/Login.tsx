import { useRef, useState } from 'react';
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

const FAST_LOGIN_USERS = [
  { label: 'Researcher', email: 'researcher@arsplatform.com', password: 'Researcher1234', role: 'Researcher' },
  { label: 'Reviewer', email: 'reviewer1.ars@arsplatform.test', password: 'Reviewer1234', role: 'Reviewer' },
  { label: 'Admin', email: 'admin@arsplatform.com', password: 'Password123', role: 'Admin' },
  { label: 'Lecturer', email: 'lecturer@arsplatform.com', password: 'Lecturer1234', role: 'Lecturer' },
  { label: 'Grad Student', email: 'gradstudent@arsplatform.com', password: 'Student1234', role: 'Graduate Student' },
] as const;

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

  // GIS-credential Google sign-in UI state. The double-submit guard is a
  // ref so double-clicks cannot enter the GIS callback twice; the loading
  // state is mirrored in React so the button can render a spinner.
  const googleInFlightRef = useRef(false);
  const [googlePending, setGooglePending] = useState(false);
  const [googleError, setGoogleError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: yupResolver(loginSchema),
    defaultValues: {
      username: '',
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

  const handleFastLogin = (email: string, password: string, role?: string) => {
    setValue('username', email);
    setValue('password', password);
    if (role) {
      setValue('selectedRole', role);
    }
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
      <div className={styles.logoSection}>
        <img src={ARSLogo} alt="ARS Logo" className={styles.logoImage} />
        <span className={styles.brandText}>Academic Research Sharing</span>
      </div>

      <div className={styles.header}>
        <h1 className={styles.title}>Nice to see you again</h1>
      </div>

      <form className={styles.form} onSubmit={handleSubmit(onSubmit)}>
        {error && (
          <div className={styles.formError} role="alert">
            {error}
          </div>
        )}

        <Controller
          name="username"
          control={control}
          render={({ field }) => (
            <Input
              {...field}
              label="Login"
              placeholder="Email or phone number"
              error={errors.username?.message}
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
                    tabIndex={-1}
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
                <option value="Researcher">Researcher</option>
                <option value="Reviewer">Reviewer</option>
                <option value="Lecturer">Lecturer</option>
                <option value="Graduate Student">Graduate Student</option>
                <option value="Admin">Administrator</option>
              </select>
            )}
          />
          <span className={styles.fieldHint}>
            Holding multiple roles? Select your role here. You can log out anytime to switch roles.
          </span>
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

        {import.meta.env.DEV && (
          <>
            <div className={styles.devDivider}>
              <span className={styles.devDividerLine} />
              <span className={styles.devDividerText}>Dev only</span>
              <span className={styles.devDividerLine} />
            </div>

            <div className={styles.fastLoginGrid}>
              {FAST_LOGIN_USERS.map((user) => (
                <button
                  key={user.label}
                  type="button"
                  className={styles.fastLoginBtn}
                  onClick={() => handleFastLogin(user.email, user.password, user.role)}
                  disabled={isLoading}
                >
                  {user.label}
                </button>
              ))}
            </div>
          </>
        )}

        <div className={styles.footer}>
          <p className={styles.footerText}>
            Dont have an account?{' '}
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
