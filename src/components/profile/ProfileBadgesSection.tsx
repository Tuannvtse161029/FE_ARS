// ProfileBadgesSection — grid of medals (unlocked + in-progress) for the
// profile page. Renders inside the existing `ProfileExtrasSection` shell so
// it matches the Publications / Forum sections visually.
//
// Data flow:
//   - Parent (Profile page) calls `useAuthorFlair(userId)` which returns the
//     full unlocked+locked list. If the parent hands the list in via
//     `medals`, we use that copy directly; otherwise we fall back to the
//     hook so this section works in isolation.
//   - `SafeMedalBadge` (admin-side lucide / image renderer) is reused so the
//     artwork stays consistent with Admin medals and the flair badge.
//
// Until the BE exposes `/api/Medal/user/:id` consistently across all roles,
// the fallback is the hook's `isLoading` flag — we never invent data.

import React, { useMemo } from 'react';
import { Award, Lock } from 'lucide-react';
import {
  criteriaUnitLabel,
  type UserMedal,
} from '../../services/medal.service';
import { useI18n } from '../../i18n/I18nContext';
import { useAuthorFlair } from '../../hooks/useAuthorFlair';
import { SafeMedalBadge } from '../../pages/Admin/AdminMedals';
import { ProfileExtrasSection } from './ProfileExtrasSection';
import { formatDate } from '../../utils/formatDate';
import styles from './ProfileBadgesSection.module.css';

export interface ProfileBadgesSectionProps {
  /** The profile owner id. */
  userId: number;
  /** If true, render the owner copy ("Your badges"); otherwise viewer copy. */
  isOwner: boolean;
  /**
   * Optional pre-loaded medals list. When omitted, the section calls
   * `useAuthorFlair(userId)` to fetch its own copy. Either path works;
   * the explicit prop is useful when the parent already has data.
   */
  medals?: UserMedal[];
}

const OWNER_TITLE = 'Your badges & honors';
const VIEWER_TITLE = 'Badges & honors';

const TIER_LABELS_VI: Record<string, string> = {
  Bronze: 'Đồng',
  Silver: 'Bạc',
  Gold: 'Vàng',
  Platinum: 'Bạch Kim',
};

export const ProfileBadgesSection: React.FC<ProfileBadgesSectionProps> = ({
  userId,
  isOwner,
  medals: medalsProp,
}) => {
  const { t, locale } = useI18n();

  const fallback = useAuthorFlair(userId);
  const medals = useMemo<UserMedal[]>(
    () =>
      Array.isArray(medalsProp) ? medalsProp : fallback.unlockedMedals,
    [medalsProp, fallback.unlockedMedals],
  );

  const isLoading = medalsProp ? false : fallback.isLoading;
  // No explicit error path — the hook swallows fetch errors into an empty
  // list (logged on the SW side), so we render the empty state instead of
  // a noisy red banner. Typed as an Error-shaped literal so the if-block
  // below keeps working when we later wire a real error source.
  const error: Error | null = null as Error | null;
  void error;

  if (isLoading) {
    return (
      <ProfileExtrasSection
        title={isOwner ? OWNER_TITLE : VIEWER_TITLE}
        subtitle={t(
          'badges.profile.tabEmpty.body',
          'Badges will appear here as you reach academic milestones on ARS.',
        )}
        data-testid="profile-badges-section"
      >
        <div className={styles.skeleton} aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className={styles.skeletonCard} />
          ))}
        </div>
      </ProfileExtrasSection>
    );
  }

  if (error) {
    return (
      <ProfileExtrasSection
        title={isOwner ? OWNER_TITLE : VIEWER_TITLE}
        subtitle=""
        data-testid="profile-badges-section"
      >
        <p className={styles.errorMsg}>{error.message}</p>
      </ProfileExtrasSection>
    );
  }

  const sorted = [...medals].sort((a, b) => {
    if (a.isUnlocked !== b.isUnlocked) return a.isUnlocked ? -1 : 1;
    return Date.parse(b.medal.createdAt || '') - Date.parse(a.medal.createdAt || '');
  });

  if (sorted.length === 0) {
    return (
      <ProfileExtrasSection
        title={isOwner ? OWNER_TITLE : VIEWER_TITLE}
        subtitle=""
        data-testid="profile-badges-section"
      >
        <div className={styles.empty} role="status">
          <Award size={28} aria-hidden="true" />
          <p className={styles.emptyTitle}>
            {t('badges.profile.tabEmpty.title', 'No badges yet')}
          </p>
          <p className={styles.emptyBody}>
            {t(
              'badges.profile.tabEmpty.body',
              'Badges will appear here as you reach academic milestones on ARS.',
            )}
          </p>
        </div>
      </ProfileExtrasSection>
    );
  }

  const tierLabelFor = (tier: string): string => {
    if (locale === 'vi') return TIER_LABELS_VI[tier] ?? tier;
    return tier;
  };

  return (
    <ProfileExtrasSection
      title={isOwner ? OWNER_TITLE : VIEWER_TITLE}
      subtitle={
        isOwner
          ? t(
              'badges.profile.tabEmpty.body',
              'Badges will appear here as you reach academic milestones on ARS.',
            )
          : t('badges.section.title', 'Badges & honors')
      }
      data-testid="profile-badges-section"
    >
      <div className={styles.grid} data-testid="profile-badges-grid">
        {sorted.map((entry) => {
          const medal = entry.medal;
          const title =
            locale === 'vi'
              ? medal.titleVi || medal.title
              : medal.title;
          const description =
            locale === 'vi'
              ? medal.descriptionVi || medal.description
              : medal.description;
          const tierLabel = tierLabelFor(medal.tier);
          const unit = criteriaUnitLabel(
            medal.criteriaUnit,
            locale === 'vi' ? 'vi' : 'en',
          );
          const percent = Math.min(
            100,
            Math.max(0, entry.progressPercentage ?? 0),
          );
          const unlockedDate =
            entry.isUnlocked && entry.unlockedAt
              ? formatDate(entry.unlockedAt)
              : null;

          return (
            <article
              key={medal.id}
              className={`${styles.card} ${entry.isUnlocked ? styles.cardUnlocked : styles.cardLocked}`}
              data-tier={medal.tier}
              data-testid="profile-badge-card"
            >
              <header className={styles.cardHeader}>
                <SafeMedalBadge
                  imageUrl={medal.imageUrl}
                  code={medal.code}
                  criteriaMetric={medal.criteriaMetric}
                  tier={medal.tier}
                  size={96}
                  alt={title}
                />
                <div className={styles.cardHeading}>
                  <h3 className={styles.cardTitle}>{title}</h3>
                  <span className={styles.cardCode}>{medal.code}</span>
                </div>
                {entry.isUnlocked ? (
                  <span className={styles.unlockedChip}>
                    {t('badges.section.unlocked', 'Unlocked')}
                  </span>
                ) : (
                  <span className={styles.lockedChip}>
                    <Lock size={12} aria-hidden="true" />
                    {t('badges.section.locked', 'Locked')}
                  </span>
                )}
              </header>

              <span className={styles.tierChip} data-tier={medal.tier}>
                {tierLabel} ·{' '}
                {t('admin.medals.tier.tierWord', 'Tier')} {medal.stageLevel}
              </span>

              {description ? (
                <p className={styles.cardDesc}>{description}</p>
              ) : null}

              <div className={styles.criteriaRow}>
                <span className={styles.criteriaLabel}>
                  {t('badges.section.howToEarn', 'How to earn:')}
                </span>
                <span className={styles.criteriaValue}>
                  {medal.criteriaMetric} ≥ {medal.criteriaThreshold} {unit}
                </span>
              </div>

              {entry.isUnlocked && unlockedDate ? (
                <p className={styles.unlockedDate}>
                  {t('badges.section.unlockedAt', 'Unlocked on {date}').replace(
                    '{date}',
                    unlockedDate,
                  )}
                </p>
              ) : null}

              {!entry.isUnlocked ? (
                <div className={styles.progressBar} aria-label={`${percent}%`}>
                  <div
                    className={styles.progressFill}
                    style={{ width: `${percent}%` }}
                  />
                  <span className={styles.progressLabel}>
                    {t('badges.section.progress', 'Progress {percent}%').replace(
                      '{percent}',
                      String(Math.round(percent)),
                    )}
                  </span>
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
    </ProfileExtrasSection>
  );
};

export default ProfileBadgesSection;
