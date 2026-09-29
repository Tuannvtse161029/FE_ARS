export const AppConfig = {
  appName: 'ARS Platform',
  appVersion: '1.0.0',
  description: 'Academic Research Sharing - Manage and share research papers',
  features: {
    enableRegistration: true,
    // ORCID collection is disabled in the registration flow per product spec;
    // reviewer ORCID profiles remain available on the reviewer discovery page.
    enableORCID: false,
    enablePaperSubmission: true,
    // ── Annual subscription (PayOS) ───────────────────────────────────────
    // Enabled: BE has shipped the AnnualFees contract (BE-ANNUAL-FEE-01) and
    // VND pricing is configured on the platform. The `useSubscription` hook
    // + `SubscriptionAccessGuard` now enforce the paywall for
    // Researcher / Lecturer users with no active annual subscription.
    //
    // Wallet money flows (top-up / withdrawal / reviewer payouts) were
    // retired per WALLET_SCOPE_CHANGE.md and are no longer a feature
    // toggle — the underlying components have been removed from the FE.
    enableSubscriptionAccess: true,
  },
};

export const AuthConfig = {
  // Legacy key — still exported so cleanup routines can sweep stragglers,
  // but new writes go through `secureToken.writeAfterLogin` which writes
  // to `tokenKeyAccess` (encrypted) instead.
  tokenKey: 'ars_token',
  tokenKeyAccess: 'ars_token_enc_v1',
  tokenKeyRefresh: 'ars_token_refresh_v1',
  userKey: 'ars_user',
  // Effective lifetime of the access envelope. Until the BE ships a
  // refresh-token endpoint, every page reload forces a re-login because
  // the in-memory session key is dropped. Documented in
  // `tickets/backend/BE-JWT-HTTPONLY-COOKIE.md`.
  tokenExpirationHours: 24,
};
