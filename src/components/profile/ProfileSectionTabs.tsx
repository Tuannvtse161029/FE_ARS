// ProfileSectionTabs — horizontal tab strip that switches the Profile page
// between Overview / Forum / Publications / Badges sections.
//
// Rendered only when `mode === 'view'` and we have a resolved targetUserId
// (the Profile page owns that gate). The component is purely presentational
// and controlled — the parent owns `activeTab` and reacts to `onChange`.

import React from 'react';
import { Award, FileText, MessageSquare, UserRound } from 'lucide-react';
import { useI18n } from '../../i18n/I18nContext';
import styles from './ProfileSectionTabs.module.css';

export type ProfileTabId = 'overview' | 'forum' | 'publications' | 'badges';

export interface ProfileSectionTabsProps {
  activeTab: ProfileTabId;
  onChange: (next: ProfileTabId) => void;
  /** Unlocked badge count rendered as a chip on the Badges tab. */
  badgeCount?: number;
}

const TAB_IDS: ProfileTabId[] = ['overview', 'forum', 'publications', 'badges'];

export const ProfileSectionTabs: React.FC<ProfileSectionTabsProps> = ({
  activeTab,
  onChange,
  badgeCount,
}) => {
  const { t } = useI18n();

  const labelFor = (id: ProfileTabId): string => {
    if (id === 'overview') return t('badges.profile.tabs.overview', 'Overview');
    if (id === 'forum') return t('badges.profile.tabs.forum', 'Forum');
    if (id === 'publications') return t('badges.profile.tabs.publications', 'Publications');
    return t('badges.profile.tabs.badges', 'Badges');
  };

  const iconFor = (id: ProfileTabId): React.ReactNode => {
    if (id === 'overview') return <UserRound size={16} aria-hidden="true" />;
    if (id === 'forum') return <MessageSquare size={16} aria-hidden="true" />;
    if (id === 'publications') return <FileText size={16} aria-hidden="true" />;
    return <Award size={16} aria-hidden="true" />;
  };

  return (
    <nav className={styles.tabBar} aria-label="Profile sections" data-testid="profile-section-tabs">
      {TAB_IDS.map((id) => {
        const isActive = id === activeTab;
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-controls={`profile-tabpanel-${id}`}
            className={`${styles.tab} ${isActive ? styles.tabActive : ''}`}
            onClick={() => onChange(id)}
            data-testid={`profile-tab-${id}`}
          >
            <span className={styles.tabIcon}>{iconFor(id)}</span>
            <span className={styles.tabLabel}>{labelFor(id)}</span>
            {id === 'badges' && typeof badgeCount === 'number' && badgeCount > 0 ? (
              <span className={styles.tabBadge} aria-label={`${badgeCount}`}>
                {badgeCount}
              </span>
            ) : null}
          </button>
        );
      })}
    </nav>
  );
};

export default ProfileSectionTabs;
