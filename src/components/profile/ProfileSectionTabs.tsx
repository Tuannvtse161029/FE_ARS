// ProfileSectionTabs — horizontal tab strip beneath the identity card.
//
// Three top-level tabs replace the older "Overview / Forum / Publications /
// Badges" strip:
//   account     — Personal profile (editable). Owner only.
//   professional — Major Field / Subfield + availability + academic metrics.
//                  Only rendered for roles that own a professional profile
//                  (Researcher / Reviewer / Lecturer).
//   public      — Role-specific public view + forum posts + publications +
//                  badges. Visible to both owner and visitor; visitors land
//                  here by default so they see the public surface first.
//
// The component is purely presentational and controlled — the parent owns
// `activeTab` and reacts to `onChange`.

import React from 'react';
import { Briefcase, Globe2, IdCard } from 'lucide-react';
import { useI18n } from '../../i18n/I18nContext';
import styles from './ProfileSectionTabs.module.css';

/**
 * Tab identifiers for the three-tab profile strip. The component hides
 * `professional` automatically when `showProfessional` is false so callers
 * don't have to render an empty tab themselves.
 */
export type ProfileTabId = 'account' | 'professional' | 'public';

export interface ProfileSectionTabsProps {
  activeTab: ProfileTabId;
  onChange: (next: ProfileTabId) => void;
  /**
   * Whether to render the Professional Profile tab. The page passes
   * `false` for roles that don't own a professional profile (Graduate
   * Student, Admin, fallback "Member"). For non-owners (visitors) the
   * caller still passes `false` so the tab is hidden — visitors only see
   * the public surface.
   */
  showProfessional: boolean;
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
    fallbackLabel: 'Profile',
    fallbackHint: 'Edit your personal details',
    icon: <IdCard size={16} aria-hidden="true" />,
  },
  professional: {
    id: 'professional',
    labelKey: 'profile.tabs.professional',
    hintKey: 'profile.tabs.professionalHint',
    fallbackLabel: 'Professional Profile',
    fallbackHint: 'Manage your research expertise and metrics',
    icon: <Briefcase size={16} aria-hidden="true" />,
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
  showProfessional,
}: ProfileSectionTabsProps) => {
  const { t } = useI18n();

  // Build the visible tab list dynamically so we don't render an empty
  // Professional tab for roles that don't own one.
  const visibleTabs: ProfileTabId[] = showProfessional
    ? ['account', 'professional', 'public']
    : ['account', 'public'];

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
