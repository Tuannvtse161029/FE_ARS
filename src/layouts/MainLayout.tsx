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
    <line x1="16" y1="13" x2="8" y2="13"></line>
    <line x1="16" y1="17" x2="8" y2="17"></line>
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

const PremiumIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
  </svg>
);

const ProfileIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
    <circle cx="12" cy="7" r="4"></circle>
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

  // Wallet balance sync state
  const [balance, setBalance] = useState(() => {
    const saved = localStorage.getItem('ars_wallet');
    return saved ? parseInt(saved, 10) : 500000;
  });

  useEffect(() => {
    const handleWalletUpdate = () => {
      const saved = localStorage.getItem('ars_wallet');
      setBalance(saved ? parseInt(saved, 10) : 500000);
    };
    window.addEventListener('wallet-update', handleWalletUpdate);
    return () => window.removeEventListener('wallet-update', handleWalletUpdate);
  }, []);

  const username = user?.username || 'Dr. Nguyen Van A';
  const role = user?.role || 'Researcher';
  const avatarInitials = username
    .split(' ')
    .filter(n => n)
    .map(n => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const handleLogout = () => {
    logout();
    navigate(ROUTES.LOGIN);
  };

  const navItems = [
    { to: ROUTES.DASHBOARD, label: 'Home', icon: <HomeIcon /> },
    { to: ROUTES.FORUM, label: 'Forums', icon: <ForumIcon />, showDot: true },
    { to: ROUTES.PAPERS, label: 'Paper', icon: <PapersIcon /> },
    { to: ROUTES.REVIEWERS, label: 'Browse Reviewers', icon: <BrowseReviewersIcon /> },
    { to: '#wallet', label: 'Wallet', icon: <WalletIcon /> },
    { to: '#packages', label: 'Premium Packages', icon: <PremiumIcon /> },
    { to: '#profile', label: 'Profile', icon: <ProfileIcon /> },
  ];

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
              <div className={styles.userCardRole}>{role}</div>
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
                <div className={styles.userPillRole}>{role}</div>
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
