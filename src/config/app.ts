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
  tokenKey: 'ars_token',
  userKey: 'ars_user',
  tokenExpirationHours: 24,
};
