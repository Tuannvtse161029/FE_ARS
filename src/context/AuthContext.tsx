import { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store';
import { useWelcomeSignal } from '../store/welcomeSignal';
import authService, { clearAuthSession } from '../services/auth.service';
import { userService } from '../services/user.service';
import {
  googleAuthService,
  type CompleteGoogleRegistrationResponse,
} from '../services/googleAuth.service';
import { ROUTES } from '../routes/paths';
import type { LoginRequest, AuthResponse, User, UserRole, EffectiveRole } from '../types/auth';
import type { GoogleCredentialResponse } from '../types/googleAuth';
import { isAdminUser, landingRouteForRoleName } from '../utils/roleNormalizer';
import {
  isFirstTimeOnboardingUser,
  type PostAuthSnapshot,
} from '../utils/postAuthRoute';
import { storage } from '../utils/storage';
import {
  acquireGoogleLoginSession,
} from '../utils/googleLoginGuard';

interface AuthContextType {
  user: AuthResponse | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (credentials: LoginRequest) => Promise<void>;
  /**
   * GIS-credential Google sign-in. POSTs the opaque Google ID token to
   * `POST /api/Auth/google-login` via `googleAuthService.postGoogleLogin`
   * and routes the user to the right workspace — new users go to the
   * existing onboarding page, pending/rejected users land on /forum,
   * accepted users land on their workspace.
   */
  loginWithGoogle: (
    credentialOrResponse: string | GoogleCredentialResponse,
    options?: { rememberMe?: boolean },
  ) => Promise<void>;
  /**
   * Agent 30 — submit the first-time Google onboarding completion payload
   * to `POST /api/Auth/complete-google-registration`.
   *
   * The ARS session is forwarded implicitly through the shared axios
   * `Authorization: Bearer <ars-jwt>` header (see `services/axios.ts`).
   * The BE derives the user id from the JWT subject — we do NOT echo
   * the upstream Google ID token, the OAuth code, or any client-supplied
   * user id into the body. This is true for both the credential flow
   * (Login → `POST /api/Auth/google-login`) and the legacy
   * code-redirect flow (`/auth/google/callback`); both produce the same
   * ARS session, so a single onboarding submit works for either entry
   * path.
   *
   * The context:
   *   • posts the documented onboarding payload exactly once per call
   *     (the page owns the double-click / in-flight guard)
   *   • refetches the BE's authoritative user record so the auth store
   *     and ars_user blob reflect the new pending state
   *   • routes to `/forum` — pending Guests do not get into role
   *     workspaces, and the verified-guard renders the pending banner.
   */
  completeGoogleRegistration: (
    payload: {
      pdfUrl: string;
      phoneNumber: string;
      role: string;
      orcidId?: string;
      consents?: Array<{ documentType: string; version: string }>;
    },
  ) => Promise<{
    status: 'submitted';
    requestStatus: string | null;
    onboardingStatus: string | null;
    role: string | null;
    effectiveRole: string | null;
  }>;
  /**
   * Removed in this revision — the onboarding completion endpoint
   * authenticates via the ARS JWT only. The Google ID token is never
   * cached or echoed; both the credential-flow (Login → GIS) and the
   * legacy code-redirect-flow (`/auth/google/callback`) share the
   * same ARS session, so a single onboarding submit works for both.
   */
  logout: () => void;
  /**
   * Agent 53 — failed-session recovery (401 / 403 / token-expired). Clears
   * the centralized ARS session and resets the Zustand store without
   * navigating; the caller is expected to redirect. Equivalent to logout
   * minus the navigation step. Safe to invoke from non-React surfaces
   * that hold a reference to this method.
   */
  handleSessionFailure: () => void;
  clearError: () => void;
  // Set when the BE returned more than one role for this user. The FE shows
  // a picker; the user picks a role and we call `confirmRoleSelection`.
  // `rememberMe` is captured here from the original login form so that the
  // role-confirmation path routes the persisted token to the same bucket the
  // user originally asked for.
  pendingRoleSelection: {
    roles: UserRole[];
    selectedRole: UserRole | null;
    authResponse: AuthResponse;
    rememberMe: boolean;
  } | null;
  confirmRoleSelection: (role: UserRole) => void;
  cancelRoleSelection: () => void;
  /**
   * Agent 39 — authoritative role the user holds *right now*. Mirrors
   * `AuthResponse.effectiveRole` (BE-derived) or the persisted value after
   * page reload. `null` until the next successful login or while a
   * pre-migration blob is being rehydrated.
   */
  effectiveRole: EffectiveRole | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Agent 39 — derive the authoritative effective role for the just-logged-in
 * user. Trust the BE value (from `GET /api/user/{id}` or the login response)
 * when present; fall back to the derived value (unverified ⇒ 'Guest').
 * Never coerce an unknown string to 'Guest'.
 */
function resolveEffectiveRole(
  freshUser: User | null,
  response: AuthResponse,
  roleToUse: string,
): EffectiveRole {
  const fromFresh = freshUser?.effectiveRole;
  if (fromFresh) return fromFresh;
  const fromResponse = response.effectiveRole;
  if (fromResponse) return fromResponse;
  const isActive = freshUser?.isActive ?? response.isActive ?? false;
  return isActive ? (roleToUse as EffectiveRole) : 'Guest';
}

/**
 * Routing-rule helpers (Agent 52 — Google entry paths).
 *
 * The loginWithGoogle + GoogleCallback routing rules per the task spec:
 *   1. Onboarding page when BE signals `isNewUser || requiresOnboarding`
 *      OR when `role` is empty AND `roleId` is absent/zero. The second
 *      clause is the documented fallback for BE versions that don't
 *      surface `isNewUser` / `requiresOnboarding` (BTR-AGENT52-01).
 *   2. /forum as Guest when the role is non-null but the account is
 *      not approved (Pending verification OR isActive=false).
 *   3. Otherwise, preserve the existing role landing route.
 *
 * `hasNonEmptyRole` accepts strings, null, undefined, and trimmed-empty.
 * `hasPositiveRoleId` accepts finite positive integers (per ROLE_IDS) and
 * treats null/undefined/zero/non-finite as "no role id assigned".
 */
function hasNonEmptyRole(role: unknown): boolean {
  return typeof role === 'string' && role.trim().length > 0;
}

function hasPositiveRoleId(roleId: unknown): boolean {
  return (
    typeof roleId === 'number' &&
    Number.isFinite(roleId) &&
    roleId > 0
  );
}

const KNOWN_BUSINESS_ROLES: readonly UserRole[] = [
  'Researcher',
  'Reviewer',
  'Lecturer',
  'Graduate Student',
  'Admin',
];

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const navigate = useNavigate();
  const authStore = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingRoleSelection, setPendingRoleSelection] = useState<{
    roles: UserRole[];
    selectedRole: UserRole | null;
    authResponse: AuthResponse;
    rememberMe: boolean;
  } | null>(null);

  // Agent 53 — single in-flight logout guard. Multiple subscribers
  // (MainLayout profile menu, Onboarding flow, PendingVerification page,
  // PublicRoute 401 interceptor, useVerifiedGuard bounce) may invoke
  // logout() concurrently. The ref guarantees we only run the cleanup
  // and the navigation once; subsequent invocations become no-ops while
  // the guard is held.
  const logoutInFlightRef = useRef(false);

  /**
   * Persist the BE auth response into both the storage layer and the Zustand
   * store, then route based on the supplied role. Centralized here so the
   * single-role and multi-role branches in `login()` behave identically.
   *
   * `rememberMe` is the user's "Remember me" checkbox choice from the login
   * form. We flip the storage bucket BEFORE writing the token/user so that
   * storage.setToken / setUser (which call rememberBucket()) land in the
   * correct backing store (localStorage vs sessionStorage) without changing
   * their signatures.
   *
   * Immediately after login, we call GET /api/user/{id} to fetch the BE's
   * authoritative user record. This overwrites ars_user with fresh data so
   * the user NEVER sees stale verificationStatus / isActive from a prior session
   * (e.g. an account approved by an Admin while the user was offline).
   */
  const persistAuthAndNavigate = useCallback(
    async (response: AuthResponse, roleToUse: string, rememberMe: boolean) => {
      // Select the storage bucket first — rememberBucket() inside storage.ts
      // reads getRememberMe() on every setToken/setUser call, so we MUST set
      // this BEFORE any setToken/setUser call below.
      storage.setRememberMe(rememberMe);
      storage.setToken(response.token);

      // Immediately fetch the authoritative user profile from the BE so ars_user
      // is written with the current state (verificationStatus, isActive, etc.).
      // Falls back to the login response fields if the GET fails (network glitch
      // or BE temporarily down — the stale snapshot is no worse than nothing).
      let freshUser: User | null = null;
      try {
        const userId = response.userId ?? 0;
        if (userId !== 0) {
          freshUser = await userService.getById(userId);
        }
      } catch {
        // silently skip — use the login response below as fallback
      }

      const userId = freshUser?.id ?? response.userId ?? 0;
      const persistedRoles: UserRole[] =
        freshUser?.roles ?? response.roles ?? (roleToUse ? [roleToUse as UserRole] : []);
      const userToPersist = freshUser ?? {
        id: userId,
        username: response.username,
        email: response.email,
        fullName: response.username,
        roleId: response.roleId ?? 0,
        roleName: roleToUse,
        isActive: response.isActive ?? false,
        // Agent 30 (regression) — preserve the BE-supplied
        // verificationStatus verbatim. A missing value stays `null`
        // (rather than being coerced to `'Pending'`) so the
        // null-aware downstream checks can recognise a fresh account
        // that has not been through the role-request lifecycle yet.
        verificationStatus: response.verificationStatus ?? null,
        accountTier: response.accountTier ?? 'Free',
        // Agent 30 — mirror `AuthResponse.roles` on the persisted user
        // so `PublicRoute` can enforce the exact approved-role-list
        // condition at runtime. The list is sourced from the BE (freshUser
        // or response) and falls back to a single-element array when the
        // BE omits it so the post-auth resolver doesn't mis-classify an
        // existing user as "first-time".
        roles: persistedRoles,
      };
      storage.setUser(userToPersist);

      // We delegate to `landingRouteForRoleName` from utils/roleNormalizer so
      // the post-login redirect and the admin guard stay in sync. The
      // `isAdminOverride` flag covers the BE-bug sentinel where roleName
      // comes back as 'Researcher' but the dual-signal check above proves
      // the user is actually an Admin.
      const adminOverride = isAdminUser({
        roleName: roleToUse,
        roleId: response.roleId ?? 0,
      });

      authStore.login(
        {
          id: userId,
          username: freshUser?.username ?? response.username,
          email: freshUser?.email ?? response.email,
          fullName: freshUser?.fullName ?? response.username,
          roleId: freshUser?.roleId ?? response.roleId ?? 0,
          roleName: roleToUse,
          // Use the BE's authoritative isActive value; default to FALSE (lockout-safe).
          isActive: freshUser?.isActive ?? response.isActive ?? false,
          // Use the BE's authoritative verificationStatus value.
          verificationStatus:
            (freshUser?.verificationStatus ?? response.verificationStatus ?? null) as
              | 'Pending'
              | 'Accepted'
              | 'Rejected'
              | null,
          accountTier: freshUser?.accountTier ?? response.accountTier ?? 'Free',
          // Forward the BE-derived effective role so the verified-guard and
          // MainLayout can render the unverified-state UI without re-deriving
          // from `isActive`. Falls back to the derived value when the BE
          // doesn't surface the field (lockout-safe).
          effectiveRole: resolveEffectiveRole(freshUser, response, roleToUse),
          // Agent 30 — mirror the BE's approved-roles list on the auth
          // store so `PublicRoute` can enforce the exact approved-role
          // condition at runtime (see `utils/postAuthRoute.ts`).
          roles: persistedRoles,
        },
        response.token,
        resolveEffectiveRole(freshUser, response, roleToUse)
      );

      // Flip the welcome-back signal ONLY after the auth store has the new
      // user persisted, so a mount of the banner reads the correct name. The
      // signal is ephemeral (never rehydrated from sessionStorage), so the
      // banner never appears on a fresh tab or after a page reload — only
      // after the genuine login transition that just completed.
      useWelcomeSignal.getState().show();
      navigate(landingRouteForRoleName(roleToUse, { isAdminOverride: adminOverride }));
    },
    [authStore, navigate]
  );

  const login = async (credentials: LoginRequest) => {
    setIsLoading(true);
    setError(null);
    setPendingRoleSelection(null);
    authStore.setLoading(true);

    try {
      const response = await authService.login(credentials);
      const assignedRoles: UserRole[] = response.roles ?? [];

      if (assignedRoles.length > 1) {
        // Multi-role user — show picker. Don't persist auth yet; we wait for
        // the user to pick a role. The picker modal calls confirmRoleSelection
        // which calls persistAuthAndNavigate() with the chosen role.
        setPendingRoleSelection({
          roles: assignedRoles,
          selectedRole: assignedRoles[0] ?? null,
          authResponse: response,
          // Stash the rememberMe choice so the picker-confirmation path
          // routes to the same storage bucket the user originally requested.
          rememberMe: credentials.rememberMe ?? false,
        });
        setIsLoading(false);
        return;
      }

      // Single-role (or zero — fall back to BE's `role`) — proceed.
      const roleToUse = assignedRoles[0] ?? response.role;
      await persistAuthAndNavigate(response, roleToUse, credentials.rememberMe ?? false);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Login failed. Please check your credentials.';
      setError(errorMessage);
      authStore.setLoading(false);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * GIS-credential Google sign-in (the agreed FE ↔ BE contract).
   *
   * Flow:
   *   1. POST `{ credential }` to `/api/Auth/google-login`.
   *   2. Decide the destination via `utils/postAuthRoute.ts`
   *      (Agent 30 — exact spec):
   *        - isNewUser===true AND requiresOnboarding===true
   *          AND effectiveRole===null AND approved roles empty
   *                                               → /complete-google-registration
   *        - role/roleId both empty (no legacy signal) → onboarding (compat)
   *        - role non-null but Pending / inactive  → /forum as Guest
   *        - role non-null and Approved + active   → role landing route
   *   3. Run the persistence + navigation pipeline used by the
   *      password-login flow (`persistAuthAndNavigate`).
   *
   * The credential is forwarded exactly once. Errors from `postGoogleLogin`
   * are normalised into a user-friendly `error` string; the underlying
   * `GoogleLoginError.code` is intentionally not surfaced to the UI.
   */
  const loginWithGoogle = useCallback(
    async (
      credentialOrResponse: string | GoogleCredentialResponse,
      options?: { rememberMe?: boolean },
    ): Promise<void> => {
      const rememberMe = options?.rememberMe ?? false;
      setIsLoading(true);
      setError(null);
      setPendingRoleSelection(null);
      authStore.setLoading(true);

      // Defensive: accept either the raw credential string (from
      // googleAuthService.extractCredential) or the full GIS response.
      const credential =
        typeof credentialOrResponse === 'string'
          ? credentialOrResponse
          : googleAuthService.extractCredential(credentialOrResponse);

      if (!credential) {
        setIsLoading(false);
        authStore.setLoading(false);
        setError(
          'Google did not return a valid credential. Please try signing in again.',
        );
        return;
      }

      try {
        // Agent 30 (regression) — wrap the POST in the shared remount-
        // safe in-flight guard keyed by the credential. Duplicate GIS
        // callbacks (StrictMode double-invoke, remount, rapid double-
        // click) share the same exchange so the BE sees ONE request and
        // we produce ONE routing decision. The slot clears on settle so
        // a retry after a transient failure re-enters the BE.
        const session = await acquireGoogleLoginSession(credential, () =>
          googleAuthService.postGoogleLogin({ credential }),
        );

        if (!session.token || !session.userId || !session.email) {
          // BE didn't surface enough fields to start a session. Treat as
          // recoverable failure — never fabricate a session.
          setIsLoading(false);
          authStore.setLoading(false);
          setError(
            'Google sign-in reached the platform but no session was returned. Please retry.',
          );
          return;
        }

        // Dev-only: surface the exact routing decision so a mis-classified
        // first-time user (who never reaches the onboarding page) shows
        // up clearly in the browser console. No credentials / tokens are
        // included — only the boolean signals + role assignment state.
        if (import.meta.env?.DEV) {
          // eslint-disable-next-line no-console
          console.info('[google-login:diag] AuthContext routing decision', {
            isNewUser: session.isNewUser,
            requiresOnboarding: session.requiresOnboarding,
            verificationStatus: session.verificationStatus,
            isActive: session.isActive,
            role: session.role,
            roleId: session.roleId,
            roles: session.roles,
            effectiveRole: session.effectiveRole,
            // Diagnostics-only: surface the unified routing signals so a
            // mis-classified first-time user (BE omitted isNewUser /
            // requiresOnboarding AND omitted role/roleId) is visible in the
            // console. We never log the token, email, or credential.
            hasRole: hasNonEmptyRole(session.role),
            hasRoleId: hasPositiveRoleId(session.roleId),
            onboardingByRoleNull:
              hasNonEmptyRole(session.role) === false &&
              hasPositiveRoleId(session.roleId) === false,
            chosenRoute: (() => {
              if (session.isNewUser || session.requiresOnboarding) {
                return ROUTES.COMPLETE_GOOGLE_REGISTRATION;
              }
              if (
                !hasNonEmptyRole(session.role) &&
                !hasPositiveRoleId(session.roleId)
              ) {
                return ROUTES.COMPLETE_GOOGLE_REGISTRATION;
              }
              return 'existing-user';
            })(),
          });
        }

        // Routing rule (per task spec, centralized in
        // utils/postAuthRoute.ts so the same priority applies to
        // AuthContext.loginWithGoogle, GoogleCallback, and PublicRoute):
        //   1. Onboarding page when BE signals new/requires-onboarding OR when
        //      the role + roleId fields are both absent/null/empty. The second
        //      clause is the documented fallback for BE versions that don't
        //      surface `isNewUser` / `requiresOnboarding` (see BTR-AGENT52-01).
        //      We do NOT rely solely on the legacy signals.
        //   2. /forum as Guest when the role is non-null but the account is
        //      not approved (Pending verification OR isActive=false).
        //   3. Otherwise, preserve the existing role landing route
        //      (landingRouteForRoleName via persistAuthAndNavigate).
        const onboardingSnapshot: PostAuthSnapshot = {
          role: session.role,
          roleId: session.roleId,
          isActive: session.isActive,
          verificationStatus: session.verificationStatus,
          effectiveRole: session.effectiveRole,
          isNewUser: session.isNewUser,
          requiresOnboarding: session.requiresOnboarding,
          // Agent 30 (regression) — forward the BE's approved-roles list
          // so the post-auth resolver can enforce the exact AND-clause
          // at runtime (a user with explicit onboarding signals but
          // already an accepted role must NOT route to onboarding).
          approvedRoles: session.roles ?? null,
        };
        const shouldOnboard = isFirstTimeOnboardingUser(onboardingSnapshot);

        if (shouldOnboard) {
          // First-time Google user. Persist a pending session WITHOUT a role
          // (mirrors the existing GoogleCallback first-time branch). The
          // /complete-google-registration page reads from the same storage
          // path so the existing onboarding UI continues to work.
          //
          // The onboarding completion endpoint authenticates via the ARS
          // JWT only — we deliberately do NOT cache the upstream Google
          // ID token here (the BE forbids echoing identity-provider
          // tokens; see BE_GOOGLE_ONBOARDING_COMPLETION_TICKET.md).
          //
          // Defensive cleanup: a stale `ars_google_onboarding_submitted`
          // sentinel from a previous (now-deleted) account must NOT survive
          // into this brand-new session. Otherwise the onboarding page
          // could render its post-submit "success" state and offer a
          // `Go to the Forum` button to a user who has not actually
          // submitted anything yet. We clear it from BOTH storage buckets
          // so neither `localStorage` (Remember Me) nor `sessionStorage`
          // (default) can leak a previous user's sentinel.
          try {
            localStorage.removeItem('ars_google_onboarding_submitted');
          } catch {
            /* ignore */
          }
          try {
            sessionStorage.removeItem('ars_google_onboarding_submitted');
          } catch {
            /* ignore */
          }
          storage.setRememberMe(rememberMe);
          storage.setToken(session.token);
          const onboardingUser = {
            id: session.userId,
            username: session.email,
            email: session.email,
            fullName: session.fullName ?? session.email,
            // role/roleId are absent in this branch — leave them at the
            // lockout-safe zero/null sentinels the rest of the FE expects
            // for a "no role assigned yet" first-time Google user.
            roleId: session.roleId ?? 0,
            roleName: session.role ?? '',
            // Agent 30 (regression) — preserve the BE-derived
            // `isActive` and `verificationStatus` exactly as the BE
            // returned them. Coercing a BE-supplied `null`
            // `verificationStatus` to `'Pending'` would falsely imply
            // a submitted request has been filed when the BE has only
            // told us this is a brand-new account.
            isActive: session.isActive ?? false,
            verificationStatus: (session.verificationStatus ?? null) as
              | 'Pending'
              | 'Accepted'
              | 'Rejected'
              | null,
            accountTier: 'Free' as const,
            effectiveRole: (session.effectiveRole as EffectiveRole) ?? null,
            // Agent 30 — preserve the BE-derived first-time signals on the
            // persisted user blob so `PublicRoute` (and any other consumer
            // that reads the persisted user) can route a freshly-logged-in
            // first-time Google user to `/complete-google-registration`
            // without an additional `GET /api/User/{id}` round-trip.
            isNewUser: session.isNewUser ?? null,
            requiresOnboarding: session.requiresOnboarding ?? null,
            // Mirror the BE's approved-roles list so PublicRoute's exact
            // AND-clause check sees the same list as the in-memory
            // snapshot.
            roles: (session.roles ?? []) as UserRole[],
          };
          storage.setUser(onboardingUser as unknown as Parameters<typeof storage.setUser>[0]);
          authStore.login(onboardingUser as unknown as Parameters<typeof authStore.login>[0], session.token, onboardingUser.effectiveRole);
          useWelcomeSignal.getState().show();
          navigate(ROUTES.COMPLETE_GOOGLE_REGISTRATION, { replace: true });
          setIsLoading(false);
          authStore.setLoading(false);
          return;
        }

        // Existing user — delegate to the centralised persist + navigate
        // helper so storage, the Zustand store, the welcome signal and the
        // landing-route resolution all match the password-login path.
        const knownRoles = session.roles.filter((r): r is UserRole =>
          (KNOWN_BUSINESS_ROLES as readonly string[]).includes(r as string),
        );
        // `role` is non-null per the role-null check above (otherwise we
        // would have routed to onboarding). Cast through `UserRole | null`
        // to satisfy the TS narrowing downstream.
        const roleToUse = (session.role as UserRole | null) ?? knownRoles[0] ?? null;

        if (!roleToUse) {
          setIsLoading(false);
          authStore.setLoading(false);
          setError(
            'Your Google account is missing a role on the platform. Please contact support.',
          );
          return;
        }

        const filteredRoles =
          knownRoles.length > 0 ? knownRoles : [roleToUse];

        // The centralised persist+navigate helper resolves the
        // landing route from `roleToUse` (via `landingRouteForRoleName`)
        // so the verified-role branch is unchanged from the previous
        // behaviour. We DO surface `effectiveRole` here so a Pending
        // user that somehow reaches this branch (e.g. legacy BE shapes)
        // lands on /forum as a Guest rather than a role workspace.
        const authResponse: AuthResponse = {
          token: session.token,
          username: session.email,
          email: session.email,
          role: roleToUse,
          userId: session.userId,
          roleId: session.roleId ?? undefined,
          roles: filteredRoles,
          isActive: session.isActive ?? false,
          // Agent 30 (regression) — preserve the BE-derived
          // `verificationStatus` exactly as the BE returned it; do NOT
          // coerce a missing value to `'Pending'`. The downstream
          // `useVerifiedGuard` and `usePermissions` apply their own
          // null-aware derivations.
          verificationStatus: (session.verificationStatus ?? null) as
            | 'Pending'
            | 'Accepted'
            | 'Rejected'
            | null,
          effectiveRole:
            (session.effectiveRole as EffectiveRole) ??
            ((session.isActive ?? false) ? roleToUse : 'Guest'),
        };

        await persistAuthAndNavigate(authResponse, roleToUse, rememberMe);
      } catch (err: unknown) {
        const fallback = 'Google sign-in failed. Please try again.';
        const message =
          err instanceof Error && err.message ? err.message : fallback;
        setError(message);
        authStore.setLoading(false);
      } finally {
        setIsLoading(false);
      }
    },
    [authStore, navigate, persistAuthAndNavigate],
  );

  // Removed in this revision: `getGoogleOnboardingCredential`. The
  // onboarding completion endpoint authenticates via the ARS JWT only,
  // so the cached Google ID token is no longer needed (and is no longer
  // cached — see the new-user branch of `loginWithGoogle`).

  /**
   * Agent 30 — submit the first-time Google onboarding completion
   * payload to the documented BE endpoint. The caller supplies the
   * captured PDF URL, requested role, optional phone number, and (for
   * Reviewer) the canonical ORCID iD.
   *
   * Authentication is forwarded implicitly through the SHARED ARS
   * SESSION: `googleAuthService.postCompleteGoogleRegistration` posts
   * through the shared axios instance, which carries the active
   * `Authorization: Bearer <ars-jwt>` header populated from
   * `storage.getToken()` (see `services/axios.ts` and
   * `utils/storage.ts`). The BE derives the user id from the JWT
   * subject server-side — we deliberately do NOT echo the upstream
   * Google ID token, the OAuth code, or a client-supplied user id into
   * the body. This is true for both the credential flow (Login →
   * `POST /api/Auth/google-login`) and the legacy code-redirect flow
   * (`/auth/google/callback`); both produce the same ARS session.
   *
   * The context:
   *   • posts the documented onboarding payload exactly once per call
   *     (the page owns the double-click / in-flight guard)
   *   • refetches the BE's authoritative user record so the auth store
   *     and ars_user blob reflect the new pending state
   *   • routes to `/forum` — pending Guests do not get into role
   *     workspaces, and the verified-guard renders the pending banner.
   */
  const completeGoogleRegistration = useCallback(
    async (
      payload: {
        pdfUrl: string;
        phoneNumber: string;
        role: string;
        orcidId?: string;
        consents?: Array<{ documentType: string; version: string }>;
      },
    ): Promise<{
      status: 'submitted';
      requestStatus: string | null;
      onboardingStatus: string | null;
      role: string | null;
      effectiveRole: string | null;
    }> => {
      const userId = authStore.user?.id ?? 0;
      if (!userId) {
        throw new Error(
          'No authenticated user is associated with this onboarding request.',
        );
      }

      setIsLoading(true);
      setError(null);
      try {
        const response: CompleteGoogleRegistrationResponse =
          await googleAuthService.postCompleteGoogleRegistration({
            payload: {
              pdfUrl: payload.pdfUrl,
              phoneNumber: payload.phoneNumber ?? '',
              role: payload.role,
              orcidId: payload.role === 'Reviewer' ? payload.orcidId : undefined,
              consents: payload.consents,
            },
            // Per-call idempotency so a double-submit on the same page
            // mount is deduped by the BE (and recognised as the same call
            // locally). Survives a refresh because the page reads it from
            // the sessionStorage-adjacent `ars_google_onboarding_submitted`
            // sentinel.
            idempotencyKey: `complete-google-registration-${userId}`,
          });

        // Refetch the authoritative user so the in-memory store reflects
        // the BE's new pending state. We swallow errors so a transient
        // BE blip doesn't break the navigation.
        try {
          const fresh = await userService.getById(userId);
          if (fresh) {
            storage.setUser(fresh);
            authStore.updateUser({
              roleName: fresh.roleName ?? null,
              roleId: fresh.roleId ?? null,
              isActive: fresh.isActive,
              verificationStatus: fresh.verificationStatus,
              accountTier: fresh.accountTier,
              effectiveRole: fresh.effectiveRole,
            });
            if (fresh.effectiveRole) {
              authStore.setEffectiveRole(fresh.effectiveRole);
            }
          }
        } catch {
          /* defensive — the user is already past the submit gate */
        }

        // The new account is expected to remain pending until Admin
        // approval. route the user to /forum so the verified-guard
        // renders the pending banner. We do NOT navigate to a role
        // workspace — the role-request lifecycle is gated server-side.
        navigate(ROUTES.FORUM, { replace: true });

        return {
          status: 'submitted',
          requestStatus: response.requestStatus ?? 'Pending',
          onboardingStatus: response.onboardingStatus ?? 'Completed',
          role: response.role ?? payload.role,
          effectiveRole: response.effectiveRole ?? 'Guest',
        };
      } finally {
        setIsLoading(false);
      }
    },
    [authStore, navigate],
  );

  const confirmRoleSelection = useCallback(
    async (role: UserRole) => {
      if (!pendingRoleSelection) return;
      // Persist using the stashed BE response, overriding `role` with the
      // user's choice. Token/email/username come from the original login.
      // Forward the original rememberMe choice so multi-role users get the
      // same storage-bucket behavior as single-role users.
      await persistAuthAndNavigate(
        pendingRoleSelection.authResponse,
        role,
        pendingRoleSelection.rememberMe
      );
      setPendingRoleSelection(null);
    },
    [pendingRoleSelection, persistAuthAndNavigate]
  );

  const cancelRoleSelection = useCallback(() => {
    setPendingRoleSelection(null);
    // User backed out — clear any partial auth state so they can re-login cleanly.
    // Agent 53 — route through the centralized routine so storage keys, the
    // Axios header, and the Zustand store are all reset before the navigate.
    // Wipe the welcome signal too so the banner never bleeds through a
    // cancelled multi-role flow into another user's session.
    useWelcomeSignal.getState().reset();
    void clearAuthSession();
    authStore.logout();
    navigate(ROUTES.LOGIN, { replace: true });
  }, [authStore, navigate]);

  const logout = () => {
    // Agent 53 — null-safe for Guest sessions. `authStore.logout()` and
    // `clearAuthSession()` are both safe to call when there is no token
    // or no user — Guest users have a hydrated `effectiveRole: 'Guest'`
    // and `user: null`, and the cleanup routine no-ops on empty storage.
    if (logoutInFlightRef.current) return;
    logoutInFlightRef.current = true;
    try {
      // Dev-only: log the logout decision so a "Guest clicks logout but
      // stays on the page" bug surfaces immediately in the console. We
      // intentionally include neither the token nor the email — only
      // the derived session bucket + the effective role so the trace is
      // useful without leaking sensitive state.
      if (import.meta.env?.DEV) {
        const isAuthenticated = authStore.isAuthenticated;
        const storedToken =
          typeof window !== 'undefined'
            ? sessionStorage.getItem('ars_token') ??
              localStorage.getItem('ars_token')
            : null;
        // eslint-disable-next-line no-console
        console.info('[auth:logout] Guest-aware logout dispatched', {
          effectiveRole: authStore.effectiveRole,
          hasStoredToken: storedToken !== null,
          isAuthenticated,
          willNavigateTo: ROUTES.LOGIN,
        });
      }
      // Clear the welcome-back signal alongside the rest of the auth state.
      // The next successful login will flip it back to true for the new user
      // — the banner must never linger across a logout/login boundary.
      useWelcomeSignal.getState().reset();
      void clearAuthSession();
      authStore.logout();
      setPendingRoleSelection(null);
      navigate(ROUTES.LOGIN, { replace: true });
    } finally {
      // Release the guard on the next tick so the user can re-trigger
      // logout from another surface (e.g. after a session recovery).
      queueMicrotask(() => {
        logoutInFlightRef.current = false;
      });
    }
  };

  /**
   * Agent 53 — failed-session recovery. Called from axios response
   * interceptors and the Pending Verification / Onboarding recovery
   * paths when the BE refuses a request (401 / 403). Equivalent to a
   * normal logout but uses the centralized cleanup so the failure path
   * stays in lock-step with the success path. Fire-and-forget; the
   * interceptor already redirected to /login so we do not navigate
   * again here.
   */
  const handleSessionFailure = useCallback(() => {
    if (logoutInFlightRef.current) return;
    logoutInFlightRef.current = true;
    try {
      // Force-clear the welcome signal too. A 401/403-driven wipe must
      // leave no trace of the previous user's session.
      useWelcomeSignal.getState().reset();
      void clearAuthSession();
      authStore.logout();
      setPendingRoleSelection(null);
    } finally {
      queueMicrotask(() => {
        logoutInFlightRef.current = false;
      });
    }
  }, [authStore]);

  const clearError = () => {
    setError(null);
  };

  /**
   * On every app boot (Zustand rehydrate completes while user is authenticated),
   * hit GET /api/user/{id} to overwrite the stale ars_user snapshot with the
   * BE's authoritative values. This is the fix for the verificationStatus bug:
   * a user approved by an Admin has their BE record updated, but the FE's cached
   * ars_user still showed the old "Pending" value from registration day.
   *
   * Runs only once per app session (no deps) and only when auth state is
   * rehydrated with a valid userId — the GET call will fail with 401 if the
   * token is invalid and we catch it silently.
   *
   * CRITICAL: Must NOT run when the user has just logged in via loginWithGoogle
   * and has `isNewUser` or `requiresOnboarding` set to `true`. Those signals
   * are only present on the login response and will be lost if we immediately
   * overwrite with GET /api/User/{id} (which doesn't return them). Only sync
   * from BE when rehydrating a stale session from storage.
   */
  useEffect(() => {
    const syncUserFromBE = async () => {
      const userId = authStore.user?.id;
      if (!authStore.isAuthenticated || !userId || userId === 0) return;

      // Skip sync if this is a fresh first-time Google user — the login
      // response already has the authoritative data and we must not lose
      // the `isNewUser`/`requiresOnboarding` signals.
      if (authStore.user?.isNewUser === true || authStore.user?.requiresOnboarding === true) {
        return;
      }

      try {
        const freshUser = await userService.getById(userId);

        // Overwrite ars_user with the BE's authoritative record.
        storage.setUser(freshUser);

        // Sync the Zustand store too so the in-memory view matches storage.
        // Agent 39 — also forward `effectiveRole` so the verified-guard and
        // MainLayout reflect the BE's authoritative role without reloading.
        authStore.updateUser({
          isActive: freshUser.isActive,
          verificationStatus: freshUser.verificationStatus,
          accountTier: freshUser.accountTier,
          effectiveRole:
            freshUser.effectiveRole ??
            (freshUser.isActive
              ? (freshUser.roleName as EffectiveRole)
              : 'Guest'),
        });
      } catch {
        // GET failed (401 = expired token, 404 = user deleted, 5xx = BE down).
        // Silently skip — the stale snapshot is no worse than nothing, and the
        // user can re-login to get a fresh token.
      }
    };

    // Wait for Zustand persist rehydration before reading authStore.user.
    // The `isLoading` flag flips to false once rehydration completes.
    if (!authStore.isLoading) {
      syncUserFromBE();
    }
  }, []); // intentionally empty — run once after first render when store is ready

  const value: AuthContextType = {
    user: authStore.user
      ? {
          token: authStore.token || '',
          userId: authStore.user.id,
          username: authStore.user.username,
          email: authStore.user.email,
          role: authStore.user.roleName,
          isActive: authStore.user.isActive ?? false,
          // Agent 30 (regression) — preserve the BE-supplied
          // `verificationStatus` as `null` when the BE omitted it.
          // Coercing to `'Pending'` would falsely imply a submitted
          // Admin-review request and silently suppress the
          // `/complete-google-registration` onboarding branch.
          verificationStatus: authStore.user.verificationStatus ?? null,
          effectiveRole: authStore.user.effectiveRole,
          // Agent 30 — forward the BE-derived first-time signals from the
          // persisted `User` blob so `PublicRoute` can route a freshly-
          // logged-in first-time Google user to `/complete-google-registration`
          // without an extra `GET /api/User/{id}` round-trip. When the
          // persisted blob has no value we emit `undefined` so the snapshot
          // falls back to the documented compatibility fallback in
          // `utils/postAuthRoute.ts`.
          isNewUser: authStore.user.isNewUser ?? undefined,
          requiresOnboarding: authStore.user.requiresOnboarding ?? undefined,
          // Agent 30 — forward the BE's approved-roles list so the post-
          // auth resolver can enforce the exact approved-role-list
          // condition at runtime (i.e. a user with explicit onboarding
          // signals BUT already an accepted role is NOT a first-time
          // candidate and must route to the workspace).
          roles: authStore.user.roles,
        }
      : null,
    isAuthenticated: authStore.isAuthenticated,
    isLoading: isLoading || authStore.isLoading,
    error,
    login,
    loginWithGoogle,
    completeGoogleRegistration,
    logout,
    handleSessionFailure,
    clearError,
    pendingRoleSelection,
    confirmRoleSelection,
    cancelRoleSelection,
    effectiveRole: authStore.effectiveRole,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
