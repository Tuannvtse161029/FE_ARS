import { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ROUTES } from '../routes/paths';
import { reviewerService } from '../services/reviewer.service';
import type { UserRole } from '../types/auth';
import { useWallet } from '../hooks/useWallet';
import { useReviewerAvailability } from '../hooks/useReviewerProfiles';
import { useNotifications } from '../hooks/useNotifications';
import { isAdminUser } from '../utils/roleNormalizer';
import { WalletTopUpModal } from '../components/wallet/WalletTopUpModal';
import styles from './MainLayout.module.css';
import arsLogo from '../assets/images/ARS_Logo.png';

import {
  Search,
  Wallet,
  Bell,
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
} from 'lucide-react';

const ProfileDropdown = ({
  username,
  activeRole,
  avatarInitials,
  onLogout,
  onProfileClick,
  onAccountSettingsClick,
}: {
  username: string;
  activeRole: string;
  avatarInitials: string;
  onLogout: () => void;
  onProfileClick: () => void;
  onAccountSettingsClick: () => void;
}) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className={styles.profileDropdownContainer}>
      <button
        className={styles.profileDropdownTrigger}
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className={styles.avatarCircleSmall}>{avatarInitials}</div>
        <div className={styles.userInfoText}>
          <div className={styles.userPillName}>{username}</div>
          <div className={styles.userPillRole}>{activeRole}</div>
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
}

export const MainLayout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Wallet balance comes from the BE — render placeholder until it loads.
  // We also pull the full `wallet` object so we can pass the `walletId`
  // through to WalletTopUpModal (which posts it as `walletId` on
  // `POST /api/Payment/create-link`).
  const { wallet: beWallet, balance: beBalance, isLoading: isBalanceLoading, refetch: refetchWallet } = useWallet(user?.userId);

  // Notifications come from the BE — feed the header bell badge.
  const { unreadCount } = useNotifications(user?.userId);

  // Reviewer availability comes from the BE (read-only here; toggle still calls update).
  const { isAvailable: beReviewerAvailable, refetch: refetchAvailability } = useReviewerAvailability(user?.userId);

  // Active role is derived solely from the authenticated user's role as set by the BE at login.
  // Role switching is no longer performed in-app — users with multiple roles re-login
  // (and pick a role on the new JWT) instead.
  const activeRole: UserRole = (user?.role as UserRole) ?? 'Researcher';

  // Admin accounts do not use the in-app wallet or top-up flow — incoming
  // payments go to the central Admin VNPay account and outgoing payouts are
  // handled manually via direct bank transfers. Hide the wallet badge (and
  // its + button) entirely for Admins. Mirrors the dual-signal check used by
  // useAdminGuard until the BE's off-by-one roleId mapping is fixed.
  const isAdmin = (() => {
    const stored = (() => {
      try {
        const raw =
          localStorage.getItem('ars_user') || sessionStorage.getItem('ars_user');
        return raw ? (JSON.parse(raw) as { roleId?: number; roleName?: string }) : null;
      } catch {
        return null;
      }
    })();
    return isAdminUser({
      roleName: activeRole,
      roleId: stored?.roleId ?? null,
    });
  })();

  // Pending-state route guard: unverified users (isActive !== true) only
  // get read-only access to /forum. Any other private route bounces them
  // back to /forum with the pending banner.
  //
  // Admins are exempt because they are provisioned directly in the DB and
  // bypass the role-request lifecycle.
  // See src/hooks/useVerifiedGuard.ts and the per-page useAdminGuard.
  useEffect(() => {
    if (isAdmin) return;
    if (location.pathname === ROUTES.FORUM) return;

    // Read isActive from storage so the guard works during the brief
    // rehydration window before AuthContext has rehydrated the store.
    const stored = (() => {
      try {
        const raw =
          localStorage.getItem('ars_user') || sessionStorage.getItem('ars_user');
        return raw ? (JSON.parse(raw) as { isActive?: boolean }) : null;
      } catch {
        return null;
      }
    })();
    const isActive = user?.isActive ?? stored?.isActive ?? true;
    if (!isActive) {
      navigate(ROUTES.FORUM, { replace: true });
    }
  }, [isAdmin, location.pathname, navigate, user?.isActive]);

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
  const [optimisticAvailability, setOptimisticAvailability] = useState<boolean | null>(null);
  const isReviewerAvailable = optimisticAvailability ?? beReviewerAvailable;

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
    switch (activeRole) {
      case 'Admin':
        return [
          { to: ROUTES.ADMIN, label: 'Dashboard', icon: <DashboardIcon size={20} /> },
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
          { to: ROUTES.EARNINGS_WALLET, label: 'Wallet & Withdrawals', icon: <Wallet size={20} /> },
        ];
      case 'Lecturer':
        return [
          { to: ROUTES.FORUM, label: 'Forums', icon: <ForumIcon size={20} /> },
          { to: ROUTES.SEMINAR_WORKSPACE, label: 'Seminar', icon: <SeminarIcon size={20} /> },
          { to: ROUTES.RESEARCH_GROUP, label: 'Research Group', icon: <GroupIcon size={20} /> },
          { to: '#shared-material', label: 'Shared Material', icon: <PapersIcon size={20} /> },
          { to: '#wallet', label: 'Wallet', icon: <Wallet size={20} /> },
        ];
      case 'Graduate Student':
        return [
          { to: ROUTES.FORUM, label: 'Forums', icon: <ForumIcon size={20} /> },
          { to: ROUTES.PAPERS, label: 'Paper', icon: <PapersIcon size={20} /> },
          { to: ROUTES.REVIEWERS, label: 'Browse Reviewers', icon: <BrowseReviewersIcon size={20} /> },
          { to: ROUTES.STUDENT_RESEARCH_GROUPS, label: 'Research Groups', icon: <GroupIcon size={20} /> },
          { to: '#wallet', label: 'Wallet', icon: <Wallet size={20} /> },
          { to: '#premium-packages', label: 'Premium Packages', icon: <BrowseReviewersIcon size={20} /> },
        ];
      case 'Researcher':
      default:
        return [
          { to: ROUTES.FORUM, label: 'Forums', icon: <ForumIcon size={20} />, showDot: true },
          { to: ROUTES.PAPERS, label: 'Paper', icon: <PapersIcon size={20} /> },
          { to: ROUTES.REVIEWERS, label: 'Reviewers', icon: <BrowseReviewersIcon size={20} /> },
          { to: '#workspaces', label: 'Workspaces', icon: <SeminarIcon size={20} /> },
          { to: '#wallet', label: 'My Wallet', icon: <Wallet size={20} /> },
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
                  className={`${styles.toggleSwitch} ${isReviewerAvailable ? styles.toggleSwitchOn : styles.toggleSwitchOff}`}
                  onClick={handleToggleAvailability}
                  disabled={isUpdatingAvailability}
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

            {/* Wallet Balance — hidden for Admins (no in-app wallet). */}
            {!isAdmin && (
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

            {/* Notification bell — badge count from BE unread count */}
            <button className={styles.notificationBtn} aria-label={`Notifications (${unreadCount} unread)`}>
              <Bell size={18} />
              {unreadCount > 0 && <span className={styles.notificationBadge}>{unreadCount}</span>}
            </button>

            {/* Profile Dropdown */}
            <ProfileDropdown
              username={displayName}
              activeRole={activeRole}
              avatarInitials={avatarInitials}
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

      {/* Wallet Top-Up Modal — only mounted for non-Admin users (Admins have
          no wallet; see the header wallet badge conditional). */}
      {!isAdmin && (
        <WalletTopUpModal
          isOpen={isTopUpOpen}
          currentUserId={user?.userId ?? null}
          currentWalletId={beWallet?.id ?? null}
          currentBalance={beBalance}
          onSuccess={async () => {
            // Re-fetch the wallet so the header pill reflects the new balance
            // immediately (works for both the mock-VNPay "Simulate Success"
            // path and the DEV auto-fund path).
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
