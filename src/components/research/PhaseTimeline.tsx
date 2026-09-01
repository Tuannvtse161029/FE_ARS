/**
 * PhaseTimeline — compact horizontal stepper that shows where a research
 * group is in its reporting journey.
 *
 * Pure presentation. The caller computes the per-phase state (upcoming,
 * due, overdue, submitted, accepted) so this component never depends on
 * the BE / service layer.
 *
 * Visual states (mapped to design tokens; never rely on color alone —
 * every state ships with an icon and a text label):
 *   - upcoming   (planned / awaiting submission)  → slate dot, no icon
 *   - dueSoon    (deadline within 7 days)          → amber dot, Clock icon
 *   - overdue    (deadline passed, no submission)  → red dot, AlertTriangle
 *   - submitted  (waiting for review)              → blue dot, CheckCircle
 *   - accepted   (lecturer approved)               → green dot, Check
 *
 * The timeline reads top-to-bottom on narrow viewports via a flex-wrap
 * fallback. The compact horizontal layout is the default; it does NOT
 * use large icons or progress-ring filler (craft-floor ban).
 */
import { Check, CheckCircle2, Clock, AlertTriangle } from 'lucide-react';
import styles from './PhaseTimeline.module.css';

export type PhaseTimelineState =
  | 'upcoming'
  | 'dueSoon'
  | 'overdue'
  | 'submitted'
  | 'accepted';

export interface PhaseTimelineItem {
  /** 1-based phase number. */
  number: number;
  /** Phase title, e.g. "Phase 1 — Literature Review". */
  title: string;
  /** Current state of this phase. */
  state: PhaseTimelineState;
  /** Optional ISO date string for the deadline (rendered as "Due <date>"). */
  deadline?: string | null;
  /** Optional ISO date string for the submission timestamp (rendered as
   *  "Submitted <date>" when state is `submitted` / `accepted`). */
  submittedAt?: string | null;
}

export interface PhaseTimelineProps {
  items: PhaseTimelineItem[];
  className?: string;
}

const STATE_LABEL: Record<PhaseTimelineState, string> = {
  upcoming: 'Awaiting submission',
  dueSoon: 'Due soon',
  overdue: 'Overdue',
  submitted: 'Awaiting review',
  accepted: 'Approved',
};

const formatDate = (iso?: string | null): string | null => {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const StateIcon = ({ state }: { state: PhaseTimelineState }) => {
  if (state === 'accepted') return <Check size={11} aria-hidden />;
  if (state === 'submitted') return <CheckCircle2 size={11} aria-hidden />;
  if (state === 'overdue') return <AlertTriangle size={11} aria-hidden />;
  if (state === 'dueSoon') return <Clock size={11} aria-hidden />;
  return null;
};

export const PhaseTimeline = ({ items, className }: PhaseTimelineProps) => {
  if (items.length === 0) return null;

  return (
    <ol
      className={`${styles.timeline} ${className ?? ''}`.trim()}
      aria-label="Phase progress timeline"
    >
      {items.map((item, idx) => {
        const deadlineLabel = formatDate(item.deadline);
        const submittedLabel = formatDate(item.submittedAt);
        const isLast = idx === items.length - 1;
        return (
          <li
            key={item.number}
            className={`${styles.step} ${styles[item.state]}`}
            data-state={item.state}
          >
            <div className={styles.markerRow}>
              <span
                className={styles.dot}
                aria-label={STATE_LABEL[item.state]}
                role="img"
              >
                <StateIcon state={item.state} />
              </span>
              {!isLast && <span className={styles.connector} aria-hidden />}
            </div>
            <div className={styles.text}>
              <span className={styles.stepTitle}>
                Phase {item.number}
                {item.title ? <span className={styles.titleBody}>{item.title}</span> : null}
              </span>
              <span className={styles.stateLabel}>
                {STATE_LABEL[item.state]}
                {deadlineLabel && item.state !== 'accepted' ? (
                  <span className={styles.metaText}> · Due {deadlineLabel}</span>
                ) : null}
                {submittedLabel && (item.state === 'submitted' || item.state === 'accepted') ? (
                  <span className={styles.metaText}> · {submittedLabel}</span>
                ) : null}
              </span>
            </div>
          </li>
        );
      })}
    </ol>
  );
};

export default PhaseTimeline;
