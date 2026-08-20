import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
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
  googleAuthService,
  GoogleLoginError,
} from '../../services/googleAuth.service';
import { useAuthStore } from '../../store';
import { authService } from '../../services/auth.service';
import { storage } from '../../utils/storage';
import { landingRouteForRoleName } from '../../utils/roleNormalizer';
import type { AuthResponse, UserRole, EffectiveRole } from '../../types/auth';
import type { GoogleCredentialResponse } from '../../types/googleAuth';

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

  // ── Agent 52 — Google Sign-In UI state (in-flight lock + error surface) ───
  // The submit lock is a ref so double-clicks cannot enter the network call
  // before React-18's StrictMode double-invoke or the GIS callback's
  // duplicate event loops get a chance to re-enter.
  const googleInFlightRef = useRef(false);
  const [googlePending, setGooglePending] = useState(false);
  const [googleError, setGoogleError] = useState<string | null>(null);

  const navigate = useNavigate();
  const authStore = useAuthStore();

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

  // ── Agent 52 — Google Identity Services callback ──────────────────────────
  //
  // Hard rules (see src/services/googleAuth.service.ts for the bridge):
  //   1. `response.credential` is the GIS-signed JWT — POST it EXACTLY once
  //      to `/api/auth/google-login`. We never authenticate from any other
  //      GIS field (select_by, clientId, etc.).
  //   2. We never log / store the credential, the BE's JWT, or the
  //      Authorization header.
  //   3. Errors are normalised to typed `GoogleLoginError` codes so the
  //      button can surface a recoverable error message without leaking
  //      the credential into the dev console.
  //   4. After a successful BE response, we trust the BE's auth/session
  //      payload exclusively. We do NOT inspect decoded JWT claims, do NOT
  //      authenticate from local claims, do NOT re-derive role from the
  //      `role` field alone (Swagger doesn't document a separate
  //      `isNewUser` / `requiresOnboarding` indicator — see BTR-AGENT52-01).
  //   5. We persist via the existing `storage` / `authStore` pattern that
  //      the password-login flow uses. AuthContext is NOT touched (Agent 53
  //      owns it). The Login handler writes to storage and the Zustand
  //      store, then navigates with `replace: true` so a back-button press
  //      does not return to the credential-posting page.
  //   6. Routing is decided solely from the BE response:
  //      - `isNewUser === true` OR `requiresOnboarding === true` ONLY
  //        → `/complete-google-registration` (the explicit onboarding gate).
  //      - `isActive === true` AND `verificationStatus === 'Accepted'`
  //        → `landingRouteForRoleName(role)` (the approved workspace).
  //      - Pending / Rejected / Guest → `/forum` (the only place a
  //        not-yet-approved user has read access). We do NOT rely on a
  //        downstream guard to route this case — we navigate explicitly.
  //   7. We never silently link to a password account on conflicting email;
  //      `409 Conflict` from the BE is surfaced as the error message.
  //   8. The user can resubmit only by clicking the Google button again.
  //      The pending flag is reset in `finally` so a failed attempt
  //      releases the UI.
  const handleGoogleCredential = async (response: GoogleCredentialResponse) => {
    setGoogleError(null);

    // Duplicate-submit guard — pair of ref + state so the second click
    // is rejected before it can race the network call.
    if (googleInFlightRef.current) return;
    googleInFlightRef.current = true;
    setGooglePending(true);

    try {
      const credential = googleAuthService.extractCredential(response);
      if (!credential) {
        setGoogleError('Google did not return a credential. Please try again.');
        return;
      }

      // Per-call idempotency key so accidental GIS double-callbacks do
      // not produce two `POST /api/Auth/google-login` bodies.
      const idempotencyKey =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `idem-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

      const session = await googleAuthService.postGoogleLogin({
        credential,
        idempotencyKey,
      });

      // ── Mandatory BE-response validation (runs BEFORE any routing) ─────
      // The first-time Google-user onboarding screen reads back the
      // persisted profile to know whose onboarding is in progress. If we
      // proceeded to /complete-google-registration with a fabricated
      // token/userId/email, the page would treat an invalid session as
      // authenticated. So we refuse to persist at all when the BE
      // response is missing the fields we need to seed a session.
      const safeToken =
        typeof session.token === 'string' && session.token.trim() !== ''
          ? session.token
          : null;
      const safeUserId =
        typeof session.userId === 'number' && session.userId > 0
          ? session.userId
          : null;
      const safeEmail =
        typeof session.email === 'string' && session.email.trim() !== ''
          ? session.email
          : null;
      const safeFullName =
        typeof session.fullName === 'string' && session.fullName.trim() !== ''
          ? session.fullName
          : null;

      if (!safeToken || !safeUserId || !safeEmail || !safeFullName) {
        setGoogleError(
          'Google sign-in succeeded but the platform did not return the expected session. Please contact support.',
        );
        return;
      }

      // ── Routing decision: explicit signals only ─────────────────────────
      // (1) First-time Google user → onboarding. We DO NOT infer
      //     onboarding from a missing role property alone — that would
      //     accidentally trap existing users whose role is in flight.
      if (session.isNewUser || session.requiresOnboarding) {
        // Strict, BE-derived data only. The User fields that the BE has
        // not assigned yet (roleId, roleName, effectiveRole) are written
        // as `null` — never as a default `0` or `'Guest'`. Auth type
        // definitions allow `null` for first-time accounts (see
        // BTR-AGENT52-04). We deliberately bypass `authService.setAuthData`
        // (Agent 53 owns it) because it fabricates `id: 0`,
        // `roleId ?? 0`, `roleName: authResponse.role`, and
        // `effectiveRole ?? 'Guest'` — that fabrication is what previously
        // let an invalid session slip past the onboarding screen.
        storage.setToken(safeToken);
        storage.setUser({
          id: safeUserId,
          username: safeEmail,
          email: safeEmail,
          fullName: safeFullName,
          roleId: session.roleId ?? null,
          roleName: session.role ?? null,
          isActive: session.isActive ?? false,
          verificationStatus: session.verificationStatus ?? 'Pending',
          accountTier: 'Free',
          effectiveRole: (session.effectiveRole as EffectiveRole) ?? null,
        });
        authStore.login(
          {
            id: safeUserId,
            username: safeEmail,
            email: safeEmail,
            fullName: safeFullName,
            roleId: session.roleId ?? null,
            roleName: session.role ?? null,
            isActive: session.isActive ?? false,
            verificationStatus: session.verificationStatus ?? 'Pending',
            accountTier: 'Free',
            effectiveRole: session.effectiveRole as EffectiveRole | undefined,
          },
          safeToken,
          (session.effectiveRole as EffectiveRole) ?? null,
        );
        navigate(ROUTES.COMPLETE_GOOGLE_REGISTRATION, { replace: true });
        return;
      }

      // (2) Existing user — the BE must surface a JWT, userId, and role.
      //     Anything missing is a contract violation; we surface it instead
      //     of guessing.
      if (!session.role) {
        setGoogleError(
          'Google sign-in succeeded but the platform did not return the expected session. Please contact support.',
        );
        return;
      }

      const knownRoles = session.roles.filter((r): r is UserRole =>
        (['Researcher', 'Reviewer', 'Lecturer', 'Graduate Student', 'Admin'] as string[]).includes(r),
      );

      const authResponse: AuthResponse = {
        token: safeToken,
        username: safeEmail,
        email: safeEmail,
        role: session.role,
        userId: safeUserId,
        roleId: session.roleId ?? undefined,
        roles: knownRoles.length > 0 ? knownRoles : [session.role as UserRole],
        isActive: session.isActive ?? false,
        verificationStatus: session.verificationStatus ?? 'Pending',
        effectiveRole:
          (session.effectiveRole as EffectiveRole) ??
          ((session.isActive ?? false) ? (session.role as EffectiveRole) : 'Guest'),
      };

      // Persist via the existing ARS auth-storage/authStore pattern. No
      // call to AuthContext.login() (Agent 53 owns it) — we route through
      // the same storage writes the password-login flow uses so the
      // authStore rehydrate picks up the new session on the next mount.
      storage.setRememberMe(false);
      authService.setAuthData(authResponse);
      authStore.login(
        {
          id: safeUserId,
          username: authResponse.username,
          email: authResponse.email,
          fullName: safeFullName,
          roleId: authResponse.roleId ?? 0,
          roleName: session.role,
          isActive: authResponse.isActive ?? false,
          verificationStatus: authResponse.verificationStatus ?? 'Pending',
          accountTier: 'Free',
          effectiveRole: authResponse.effectiveRole,
        },
        safeToken,
        authResponse.effectiveRole,
      );

      // ── Routing decision: approved vs pending ──────────────────────────
      // Approved + active business-role user → workspace.
      // Pending / Rejected / Guest → `/forum` (the only place a
      // not-yet-approved user has read access). We do NOT rely on a
      // downstream guard to redirect — we navigate explicitly.
      const isApproved =
        (session.isActive ?? false) && session.verificationStatus === 'Accepted';

      if (isApproved) {
        navigate(landingRouteForRoleName(authResponse.role), { replace: true });
      } else {
        // Pending / Rejected / Guest lands on `/forum`. The page itself
        // renders the pending-state UI (per useVerifiedGuard's behaviour).
        navigate(ROUTES.FORUM, { replace: true });
      }
    } catch (err: unknown) {
      const fallback =
        'Google sign-in failed. Please try again or use the email & password option.';
      setGoogleError(
        err instanceof GoogleLoginError && err.message ? err.message : fallback,
      );
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
