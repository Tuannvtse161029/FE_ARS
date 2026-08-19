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
import styles from './MainLayout.module.css';
import arsLogo from '../assets/images/ARS_Logo.png';

import {
  Search,
  Wallet,
  Plus,
  MessageSquare as ForumIcon,
  FileText as PapersIcon,
  Users as BrowseReviewersIcon,
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

  // Wallet balance comes from the BE — render placeholder until it loads.
  // We also pull the full `wallet` object so we can pass the `walletId`
  // through to WalletTopUpModal (which posts it as `walletId` on
  // `POST /api/Payment/create-link`).
  const { walletId: beWalletId, balance: beBalance, isLoading: isBalanceLoading, refetch: refetchWallet } = useWallet(user?.userId);

  // Notifications are owned by <NotificationCenter /> below. The header
  // bell button now renders the dropdown directly, so we no longer read
  // `unreadCount` here — keeping a stale local copy would create two
  // sources of truth for the same BE row.

  // Reviewer availability comes from the BE (read-only here; toggle still calls update).
  const { isAvailable: beReviewerAvailable, isLoading: beAvailabilityLoading, refetch: refetchAvailability } = useReviewerAvailability(user?.userId);

  // Active role is derived solely from the authenticated user's role as set by the BE at login.
  // Role switching is no longer performed in-app — users with multiple roles re-login
  // (and pick a role on the new JWT) instead.
  const activeRole: UserRole = (user?.role as UserRole) ?? 'Researcher';

  // Single source of truth for unverified-user gating. `canViewAdminPanel`
  // collapses the dual-signal admin check (roleName OR roleId) that the
  // Admin guards used to repeat. `hasWallet` collapses what used to be a
  // `!isAdmin && !isGuest` check at every header / modal site into one
  // derivation. `isGuest` is sourced from the BE-derived `effectiveRole`
  // field (Agent 39) with the old `!isActive && !isAdmin` derivation as a
  // fallback for pre-migration persisted blobs.
  const { hasWallet, isGuest } = usePermissions();
  const displayedRole: string = isGuest ? 'Guest' : activeRole;

  // Bounce unverified users off every private route except /forum. Lives in
  // its own hook so the verification rule has one definition site.
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
    navigate(ROUTES.LOGIN);
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
          { to: ROUTES.ADMIN_ROLE_REQUESTS, label: 'Role Requests', icon: <RoleRequestsIcon size={20} /> },
          { to: ROUTES.ADMIN_ACCOUNTS, label: 'Accounts', icon: <AccountsIcon size={20} /> },
          { to: ROUTES.ADMIN_TRANSACTIONS, label: 'Transactions', icon: <TransactionsIcon size={20} /> },
          { to: ROUTES.ADMIN_REPORTS, label: 'Reports', icon: <ReportsIcon size={20} /> },
          { to: ROUTES.ADMIN_PACKAGES, label: 'Packages', icon: <PackagesIcon size={20} /> },
          { to: ROUTES.ADMIN_AUDIT_LOGS, label: 'Audit Logs', icon: <AuditLogsIcon size={20} /> },
        ];
      case 'Reviewer':
        return [
          { to: ROUTES.FORUM, label: 'Forums', icon: <ForumIcon size={20} /> },
          { to: ROUTES.REVIEW_TASKS, label: 'Review Paper', icon: <PapersIcon size={20} />, badge: '2' },
          { to: ROUTES.PROFESSIONAL_PROFILE, label: 'Professional Profile', icon: <BriefcaseBusiness size={20} />, end: true },
          { to: ROUTES.EARNINGS_WALLET, label: 'Wallet & Withdrawals', icon: <Wallet size={20} /> },
          { to: ROUTES.PREMIUM_PACKAGES, label: 'Premium Package', icon: <PremiumIcon size={20} /> },
        ];
      case 'Lecturer':
        return [
          { to: ROUTES.FORUM, label: 'Forums', icon: <ForumIcon size={20} /> },
          { to: ROUTES.SEMINAR_WORKSPACE, label: 'Seminar', icon: <SeminarIcon size={20} /> },
          { to: ROUTES.RESEARCH_GROUP, label: 'Research Group', icon: <GroupIcon size={20} /> },
          { to: ROUTES.LECTURER_EVALUATE_REPORTS, label: 'Evaluate Reports', icon: <ClipboardCheck size={20} /> },
          { to: ROUTES.CONFIGURE_MILESTONES, label: 'Configure Milestones', icon: <Settings size={20} /> },
          // Lecturer nav (added in Phase C, Lead, lead-phase-c-contract.md §3.1 / L1).
          // "Guidance Projects" is wired to the real Lecturer route now that
          // Agent-1 has built the page (L1 of Phase C).
          // The disabled placeholders below remain until the matching BE
          // resources ship (gap ticket §C.2 / §D.2 / §E).
          { to: ROUTES.LECTURER_GUIDANCE_PROJECTS, label: 'Guidance Projects', icon: <ClipboardCheck size={20} /> },
          { to: '#shared-material', label: 'Shared Material', icon: <PapersIcon size={20} /> },
          { to: '#wallet', label: 'Wallet', icon: <Wallet size={20} /> },
          { to: ROUTES.PREMIUM_PACKAGES, label: 'Premium Package', icon: <PremiumIcon size={20} /> },
        ];
      case 'Graduate Student':
        return [
          { to: ROUTES.FORUM, label: 'Forums', icon: <ForumIcon size={20} /> },
          { to: ROUTES.STUDENT_RESEARCH_GROUPS, label: 'Research Groups', icon: <GroupIcon size={20} /> },
          { to: ROUTES.SUBMIT_REPORT, label: 'Submit Report', icon: <Upload size={20} /> },
          { to: '#wallet', label: 'Wallet', icon: <Wallet size={20} /> },
          { to: ROUTES.PREMIUM_PACKAGES, label: 'Premium Package', icon: <PremiumIcon size={20} /> },
        ];
      case 'Researcher':
      default:
        return [
          { to: ROUTES.FORUM, label: 'Forums', icon: <ForumIcon size={20} />, showDot: true },
          { to: ROUTES.PAPERS, label: 'Paper', icon: <PapersIcon size={20} /> },
          { to: ROUTES.REVIEWERS, label: 'Reviewers', icon: <BrowseReviewersIcon size={20} /> },
          { to: '#workspaces', label: 'Workspaces', icon: <SeminarIcon size={20} /> },
          { to: '#wallet', label: 'My Wallet', icon: <Wallet size={20} /> },
          { to: ROUTES.PREMIUM_PACKAGES, label: 'Premium Package', icon: <PremiumIcon size={20} /> },
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
