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
    // ── Wallet money flows (top-up, withdrawal, PayOS) ─────────────────────
    // Permanently disabled per WALLET_SCOPE_CHANGE.md. ARS no longer supports
    // adding funds to a wallet or cashing out to a bank. The flag is kept
    // here as a hook for a future, read-only ARS-credits area; the underlying
    // withdrawal/top-up components have been removed from the codebase.
    enableWithdrawals: false,
    // ── Annual subscription (PayOS) ───────────────────────────────────────
    // Enabled: BE has shipped the AnnualFees contract (BE-ANNUAL-FEE-01) and
    // VND pricing is configured on the platform. The `useSubscription` hook
    // + `SubscriptionAccessGuard` now enforce the paywall for
    // Researcher / Lecturer users with no active annual subscription.
    enableSubscriptionAccess: true,
  },
};

export const AuthConfig = {
  tokenKey: 'ars_token',
  userKey: 'ars_user',
  tokenExpirationHours: 24,
};
