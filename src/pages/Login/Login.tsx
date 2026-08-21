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
import {
  googleOAuthService,
  GoogleOAuthError,
} from '../../services/googleOAuth.service';
import { authService } from '../../services/auth.service';

const FAST_LOGIN_USERS = [
  { label: 'Researcher', email: 'researcher@arsplatform.com', password: 'Researcher1234' },
  { label: 'Reviewer', email: 'reviewer1.ars@arsplatform.test', password: 'Reviewer1234' },
  { label: 'Admin', email: 'admin@arsplatform.com', password: 'Password123' },
  { label: 'Lecturer', email: 'lecturer@arsplatform.com', password: 'Lecturer1234' },
  { label: 'Grad Student', email: 'gradstudent@arsplatform.com', password: 'Student1234' },
] as const;

const Login = () => {
  const { login, isLoading, error, user, pendingRoleSelection, confirmRoleSelection, cancelRoleSelection } = useAuth();
  const [showPassword, setShowPassword] = useState(false);

  // ── Agent 54 — Google Sign-In UI state (in-flight lock + error surface) ──
  // The submit lock is a ref so double-clicks cannot enter the redirect
  // before React-18's StrictMode double-invoke or a second tap has a
  // chance to re-enter. The service layer mirrors this with a
  // module-level flag in googleOAuth.service.ts.
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
      // rememberMe is now managed by react-hook-form (and forwarded to
      // AuthContext.login()). Storage bucket selection happens in
      // persistAuthAndNavigate, which calls storage.setRememberMe() BEFORE
      // storage.setToken()/setUser() so the token lands in the correct store.
      rememberMe: false,
    },
  });

  const onSubmit = async (data: LoginFormData) => {
    // Pass the full form payload (now including rememberMe) through to the
    // AuthContext. Yup's default keeps rememberMe as a real boolean even
    // when the user never touched the checkbox, so this is safe.
    await login(data);
  };

  const handleFastLogin = (email: string, password: string) => {
    setValue('username', email);
    setValue('password', password);
  };

  // ── Agent 54 — Google OAuth begin handler ────────────────────────────────
  //
  // The BE has moved from a GIS credential swap (`POST /api/Auth/google-login`)
  // to a server-issued OAuth Authorization Code flow:
  //
  //   1. The user clicks the "Sign in with Google" button.
  //   2. We issue `window.location.assign(GET /api/Auth/google-oauth-login)`.
  //   3. The BE redirects to Google; the user consents.
  //   4. Google redirects back to `/api/Auth/google-callback?code=...` (or
  //      `?error=...` on cancel / error). The BE then 302s the browser to
  //      our `/auth/google/callback` page (handled by GoogleCallback.tsx).
  //
  // Hard rules:
  //   - The Google `code`, the ARS JWT, and any access/refresh tokens are
  //     NEVER logged, echoed in the address bar, or stored beyond the
  //     standard `ars_token` bucket the rest of the FE already uses.
  //   - The OAuth redirect is in-flight deduped at TWO layers: a local
  //     ref + state (UI lock) and a module-level guard inside the service.
  //     Rapid double-clicks cannot issue two redirects.
  //   - We do NOT call the legacy `POST /api/Auth/google-login` flow any
  //     more. The legacy service is retained for tests but is not invoked
  //     from the Login page.
  //   - Defensive null-safe guest logout is run before the OAuth redirect
  //     so a guest who clicks "Sign in with Google" leaves any anonymous
  //     state behind. `authService.logout()` / `clearAuthSession()` no-op
  //     on empty storage — safe for guests.
  //   - On a synchronous failure (e.g. the URL was malformed) we surface a
  //     recoverable error and release the in-flight flag so the user can
  //     retry. The navigate-away case does not need to release the flag —
  //     the callback page does it once it mounts.
  const handleBeginGoogleOAuth = async () => {
    setGoogleError(null);

    // UI-layer duplicate guard. The service also guards via a module-level
    // flag, but having the UI lock lets us flip the button into a loading
    // state immediately on the first click.
    if (googleInFlightRef.current) return;
    googleInFlightRef.current = true;
    setGooglePending(true);

    try {
      // Null-safe guest logout: a guest who clicks "Sign in with Google"
      // leaves any anonymous state behind before the OAuth handshake.
      // `authService.logout()` and the underlying `clearAuthSession()`
      // both no-op when there is no token / user.
      authService.logout();

      // The backend owns the Google callback and its registered redirect URI.
      // Swagger defines this endpoint without query parameters, so do not send
      // the frontend callback as redirect_uri.
      await googleOAuthService.beginGoogleOAuth();
    } catch (err: unknown) {
      const fallback =
        'Could not start the Google sign-in flow. Please try again or use the email & password option.';
      setGoogleError(
        err instanceof GoogleOAuthError && err.message ? err.message : fallback,
      );
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
            onBegin={handleBeginGoogleOAuth}
            disabled={isLoading || googlePending}
            pending={googlePending}
            errorMessage={googleError}
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
                  onClick={() => handleFastLogin(user.email, user.password)}
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
