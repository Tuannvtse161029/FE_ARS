import styles from './StatusBadge.module.css';

// Canonical PhaseReport status values that can be passed as the normalised
// value when StatusBadge is used inside lecturer PhaseReports pages.
// These values bypass the free-form string normalisation table so the CSS
// class is always correct regardless of label variations.
export type NormalizedStatus =
  | 'evaluated'
  | 'rejected'
  | 'submitted'
  | 'submitted-late'
  | 'overdue'
  | 'awaiting-submission';

export type StatusBadgeVariant =
  | NormalizedStatus
  | 'waiting'
  | 'overdueAwaiting'
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
//
// PhaseReportStatus values (evaluated, rejected, submitted, submitted-late,
// overdue, awaiting-submission) are added explicitly so the table can
// normalise them even when the BE sends them in kebab-case or unexpected
// casing.
const NORMALISE_TABLE: Record<string, StatusBadgeVariant> = {
  // PhaseReport canonical statuses
  evaluated: 'evaluated',
  rejected: 'rejected',
  submitted: 'submitted',
  'submitted-late': 'submitted-late',
  overdue: 'overdue',
  'awaiting-submission': 'awaiting-submission',
  // Common aliases / synonyms
  waiting: 'waiting',
  pending: 'waiting',
  awaiting: 'waiting',
  pending_review: 'submitted',
  approved: 'evaluated',
  graded: 'evaluated',
  complete: 'evaluated',
  denied: 'rejected',
  declined: 'rejected',
  // Synthetic computed statuses (passed directly from page-level code)
  overdue_awaiting: 'overdueAwaiting',
  // ResearchTopic statuses
  open: 'open',
  assigned: 'assigned',
  completed: 'completed',
  closed: 'closed',
};

const normalise = (raw: string | null | undefined): StatusBadgeVariant => {
  if (!raw) return 'unknown';
  const key = raw.toLowerCase().trim().replace(/[\s-]+/g, '_');
  return NORMALISE_TABLE[key] ?? 'unknown';
};

interface StatusBadgeProps {
  /**
   * Raw status string from the BE. Used as the display label when `label`
   * is not provided.
   */
  status: string | null | undefined;
  /**
   * Pre-normalised PhaseReportStatus value from `classifyPhaseReportStatus`.
   * When provided, the CSS class is selected from this value directly,
   * bypassing the string normalisation table — this is the authoritative
   * path for lecturer PhaseReports where the brief requires strict colour
   * mapping independent of label variations.
   */
  normalizedStatus?: NormalizedStatus | null;
  /**
   * Display text. Defaults to `status ?? 'Unknown'`.
   */
  label?: string;
  size?: 'sm' | 'md';
}

// Compact pill: 22px tall (md) / 20px (sm). Always paired with a coloured
// dot prefix and a label. Background tint uses the token palette so badges
// read consistently across the Lecturer workspace without bespoke hex codes
// in pages.
export const StatusBadge = ({
  status,
  normalizedStatus,
  label,
  size = 'md',
}: StatusBadgeProps) => {
  // Prefer the normalised value from the classifier when available;
  // fall back to normalising the raw string for all other consumers.
  const rawVariant = normalizedStatus ?? normalise(status);
  const text = label ?? status ?? 'Unknown';
  const variantClass = styles[rawVariant];
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