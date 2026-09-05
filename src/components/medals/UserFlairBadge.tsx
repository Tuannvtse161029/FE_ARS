/**
 * UserFlairBadge — Reddit-style user flair badge rendered inline next to a
 * username (forum cards, comments, profile identity row, etc.).
 *
 * Responsibilities:
 *   1. Fetch the user's unlocked medals via `useAuthorFlair` (which owns a
 *      module-level cache so 20 forum cards for the same author produce
 *      ONE network call).
 *   2. If `forceMedalId` is provided, look that medal up in the unlocked
 *      set and render its `SafeMedalBadge` (or `null` if not unlocked —
 *      see note below).
 *   3. Otherwise, pick the user's featured flair using the layered
 *      algorithm implemented in `pickFeaturedMedal`:
 *         a. Explicit `flairMedalId` (pinned, from props or localStorage)
 *         b. User-defined `flairOrder` (from props or localStorage)
 *         c. Highest unlocked tier, tie-broken by most-recent `unlockedAt`
 *   4. Render the badge with a hover tooltip showing title + tier + a
 *      short description, all localized via `useI18n`.
 *
 * Implementation notes:
 *   - `SafeMedalBadge` is imported lazily so we don't drag the entire
 *     AdminMedals page bundle (modals, hooks, dozens of icons, page-level
 *     CSS) into every consumer of this small presentational component.
 *   - `forceMedalId` lookup: if the id is NOT in the unlocked list, render
 *     NOTHING (silent `null`). This is intentional — the parent (profile
 *     identity row) has authoritative knowledge that the medal IS
 *     unlocked, so a miss means stale data; flashing a fallback badge
 *     would mislead the viewer. Callers who want a guaranteed badge
 *     should omit `forceMedalId` and let `pickFeaturedMedal` choose.
 */

import React, { Suspense, lazy, useMemo } from 'react';
import type { UserMedal } from '../../services/medal.service';
import { useI18n } from '../../i18n/I18nContext';
import {
  pickFeaturedMedal,
  useAuthorFlair,
} from '../../hooks/useAuthorFlair';
import styles from './UserFlairBadge.module.css';

// Lazy import — AdminMedals.tsx is a heavy admin page (modals, hooks, large
// icon set). Wrapping SafeMedalBadge in lazy() keeps the flair badge bundle
// small and prevents future circular imports if AdminMedals ever wants to
// render a UserFlairBadge itself.
const SafeMedalBadge = lazy(async () => {
  const mod = await import('../../pages/Admin/AdminMedals');
  return { default: mod.SafeMedalBadge };
});

export type UserFlairSize = 'xs' | 'sm' | 'md';

const SIZE_PX: Record<UserFlairSize, number> = {
  xs: 24,
  sm: 32,
  md: 48,
};

export interface UserFlairBadgeProps {
  /** Backend user id — number (preferred) or string. Required. */
  userId: number | string;
  /** Render size in pixels. Default 'sm'. */
  size?: UserFlairSize;
  /** Show a hover/focus tooltip with title + tier + description. Default true. */
  showTooltip?: boolean;
  /**
   * Force a specific medal id to render (used by the profile identity row
   * which iterates the user's unlocked list and shows one badge per
   * medal). If the id is not in the unlocked list, the component renders
   * `null` — silent fallback rather than a misleading badge.
   */
  forceMedalId?: string;
  /** Profile-level pinned flair id, if the calling page has it. */
  profileFlairMedalId?: string | null;
  /** Optional click handler — sets pointer cursor and a11y semantics. */
  onClick?: () => void;
}

/**
 * Local storage key for a per-user pinned-flair preference.
 * Shape: `{ flairMedalId?: string; flairOrder?: string[] }`
 */
const flairStorageKey = (userId: number | string): string =>
  `ars_flair_${String(userId)}`;

interface StoredFlairPrefs {
  flairMedalId?: string;
  flairOrder?: string[];
}

const readStoredFlairPrefs = (
  userId: number | string,
): StoredFlairPrefs | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(flairStorageKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === 'object') {
      const out: StoredFlairPrefs = {};
      const obj = parsed as Record<string, unknown>;
      if (typeof obj.flairMedalId === 'string') {
        out.flairMedalId = obj.flairMedalId;
      }
      if (Array.isArray(obj.flairOrder)) {
        out.flairOrder = obj.flairOrder.filter(
          (x): x is string => typeof x === 'string',
        );
      }
      return out;
    }
  } catch {
    /* ignore malformed storage */
  }
  return null;
};

/** Localized tier label — mirrors the labels in AdminMedals.tsx. */
const tierLabel = (tier: string, locale: 'en' | 'vi'): string => {
  if (locale === 'vi') {
    if (tier === 'Bronze') return 'Đồng';
    if (tier === 'Silver') return 'Bạc';
    if (tier === 'Gold') return 'Vàng';
    if (tier === 'Platinum') return 'Bạch Kim';
    return tier;
  }
  return tier;
};

const UserFlairBadgeInner: React.FC<{
  unlockedMedals: UserMedal[];
  forceMedalId?: string;
  storedPrefs: StoredFlairPrefs | null;
  profileFlairMedalId?: string | null;
  showTooltip: boolean;
  badgeSize: number;
  onClick?: () => void;
  locale: 'en' | 'vi';
}> = ({
  unlockedMedals,
  forceMedalId,
  storedPrefs,
  profileFlairMedalId,
  showTooltip,
  badgeSize,
  onClick,
  locale,
}) => {
  const chosen: UserMedal | null = useMemo(() => {
    // 1. Forced id — explicit render target from a parent that has
    //    authoritative knowledge the medal is unlocked. Silent `null`
    //    on miss (see file header for rationale).
    if (forceMedalId) {
      const hit = unlockedMedals.find(
        (m) => m && m.medal && m.medal.id === forceMedalId && m.isUnlocked,
      );
      return hit ?? null;
    }

    if (!Array.isArray(unlockedMedals) || unlockedMedals.length === 0) {
      return null;
    }

    // 2. Featured selection: localStorage pinned id > profile pinned id >
    //    localStorage ordering > highest tier.
    const flairMedalId =
      storedPrefs?.flairMedalId ?? profileFlairMedalId ?? null;
    const flairOrder = storedPrefs?.flairOrder ?? null;

    return pickFeaturedMedal(unlockedMedals, flairMedalId, flairOrder);
  }, [unlockedMedals, forceMedalId, storedPrefs, profileFlairMedalId]);

  if (!chosen || !chosen.medal) return null;

  const medal = chosen.medal;
  const title =
    locale === 'vi' ? medal.titleVi || medal.title : medal.title;
  const description =
    locale === 'vi'
      ? medal.descriptionVi || medal.description
      : medal.description;
  const tier = tierLabel(medal.tier, locale);

  // One-line description for the tooltip.
  const oneLineDescription =
    description.length > 120
      ? `${description.slice(0, 117).trimEnd()}…`
      : description;

  const Wrapper: React.ElementType = onClick ? 'button' : 'span';

  return (
    <Wrapper
      type={onClick ? 'button' : undefined}
      className={styles.flairWrapper}
      data-clickable={onClick ? 'true' : 'false'}
      onClick={onClick}
      aria-label={
        onClick
          ? `${title} — ${tier}`
          : `${tier} flair: ${title}`
      }
    >
      <span className={styles.flairBadge}>
        <Suspense
          fallback={
            <span
              aria-hidden="true"
              style={{
                width: badgeSize,
                height: badgeSize,
                display: 'inline-block',
              }}
            />
          }
        >
          <SafeMedalBadge
            imageUrl={medal.imageUrl}
            code={medal.code}
            criteriaMetric={medal.criteriaMetric}
            tier={medal.tier}
            size={badgeSize}
            alt={`${title} — ${tier}`}
          />
        </Suspense>
      </span>
      {showTooltip && (
        <span role="tooltip" className={styles.tooltip}>
          <span className={styles.tooltipTitle}>{title}</span>
          <span className={styles.tooltipTier}>
            {tier}
            {oneLineDescription ? ` · ${oneLineDescription}` : ''}
          </span>
        </span>
      )}
    </Wrapper>
  );
};

export const UserFlairBadge: React.FC<UserFlairBadgeProps> = ({
  userId,
  size = 'sm',
  showTooltip = true,
  forceMedalId,
  profileFlairMedalId,
  onClick,
}) => {
  const { locale } = useI18n();
  // The hook handles the module-level cache + network fetch.
  const { unlockedMedals } = useAuthorFlair(userId);

  // Stored prefs are read once per render — they're cheap to re-read and
  // we don't need a useEffect for them since the badge re-renders when
  // unlockedMedals updates anyway.
  const storedPrefs = useMemo(
    () => readStoredFlairPrefs(userId),
    [userId],
  );

  const badgeSize = SIZE_PX[size] ?? SIZE_PX.sm;

  return (
    <UserFlairBadgeInner
      unlockedMedals={unlockedMedals}
      forceMedalId={forceMedalId}
      storedPrefs={storedPrefs}
      profileFlairMedalId={profileFlairMedalId}
      showTooltip={showTooltip}
      badgeSize={badgeSize}
      onClick={onClick}
      locale={locale === 'en' ? 'en' : 'vi'}
    />
  );
};

export default UserFlairBadge;
