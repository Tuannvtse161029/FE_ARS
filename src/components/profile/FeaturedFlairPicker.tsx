// FeaturedFlairPicker — Reddit-style flair picker embedded inside the
// Edit Profile form. Lets the owner pick one unlocked medal to feature
// next to their name and reorder the rest via HTML5 drag-and-drop.
//
// Why two affordances (select + reorder)?
//   - The "select" grid makes a single choice explicit (the highlighted
//     tile moves to the top of the order list).
//   - The "display order" list lets users reorder the remaining medals so
//     the secondary badges render in a personalized sequence on the public
//     profile.
//
// Persistence:
//   - The component is fully controlled by the parent (Profile.tsx), which
//     owns `flairMedalId` and `flairOrder` state.
//   - On every change we ALSO write a copy to localStorage under
//     `ars_flair_<userId>` so the flair survives even when the BE hasn't
//     caught up to the new fields yet. When `pickProfileUpdateFields` on
//     the BE accepts the flair fields, the localStorage write becomes a
//     convenience cache.

import React, { useEffect, useMemo, useState } from 'react';
import { Award, GripVertical } from 'lucide-react';
import {
  medalService,
  type UserMedal,
} from '../../services/medal.service';
import { SafeMedalBadge } from '../../features/admin/AdminMedals';
import { useI18n } from '../../i18n/I18nContext';
import styles from './FeaturedFlairPicker.module.css';

export interface FeaturedFlairPickerProps {
  /** Authenticated user id (used to scope the localStorage key). */
  userId: number;
  /** Currently selected featured-flair medal id, controlled. */
  valueFlairMedalId: string | null;
  /** Currently selected ordered list of unlocked medals, controlled. */
  valueFlairOrder: string[];
  onChange: (next: {
    flairMedalId: string | null;
    flairOrder: string[];
  }) => void;
}

interface StoredPrefs {
  flairMedalId: string | null;
  flairOrder: string[];
}

const STORAGE_KEY = (userId: number): string => `ars_flair_${userId}`;

export const FeaturedFlairPicker: React.FC<FeaturedFlairPickerProps> = ({
  userId,
  valueFlairMedalId,
  valueFlairOrder,
  onChange,
}) => {
  const { t } = useI18n();
  const [medals, setMedals] = useState<UserMedal[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    medalService
      .getMyMedals()
      .then((list) => {
        if (cancelled) return;
        setMedals(Array.isArray(list) ? list : []);
      })
      .catch(() => {
        if (cancelled) return;
        setMedals([]);
      })
      .finally(() => {
        if (cancelled) return;
        setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const unlocked = useMemo(
    () => medals.filter((m) => m && m.medal && m.isUnlocked),
    [medals],
  );

  // Sync to localStorage on every change (until the BE supports flair).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const payload: StoredPrefs = {
        flairMedalId: valueFlairMedalId,
        flairOrder: valueFlairOrder,
      };
      window.localStorage.setItem(
        STORAGE_KEY(userId),
        JSON.stringify(payload),
      );
    } catch {
      /* ignore quota / serialization errors */
    }
  }, [userId, valueFlairMedalId, valueFlairOrder]);

  // When the unlocked list first arrives, seed the order with the current
  // pick (or all unlocked medals) so the user always has something to drag.
  useEffect(() => {
    // Only seed when BOTH the order is empty AND we have unlocked medals.
    // Guard against re-entry: if onChange triggers a parent re-render and
    // this effect runs again, the early-return on length>0 prevents a loop.
    if (valueFlairOrder.length > 0) return;
    if (unlocked.length === 0) return;
    onChange({
      flairMedalId: valueFlairMedalId ?? unlocked[0].medal.id,
      flairOrder: unlocked.map((m) => m.medal.id),
    });
    // Intentionally only run when the unlocked list shape changes.
    // Including the other deps would cause infinite re-renders because
    // `onChange` always produces a new array reference.
  }, [unlocked, onChange, valueFlairMedalId, valueFlairOrder.length]);

  const handleSelect = (medalId: string) => {
    // Move the selected medal to the top of the order.
    const filtered = valueFlairOrder.filter((id) => id !== medalId);
    onChange({
      flairMedalId: medalId,
      flairOrder: [medalId, ...filtered],
    });
  };

  const handleReorder = (fromIdx: number, toIdx: number) => {
    if (fromIdx === toIdx) return;
    const next = [...valueFlairOrder];
    const [moved] = next.splice(fromIdx, 1);
    if (moved === undefined) return;
    next.splice(toIdx, 0, moved);
    onChange({
      flairMedalId: next[0] ?? null,
      flairOrder: next,
    });
  };

  if (isLoading) {
    return (
      <section className={styles.picker} aria-busy="true">
        <header className={styles.header}>
          <h3 className={styles.title}>
            {t('badges.featuredFlair', 'Featured flair badge')}
          </h3>
          <p className={styles.help}>
            {t(
              'badges.featuredFlairHelp',
              'Shown next to your name in the forum and on your public profile.',
            )}
          </p>
        </header>
        <div className={styles.skeletonGrid}>
          {[0, 1, 2].map((i) => (
            <div key={i} className={styles.skeletonTile} />
          ))}
        </div>
      </section>
    );
  }

  if (unlocked.length === 0) {
    return (
      <section className={styles.picker}>
        <header className={styles.header}>
          <h3 className={styles.title}>
            {t('badges.featuredFlair', 'Featured flair badge')}
          </h3>
          <p className={styles.help}>
            {t(
              'badges.featuredFlairHelp',
              'Shown next to your name in the forum and on your public profile.',
            )}
          </p>
        </header>
        <div className={styles.empty}>
          <Award size={28} aria-hidden="true" />
          <p className={styles.emptyTitle}>
            {t(
              'badges.featuredFlairEmpty.title',
              'No badges to choose from yet',
            )}
          </p>
          <p className={styles.emptyBody}>
            {t(
              'badges.featuredFlairEmpty.body',
              'Earn your first milestone to start customizing your featured flair.',
            )}
          </p>
          <a className={styles.emptyCta} href="/forum">
            {t('badges.featuredFlairEmpty.cta', 'Explore the forum')}
          </a>
        </div>
      </section>
    );
  }

  // Render the order list, falling back to the unlocked list if order is empty.
  const orderedIds =
    valueFlairOrder.length > 0
      ? valueFlairOrder
      : unlocked.map((m) => m.medal.id);

  const orderedMedals: UserMedal[] = orderedIds
    .map((id) => unlocked.find((m) => m.medal.id === id))
    .filter((m): m is UserMedal => Boolean(m));

  return (
    <section
      className={styles.picker}
      data-testid="featured-flair-picker"
    >
      <header className={styles.header}>
        <h3 className={styles.title}>
          {t('badges.featuredFlair', 'Featured flair badge')}
        </h3>
        <p className={styles.help}>
          {t(
            'badges.featuredFlairHelp',
            'Shown next to your name in the forum and on your public profile.',
          )}
        </p>
      </header>

      {/* Grid picker */}
      <div
        className={styles.grid}
        role="radiogroup"
        aria-label={t('badges.select.aria', 'Select featured flair badge')}
      >
        {unlocked.map((m) => {
          const isSelected = m.medal.id === valueFlairMedalId;
          return (
            <button
              key={m.medal.id}
              type="button"
              role="radio"
              aria-checked={isSelected}
              className={`${styles.tile} ${isSelected ? styles.tileSelected : ''}`}
              onClick={() => handleSelect(m.medal.id)}
              data-testid={`flair-tile-${m.medal.id}`}
            >
              <SafeMedalBadge
                imageUrl={m.medal.imageUrl}
                code={m.medal.code}
                criteriaMetric={m.medal.criteriaMetric}
                tier={m.medal.tier}
                size={56}
                alt={m.medal.title}
              />
              <span className={styles.tileLabel}>{m.medal.title}</span>
              {isSelected ? (
                <span className={styles.tileCheck} aria-hidden="true">
                  ✓
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {/* Drag-reorder list */}
      <div className={styles.orderSection}>
        <h4 className={styles.orderTitle}>
          {t('badges.order.title', 'Display order')}
        </h4>
        <p className={styles.orderHelp}>
          {t(
            'badges.order.help',
            'Drag to reorder — the first badge appears next to your name.',
          )}
        </p>
        <ol className={styles.orderList} data-testid="featured-flair-order">
          {orderedMedals.map((m, idx) => (
            <li
              key={m.medal.id}
              className={`${styles.orderItem} ${idx === 0 ? styles.orderItemPrimary : ''}`}
              draggable
              onDragStart={(event) => {
                event.dataTransfer.effectAllowed = 'move';
                event.dataTransfer.setData('text/plain', String(idx));
              }}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                const raw = event.dataTransfer.getData('text/plain');
                const fromIdx = Number(raw);
                if (Number.isFinite(fromIdx)) handleReorder(fromIdx, idx);
              }}
            >
              <span
                className={styles.orderDragHandle}
                aria-hidden="true"
              >
                <GripVertical size={14} />
              </span>
              <SafeMedalBadge
                imageUrl={m.medal.imageUrl}
                code={m.medal.code}
                criteriaMetric={m.medal.criteriaMetric}
                tier={m.medal.tier}
                size={36}
                alt={m.medal.title}
              />
              <span className={styles.orderLabel}>{m.medal.title}</span>
              {idx === 0 ? (
                <span className={styles.orderPrimaryChip}>
                  {t('badges.select.checked', 'Selected')}
                </span>
              ) : null}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
};

export default FeaturedFlairPicker;
