// PaperLockBadge — a small visual indicator for papers that have an active
// Review Request.
//
// Source of truth: docs/local-only/review-request-status-policy.md §5.
//
// Status must not be communicated by color alone (per the master prompt):
// we always pair the lock icon with the word "Locked" and a tooltip that
// explains *why* (active review request, reviewer name when known).

import { Lock, ShieldAlert } from 'lucide-react';
import styles from './PaperLockBadge.module.css';

interface PaperLockBadgeProps {
  isLocked: boolean;
  reviewerName?: string | null;
  activeRequestCount?: number;
  // Compact form is used inside dense tables; the full form renders the
  // tooltip-friendly description. Both share the same accessibility text.
  variant?: 'compact' | 'full';
}

export function PaperLockBadge({
  isLocked,
  reviewerName,
  activeRequestCount,
  variant = 'full',
}: PaperLockBadgeProps): JSX.Element | null {
  if (!isLocked) return null;

  const reviewer = (reviewerName ?? '').trim();
  const count = typeof activeRequestCount === 'number' ? activeRequestCount : 1;

  const tooltipText = reviewer
    ? `This paper cannot be deleted because it has ${count === 1 ? 'an active review request' : `${count} active review requests`} assigned to ${reviewer}. The paper must remain available until the request reaches a final state.`
    : `This paper cannot be deleted because it has ${count === 1 ? 'an active review request' : `${count} active review requests`}. The paper must remain available until the request reaches a final state.`;

  const visibleLabel = reviewer
    ? `Locked · under review by ${reviewer}`
    : 'Locked · under review';

  return (
    <span
      className={`${styles.pBadge} ${variant === 'compact' ? styles.pCompact : styles.pFull}`}
      role="status"
      aria-label={tooltipText}
      title={tooltipText}
      data-testid="paper-lock-badge"
    >
      <span className={styles.pIcon} aria-hidden="true">
        {reviewer ? <ShieldAlert size={14} /> : <Lock size={14} />}
      </span>
      <span className={styles.pLabel}>{visibleLabel}</span>
    </span>
  );
}

export default PaperLockBadge;