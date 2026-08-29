export const AppConfig = {
  appName: 'ARS Platform',
  appVersion: '1.0.0',
  description: 'Academic Research System - Manage and share research papers',
  features: {
    enableRegistration: true,
    // ORCID collection is disabled in the registration flow per product spec;
    // reviewer ORCID profiles remain available on the reviewer discovery page.
    enableORCID: false,
    enablePaperSubmission: true,
    // ── Withdrawal feature flag (centralized gate) ──────────────────────────
    // Withdrawals (Reviewer cash-out requests + Admin payout clearance) are
    // temporarily disabled due to changed product requirements. While this
    // flag is `true`:
    //   • Sidebar nav entry "Wallet & Withdrawals" is hidden for Reviewer.
    //   • EarningsWallet page renders a "temporarily unavailable" notice
    //     instead of forms / tables / modals / API calls.
    //   • Admin "Reviewer Withdrawal Requests" tab + actions are hidden.
    //   • withdrawalService rejects all network calls with a sentinel error
    //     so any stale visible UI cannot trigger withdrawals.
    //   • Direct navigation to /earnings-wallet is redirected to /forum.
    // Wallet balance, top-up, transaction history, and receipts are NOT
    // affected — this gate is withdrawal-only.
    // Restore by flipping to `false`; the underlying components/hooks/services
    // are preserved verbatim and will resume immediately.
    enableWithdrawals: false,
    // Premium package listing is backed by the live /api/PremiumPackage API.
    premiumPackagesEnabled: true,
  },
};

export const AuthConfig = {
  tokenKey: 'ars_token',
  userKey: 'ars_user',
  tokenExpirationHours: 24,
};
