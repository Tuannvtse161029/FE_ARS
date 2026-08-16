import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useWallet } from '../../hooks/useWallet';
import styles from './Profile.module.css';

export const Profile = () => {
  const { user } = useAuth();

  // Active role is derived from the authenticated user — no in-app switching.
  // Users with multiple assigned roles must log out and re-login to choose one.
  const activeRole = (user?.role as 'Researcher' | 'Reviewer' | 'Lecturer' | 'Graduate Student') ?? 'Researcher';

  const [activeTab, setActiveTab] = useState<'info' | 'wallet' | 'security'>('info');

  // Personal Info Form State
  const [fullName, setFullName] = useState(
    activeRole === 'Researcher'
      ? 'Prof. Dang Researcher'
      : activeRole === 'Reviewer'
      ? 'Dr. N. Ashford'
      : activeRole === 'Lecturer'
      ? 'Prof. Tran Minh B'
      : 'Nguyen Student'
  );

  const [academicTitle, setAcademicTitle] = useState(
    activeRole === 'Researcher'
      ? 'Principal Researcher & Professor'
      : activeRole === 'Reviewer'
      ? 'Senior Peer Reviewer & Journal Editor'
      : activeRole === 'Lecturer'
      ? 'Associate Professor & Lab Director'
      : 'Graduate Research Scholar'
  );

  const [email, setEmail] = useState(
    activeRole === 'Researcher'
      ? 'researcher.dang@ars.edu.vn'
      : activeRole === 'Reviewer'
      ? 'reviewer.ashford@ars.edu.vn'
      : activeRole === 'Lecturer'
      ? 'lecturer.tran@ars.edu.vn'
      : 'student.nguyen@ars.edu.vn'
  );

  const [institution, setInstitution] = useState('FPT University — Department of Computer Science & AI');
  const [bio, setBio] = useState(
    'Specializing in distributed systems performance, WebRTC streaming, consensus protocol validation, and automated peer-review workflows.'
  );

  const [keywords, setKeywords] = useState(['Distributed Systems', 'Machine Learning', 'Blockchain', 'Cloud Architecture']);
  const [newKeywordInput, setNewKeywordInput] = useState('');
  const [showSavedToast, setShowSavedToast] = useState(false);

  // Wallet — read from the BE (no hardcoded 1,500,000 VND fallback).
  const { balance: walletBalance, isLoading: isWalletLoading } = useWallet(user?.userId);

  const handleAddKeyword = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && newKeywordInput.trim()) {
      if (!keywords.includes(newKeywordInput.trim())) {
        setKeywords([...keywords, newKeywordInput.trim()]);
      }
      setNewKeywordInput('');
    }
  };

  const handleRemoveKeyword = (kw: string) => {
    setKeywords(keywords.filter((x) => x !== kw));
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    setShowSavedToast(true);
    setTimeout(() => setShowSavedToast(false), 4000);
  };

  const avatarInitials =
    activeRole === 'Researcher' ? 'PD' : activeRole === 'Reviewer' ? 'NA' : activeRole === 'Lecturer' ? 'TB' : 'NS';

  return (
    <div className={styles.profilePage}>
      {/* Breadcrumbs */}
      <div className={styles.breadcrumbs}>
        Home &gt; <span className={styles.activeBreadcrumb}>Profile & Account Settings</span>
      </div>

      {/* Profile Cover Banner */}
      <div className={styles.coverBanner}>
        <div className={styles.bannerOverlay}></div>
        <div className={styles.profileHeaderContent}>
          <div className={styles.avatarWrapper}>
            <div className={styles.avatarCircle}>{avatarInitials}</div>
            <span className={styles.verifiedCheckBadge} title="Verified Academic User">✓</span>
          </div>

          <div className={styles.profileMetaBlock}>
            <div className={styles.nameRow}>
              <h1 className={styles.userName}>{fullName}</h1>
              <span className={styles.roleBadgePill}>{activeRole}</span>
              <span className={styles.verifiedTag}>✓ Verified Academic User</span>
            </div>
            <p className={styles.userTitle}>{academicTitle}</p>
            <p className={styles.userInstitution}>🏛️ {institution}</p>
          </div>
        </div>
      </div>

      {/* Success Toast Banner */}
      {showSavedToast && (
        <div className={styles.savedToastBanner}>
          <span className={styles.toastCheckIcon}>✓</span>
          <div>
            <b>Profile Updated Successfully!</b>
            <p style={{ margin: 0, fontSize: '0.75rem', opacity: 0.9 }}>Your academic bio and profile preferences have been saved.</p>
          </div>
        </div>
      )}

      {/* Tabs Row */}
      <div className={styles.tabsRow}>
        <button
          className={`${styles.tabBtn} ${activeTab === 'info' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('info')}
        >
          👤 Personal Info
        </button>
        <button
          className={`${styles.tabBtn} ${activeTab === 'wallet' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('wallet')}
        >
          💳 Wallet & Financials
        </button>
        <button
          className={`${styles.tabBtn} ${activeTab === 'security' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('security')}
        >
          🔒 Security & Password
        </button>
      </div>

      {/* TAB 1: PERSONAL INFO */}
      {activeTab === 'info' && (
        <div className={styles.tabCard}>
          <h3 className={styles.cardSectionTitle}>Academic Profile Information</h3>
          <p className={styles.cardSectionSubtitle}>Update your public research details, title, and research tags.</p>

          <form onSubmit={handleSaveProfile} className={styles.profileForm}>
            <div className={styles.formRowTwoCols}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>* Full Name</label>
                <input
                  type="text"
                  className={styles.formInput}
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>* Academic Title</label>
                <input
                  type="text"
                  className={styles.formInput}
                  value={academicTitle}
                  onChange={(e) => setAcademicTitle(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className={styles.formRowTwoCols}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>* Email Address</label>
                <input
                  type="email"
                  className={styles.formInput}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>* Institution / University</label>
                <input
                  type="text"
                  className={styles.formInput}
                  value={institution}
                  onChange={(e) => setInstitution(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Research Keywords */}
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Research Interest Keywords (Press Enter to add)</label>
              <div className={styles.keywordsInputBox}>
                <input
                  type="text"
                  className={styles.keywordRawInput}
                  value={newKeywordInput}
                  onChange={(e) => setNewKeywordInput(e.target.value)}
                  onKeyDown={handleAddKeyword}
                  placeholder="Type research topic and press Enter..."
                />
                <div className={styles.keywordTagsContainer}>
                  {keywords.map((kw) => (
                    <span key={kw} className={styles.keywordPillTag}>
                      🏷️ {kw}
                      <button
                        type="button"
                        className={styles.removeKeywordCross}
                        onClick={() => handleRemoveKeyword(kw)}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Biography */}
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Academic Bio & Research Overview</label>
              <textarea
                className={styles.formTextarea}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={4}
              />
            </div>

            <div className={styles.formActionsRow}>
              <button type="submit" className={styles.saveNavyBtn}>
                💾 Save Changes
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 2: WALLET & FINANCIALS */}
      {activeTab === 'wallet' && (
        <div className={styles.tabCard}>
          <h3 className={styles.cardSectionTitle}>Wallet & Financial Overview</h3>
          <p className={styles.cardSectionSubtitle}>Manage your balance, escrow funds, and verified bank account.</p>

          <div className={styles.walletMetricsGrid}>
            <div className={styles.walletMetricCard}>
              <span className={styles.metricLabel}>PLATFORM WALLET BALANCE</span>
              <span className={styles.metricValue}>
                {isWalletLoading || walletBalance === null
                  ? '—'
                  : `${walletBalance.toLocaleString()} VND`}
              </span>
              <span className={styles.metricSub}>Available for peer-review requests & services</span>
            </div>

            <div className={styles.walletMetricCard}>
              <span className={styles.metricLabel}>ESCROW HELD FUNDS</span>
              <span className={styles.metricValue}>500,000 VND</span>
              <span className={styles.metricSub}>Locked in active peer-review contracts</span>
            </div>

            <div className={styles.walletMetricCard}>
              <span className={styles.metricLabel}>VERIFIED BANK ACCOUNT</span>
              <span className={styles.bankNameVal}>Vietcombank</span>
              <span className={styles.bankAccountVal}>•••• 4756 (Verified)</span>
            </div>
          </div>

          <div className={styles.walletActionsBar}>
            <button
              className={styles.actionNavyBtn}
              onClick={() => {
                // Deposit flow now goes through the PayOS payment link (Phase 3.2).
                alert('Use the Deposit flow on the Wallet page — it now goes through the PayOS payment link.');
              }}
            >
              💵 Deposit Funds
            </button>

            <button
              className={styles.actionOutlineBtn}
              onClick={() => alert('Withdrawal request initiated to Vietcombank account.')}
            >
              🏦 Withdraw Funds
            </button>
          </div>
        </div>
      )}

      {/* TAB 3: SECURITY & PASSWORD */}
      {activeTab === 'security' && (
        <div className={styles.tabCard}>
          <h3 className={styles.cardSectionTitle}>Security & Account Authentication</h3>
          <p className={styles.cardSectionSubtitle}>Update password, enable two-factor authentication, and monitor active sessions.</p>

          <form onSubmit={(e) => { e.preventDefault(); alert('Password updated successfully!'); }} className={styles.profileForm}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Current Password</label>
              <input type="password" className={styles.formInput} placeholder="••••••••••••" required />
            </div>

            <div className={styles.formRowTwoCols}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>New Password</label>
                <input type="password" className={styles.formInput} placeholder="••••••••••••" required />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Confirm New Password</label>
                <input type="password" className={styles.formInput} placeholder="••••••••••••" required />
              </div>
            </div>

            <div className={styles.security2FaBox}>
              <div>
                <b>Two-Factor Authentication (2FA)</b>
                <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b' }}>
                  Secure your account using Google Authenticator or SMS verification.
                </p>
              </div>
              <span className={styles.enabledPill}>✓ Enabled</span>
            </div>

            <div className={styles.formActionsRow}>
              <button type="submit" className={styles.saveNavyBtn}>
                🔒 Update Password
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default Profile;
