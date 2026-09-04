/**
 * Google MeetCapacityMeter — visualizes the Google Meet (free-account)
 * 100-participant cap for a single seminar.
 *
 * Three states:
 * - safe:       below 80% — neutral
 * - warning:    80–99% — amber
 * - full:       >=100% — danger, meeting at capacity
 *
 * Accepts either:
 * - a raw current count, OR
 * - the BE-provided `maxParticipants` (which defaults to 100 if BE sends null)
 */

import { AlertTriangle, Users, Video } from 'lucide-react';
import styles from './GoogleMeetCapacityMeter.module.css';
import { GOOGLE_MEET_FREE_PARTICIPANT_CAP } from '../../services/seminar.service';

interface GoogleMeetCapacityMeterProps {
  /** Current confirmed participants. */
  current: number;
  /** Optional override of the cap. Defaults to the Google Meet free-account
   *  cap of 100 participants. */
  cap?: number;
  /** Compact mode for inline use inside seminar cards. */
  compact?: boolean;
}

const computeState = (current: number, cap: number) => {
  if (cap <= 0) return 'safe' as const;
  const ratio = current / cap;
  if (ratio >= 1) return 'full' as const;
  if (ratio >= 0.8) return 'warning' as const;
  return 'safe' as const;
};

export const GoogleMeetCapacityMeter: React.FC<GoogleMeetCapacityMeterProps> = ({
  current,
  cap = GOOGLE_MEET_FREE_PARTICIPANT_CAP,
  compact = false,
}) => {
  const safeCurrent = Math.max(0, Math.floor(current || 0));
  const ratio = cap > 0 ? safeCurrent / cap : 0;
  const state = computeState(safeCurrent, cap);
  const remaining = Math.max(0, cap - safeCurrent);

  const stateClass =
    state === 'full'
      ? styles.state_full
      : state === 'warning'
        ? styles.state_warning
        : styles.state_safe;

  const fillPct = Math.min(100, Math.max(0, Math.round(ratio * 100)));

  if (compact) {
    return (
      <span
        className={`${styles.compactMeter} ${stateClass}`}
        role="status"
        aria-label={`${safeCurrent} of ${cap} Google Meet participant slots filled`}
      >
        <Video size={12} aria-hidden />
        <span className={styles.compactMeterValue}>
          {safeCurrent}/{cap}
        </span>
        {state === 'full' && (
          <span className={styles.compactMeterBadge}>At capacity</span>
        )}
      </span>
    );
  }

  return (
    <div
      className={`${styles.meter} ${stateClass}`}
      role="group"
      aria-label="Google Meet participant capacity"
    >
      <header className={styles.meterHeader}>
        <span className={styles.meterHeaderLeft}>
          <Video size={14} aria-hidden />
          <span className={styles.meterHeaderLabel}>
            Google Meet capacity
          </span>
        </span>
        <span className={styles.meterHeaderValue}>
          <strong>{safeCurrent}</strong>
          <span className={styles.meterHeaderSep}>/</span>
          <span>{cap}</span>
        </span>
      </header>

      <div className={styles.meterBar} aria-hidden>
        <div
          className={styles.meterFill}
          style={{ width: `${fillPct}%` }}
        />
      </div>

      <footer className={styles.meterFooter}>
        {state === 'full' ? (
          <span className={styles.meterFooterAlert}>
            <AlertTriangle size={13} aria-hidden />
            <span>
              The Google Meet link is at capacity. The free-account cap is{' '}
              <strong>{cap} participants</strong>. New invitees cannot join this
              room.
            </span>
          </span>
        ) : state === 'warning' ? (
          <span className={styles.meterFooterWarn}>
            <AlertTriangle size={13} aria-hidden />
            <span>
              Approaching the Google Meet limit — <strong>{remaining}</strong>{' '}
              participant slot{remaining === 1 ? '' : 's'} remaining out of{' '}
              {cap}.
            </span>
          </span>
        ) : (
          <span className={styles.meterFooterOk}>
            <Users size={13} aria-hidden />
            <span>
              <strong>{remaining}</strong> participant slot
              {remaining === 1 ? '' : 's'} still available (free Google Meet
              caps at {cap}).
            </span>
          </span>
        )}
      </footer>
    </div>
  );
};

export default GoogleMeetCapacityMeter;
