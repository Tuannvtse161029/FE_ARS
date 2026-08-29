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
  | 'unknown';

// Map raw status strings (canonical labels AND common synonyms) to a
// normalised variant. The BE stores these as free-form strings so we accept
// a wide input range; unknown inputs fall back to `unknown` which renders in
// muted grey.
const NORMALISE_TABLE: Record<string, StatusBadgeVariant> = {
  // PhasedReport statuses
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
  // ResearchTopic statuses
  open: 'open',
  assigned: 'assigned',
  completed: 'completed',
  closed: 'closed',
  // GuidanceProject statuses
  proposed: 'proposed',
  ongoing: 'ongoing',
  cancelled: 'cancelled',
};

const normalise = (raw: string | null | undefined): StatusBadgeVariant => {
  if (!raw) return 'unknown';
  const key = raw.toLowerCase().trim().replace(/[\s-]+/g, '_');
  return NORMALISE_TABLE[key] ?? 'unknown';
};

interface StatusBadgeProps {
  status: string | null | undefined;
  label?: string;
  size?: 'sm' | 'md';
}

// Compact pill: 22px tall (md) / 20px (sm). Always paired with a coloured
// dot prefix and a label. Background tint uses the token palette so badges
// read consistently across the Lecturer workspace without bespoke hex codes
// in pages.
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