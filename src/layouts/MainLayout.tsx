import { useEffect, useId, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
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
  ClipboardCheck,
  Upload,
  BriefcaseBusiness,
  Receipt as AnnualFeesIcon,
  Home as HomeIcon,
  ClipboardList as AssignmentsIcon,
  FileCheck2 as PublicationIcon,
  Menu as MenuIcon,
} from 'lucide-react';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  MoonIcon,
  ResearchPaperIcon,
  SunIcon,
} from './MainLayout.icons';

const SIDEBAR_COLLAPSED_STORAGE_KEY = 'ars.sidebar.collapsed';
const getStoredSidebarCollapsed = (): boolean => {
  if (typeof window === 'undefined') {
    return false;
  }

  try {
    const primary = window.localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY);
    if (primary === 'true') return true;
    if (primary === 'false') return false;
    // Legacy key the user request specified (`ars_sidebar_collapsed`).
    // Kept for backward compatibility with already-saved sessions so an
    // existing user who already collapsed the sidebar before this worker
    // shipped keeps their preference.
    const legacy = window.localStorage.getItem('ars_sidebar_collapsed');
    return legacy === 'true';
  } catch {
    return false;
  }
};

/* ───────────────────────────────────────────────────────────────
   === Collapse + Dark Mode (this worker / Agent 38) ===
   Delimiter for downstream coordination. Storage keys + theme
   helpers below are owned by this worker. Other agents should
   leave the localStorage helpers and theme bootstrap alone and
   place their changes ABOVE this banner.
   ─────────────────────────────────────────────────────────────── */
const THEME_STORAGE_KEY = 'ars_theme';
type ThemeName = 'light' | 'night';

const THEME_VALUES: readonly ThemeName[] = ['light', 'night'] as const;

const isThemeName = (value: unknown): value is ThemeName =>
  typeof value === 'string' &&
  (THEME_VALUES as readonly string[]).includes(value);

/**
 * Read the persisted theme preference. Falls back to `null` so the
 * MainLayout bootstrap effect can apply `prefers-color-scheme` only when
 * the user has not made an explicit choice.
 */
const getStoredTheme = (): ThemeName | null => {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isThemeName(raw) ? raw : null;
  } catch {
    return null;
  }
};

/**
 * Returns the initial theme to apply on first paint. The cascade order is:
 *   1. localStorage explicit choice (user wins).
 *   2. `prefers-color-scheme: dark` for first-time visitors with no
 *      stored value.
 *   3. `light` as the final default.
 */
const resolveInitialTheme = (): ThemeName => {
  const stored = getStoredTheme();
  if (stored !== null) {
    return stored;
  }
  if (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
  ) {
    return 'night';
  }
  return 'light';
};

/**
 * Persist a theme choice to localStorage. The decision to read
 * `matchMedia` synchronously inside `resolveInitialTheme` (rather than
 * wiring a `change` listener) is intentional: theme changes for an
 * already-mounted session come through the toggle button, and we do
 * not want a foreground OS theme flip to silently override an
 * explicit user preference while they are mid-task.
 */
const setStoredTheme = (theme: ThemeName): void => {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // The layout remains usable when browser storage is unavailable.
  }
};

/**
 * Apply the theme by writing `data-theme="night"` (or `light`) on the
 * root `<html>` element. The matching `:root[data-theme='night']` token
 * cascade lives in `src/styles/ars-tokens.css`.
 *
 * Why `<html>` rather than the MainLayout root container?
 *   - Single source of truth shared by every route that renders inside
 *     MainLayout (publication home, profile, dashboard, etc).
 *   - Avoids race conditions where descendant pages render before the
 *     attribute is on the layout wrapper.
 *   - The light-only public pages (Landing, Login, Register) sit ABOVE
 *     MainLayout in the route tree, so they never see this attribute.
 */
const applyThemeToRoot = (theme: ThemeName): void => {
  if (typeof document === 'undefined') {
    return;
  }
  document.documentElement.setAttribute('data-theme', theme);
};
/* === END Collapse + Dark Mode (this worker / Agent 38) === */

const ProfileDropdown = ({
  username,
  activeRole,
  avatarInitials,
  accountTier,
  onLogout,
  onProfileClick,
}: {
  username: string;
  activeRole: string;
  avatarInitials: string;
  accountTier?: string;
  onLogout: () => void;
  onProfileClick: () => void;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const tierClass =
    accountTier === 'Premium'
      ? styles.userPillTierPremium
      : accountTier === 'Enterprise'
      ? styles.userPillTierEnterprise
      : styles.userPillTierFree;

  return (
    <div className={styles.profileDropdownContainer}>
      <button
        ref={triggerRef}
        type="button"
        className={styles.profileDropdownTrigger}
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        aria-controls={menuId}
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
        <div id={menuId} className={styles.profileDropdownMenu} role="menu" aria-label="Account menu">
          <button type="button" role="menuitem" className={styles.dropdownItem} onClick={() => { onProfileClick(); setIsOpen(false); }}>
            <User size={16} />
            <span>My Profile & Role Upgrades</span>
          </button>
          <div className={styles.dropdownDivider}></div>
          <button type="button" role="menuitem" className={`${styles.dropdownItem} ${styles.dropdownItemLogout}`} onClick={() => { onLogout(); setIsOpen(false); }}>
            <LogOut size={16} />
            <span>Log out</span>
          </button>
        </div>
      )}
    </div>
  );
};

const ARSPlatformLogo = () => (
  <div className={styles.logoContainer}>
    <img src={arsLogo} alt="ARS Platform" />
  </div>
);

interface NavItem {
  to: string;
  label: string;
  icon: React.ReactNode;
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
  const location = useLocation();

  // Active role is derived solely from the authenticated user's role as set by the BE at login.
  const activeRole: UserRole = (user?.role as UserRole) ?? 'Researcher';

  // Single source of truth for unverified-user gating.
  const { hasWallet, isGuest } = usePermissions();
  const displayedRole: string = isGuest ? 'Guest' : activeRole;

  // Lecturer, Graduate Student, and Guest do not own a wallet row in this build —
  // suppress both the header wallet pill and the top-up modal for them.
  // Researcher / Reviewer / Admin behavior is unchanged: the `hasWallet` flag
  // from usePermissions() is already false for Admin, so we only AND in
  // role-based suppression for the three roles the product says shouldn't
  // see wallet UI yet.
  const walletVisible =
    hasWallet &&
    activeRole !== 'Lecturer' &&
    activeRole !== 'Graduate Student' &&
    displayedRole !== 'Guest';

  // Wallet balance comes from the BE — only for roles that have wallets (not Guest).
  const { walletId: beWalletId, balance: beBalance, isLoading: isBalanceLoading, refetch: refetchWallet } = useWallet(hasWallet && user?.userId ? user.userId : undefined);

  // Reviewer availability comes from the BE (only for active Reviewers).
  const { isAvailable: beReviewerAvailable, isLoading: beAvailabilityLoading, refetch: refetchAvailability } = useReviewerAvailability(activeRole === 'Reviewer' && user?.userId ? user.userId : undefined);

  // Bounce unverified users off every private route except /forum.
  useVerifiedGuard();

  const [isUpdatingAvailability, setIsUpdatingAvailability] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [isTopUpOpen, setIsTopUpOpen] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(getStoredSidebarCollapsed);
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  const mobileDrawerRef = useRef<HTMLElement>(null);

  // Theme bootstrap (this worker / Agent 38) — read the persisted choice on
  // mount and apply it to <html data-theme="..."> so token cascade flips
  // before the user sees a flash of the wrong background.
  const [theme, setTheme] = useState<ThemeName>(() => resolveInitialTheme());

  useEffect(() => {
    applyThemeToRoot(theme);
    setStoredTheme(theme);
  }, [theme]);

  const handleToggleTheme = (): void => {
    setTheme((current) => (current === 'night' ? 'light' : 'night'));
  };

  const handleToggleSidebar = (): void => {
    setIsSidebarCollapsed((collapsed) => !collapsed);
  };

  useEffect(() => {
    try {
      window.localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, String(isSidebarCollapsed));
      // Mirror the legacy key the original user spec called out so older
      // consumers (and any browser extensions keying off it) keep working.
      window.localStorage.setItem('ars_sidebar_collapsed', String(isSidebarCollapsed));
    } catch {
      // The layout remains usable when browser storage is unavailable.
    }
  }, [isSidebarCollapsed]);

  // Keep the mobile drawer in the user's keyboard path and restore its trigger
  // when it closes. Desktop sidebar behavior remains unchanged.
  useEffect(() => {
    if (!isMobileNavOpen) {
      return undefined;
    }

    const drawer = mobileDrawerRef.current;
    const closeControl = drawer?.querySelector<HTMLButtonElement>('button[aria-label="Close navigation"]');
    closeControl?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setIsMobileNavOpen(false);
        menuTriggerRef.current?.focus();
        return;
      }

      if (event.key !== 'Tab' || !drawer) {
        return;
      }

      const focusable = Array.from(
        drawer.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => !element.hasAttribute('hidden'));
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (!first || !last) {
        return;
      }

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isMobileNavOpen]);

  // Close mobile drawer on route change so navigating between roles hides it.
  useEffect(() => {
    setIsMobileNavOpen(false);
  }, [location.pathname]);

  // Auto-dismiss toast after 3 seconds
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  // Mirror the BE reviewer availability into local state so the toggle works
  // on the same source-of-truth that the publication adapter reads from.
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
          // Annual Fees stays visible as a production dependency state while
          // its backend contract is being implemented.
          { to: ROUTES.ADMIN_ANNUAL_FEES, label: 'Annual Fees', icon: <AnnualFeesIcon size={20} /> },
          { to: ROUTES.ADMIN_AUDIT_LOGS, label: 'Audit Logs', icon: <AuditLogsIcon size={20} /> },
        ];
      case 'Reviewer':
        return [
          { to: ROUTES.HOME, label: 'Discover Research', icon: <HomeIcon size={20} />, end: true },
          { to: ROUTES.FORUM, label: 'Forums', icon: <ForumIcon size={20} /> },
          { to: ROUTES.REVIEWER_ASSIGNMENTS, label: 'Review Assignments', icon: <AssignmentsIcon size={20} /> },
          { to: ROUTES.PROFESSIONAL_PROFILE, label: 'Professional Profile', icon: <BriefcaseBusiness size={20} />, end: true },
          ...(AppConfig.features.enableWithdrawals
            ? [{ to: ROUTES.EARNINGS_WALLET, label: 'Wallet & Withdrawals', icon: <Wallet size={20} /> }]
            : []),
        ];
      case 'Lecturer':
        return [
          { to: ROUTES.HOME, label: 'Discover Research', icon: <HomeIcon size={20} />, end: true },
          { to: ROUTES.FORUM, label: 'Forums', icon: <ForumIcon size={20} /> },
          { to: ROUTES.SEMINAR_WORKSPACE, label: 'Seminar', icon: <SeminarIcon size={20} /> },
          { to: ROUTES.LECTURER_GUIDANCE_PROJECTS, label: 'Guidance Projects', icon: <ClipboardCheck size={20} /> },
          { to: ROUTES.LECTURER_LEARNING_MATERIALS, label: 'Learning Materials', icon: <PapersIcon size={20} /> },
          { to: ROUTES.LECTURER_RESEARCH_TOPICS, label: 'Research Topics', icon: <GroupIcon size={20} /> },
          { to: ROUTES.RESEARCH_GROUP, label: 'Research Groups', icon: <GroupIcon size={20} /> },
          { to: ROUTES.CONFIGURE_MILESTONES, label: 'Milestones', icon: <Settings size={20} /> },
        ];
      case 'Graduate Student':
        return [
          { to: ROUTES.GRADUATE_STUDENT_DASHBOARD, label: 'Research Journey', icon: <DashboardIcon size={20} />, end: true },
          { to: ROUTES.HOME, label: 'Discover Research', icon: <HomeIcon size={20} />, end: true },
          { to: ROUTES.FORUM, label: 'Forums', icon: <ForumIcon size={20} /> },
          { to: ROUTES.STUDENT_RESEARCH_GROUPS, label: 'Research Groups', icon: <GroupIcon size={20} /> },
          { to: ROUTES.SUBMIT_REPORT, label: 'Submit Report', icon: <Upload size={20} /> },
        ];
      case 'Researcher':
      default:
        return [
          { to: ROUTES.HOME, label: 'Discover Research', icon: <HomeIcon size={20} />, end: true },
          { to: ROUTES.FORUM, label: 'Forums', icon: <ForumIcon size={20} /> },
          { to: ROUTES.SEMINAR_WORKSPACE, label: 'Seminar', icon: <SeminarIcon size={20} /> },
          { to: ROUTES.RESEARCHER_SUBMISSIONS, label: 'My Submissions', icon: <PapersIcon size={20} /> },
        ];
    }
  };

  const navItems = getNavItemsByRole();

  return (
    /* Theme attribute (Agent 38) lives on the MainLayout root so the
       night-mode cascade is scoped to authenticated routes only — the
       light-only public pages (Landing / Login / Register) render
       outside MainLayout and never see this attribute. We also mirror
       the attribute on <html> via `applyThemeToRoot` so token look-ups
       cascade even before this component mounts. */
    <div className={styles.mainContainer} data-theme={theme}>
      {/* Backdrop for mobile drawer */}
      <div
        className={`${styles.backdrop} ${isMobileNavOpen ? styles.backdropVisible : ''}`}
        onClick={() => {
          setIsMobileNavOpen(false);
          menuTriggerRef.current?.focus();
        }}
        aria-hidden
      />

      {/* Sidebar */}
      <aside
        ref={mobileDrawerRef}
        className={`${styles.sidebar} ${isSidebarCollapsed ? styles.sidebarCollapsed : ''} ${isMobileNavOpen ? styles.sidebarOpen : ''}`}
      >
        <div className={styles.sidebarHeader}>
          <ARSPlatformLogo />
          <button
            type="button"
            className={styles.sidebarClose}
            onClick={() => {
              setIsMobileNavOpen(false);
              menuTriggerRef.current?.focus();
            }}
            aria-label="Close navigation"
          >
            <X size={18} />
          </button>
        </div>

        <nav className={styles.sidebarNav} aria-label="Workspace navigation">
          <button
            type="button"
            className={styles.sidebarCollapse}
            onClick={handleToggleSidebar}
            aria-label={isSidebarCollapsed ? 'Expand navigation' : 'Collapse navigation'}
            aria-expanded={!isSidebarCollapsed}
            aria-controls="main-navigation-list"
            title={isSidebarCollapsed ? 'Expand navigation' : 'Collapse navigation'}
            data-testid="sidebar-collapse-toggle"
          >
            {isSidebarCollapsed ? (
              <ChevronRightIcon size={18} aria-label="Expand navigation" />
            ) : (
              <ChevronLeftIcon size={18} aria-label="Collapse navigation" />
            )}
            <span className={styles.sidebarCollapseLabel}>
              {isSidebarCollapsed ? 'Expand navigation' : 'Collapse navigation'}
            </span>
          </button>

          {navItems.map((item, index) => {
            if (item.to.startsWith('#')) {
              return (
                <div
                  key={index}
                  className={`${styles.navItem} ${styles.disabledNavItem}`}
                  aria-label={item.label}
                  title={item.label}
                >
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
                aria-label={item.label}
                title={item.label}
                className={({ isActive }) =>
                  `${styles.navItem} ${isActive ? styles.navItemActive : ''}`
                }
              >
                <span className={styles.navIcon}>{item.icon}</span>
                <span className={styles.navLabel}>{item.label}</span>
                {/* === Nav dot removal (this worker) ===
                    The 6×6 dot that previously lived here was a stale
                    visual marker (no signal, no counter, no badge
                    contract). The active nav state already reads
                    through `_navItemActive_1bnip_151` (background wash,
                    3px primary rule, semibold label) so the dot was
                    redundant. Keeping the comment block here so any
                    later agent knows the removal was deliberate. */}
                {item.badge && <span className={styles.navBadge}>{item.badge}</span>}
              </NavLink>
            );
          })}
        </nav>

        {/* Sidebar watermark — a decorative manuscript icon placed in the
            empty space below the nav. The existing low-opacity CSS treatment
            keeps it visually secondary to navigation. */}
        <div className={styles.sidebarWatermark} aria-hidden="true">
          <span className={styles.sidebarWatermarkImage}>
            <ResearchPaperIcon size={152} />
          </span>
        </div>

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

          {/* Header left — mobile menu toggle only.
              The previous "running-head" editorial label ("ARS Workspace")
              was removed at the product owner's request — "Don't like the
              word here, so remove it." The mobile menu trigger still
              anchors flush left and the right cluster is unchanged. */}
          <div className={styles.headerLeft}>
            {/* === ARS WORKSPACE label removal (this worker) ===
                The decorative `<span className={styles.runningHead}>ARS
                Workspace</span>` that used to sit beside the mobile menu
                trigger was a journal-style running head. The product owner
                asked to remove the word entirely. The span, its text, the
                `aria-hidden` flag, and the previous explanatory comment are
                all gone in this commit. The `_headerLeft_` flex container
                keeps its gap so the menu trigger still aligns cleanly with
                the right cluster, and the `.runningHead` CSS rule (plus its
                responsive / theme overrides) is removed in
                MainLayout.module.css. */}
            {/* Mobile menu toggle — only visible <= 768px via CSS */}
            <button
              ref={menuTriggerRef}
              type="button"
              className={styles.menuToggle}
              onClick={() => setIsMobileNavOpen(true)}
              aria-expanded={isMobileNavOpen}
            >
              <MenuIcon size={18} />
            </button>
          </div>

          {/* Right Header Panel */}
          <div className={styles.headerRight}>
            {/* Theme toggle (Agent 38) — sun/moon button placed to the LEFT
                of the wallet/notifications/user pill so it's easy to find.
                Clicking flips the data-theme attribute on the MainLayout
                root (and on <html> via applyThemeToRoot) and persists the
                choice in localStorage under `ars_theme`. The icon shown
                reflects the action that clicking will perform, not the
                current theme: when night is active we render the SUN icon
                to invite the user back to light. */}
            <button
              type="button"
              className={styles.themeToggle}
              onClick={handleToggleTheme}
              aria-label={theme === 'night' ? 'Switch to light theme' : 'Switch to night theme'}
              aria-pressed={theme === 'night'}
              title={theme === 'night' ? 'Switch to light theme' : 'Switch to night theme'}
              data-testid="theme-toggle"
            >
              {theme === 'night' ? (
                <SunIcon size={18} aria-label="Switch to light theme" />
              ) : (
                <MoonIcon size={18} aria-label="Switch to night theme" />
              )}
            </button>

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
                have no row until an Admin approves their role request.
                Lecturer and Graduate Student are also suppressed here in this
                build (see `walletVisible` above). */}
            {walletVisible && (
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
      {walletVisible && (
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
