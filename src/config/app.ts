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
    // Temporary state: subscription access is disabled until backend
    // subscription APIs, PayOS verification, and authoritative subscription
    // status are available. Researcher and Lecturer retain full access.
    // Set to `true` only after the BE publishes the subscription contract
    // and VND pricing is approved and configured.
    enableSubscriptionAccess: false,
  },
};

export const AuthConfig = {
  tokenKey: 'ars_token',
  userKey: 'ars_user',
  tokenExpirationHours: 24,
};
