import { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ROUTES } from '../routes/paths';
import { reviewerService } from '../services/reviewer.service';
import type { UserRole } from '../types/auth';
import styles from './MainLayout.module.css';
import arsLogo from '../assets/images/ARS_Logo.png';

import {
  Search,
  Wallet,
  Bell,
  MessageSquare as ForumIcon,
  FileText as PapersIcon,
  Users as BrowseReviewersIcon,
  Calendar as SeminarIcon,
  Users as GroupIcon,
  Settings,
  User,
  ChevronDown,
  LogOut,
  RefreshCw as SwitchIcon,
  X,
  Check,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

const RoleSwitchModal = ({
  isOpen,
  onClose,
  activeRole,
  availableRoles,
  onConfirm
}: {
  isOpen: boolean;
  onClose: () => void;
  activeRole: string;
  availableRoles: { value: string; label: string }[];
  onConfirm: (role: string) => void;
}) => {
  const [selectedRole, setSelectedRole] = useState(activeRole);

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (selectedRole !== activeRole) {
      onConfirm(selectedRole);
    }
    onClose();
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>Switch Role</h2>
          <button className={styles.modalCloseBtn} onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        <div className={styles.modalBody}>
          <p className={styles.modalDescription}>Select a role to switch to:</p>
          <div className={styles.roleOptionsList}>
            {availableRoles.map((role) => (
              <label
                key={role.value}
                className={`${styles.roleOption} ${selectedRole === role.value ? styles.roleOptionSelected : ''}`}
              >
                <input
                  type="radio"
                  name="role"
                  value={role.value}
                  checked={selectedRole === role.value}
                  onChange={() => setSelectedRole(role.value)}
                  className={styles.roleOptionRadio}
                />
                <span className={styles.roleOptionLabel}>{role.label}</span>
                {selectedRole === role.value && (
                  <span className={styles.roleOptionCheck}>
                    <Check size={16} strokeWidth={3} />
                  </span>
                )}
              </label>
            ))}
          </div>
        </div>
        <div className={styles.modalFooter}>
          <button className={styles.modalCancelBtn} onClick={onClose}>
            Cancel
          </button>
          <button
            className={styles.modalConfirmBtn}
            onClick={handleConfirm}
            disabled={selectedRole === activeRole}
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
};

const ProfileDropdown = ({
  username,
  activeRole,
  avatarInitials,
  onLogout,
  onProfileClick,
  onAccountSettingsClick,
  onSwitchRoleClick
}: {
  username: string;
  activeRole: string;
  avatarInitials: string;
  onLogout: () => void;
  onProfileClick: () => void;
  onAccountSettingsClick: () => void;
  onSwitchRoleClick: () => void;
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
          <button className={styles.dropdownItem} onClick={() => { onSwitchRoleClick(); setIsOpen(false); }}>
            <SwitchIcon size={16} />
            <span>Switch Role</span>
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

  // Selected role for mockup switching (excludes Admin - must login to access)
  const [activeRole, setActiveRole] = useState<UserRole>(() => {
    const saved = localStorage.getItem('ars_active_role');
    return (saved as UserRole) || 'Researcher';
  });

  // Sync activeRole with user role from auth when user logs in
  useEffect(() => {
    if (user?.role) {
      const userRole = user.role as UserRole;
      setActiveRole(userRole);
      localStorage.setItem('ars_active_role', userRole);
    }
  }, [user?.role]);

  // Wallet balance sync state
  const [balance, setBalance] = useState(() => {
    const saved = localStorage.getItem('ars_wallet');
    return saved ? parseInt(saved, 10) : 1500000;
  });

  // Reviewer availability toggle state
  const [isReviewerAvailable, setIsReviewerAvailable] = useState(() => {
    const saved = localStorage.getItem('ars_reviewer_available');
    return saved ? saved === 'true' : true;
  });
  const [isUpdatingAvailability, setIsUpdatingAvailability] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Auto-dismiss toast after 2 seconds
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 2000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  // Sync reviewer availability from BE when user logs in
  useEffect(() => {
    if (user?.userId && activeRole === 'Reviewer') {
      reviewerService
        .getById(user.userId)
        .then((profile) => {
          if (profile.reviewFee !== undefined && profile.reviewFee !== null) {
            // BE returns availability as part of the profile; fall back to localStorage
          }
        })
        .catch(() => {
          // silently ignore — keep local state
        });
    }
  }, [user?.userId, activeRole]);

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
    setIsReviewerAvailable(next);
    localStorage.setItem('ars_reviewer_available', String(next));
    // Also write per-user key so DiscoverReviewers can filter unavailable reviewers
    localStorage.setItem(`ars_reviewer_available_${user.userId}`, String(next));
    try {
      await reviewerService.updateAvailability(user.userId, next);
      setToastMessage({
        text: next ? 'You are now accepting review requests.' : 'You are no longer accepting review requests.',
        type: 'success',
      });
    } catch {
      // Revert on failure
      setIsReviewerAvailable(!next);
      localStorage.setItem('ars_reviewer_available', String(!next));
      localStorage.setItem(`ars_reviewer_available_${user.userId}`, String(!next));
      setToastMessage({ text: 'Failed to update availability. Please try again.', type: 'error' });
    } finally {
      setIsUpdatingAvailability(false);
    }
  };

  // Role switch modal state
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);

  // Available roles for the user
  const availableRoles = [
    { value: 'Researcher', label: 'Researcher' },
    { value: 'Reviewer', label: 'Reviewer' },
    { value: 'Lecturer', label: 'Lecturer (Seminar/Group)' },
    { value: 'Graduate Student', label: 'Graduate Student' },
  ];

  useEffect(() => {
    const handleWalletUpdate = () => {
      const saved = localStorage.getItem('ars_wallet');
      setBalance(saved ? parseInt(saved, 10) : 1500000);
    };
    window.addEventListener('wallet-update', handleWalletUpdate);
    return () => window.removeEventListener('wallet-update', handleWalletUpdate);
  }, []);

  const handleRoleSwitch = (role: string) => {
    setActiveRole(role as UserRole);
    localStorage.setItem('ars_active_role', role);

    // Redirect to default pages based on role selection
    if (role === 'Researcher') {
      navigate(ROUTES.FORUM);
    } else {
      navigate(ROUTES.DASHBOARD);
    }
  };

  // Use real user data when available, fallback to mock data
  const displayName = user?.username || (activeRole === 'Researcher' ? 'Prof. Dang Researcher' : activeRole === 'Reviewer' ? 'Dr. N. Ashford' : activeRole === 'Graduate Student' ? 'Dr. N. Ashford' : 'Lecturer Account');
  const avatarInitials = user?.username
    ? user.username.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : (activeRole === 'Researcher' ? 'PD' : activeRole === 'Reviewer' ? 'NA' : activeRole === 'Graduate Student' ? 'NA' : 'LA');

  const handleLogout = () => {
    logout();
    navigate(ROUTES.LOGIN);
  };

  // Nav items filtered dynamically based on active role
  const getNavItemsByRole = (): NavItem[] => {
    switch (activeRole) {
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

            {/* Wallet Balance */}
            <div className={styles.walletBadge}>
              <span className={styles.walletIcon}><Wallet size={18} /></span>
              <span className={styles.walletAmount}>{balance.toLocaleString('vi-VN')} VND</span>
            </div>

            {/* Notification bell */}
            <button className={styles.notificationBtn}>
              <Bell size={18} />
              <span className={styles.notificationBadge}>3</span>
            </button>

            {/* Profile Dropdown */}
            <ProfileDropdown
              username={displayName}
              activeRole={activeRole}
              avatarInitials={avatarInitials}
              onLogout={handleLogout}
              onProfileClick={() => navigate(ROUTES.PROFILE)}
              onAccountSettingsClick={() => navigate(ROUTES.ACCOUNT_SETTINGS)}
              onSwitchRoleClick={() => setIsRoleModalOpen(true)}
            />
          </div>
        </header>

        {/* Role Switch Modal */}
        <RoleSwitchModal
          isOpen={isRoleModalOpen}
          onClose={() => setIsRoleModalOpen(false)}
          activeRole={activeRole}
          availableRoles={availableRoles}
          onConfirm={handleRoleSwitch}
        />

        {/* Content Body */}
        <main className={styles.contentBody}>
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default MainLayout;
