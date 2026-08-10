import { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ROUTES } from '../routes/paths';
import styles from './MainLayout.module.css';

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
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
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

const ARSPlatformLogo = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="24" height="24" rx="6" fill="#2563EB" />
    <path d="M12 5L18 10V18H6V10L12 5Z" fill="white" opacity="0.8" />
    <path d="M9 12H15V18H9V12Z" fill="#1D2A4A" />
  </svg>
);

export const MainLayout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // Selected role for mockup switching
  const [activeRole, setActiveRole] = useState<'Researcher' | 'Reviewer' | 'Lecturer'>(() => {
    const saved = localStorage.getItem('ars_active_role');
    return (saved as any) || 'Researcher';
  });

  // Wallet balance sync state
  const [balance, setBalance] = useState(() => {
    const saved = localStorage.getItem('ars_wallet');
    return saved ? parseInt(saved, 10) : 1500000; // Initialize to 1,500,000 VND
  });

  useEffect(() => {
    // Keep 1,500,000 VND in localstorage if not set yet
    if (!localStorage.getItem('ars_wallet')) {
      localStorage.setItem('ars_wallet', '1500000');
      setBalance(1500000);
    }
  }, []);

  useEffect(() => {
    const handleWalletUpdate = () => {
      const saved = localStorage.getItem('ars_wallet');
      setBalance(saved ? parseInt(saved, 10) : 1500000);
    };
    window.addEventListener('wallet-update', handleWalletUpdate);
    return () => window.removeEventListener('wallet-update', handleWalletUpdate);
  }, []);

  const handleRoleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const role = e.target.value as 'Researcher' | 'Reviewer' | 'Lecturer';
    setActiveRole(role);
    localStorage.setItem('ars_active_role', role);

    // Redirect to default pages based on role selection
    if (role === 'Researcher') {
      navigate(ROUTES.DASHBOARD);
    } else if (role === 'Reviewer') {
      navigate(ROUTES.EVALUATION);
    } else if (role === 'Lecturer') {
      navigate(ROUTES.SEMINAR_WORKSPACE);
    }
  };

  const username = user?.username || (activeRole === 'Researcher' ? 'Prof. Dang Researcher' : activeRole === 'Reviewer' ? 'Dr. N. Ashford' : 'Lecturer Account');
  const avatarInitials = activeRole === 'Researcher' ? 'PD' : activeRole === 'Reviewer' ? 'NA' : 'LA';

  const handleLogout = () => {
    logout();
    navigate(ROUTES.LOGIN);
  };

  // Nav items filtered dynamically based on active role
  const getNavItemsByRole = () => {
    switch (activeRole) {
      case 'Reviewer':
        return [
          { to: ROUTES.DASHBOARD, label: 'Dashboard', icon: <HomeIcon /> },
          { to: ROUTES.EVALUATION, label: 'Review Tasks', icon: <PapersIcon />, badge: '4' },
          { to: '#reviews', label: 'Submitted Reviews', icon: <ForumIcon /> },
          { to: '#author-subs', label: 'Author Submissions', icon: <BrowseReviewersIcon /> },
          { to: '#settings', label: 'Settings', icon: <SettingsIcon /> },
        ];
      case 'Lecturer':
        return [
          { to: ROUTES.DASHBOARD, label: 'Dashboard', icon: <HomeIcon /> },
          { to: ROUTES.SEMINAR_WORKSPACE, label: 'Seminar Workspace', icon: <SeminarIcon /> },
          { to: ROUTES.RESEARCH_GROUP, label: 'Guidance Group', icon: <GroupIcon /> },
          { to: '#catalog', label: 'Course Catalog', icon: <PapersIcon /> },
          { to: '#participants', label: 'Participants', icon: <BrowseReviewersIcon /> },
          { to: '#settings', label: 'Settings', icon: <SettingsIcon /> },
        ];
      case 'Researcher':
      default:
        return [
          { to: ROUTES.DASHBOARD, label: 'Dashboard', icon: <HomeIcon /> },
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
            <div className={styles.logoText}>
              <span className={styles.logoTitle}>ARS</span>
              <span className={styles.logoSubtitle}>RESEARCH PLATFORM</span>
            </div>
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

        {/* User Card at bottom of Sidebar */}
        <div className={styles.sidebarFooter}>
          <div className={styles.userProfileCard}>
            <div className={styles.avatarCircle}>{avatarInitials}</div>
            <div className={styles.userCardInfo}>
              <div className={styles.userCardName} title={username}>{username}</div>
              <div className={styles.userCardRole}>{activeRole}</div>
            </div>
            <button className={styles.logoutButton} onClick={handleLogout} title="Log out">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                <polyline points="16 17 21 12 16 7"></polyline>
                <line x1="21" y1="12" x2="9" y2="12"></line>
              </svg>
            </button>
          </div>
        </div>
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
            {/* Role Switcher Selector dropdown */}
            <div className={styles.roleSwitcherContainer}>
              <span className={styles.roleSwitcherLabel}>Active Role:</span>
              <select
                className={styles.roleSelect}
                value={activeRole}
                onChange={handleRoleChange}
              >
                <option value="Researcher">Researcher</option>
                <option value="Reviewer">Reviewer</option>
                <option value="Lecturer">Lecturer (Seminar/Group)</option>
              </select>
            </div>

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

            {/* User Info Pill */}
            <div className={styles.userInfoPill}>
              <div className={styles.avatarCircleSmall}>{avatarInitials}</div>
              <div className={styles.userInfoText}>
                <div className={styles.userPillName}>{username}</div>
                <div className={styles.userPillRole}>{activeRole}</div>
              </div>
            </div>
          </div>
        </header>

        {/* Content Body */}
        <main className={styles.contentBody}>
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default MainLayout;
