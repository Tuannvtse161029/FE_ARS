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
    // ── Premium packages feature flag (centralized gate) ───────────────────
    // Premium package subscriptions + AI entitlements are temporarily
    // disabled while the BE team's annual-fee CRUD endpoint is being
    // finalized (see BACKEND_REQUESTS.md → Agent Admin Annual Fees).
    // While this flag is `false`:
    //   • Sidebar nav entry "Premium Package" is hidden for every
    //     non-Admin role (Researcher, Lecturer, Reviewer, Graduate Student).
    //   • Direct navigation to /premium-packages is redirected to /forum.
    //   • PremiumPackagesPreview renders a "temporarily unavailable" notice.
    // The Admin surface is NOT affected — Admins still see /admin/packages
    // and the new /admin/annual-fees tab.
    // Restore by flipping to `true`; the underlying components are preserved
    // verbatim and resume immediately.
    premiumPackagesEnabled: false,
  },
};

export const AuthConfig = {
  tokenKey: 'ars_token',
  userKey: 'ars_user',
  tokenExpirationHours: 24,
};
