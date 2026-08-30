// Type definitions for Google Identity Services (GIS) integration.
//
// We only model the subset of `CredentialResponse` that we consume — Google
// injects many other fields (select_by, client_id, etc.) which we deliberately
// ignore on the FE because:
//   1. Authoritative user data comes from the BE's `/api/Auth/google-login`
//      response — never from the GIS client payload.
//   2. We MUST NOT authenticate from `clientId`/`select_by`/etc.; these are
//      observability signals, not identity claims.
//
// `credential` is the signed ID token (a JWT issued by Google). The FE treats
// it as an opaque string and POSTs it exactly once to the BE — we never decode
// it client-side, never log it, never persist it, and never derive roles from
// its payload.

export interface GoogleCredentialResponse {
  /** Signed Google ID token (JWT). Treat as opaque. */
  credential: string;
  /**
   * Optional GIS callback discriminator (e.g. "btn_disabled_fedcm"). We do
   * not authenticate from this — only the BE can validate the credential.
   */
  select_by?: string;
  clientId?: string;
}

export interface GoogleAccountsIdConfiguration {
  client_id: string;
  callback: (response: GoogleCredentialResponse) => void;
  /**
   * FedCM / One Tap behavior. We default to `select_account` so the user can
   * pick the account they want to sign in with — matches the spec.
   */
  auto_select?: boolean;
  cancel_on_tap_outside?: boolean;
  /** Restrict to a specific hosted-domain when set (corporate SSO). */
  hd?: string;
  /** UX-mode: `popup` opens the GIS popup, `redirect` performs a page redirect. */
  ux_mode?: 'popup' | 'redirect';
  /**
   * Force the rendered GIS UI (button label, popup copy) into a specific
   * locale, e.g. `'en'`. Overrides the browser's preferred language and
   * the script-level `?hl=` query param. Used by ARS to keep the sign-in
   * button in English regardless of the user's browser locale.
   */
  locale?: string;
}

export interface GoogleAccountsId {
  initialize: (config: GoogleAccountsIdConfiguration) => void;
  renderButton: (
    parent: HTMLElement,
    options: {
      type?: 'standard' | 'icon';
      theme?: 'outline' | 'filled_blue' | 'filled_black';
      size?: 'large' | 'medium' | 'small';
      text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
      shape?: 'rectangular' | 'pill' | 'circle' | 'square';
      logo_alignment?: 'left' | 'center';
      width?: number;
      /**
       * Force the rendered button label into a specific locale (e.g. `'en'`).
       * Mirrors the per-init `locale` override — kept on both entry points
       * so either surface can be locale-locked independently.
       */
      locale?: string;
    }
  ) => void;
  prompt: () => void;
  disableAutoSelect: () => void;
}

export interface GoogleAccounts {
  id: GoogleAccountsId;
}

declare global {
  interface Window {
    google?: {
      accounts: GoogleAccounts;
    };
  }
}

// ── Backend response contract ──────────────────────────────────────────────
//
// Swagger only documents `200 OK` for `/api/Auth/google-login` (no schema).
// We mirror the same set of fields the BE echoes from `/api/Auth/login` so the
// rest of the FE can treat a Google session identically to a password session
// once we've normalised the response in `googleAuth.service`.
//
// `isNewUser` and `requiresOnboarding` are the ONLY safe signals for routing
// a Google user to the onboarding page. When the BE does not surface them
// (older contracts), the FE falls back to the existing role / isActive /
// verificationStatus checks — see BTR-AGENT52-01.
export interface GoogleLoginResponse {
  // Same fields as the password-login AuthResponse:
  token?: string;
  refreshToken?: string;
  username?: string;
  email?: string;
  fullName?: string;
  avatarUrl?: string | null;
  role?: string;
  roleName?: string;
  roleId?: number;
  userId?: number;
  roles?: string[];
  isActive?: boolean;
  isEmailVerified?: boolean;
  verificationStatus?: 'Pending' | 'Accepted' | 'Rejected';
  accountTier?: 'Free' | 'Premium' | 'Enterprise';
  effectiveRole?: string;

  // Google-specific routing signals (BE may or may not surface these):
  isNewUser?: boolean;
  requiresOnboarding?: boolean;
}

// Normalised Google session that the rest of the FE consumes. Maps a
// GoogleLoginResponse + the original credential into a shape compatible with
// `AuthResponse` so the existing AuthContext wiring can persist it (handled
// out-of-band by the Google button handler; AuthContext itself is unchanged).
export interface NormalisedGoogleSession {
  // `auth`-compatible payload (subset of AuthResponse) consumed by the page
  // navigation logic. The page-level handler reads this and decides where to
  // navigate; AuthContext is NOT touched here.
  token: string | null;
  email: string | null;
  fullName: string | null;
  avatarUrl: string | null;
  userId: number | null;
  role: string | null;
  roleId: number | null;
  roles: string[];
  isActive: boolean | null;
  verificationStatus: 'Pending' | 'Accepted' | 'Rejected' | null;
  effectiveRole: string | null;

  // Routing signals surfaced from the BE.
  isNewUser: boolean;
  requiresOnboarding: boolean;
}
