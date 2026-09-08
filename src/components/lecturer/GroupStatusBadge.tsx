/**
 * GroupActiveBadge — ACTIVE / INACTIVE pill for Research Group cards.
 *
 * Renders a semantic badge (success green for ACTIVE, muted grey for INACTIVE)
 * that signals whether a research group is currently active. The badge carries
 * meaning via color + label + dot, never via color alone (accessibility).
 *
 * The Lecturer can toggle a group's active status via the toggle button on the
 * card. This badge reflects the current state.
 */

import styles from './GroupStatusBadge.module.css';

export type GroupActiveStatus = 'active' | 'inactive';

interface GroupStatusBadgeProps {
  /** Whether the group is currently active. Defaults to `true` for new groups. */
  isActive: boolean;
  /** Size variant — `sm` for compact card contexts, `md` (default) for detail views. */
  size?: 'sm' | 'md';
}

export const GroupStatusBadge = ({
  isActive,
  size = 'md',
}: GroupStatusBadgeProps) => {
  const status: GroupActiveStatus = isActive ? 'active' : 'inactive';
  return (
    <span
      className={`${styles.badge} ${styles[status]} ${size === 'sm' ? styles.sizeSm : styles.sizeMd}`}
      aria-label={isActive ? 'Group status: Active' : 'Group status: Inactive'}
      data-component="GroupStatusBadge"
    >
      <span className={styles.dot} aria-hidden />
      {status === 'active'
        ? 'ACTIVE'
        : 'INACTIVE'}
    </span>
  );
};

export default GroupStatusBadge;
