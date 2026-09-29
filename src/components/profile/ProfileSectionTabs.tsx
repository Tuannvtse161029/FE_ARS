// ProfileSectionTabs — horizontal tab strip beneath the identity card.
//
// Two top-level tabs remain after the Profile + Professional Profile merge:
//   account     — Personal profile (editable) + research expertise + academic
//                 metrics for roles that own a professional profile. Owner only.
//   public      — Role-specific public view + forum posts + publications +
//                 badges. Visible to both owner and visitor; visitors land
//                 here by default so they see the public surface first.
//
// The component is purely presentational and controlled — the parent owns
// `activeTab` and reacts to `onChange`.

import React from 'react';
import { Globe2, IdCard } from 'lucide-react';
import { useI18n } from '../../i18n/I18nContext';
import styles from './ProfileSectionTabs.module.css';

/**
 * Tab identifiers for the two-tab profile strip. After the Profile +
 * Professional Profile merge, only `account` (which now bundles personal
 * details, expertise, and academic metrics) and `public` remain.
 */
export type ProfileTabId = 'account' | 'public';

export interface ProfileSectionTabsProps {
  activeTab: ProfileTabId;
  onChange: (next: ProfileTabId) => void;
  /** Unlocked badge count — currently unused but kept for forward compat. */
  badgeCount?: number;
}

interface TabDescriptor {
  id: ProfileTabId;
  labelKey: string;
  hintKey: string;
  fallbackLabel: string;
  fallbackHint: string;
  icon: React.ReactNode;
}

const TAB_DESCRIPTORS: Record<ProfileTabId, TabDescriptor> = {
  account: {
    id: 'account',
    labelKey: 'profile.tabs.account',
    hintKey: 'profile.tabs.accountHint',
    fallbackLabel: 'Profile & Expertise',
    fallbackHint: 'Edit your details and manage research expertise',
    icon: <IdCard size={16} aria-hidden="true" />,
  },
  public: {
    id: 'public',
    labelKey: 'profile.tabs.public',
    hintKey: 'profile.tabs.publicHint',
    fallbackLabel: 'Public Profile',
    fallbackHint: 'How others see your profile',
    icon: <Globe2 size={16} aria-hidden="true" />,
  },
};

export const ProfileSectionTabs = ({
  activeTab,
  onChange,
}: ProfileSectionTabsProps) => {
  const { t } = useI18n();

  // After merging the Professional tab into the account tab, every role
  // sees the same two-tab strip: account (editable) + public (read-only).
  const visibleTabs: ProfileTabId[] = ['account', 'public'];

  // If the active tab became hidden (e.g. the parent's role resolved
  // late), fall back to the first visible tab so the panel never renders
  // orphaned.
  const effectiveActive: ProfileTabId = visibleTabs.includes(activeTab)
    ? activeTab
    : visibleTabs[0];

  return (
    <nav className={styles.tabBar} aria-label="Profile sections" data-testid="profile-section-tabs">
      {visibleTabs.map((id) => {
        const desc = TAB_DESCRIPTORS[id];
        const isActive = id === effectiveActive;
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
            title={t(desc.hintKey, desc.fallbackHint)}
          >
            <span className={styles.tabIcon}>{desc.icon}</span>
            <span className={styles.tabLabel}>{t(desc.labelKey, desc.fallbackLabel)}</span>
          </button>
        );
      })}
    </nav>
  );
};

export default ProfileSectionTabs;
