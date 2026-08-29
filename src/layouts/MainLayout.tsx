import { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ROUTES } from '../routes/paths';
import { reviewerService } from '../services/reviewer.service';
import type { UserRole } from '../types/auth';
import { useWallet } from '../hooks/useWallet';
import { useReviewerAvailability } from '../hooks/useReviewerProfiles';
import { usePermissions } from '../hooks/usePermissions';
import { useVerifiedGuard } from '../hooks/useVerifiedGuard';
import { WalletTopUpModal } from '../components/wallet/WalletTopUpModal';
import { NotificationCenter } from '../components/notification/NotificationCenter';
import { WelcomeBackBanner } from '../components/WelcomeBackBanner/WelcomeBackBanner';
import { AppConfig } from '../config/app';
import styles from './MainLayout.module.css';
import arsLogo from '../assets/images/ARS_Logo.png';

import {
  Search,
  Wallet,
  Plus,
  MessageSquare as ForumIcon,
  FileText as PapersIcon,
  Calendar as SeminarIcon,
  Users as GroupIcon,
  Settings,
  User,
  ChevronDown,
  LogOut,
  X,
  CheckCircle2,
  AlertCircle,
  LayoutDashboard as DashboardIcon,
  UserCheck as RoleRequestsIcon,
  UserCog as AccountsIcon,
  Banknote as TransactionsIcon,
  Flag as ReportsIcon,
  Package as PackagesIcon,
  ScrollText as AuditLogsIcon,
  Crown as PremiumIcon,
  ClipboardCheck,
  Upload,
  BriefcaseBusiness,
  Receipt as AnnualFeesIcon,
  Home as HomeIcon,
  ClipboardList as AssignmentsIcon,
  FileCheck2 as PublicationIcon,
} from 'lucide-react';

const ProfileDropdown = ({
  username,
  activeRole,
  avatarInitials,
  accountTier,
  onLogout,
  onProfileClick,
  onAccountSettingsClick,
}: {
  username: string;
  activeRole: string;
  avatarInitials: string;
  accountTier?: string;
  onLogout: () => void;
  onProfileClick: () => void;
  onAccountSettingsClick: () => void;
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const tierClass =
    accountTier === 'Premium'
      ? styles.userPillTierPremium
      : accountTier === 'Enterprise'
      ? styles.userPillTierEnterprise
      : styles.userPillTierFree;

  return (
    <div className={styles.profileDropdownContainer}>
      <button
        className={styles.profileDropdownTrigger}
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className={styles.avatarCircleSmall}>{avatarInitials}</div>
        <div className={styles.userInfoText}>
          <div className={styles.userPillName}>{username}</div>
          <div className={styles.userPillRole}>
            {activeRole}
            {accountTier && accountTier !== 'Free' && (
              <span className={`${styles.userPillTier} ${tierClass}`}>
                {accountTier}
              </span>
            )}
          </div>
        </div>
        <ChevronDown size={16} />
      </button>

      {isOpen && (
        <div className={styles.profileDropdownMenu}>
          <button className={styles.dropdownItem} onClick={() => { onProfileClick(); setIsOpen(false); }}>
            <User size={16} />
            <span>My Profile & Role Upgrades</span>
          </button>
          <button className={styles.dropdownItem} onClick={() => { onAccountSettingsClick(); setIsOpen(false); }}>
            <Settings size={16} />
            <span>Account Settings</span>
          </button>
          <div className={styles.dropdownDivider}></div>
          <button className={`${styles.dropdownItem} ${styles.dropdownItemLogout}`} onClick={() => { onLogout(); setIsOpen(false); }}>
            <LogOut size={16} />
            <span>Log out</span>
          </button>
        </div>
      )}
    </div>
  );
};

const ARSPlatformLogo = () => (
  <img src={arsLogo} alt="ARS Platform Logo" style={{ borderRadius: 8 }} />
);

interface NavItem {
  to: string;
  label: string;
  icon: React.ReactNode;
  showDot?: boolean;
  badge?: string;
  // When `true`, the NavLink uses React Router's "exact" match so the link
  // only highlights on its own path (and not on any nested child route).
  // Required for Admin items because they all share the `/admin` prefix and
  // NavLink's default prefix matching would otherwise mark every Admin child
  // route as "Dashboard" (Phase C defect 3B).
  end?: boolean;
}

export const MainLayout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // Active role is derived solely from the authenticated user's role as set by the BE at login.
  const activeRole: UserRole = (user?.role as UserRole) ?? 'Researcher';

  // Single source of truth for unverified-user gating.
  const { hasWallet, isGuest } = usePermissions();
  const displayedRole: string = isGuest ? 'Guest' : activeRole;

  // Wallet balance comes from the BE — only for roles that have wallets (not Guest).
  const { walletId: beWalletId, balance: beBalance, isLoading: isBalanceLoading, refetch: refetchWallet } = useWallet(hasWallet && user?.userId ? user.userId : undefined);

  // Reviewer availability comes from the BE (only for active Reviewers).
  const { isAvailable: beReviewerAvailable, isLoading: beAvailabilityLoading, refetch: refetchAvailability } = useReviewerAvailability(activeRole === 'Reviewer' && user?.userId ? user.userId : undefined);

  // Bounce unverified users off every private route except /forum.
  useVerifiedGuard();

  const [isUpdatingAvailability, setIsUpdatingAvailability] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [isTopUpOpen, setIsTopUpOpen] = useState(false);

  // Auto-dismiss toast after 2 seconds
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 2000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  // Mirror the BE reviewer availability into local state so the toggle works
  // on the same source-of-truth that DiscoverReviewers reads from.
  // `null` here means "indeterminate / loading / error" — we must never render
  // a confirmed `Available` label during that window (see useReviewerProfiles
  // addendum §C). Until the BE answers, treat the toggle as off so the
  // Researcher cannot act on a false-positive state.
  const [optimisticAvailability, setOptimisticAvailability] = useState<boolean | null>(null);
  const isReviewerAvailable: boolean =
    optimisticAvailability ?? beReviewerAvailable ?? false;

  // Refresh the cached availability whenever the BE tells us something changed.
  useEffect(() => {
    if (optimisticAvailability === null) return;
    // Reset optimistic state once the BE catches up.
    if (beReviewerAvailable === optimisticAvailability) {
      setOptimisticAvailability(null);
    }
  }, [beReviewerAvailable, optimisticAvailability]);

  const handleToggleAvailability = async () => {
    if (!user?.userId || isUpdatingAvailability) {
      if (!user?.userId) {
        console.warn('[Availability] No logged-in user — toggle ignored.');
      }
      return;
    }
    // Block the click while the BE answer is still indeterminate so the
    // Reviewer never flips a state we have not confirmed.
    if (beReviewerAvailable === null) {
      console.warn('[Availability] Backend state not yet known — toggle ignored.');
      return;
    }
    const next = !isReviewerAvailable;
    setIsUpdatingAvailability(true);
    // Optimistic update
    setOptimisticAvailability(next);
    try {
      await reviewerService.updateAvailability(user.userId, next);
      await refetchAvailability();
      setToastMessage({
        text: next ? 'You are now accepting review requests.' : 'You are no longer accepting review requests.',
        type: 'success',
      });
    } catch {
      setOptimisticAvailability(!next);
      setToastMessage({ text: 'Failed to update availability. Please try again.', type: 'error' });
    } finally {
      setIsUpdatingAvailability(false);
    }
  };

  // Display-only normalization for R5: treat null/missing accountTier as 'Free'.
  // We never persist this — the BE-side default remains a backend ticket (BE-R5).
  const accountTier = user?.accountTier ?? 'Free';

  // Display name and avatar initials are derived from the authenticated user.
  const displayName = user?.username || user?.email || 'Account';
  const avatarInitials = (user?.username || user?.email || 'U')
    .split(/\s+/)
    .map((n) => n[0] ?? '')
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'U';

  const handleLogout = () => {
    logout();
  };

  // Nav items filtered dynamically based on active role
  const getNavItemsByRole = (): NavItem[] => {
    // Unverified users (Guest) only get read-only access to /forum. Show only
    // the Forums link in the sidebar so they can't see (let alone click)
    // workspace shortcuts the verified-guard would bounce them from anyway.
    if (isGuest) {
      return [
        { to: ROUTES.FORUM, label: 'Forums', icon: <ForumIcon size={20} /> },
      ];
    }
    switch (activeRole) {
      case 'Admin':
        return [
          // The Dashboard item is the only admin nav entry that requires
          // exact match — every other admin route starts with `/admin`, so
          // React Router's NavLink default prefix matching would otherwise
          // keep Dashboard highlighted on every admin page (Phase C
          // defect 3B).
          { to: ROUTES.ADMIN, label: 'Dashboard', icon: <DashboardIcon size={20} />, end: true },
          { to: ROUTES.ADMIN_PAPER_SUBMISSIONS, label: 'Paper Submissions', icon: <PapersIcon size={20} /> },
          { to: ROUTES.ADMIN_REVIEWER_ASSIGNMENTS, label: 'Reviewer Assignments', icon: <AssignmentsIcon size={20} /> },
          { to: ROUTES.ADMIN_PUBLISHED_PAPERS, label: 'Published Papers', icon: <PublicationIcon size={20} /> },
          { to: ROUTES.ADMIN_ROLE_REQUESTS, label: 'User Verification', icon: <RoleRequestsIcon size={20} /> },
          { to: ROUTES.ADMIN_ACCOUNTS, label: 'Accounts', icon: <AccountsIcon size={20} /> },
          { to: ROUTES.ADMIN_TRANSACTIONS, label: 'Transactions', icon: <TransactionsIcon size={20} /> },
          { to: ROUTES.ADMIN_REPORTS, label: 'Reports', icon: <ReportsIcon size={20} /> },
          { to: ROUTES.ADMIN_PACKAGES, label: 'Packages', icon: <PackagesIcon size={20} /> },
          // Agent admin-annual-fees — new Admin tab for the annual-fee
          // CRUD surface. Currently rendered against the demo-data
          // module (`src/data/annualFees.demo.ts`) while the BE-side
          // contract is being finalized. The Admin always sees this tab;
          // the feature flag gates the user-facing premium-packages
          // surface, not the Admin surface.
          { to: ROUTES.ADMIN_ANNUAL_FEES, label: 'Annual Fees', icon: <AnnualFeesIcon size={20} /> },
          { to: ROUTES.ADMIN_AUDIT_LOGS, label: 'Audit Logs', icon: <AuditLogsIcon size={20} /> },
        ];
      case 'Reviewer':
        return [
          { to: ROUTES.HOME, label: 'Home', icon: <HomeIcon size={20} />, end: true },
          { to: ROUTES.FORUM, label: 'Forums', icon: <ForumIcon size={20} /> },
          { to: ROUTES.REVIEWER_ASSIGNMENTS, label: 'Review Assignments', icon: <AssignmentsIcon size={20} /> },
          { to: ROUTES.PROFESSIONAL_PROFILE, label: 'Professional Profile', icon: <BriefcaseBusiness size={20} />, end: true },
          ...(AppConfig.features.enableWithdrawals
            ? [{ to: ROUTES.EARNINGS_WALLET, label: 'Wallet & Withdrawals', icon: <Wallet size={20} /> }]
            : []),
          // Agent admin-annual-fees — the premium-packages surface is
          // temporarily hidden for non-Admin roles while the BE-side
          // annual-fee CRUD endpoint is being finalized. The flag lives
          // in src/config/app.ts so the rule has a single definition
          // site (no scattered hardcoded booleans). The
          // `AppConfig.features.premiumPackagesEnabled` check is the
          // one — flipping it back to `true` reveals the entry for
          // every non-Admin role below.
          ...(AppConfig.features.premiumPackagesEnabled
            ? [{ to: ROUTES.PREMIUM_PACKAGES, label: 'Premium Package', icon: <PremiumIcon size={20} /> }]
            : []),
        ];
      case 'Lecturer':
        return [
          // Agent lecturer-navigation — required top-to-bottom Lecturer nav
          // order: Forum → Seminar → Guidance Projects → Learning Materials →
          // Research Topics → Research Groups → Milestones.
          // Shared edit: the Lecturer nav block was re-ordered and the
          // disabled "Shared Material" / "Wallet" stubs were removed (the
          // former points to a page that does not exist and the latter
          // belongs to Reviewer / Graduate Student flows). See
          // docs/BACKEND_REQUESTS.md "Coordination — Agent Lecturer
          // Navigation" for the coordination note.
          { to: ROUTES.HOME, label: 'Home', icon: <HomeIcon size={20} />, end: true },
          { to: ROUTES.FORUM, label: 'Forums', icon: <ForumIcon size={20} /> },
          { to: ROUTES.SEMINAR_WORKSPACE, label: 'Seminar', icon: <SeminarIcon size={20} /> },
          { to: ROUTES.LECTURER_GUIDANCE_PROJECTS, label: 'Guidance Projects', icon: <ClipboardCheck size={20} /> },
          { to: ROUTES.LECTURER_LEARNING_MATERIALS, label: 'Learning Materials', icon: <PapersIcon size={20} /> },
          { to: ROUTES.LECTURER_RESEARCH_TOPICS, label: 'Research Topics', icon: <GroupIcon size={20} /> },
          { to: ROUTES.RESEARCH_GROUP, label: 'Research Groups', icon: <GroupIcon size={20} /> },
          { to: ROUTES.CONFIGURE_MILESTONES, label: 'Milestones', icon: <Settings size={20} /> },
          // Agent admin-annual-fees — hidden for non-Admin roles while the
          // BE-side annual-fee CRUD endpoint is being finalized. See the
          // Reviewer block above for the single-source-of-truth flag.
          ...(AppConfig.features.premiumPackagesEnabled
            ? [{ to: ROUTES.PREMIUM_PACKAGES, label: 'Premium Package', icon: <PremiumIcon size={20} /> }]
            : []),
        ];
      case 'Graduate Student':
        return [
          { to: ROUTES.HOME, label: 'Home', icon: <HomeIcon size={20} />, end: true },
          { to: ROUTES.FORUM, label: 'Forums', icon: <ForumIcon size={20} /> },
          { to: ROUTES.STUDENT_RESEARCH_GROUPS, label: 'Research Groups', icon: <GroupIcon size={20} /> },
          { to: ROUTES.SUBMIT_REPORT, label: 'Submit Report', icon: <Upload size={20} /> },
          { to: '#wallet', label: 'Wallet', icon: <Wallet size={20} /> },
          // Agent admin-annual-fees — see the Reviewer block above for the
          // single-source-of-truth flag and the rationale.
          ...(AppConfig.features.premiumPackagesEnabled
            ? [{ to: ROUTES.PREMIUM_PACKAGES, label: 'Premium Package', icon: <PremiumIcon size={20} /> }]
            : []),
        ];
      case 'Researcher':
      default:
        return [
          { to: ROUTES.HOME, label: 'Home', icon: <HomeIcon size={20} />, end: true },
          { to: ROUTES.FORUM, label: 'Forums', icon: <ForumIcon size={20} />, showDot: true },
          { to: ROUTES.RESEARCHER_SUBMISSIONS, label: 'My Submissions', icon: <PapersIcon size={20} /> },
          { to: '#workspaces', label: 'Workspaces', icon: <SeminarIcon size={20} /> },
          { to: '#wallet', label: 'My Wallet', icon: <Wallet size={20} /> },
          // Agent admin-annual-fees — see the Reviewer block above for the
          // single-source-of-truth flag and the rationale.
          ...(AppConfig.features.premiumPackagesEnabled
            ? [{ to: ROUTES.PREMIUM_PACKAGES, label: 'Premium Package', icon: <PremiumIcon size={20} /> }]
            : []),
        ];
    }
  };

  const navItems = getNavItemsByRole();

  return (
    <div className={styles.mainContainer}>
      {/* Sidebar */}
      <aside className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <div className={styles.logoContainer}>
            <ARSPlatformLogo />
          </div>
        </div>

        <nav className={styles.sidebarNav}>
          {navItems.map((item, index) => {
            if (item.to.startsWith('#')) {
              return (
                <div key={index} className={`${styles.navItem} ${styles.disabledNavItem}`}>
                  <span className={styles.navIcon}>{item.icon}</span>
                  <span className={styles.navLabel}>{item.label}</span>
                </div>
              );
            }
            return (
              <NavLink
                key={index}
                to={item.to}
                end={item.end ?? false}
                className={({ isActive }) =>
                  `${styles.navItem} ${isActive ? styles.navItemActive : ''}`
                }
              >
                <span className={styles.navIcon}>{item.icon}</span>
                <span className={styles.navLabel}>{item.label}</span>
                {item.showDot && <span className={styles.navDot}></span>}
                {item.badge && <span className={styles.navBadge}>{item.badge}</span>}
              </NavLink>
            );
          })}
        </nav>
      </aside>

      {/* Right Column (Header + Content) */}
      <div className={styles.rightContentArea}>
        {/* Header */}
        <header className={styles.header}>
          {/* Toast Notification */}
          {toastMessage && (
            <div className={`${styles.toast} ${toastMessage.type === 'success' ? styles.toastSuccess : styles.toastError}`}>
              {toastMessage.type === 'success' ? (
                <CheckCircle2 size={16} />
              ) : (
                <AlertCircle size={16} />
              )}
              <span>{toastMessage.text}</span>
              <button className={styles.toastClose} onClick={() => setToastMessage(null)}>
                <X size={14} />
              </button>
            </div>
          )}

          {/* Search bar */}
          <div className={styles.searchContainer}>
            <span className={styles.searchIcon}><Search size={18} /></span>
            <input
              type="text"
              placeholder="Search Papers..."
              className={styles.searchInput}
            />
          </div>

          {/* Right Header Panel */}
          <div className={styles.headerRight}>
            {/* Reviewer availability toggle — only shown for Reviewer role */}
            {activeRole === 'Reviewer' && (
              <div className={styles.availabilityToggle}>
                <button
                  data-testid="availability-toggle"
                  className={`${styles.toggleSwitch} ${isReviewerAvailable ? styles.toggleSwitchOn : styles.toggleSwitchOff}`}
                  onClick={handleToggleAvailability}
                  disabled={isUpdatingAvailability || beAvailabilityLoading}
                  aria-label={isReviewerAvailable ? 'Turn off availability' : 'Turn on availability'}
                  aria-pressed={isReviewerAvailable}
                  title={isReviewerAvailable ? 'Click to go unavailable' : 'Click to go available'}
                >
                  <span
                    className={`${styles.toggleKnob} ${isReviewerAvailable ? styles.toggleKnobOn : styles.toggleKnobOff}`}
                  />
                </button>
                <span
                  className={`${styles.availabilityLabel} ${isReviewerAvailable ? styles.availabilityLabelAvailable : styles.availabilityLabelUnavailable}`}
                >
                  {isReviewerAvailable ? 'Available' : 'Unavailable'}
                </span>
              </div>
            )}

            {/* Wallet Balance — hidden for users who don't have a wallet row.
                Admins do not hold a personal wallet; unverified users (Guest)
                have no row until an Admin approves their role request. */}
            {hasWallet && (
              <div className={styles.walletBadge}>
                <span className={styles.walletIcon}><Wallet size={18} /></span>
                <span className={styles.walletAmount}>
                  {isBalanceLoading || beBalance === null
                    ? '—'
                    : `${beBalance.toLocaleString('vi-VN')} VND`}
                </span>
                <button
                  type="button"
                  className={styles.walletTopUpButton}
                  aria-label="Top up wallet"
                  onClick={() => setIsTopUpOpen(true)}
                  data-testid="wallet-topup-trigger"
                >
                  <Plus size={14} />
                </button>
              </div>
            )}

            {/* Notification bell — Agent-16: replaced the static badge with
                the full NotificationCenter dropdown. Reads the same BE
                notifications list, but also drives the dropdown panel,
                mark-read mutations, and route resolution. */}
            <NotificationCenter onNavigate={(path) => navigate(path)} />

            {/* Profile Dropdown */}
            <ProfileDropdown
              username={displayName}
              activeRole={displayedRole}
              avatarInitials={avatarInitials}
              accountTier={accountTier}
              onLogout={handleLogout}
              onProfileClick={() => navigate(ROUTES.PROFILE)}
              onAccountSettingsClick={() => navigate(ROUTES.ACCOUNT_SETTINGS)}
            />
          </div>
        </header>

        {/* Welcome-back banner — Agent banner: renders a transient greeting
            after a genuine successful login (email/password or Google OAuth).
            Lives in the shared layout so every role (Researcher, Reviewer,
            Lecturer, Graduate Student, Admin) sees it through the single
            MainLayout slot. The banner reads its visibility from a session-
            only signal store; on refresh / route change the store stays empty
            so the banner does NOT re-show. */}
        <WelcomeBackBanner />

        {/* Content Body */}
        <main className={styles.contentBody}>
          <Outlet />
        </main>
      </div>

      {/* Wallet Top-Up Modal — only mounted for users who actually have a
          wallet row (see the header wallet badge above for the rule). */}
      {hasWallet && (
        <WalletTopUpModal
          isOpen={isTopUpOpen}
          currentUserId={user?.userId ?? null}
          currentWalletId={beWalletId ?? null}
          currentBalance={beBalance}
          onSuccess={async () => {
            // Re-fetch the wallet so the header pill reflects the new balance
            // immediately (works for both the PayOS redirect path and the DEV
            // auto-fund path).
            await refetchWallet();
          }}
          onMessage={(text, type) => setToastMessage({ text, type })}
          onClose={() => setIsTopUpOpen(false)}
        />
      )}
    </div>
  );
};

export default MainLayout;
