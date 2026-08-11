import { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ROUTES } from '../routes/paths';
import type { UserRole } from '../types/auth';
import styles from './MainLayout.module.css';
import arsLogo from '../assets/images/ARS_Logo.png';

// SVG Icons
const SearchIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"></circle>
    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
  </svg>
);

const WalletIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="4" width="20" height="16" rx="2" ry="2"></rect>
    <line x1="12" y1="20" x2="12" y2="4"></line>
  </svg>
);

const BellIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
    <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
  </svg>
);

const HomeIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
    <polyline points="9 22 9 12 15 12 15 22"></polyline>
  </svg>
);

const ForumIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
  </svg>
);

const PapersIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
    <polyline points="14 2 14 8 20 8"></polyline>
  </svg>
);

const BrowseReviewersIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
    <circle cx="9" cy="7" r="4"></circle>
    <circle cx="17" cy="8" r="1"></circle>
    <line x1="21" y1="12" x2="18" y2="9"></line>
  </svg>
);

const SeminarIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
    <line x1="16" y1="2" x2="16" y2="6"></line>
    <line x1="8" y1="2" x2="8" y2="6"></line>
    <line x1="3" y1="10" x2="21" y2="10"></line>
  </svg>
);

const GroupIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
    <circle cx="9" cy="7" r="4"></circle>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
    <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
  </svg>
);

const SettingsIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3"></circle>
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
  </svg>
);

const UserIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
    <circle cx="12" cy="7" r="4"></circle>
  </svg>
);

const ChevronDownIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9"></polyline>
  </svg>
);

const LogOutIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
    <polyline points="16 17 21 12 16 7"></polyline>
    <line x1="21" y1="12" x2="9" y2="12"></line>
  </svg>
);

const SwitchIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="17 1 21 5 17 9"></polyline>
    <path d="M3 11V9a4 4 0 0 1 4-4h14"></path>
    <polyline points="7 23 3 19 7 15"></polyline>
    <path d="M21 13v2a4 4 0 0 1-4 4H3"></path>
  </svg>
);

const CloseIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"></line>
    <line x1="6" y1="6" x2="18" y2="18"></line>
  </svg>
);

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
            <CloseIcon />
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
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
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
        <ChevronDownIcon />
      </button>

      {isOpen && (
        <div className={styles.profileDropdownMenu}>
          <button className={styles.dropdownItem} onClick={() => { onProfileClick(); setIsOpen(false); }}>
            <UserIcon />
            <span>My Profile & Role Upgrades</span>
          </button>
          <button className={styles.dropdownItem} onClick={() => { onAccountSettingsClick(); setIsOpen(false); }}>
            <SettingsIcon />
            <span>Account Settings</span>
          </button>
          <button className={styles.dropdownItem} onClick={() => { onSwitchRoleClick(); setIsOpen(false); }}>
            <SwitchIcon />
            <span>Switch Role</span>
          </button>
          <div className={styles.dropdownDivider}></div>
          <button className={`${styles.dropdownItem} ${styles.dropdownItemLogout}`} onClick={() => { onLogout(); setIsOpen(false); }}>
            <LogOutIcon />
            <span>Log out</span>
          </button>
        </div>
      )}
    </div>
  );
};

const ARSPlatformLogo = () => (
  <img src={arsLogo} alt="ARS Platform Logo" width={120} height={120} style={{ borderRadius: 8 }} />
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
    console.log('[MainLayout] user from useAuth:', user);
    if (user?.role) {
      const userRole = user.role as UserRole;
      console.log('[MainLayout] Setting activeRole to:', userRole);
      setActiveRole(userRole);
      localStorage.setItem('ars_active_role', userRole);
    }
  }, [user?.role]);

  // Wallet balance sync state
  const [balance, setBalance] = useState(() => {
    const saved = localStorage.getItem('ars_wallet');
    return saved ? parseInt(saved, 10) : 1500000;
  });

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
          { to: ROUTES.DASHBOARD, label: 'Home', icon: <HomeIcon /> },
          { to: ROUTES.FORUM, label: 'Forums', icon: <ForumIcon /> },
          { to: ROUTES.REVIEW_TASKS, label: 'Review Paper', icon: <PapersIcon />, badge: '2' },
          { to: ROUTES.EARNINGS_WALLET, label: 'Wallet', icon: <WalletIcon /> },
          { to: ROUTES.EARNINGS_WALLET, label: 'Withdrawal Request', icon: <WalletIcon /> },
        ];
      case 'Lecturer':
        return [
          { to: ROUTES.DASHBOARD, label: 'Home', icon: <HomeIcon /> },
          { to: ROUTES.FORUM, label: 'Forums', icon: <ForumIcon /> },
          { to: ROUTES.SEMINAR_WORKSPACE, label: 'Seminar', icon: <SeminarIcon /> },
          { to: ROUTES.RESEARCH_GROUP, label: 'Research Group', icon: <GroupIcon /> },
          { to: '#shared-material', label: 'Shared Material', icon: <PapersIcon /> },
          { to: '#wallet', label: 'Wallet', icon: <WalletIcon /> },
        ];
      case 'Graduate Student':
        return [
          { to: ROUTES.DASHBOARD, label: 'Home', icon: <HomeIcon /> },
          { to: ROUTES.FORUM, label: 'Forums', icon: <ForumIcon /> },
          { to: ROUTES.PAPERS, label: 'Paper', icon: <PapersIcon /> },
          { to: ROUTES.REVIEWERS, label: 'Browse Reviewers', icon: <BrowseReviewersIcon /> },
          { to: ROUTES.STUDENT_RESEARCH_GROUPS, label: 'Research Groups', icon: <GroupIcon /> },
          { to: '#wallet', label: 'Wallet', icon: <WalletIcon /> },
          { to: '#premium-packages', label: 'Premium Packages', icon: <BrowseReviewersIcon /> },
        ];
      case 'Researcher':
      default:
        return [
          { to: ROUTES.DASHBOARD, label: 'Home Dashboard', icon: <HomeIcon /> },
          { to: ROUTES.FORUM, label: 'Forums', icon: <ForumIcon />, showDot: true },
          { to: ROUTES.PAPERS, label: 'Paper', icon: <PapersIcon /> },
          { to: ROUTES.REVIEWERS, label: 'Reviewers', icon: <BrowseReviewersIcon /> },
          { to: '#workspaces', label: 'Workspaces', icon: <SeminarIcon /> },
          { to: '#wallet', label: 'My Wallet', icon: <WalletIcon /> },
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
          {/* Search bar */}
          <div className={styles.searchContainer}>
            <span className={styles.searchIcon}><SearchIcon /></span>
            <input
              type="text"
              placeholder="Search Papers..."
              className={styles.searchInput}
            />
          </div>

          {/* Right Header Panel */}
          <div className={styles.headerRight}>
            {/* Wallet Balance */}
            <div className={styles.walletBadge}>
              <span className={styles.walletIcon}><WalletIcon /></span>
              <span className={styles.walletAmount}>{balance.toLocaleString('vi-VN')} VND</span>
            </div>

            {/* Notification bell */}
            <button className={styles.notificationBtn}>
              <BellIcon />
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
