import { useEffect, useId, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ROUTES } from '../routes/paths';
import { reviewerService } from '../services/reviewer.service';
import type { UserRole } from '../types/auth';
import { useReviewerAvailability } from '../hooks/useReviewerProfiles';
import { usePermissions } from '../hooks/usePermissions';
import { useVerifiedGuard } from '../hooks/useVerifiedGuard';
import { landingRouteForRoleName } from '../utils/roleNormalizer';
import { NotificationCenter } from '../components/notification/NotificationCenter';
import { WelcomeBackBanner } from '../components/WelcomeBackBanner/WelcomeBackBanner';
import { LanguageToggle } from '../components/i18n/LanguageToggle';
import { KeyboardShortcutsHelp } from '../components/shortcuts/KeyboardShortcutsHelp';
import { useShortcuts } from '../hooks/useShortcuts';
import { useI18n } from '../i18n/I18nContext';
import styles from './MainLayout.module.css';
import arsLogo from '../assets/images/ARS_Logo.png';

import {
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
  Upload,
  BriefcaseBusiness,
  Home as HomeIcon,
  ClipboardList as AssignmentsIcon,
  FileCheck2 as PublicationIcon,
  Menu as MenuIcon,
  Search,
  Library,
} from 'lucide-react';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  MoonIcon,
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
   === Collapse + Archive Dusk theme ===
   Delimiter for downstream coordination. Storage keys + theme
   helpers below are owned by this worker. Other agents should
   leave the localStorage helpers and theme bootstrap alone and
   place their changes ABOVE this banner.
   ─────────────────────────────────────────────────────────────── */
const THEME_STORAGE_KEY = 'ars_theme';
type ArchiveThemeName = 'archive-dusk' | 'paper-day';

const THEME_VALUES: readonly ArchiveThemeName[] = ['archive-dusk', 'paper-day'] as const;

const isThemeName = (value: unknown): value is ArchiveThemeName =>
  typeof value === 'string' &&
  (THEME_VALUES as readonly string[]).includes(value);

/**
 * Read the persisted theme preference. Falls back to `null` so the
 * MainLayout bootstrap effect can apply `prefers-color-scheme` only when
 * the user has not made an explicit choice.
 */
const getStoredTheme = (): ArchiveThemeName | null => {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (isThemeName(raw)) return raw;
    if (raw === 'night') return 'archive-dusk';
    if (raw === 'light') return 'paper-day';
    return null;
  } catch {
    return null;
  }
};

/**
 * Returns the initial theme to apply on first paint. The cascade order is:
 *   1. localStorage explicit choice (user wins).
 *   2. `paper-day` for a consistent bright, welcoming first visit.
 */
const resolveInitialTheme = (): ArchiveThemeName => {
  const stored = getStoredTheme();
  if (stored !== null) {
    return stored;
  }
  return 'paper-day';
};

/**
 * Persist a theme choice to localStorage. The decision to read
 * `matchMedia` synchronously inside `resolveInitialTheme` (rather than
 * wiring a `change` listener) is intentional: theme changes for an
 * already-mounted session come through the toggle button, and we do
 * not want a foreground OS theme flip to silently override an
 * explicit user preference while they are mid-task.
 */
const setStoredTheme = (theme: ArchiveThemeName): void => {
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
 * Apply the theme to the root `<html>` element. The matching semantic token
 * cascade lives in `src/styles/ars-tokens.css`.
 *
 * Why `<html>` rather than the MainLayout root container?
 *   - Single source of truth shared by every route that renders inside
 *     MainLayout (publication home, profile, dashboard, etc).
 *   - Avoids race conditions where descendant pages render before the
 *     attribute is on the layout wrapper.
 *   - Public pages sit above MainLayout and use the default Archive Dusk token
 *     values when no saved authenticated preference has been applied.
 */
const applyThemeToRoot = (theme: ArchiveThemeName): void => {
  if (typeof document === 'undefined') {
    return;
  }
  document.documentElement.setAttribute('data-theme', theme);
};
/* === END Collapse + Archive Dusk theme === */

const ProfileDropdown = ({
  username,
  activeRole,
  avatarInitials,
  accountTier,
  onLogout,
  onProfileClick,
  showProfileAction,
}: {
  username: string;
  activeRole: string;
  avatarInitials: string;
  accountTier?: string;
  onLogout: () => void;
  onProfileClick: () => void;
  showProfileAction: boolean;
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
          {showProfileAction ? (
            <>
              <button type="button" role="menuitem" className={styles.dropdownItem} onClick={() => { onProfileClick(); setIsOpen(false); }}>
                <User size={16} />
                <span>My Profile & Role Upgrades</span>
              </button>
              <div className={styles.dropdownDivider}></div>
            </>
          ) : null}
          <button type="button" role="menuitem" className={`${styles.dropdownItem} ${styles.dropdownItemLogout}`} onClick={() => { onLogout(); setIsOpen(false); }}>
            <LogOut size={16} />
            <span>Log out</span>
          </button>
        </div>
      )}
    </div>
  );
};

const ARSPlatformLogo = ({ onClick }: { onClick?: (event: React.MouseEvent<HTMLAnchorElement>) => void }) => (
  <a
    href={ROUTES.LANDING}
    className={styles.logoContainer}
    onClick={onClick}
    aria-label="Go to homepage"
    title="Go to homepage"
  >
    <img src={arsLogo} alt="ARS Platform" />
  </a>
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
  // Additional path prefixes that should also mark this item as active
  // in the sidebar. Used when a parent list route (e.g. `/research-group`)
  // has a detail page at a different prefix (e.g. `/lecturer/groups/:id`),
  // so the user still sees which section they're in. React Router's default
  // prefix matching only walks down `to`, not sideways to sibling routes.
  activeFor?: string[];
}

/**
 * Returns true when the current pathname should mark the given nav item
 * as active. We combine React Router's default "starts with `to`" rule
 * with any explicit `activeFor` prefixes declared on the item so parent
 * list routes can stay highlighted on their child detail pages.
 */
const isNavItemActive = (item: NavItem, pathname: string): boolean => {
  const toPrefix = item.to;
  if (item.end) {
    if (pathname === toPrefix) return true;
  } else if (pathname === toPrefix || pathname.startsWith(`${toPrefix}/`)) {
    return true;
  }
  if (item.activeFor) {
    return item.activeFor.some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
    );
  }
  return false;
};

export const MainLayout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Active role is derived solely from the authenticated user's role as set by the BE at login.
  const activeRole: UserRole = (user?.role as UserRole) ?? 'Researcher';

  // Single landing destination used by the sidebar logo: Admin → /admin,
  // every other signed-in role → /home. Mirrors landingRouteForRoleName so
  // clicking the logo never feels like a half-step away from home.
  const handleLogoClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    // Let modifier-clicks / non-left-clicks behave normally (new tab, etc.).
    if (event.defaultPrevented) return;
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    const destination = user
      ? landingRouteForRoleName(activeRole)
      : ROUTES.LANDING;
    navigate(destination);
  };

  const { isGuest } = usePermissions();
  const displayedRole: string = isGuest ? 'Guest' : activeRole;

  // Reviewer availability comes from the BE (only for active Reviewers).
  const { isAvailable: beReviewerAvailable, isLoading: beAvailabilityLoading, refetch: refetchAvailability } = useReviewerAvailability(activeRole === 'Reviewer' && user?.userId ? user.userId : undefined);

  // Bounce unverified users off every private route except /forum.
  useVerifiedGuard();

  const [isUpdatingAvailability, setIsUpdatingAvailability] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(getStoredSidebarCollapsed);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  const mobileDrawerRef = useRef<HTMLElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Global keyboard shortcuts — Part 1 of the keyboard-shortcut rollout.
  // The `?` shortcut opens the KeyboardShortcutsHelp modal from anywhere
  // in the app. The `useShortcuts` hook auto-skips text inputs and modal
  // surfaces so it never interferes with typing. Future shortcuts (list
  // navigation, form submit) will be registered by their respective pages.
  useShortcuts([
    {
      key: '?',
      modifier: undefined,
      label: 'Show keyboard shortcuts',
      description: 'Open the keyboard shortcuts reference.',
      group: 'global',
      allowInInputs: true,
      handler: () => setShortcutsOpen(true),
    },
    {
      key: '/',
      label: 'Focus search',
      description: 'Move focus to the global search bar.',
      group: 'global',
      handler: () => searchRef.current?.focus(),
    },
  ]);

  // Theme bootstrap (this worker / Agent 38) — read the persisted choice on
  // mount and apply it to <html data-theme="..."> so token cascade flips
  // before the user sees a flash of the wrong background.
  const [theme, setTheme] = useState<ArchiveThemeName>(() => resolveInitialTheme());

  useEffect(() => {
    applyThemeToRoot(theme);
    setStoredTheme(theme);
  }, [theme]);

  const handleToggleTheme = (): void => {
    setTheme((current) => (current === 'archive-dusk' ? 'paper-day' : 'archive-dusk'));
  };

  const { t: tr } = useI18n();

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

  // Auto-dismiss toast after 6 seconds (was 3s; too short for screen
  // readers and slow readers to finish the message). The close button
  // is the primary way to dismiss for users who want to read longer.
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 6000);
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
          { to: ROUTES.ADMIN_PACKAGES, label: 'Annual Fees', icon: <PackagesIcon size={20} /> },

          { to: ROUTES.ADMIN_AUDIT_LOGS, label: 'Audit Logs', icon: <AuditLogsIcon size={20} /> },
        ];
      case 'Reviewer':
        return [
          { to: ROUTES.HOME, label: 'Discover Research', icon: <HomeIcon size={20} />, end: true },
          { to: ROUTES.FORUM, label: 'Forums', icon: <ForumIcon size={20} /> },
          { to: ROUTES.REVIEWER_ASSIGNMENTS, label: 'Review Assignments', icon: <AssignmentsIcon size={20} /> },
          { to: ROUTES.PROFESSIONAL_PROFILE, label: 'Professional Profile', icon: <BriefcaseBusiness size={20} />, end: true },
        ];
      case 'Lecturer':
        return [
          // Top-level entry points (shared with all roles).
          { to: ROUTES.HOME, label: 'Discover Research', icon: <HomeIcon size={20} />, end: true },
          { to: ROUTES.FORUM, label: 'Forums', icon: <ForumIcon size={20} /> },
          { to: ROUTES.SEMINAR_WORKSPACE, label: 'Seminar', icon: <SeminarIcon size={20} /> },

          // PhasedReport core flow — read top-to-bottom in workflow order:
          // define a Topic → assign Groups → configure Milestones for a
          // Topic/Group → review Phase Reports submitted against those
          // milestones → manage reference Materials used by all of the
          // above.
          { to: ROUTES.LECTURER_RESEARCH_TOPICS, label: 'Research Topics', icon: <GroupIcon size={20} /> },
          { to: ROUTES.RESEARCH_GROUP, label: 'Research Groups', icon: <GroupIcon size={20} />, activeFor: ['/lecturer/groups'] },
          { to: ROUTES.CONFIGURE_MILESTONES, label: 'Milestones', icon: <Settings size={20} /> },
          { to: ROUTES.LECTURER_PHASE_REPORTS, label: 'Phase Reports', icon: <PapersIcon size={20} /> },
          { to: ROUTES.LECTURER_MATERIALS, label: 'Materials', icon: <Library size={20} /> },
        ];
      case 'Graduate Student':
        return [
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
          { to: ROUTES.RESEARCHER_SUBMISSIONS, label: 'My Research Papers', icon: <PapersIcon size={20} /> },
        ];
    }
  };

  const navItems = getNavItemsByRole();

  // "My Subscription" sits at the bottom of the sidebar for roles that
  // previously had it inline (Researcher + Lecturer). Pulling it out of
  // the role-based list keeps the primary nav focused on workspace
  // shortcuts, and the dedicated footer slot makes its billing/upgrad
  // affordance easy to find without scrolling the main list.
  const showSubscriptionFooter =
    activeRole === 'Researcher' || activeRole === 'Lecturer';

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
          <ARSPlatformLogo onClick={handleLogoClick} />
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

        <div className={styles.roleContext}>
          <span className={styles.roleContextLabel}>Research workspace</span>
          <strong>{displayedRole}</strong>
        </div>

        <nav
          className={styles.sidebarNav}
          aria-label={
            isSidebarCollapsed
              ? 'Workspace navigation (collapsed)'
              : 'Workspace navigation'
          }
        >
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
                  `${styles.navItem} ${
                    isActive || isNavItemActive(item, location.pathname)
                      ? styles.navItemActive
                      : ''
                  }`
                }
              >
                <span className={styles.navIcon}>{item.icon}</span>
                <span className={styles.navLabel}>{item.label}</span>
                {item.badge && <span className={styles.navBadge}>{item.badge}</span>}
              </NavLink>
            );
          })}
        </nav>

        {/* Bottom-anchored "My Subscription" footer — sits at the very
            bottom of the sidebar so it's visually separated from the
            primary role-based nav. The wrapper uses `margin-top: auto`
            to push the link to the end of the aside's flex column,
            regardless of how many primary nav items the role exposes.
            Inside the same <aside> so it inherits the dark-navy
            sidebar background (#323964). Active-state styling routes
            through the same `navItem` / `navItemActive` classes as the
            regular nav items, so aria-current and the 3px primary rule
            stay consistent. */}
        {showSubscriptionFooter && (
          <div className={styles.sidebarFooter}>
            <NavLink
              to={ROUTES.SUBSCRIPTION}
              end={false}
              aria-label="My Subscription"
              title="My Subscription"
              className={({ isActive }) =>
                `${styles.navItem} ${isActive ? styles.navItemActive : ''}`
              }
            >
              <span className={styles.navIcon}>
                <PackagesIcon size={20} />
              </span>
              <span className={styles.navLabel}>My Subscription</span>
            </NavLink>
          </div>
        )}

        {/* Centered collapse/expand button — lives at the bottom of the
            sidebar so the user can always collapse OR expand the rail
            without hunting for a hidden control. Vertical centering is
            achieved via flex on the wrapper which fills the remaining
            height of the sidebar. */}
        <div className={styles.sidebarCollapseAnchor}>
          <button
            type="button"
            className={styles.sidebarCollapseBtn}
            onClick={handleToggleSidebar}
            aria-label={isSidebarCollapsed ? 'Expand navigation' : 'Collapse navigation'}
            title={isSidebarCollapsed ? 'Expand navigation' : 'Collapse navigation'}
            data-testid="sidebar-collapse-toggle"
          >
            {isSidebarCollapsed ? (
              <ChevronRightIcon size={16} aria-hidden="true" />
            ) : (
              <ChevronLeftIcon size={16} aria-hidden="true" />
            )}
          </button>
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
            {/* Global search bar — Part 2 keyboard shortcuts. Accessible
                from any authenticated route. The `/` key focuses it; users
                can type and press Enter to search. The actual search
                routing is implemented in a later part. */}
            <div className={styles.searchContainer}>
              <span className={styles.searchIcon} aria-hidden>
                <Search size={14} />
              </span>
              <input
                ref={searchRef}
                type="search"
                className={styles.searchInput}
                placeholder="Search…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label="Search the platform"
              />
            </div>

            {/* Keyboard shortcuts help — opens the shortcuts reference modal.
                Also reachable from anywhere on the page via the `?` key.
                The kbd chip gives a visual affordance without being noisy. */}
            <button
              type="button"
              className={styles.shortcutButton}
              onClick={() => setShortcutsOpen(true)}
              aria-label="Show keyboard shortcuts"
              title="Keyboard shortcuts (?)"
            >
              <span aria-hidden>?</span>
            </button>

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
              aria-label={theme === 'archive-dusk' ? tr('header.themeToLight') : tr('header.themeToDark')}
              aria-pressed={theme === 'archive-dusk'}
              title={theme === 'archive-dusk' ? tr('header.themeLightTitle') : tr('header.themeDarkTitle')}
              data-testid="theme-toggle"
            >
              {theme === 'archive-dusk' ? (
                <SunIcon size={18} aria-label={tr('header.themeToLight')} />
              ) : (
                <MoonIcon size={18} aria-label={tr('header.themeToDark')} />
              )}
            </button>

            {/* Language toggle — sits directly to the RIGHT of the theme
                toggle so the two settings cluster together at the top of
                the page. Flag + active locale code; click cycles between
                Vietnamese (default) and English. */}
            <LanguageToggle />

            {/* Reviewer availability toggle — only shown for Reviewer role.
                The toggle announces its current state to assistive tech via
                `aria-pressed`, and `aria-describedby` ties it to a
                screen-reader-only explanation of what "available" means on
                the platform. The visible label carries a tooltip via the
                title attribute so sighted users also see context on hover. */}
            {activeRole === 'Reviewer' && (
              <div className={styles.availabilityToggle}>
                <button
                  data-testid="availability-toggle"
                  className={`${styles.toggleSwitch} ${isReviewerAvailable ? styles.toggleSwitchOn : styles.toggleSwitchOff}`}
                  onClick={handleToggleAvailability}
                  disabled={isUpdatingAvailability || beAvailabilityLoading}
                  aria-label={isReviewerAvailable ? 'Turn off availability' : 'Turn on availability'}
                  aria-pressed={isReviewerAvailable}
                  aria-describedby="availability-help"
                  title={
                    isReviewerAvailable
                      ? 'You are receiving review assignments. Click to pause new assignments.'
                      : 'You are not receiving review assignments. Click to start receiving them.'
                  }
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
                <span id="availability-help" className={styles.srOnly}>
                  Controls whether the platform assigns new peer-review
                  invitations to you. When available, the Admin can route
                  new manuscript assignments to you.
                </span>
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
              showProfileAction={activeRole !== 'Admin'}
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
        <main key={location.key} className={styles.contentBody}>
          <Outlet />
        </main>

        {/* Keyboard shortcuts help modal — opened by the `?` key or the
            header button. Global so it works from any page. */}
        <KeyboardShortcutsHelp
          open={shortcutsOpen}
          onClose={() => setShortcutsOpen(false)}
        />
      </div>
    </div>
  );
};

export default MainLayout;
