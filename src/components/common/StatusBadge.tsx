/**
 * StatusBadge — Reusable status pill component
 *
 * Moved from src/components/lecturer/StatusBadge.tsx → src/components/common/
 * Domain adapters should provide correct label and semantic tone.
 * Don't normalize unrelated backend lifecycles through one guessing table.
 */
import styles from './StatusBadge.module.css';

export type StatusBadgeVariant =
  | 'waiting'
  | 'submitted'
  | 'evaluated'
  | 'rejected'
  | 'open'
  | 'assigned'
  | 'completed'
  | 'closed'
  | 'proposed'
  | 'ongoing'
  | 'cancelled'
  | 'unknown'
  // Publication research-paper list statuses (ARS Paper Day design system)
  | 'pubSubmitted'    // Amber — SUBMITTED
  | 'pubAssigned'     // Blue  — REVIEWER_ASSIGNED
  | 'pubPublished'    // Green — PUBLISHED
  | 'pubRejected'     // Red   — ADMIN_REJECTED
  | 'pubImprovement'; // Purple — REVIEWER_RECOMMENDED_REJECT

// Map raw status strings (canonical labels AND common synonyms) to a
// normalised variant. The BE stores these as free-form strings so we accept
// a wide input range; unknown inputs fall back to `unknown` which renders in
// muted grey.
//
// Publication researcher-paper statuses use `pub*` variants so they can be
// styled with the ARS Paper Day amber/blue/green/red/purple palette.
const NORMALISE_TABLE: Record<string, StatusBadgeVariant> = {
  waiting: 'waiting',
  pending: 'waiting',
  awaiting: 'waiting',
  submitted: 'submitted',
  pending_review: 'submitted',
  evaluated: 'evaluated',
  approved: 'evaluated',
  graded: 'evaluated',
  complete: 'evaluated',
  rejected: 'rejected',
  denied: 'rejected',
  declined: 'rejected',
  open: 'open',
  assigned: 'assigned',
  completed: 'completed',
  closed: 'closed',
  proposed: 'proposed',
  ongoing: 'ongoing',
  cancelled: 'cancelled',
  // Publication researcher-paper list statuses
  submitted_paper: 'pubSubmitted',
  reviewer_assigned_paper: 'pubAssigned',
  published_paper: 'pubPublished',
  admin_rejected_paper: 'pubRejected',
  reviewer_recommended_improvement: 'pubImprovement',
};

const normalise = (raw: string | null | undefined): StatusBadgeVariant => {
  if (!raw) return 'unknown';
  const key = raw.toLowerCase().trim().replace(/[\s-]+/g, '_');

  // Publication researcher-paper statuses — map BE enum tokens directly
  // so the badge can render correctly when `status` receives a raw
  // PublicationStatus string and no label override is supplied.
  switch (key) {
    case 'submitted':                          return 'pubSubmitted';
    case 'reviewer_assigned':                  return 'pubAssigned';
    case 'published':                          return 'pubPublished';
    case 'admin_rejected':                     return 'pubRejected';
    case 'reviewer_recommended_reject':         return 'pubImprovement';
    default:
      return NORMALISE_TABLE[key] ?? 'unknown';
  }
};

export interface StatusBadgeProps {
  status: string | null | undefined;
  label?: string;
  size?: 'sm' | 'md';
}

export const StatusBadge = ({ status, label, size = 'md' }: StatusBadgeProps) => {
  const variant = normalise(status);
  const text = label ?? status ?? 'Unknown';
  const variantClass = styles[variant];
  const sizeClass = size === 'sm' ? styles.sizeSm : styles.sizeMd;
  return (
    <span
      className={`${styles.badge} ${variantClass} ${sizeClass}`}
      aria-label={`Status: ${text}`}
      data-component="StatusBadge"
    >
      <span className={styles.dot} aria-hidden />
      {text}
    </span>
  );
};

export default StatusBadge;
