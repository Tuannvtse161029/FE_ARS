/**
 * Seminar feedback window — single source of truth for the participant-
 * side submission deadline.
 *
 * Both the lecturer's setup modal (where we advertise "your participants
 * have 72 hours to submit") and the participant's table action (where
 * we hide Submit feedback once the deadline passes) must agree on the
 * exact deadline, so the derivation lives in one place and both call
 * sites consume it.
 *
 * Convention:
 *   • The window starts at the seminar's `endTime` (UTC).
 *   • The deadline is `endTime + SEMINAR_FEEDBACK_WINDOW_MS`.
 *   • All comparisons use `Date.now()` so they're consistent with the
 *     rest of the FE's status checks.
 *
 * If the BE ever exposes a per-seminar deadline, prefer the BE value
 * here and keep the constant as a fallback.
 */

import { SEMINAR_FEEDBACK_WINDOW_HOURS, SEMINAR_FEEDBACK_WINDOW_MS } from './constants';
import { parseApiDateTimeAsUtc } from './datetime';

/** Three-state outcome for the participant-side feedback gate. */
export type SeminarFeedbackWindowState =
  | 'not-started'      // Seminar hasn't ended yet — wait.
  | 'open'             // Past endTime AND before deadline — submit.
  | 'closed'           // Past deadline — submission locked.
  | 'not-applicable';  // No endTime on the row — can't compute.

export interface SeminarFeedbackWindowInfo {
  state: SeminarFeedbackWindowState;
  /** Absolute deadline (`endTime + window`), or `null` if not derivable. */
  deadline: Date | null;
  /** Milliseconds remaining until the deadline; negative if already past. */
  remainingMs: number | null;
  /** Number of full hours in the window — used for the lecturer-facing copy. */
  windowHours: number;
}

/**
 * Compute the feedback-window state for one participation row. The
 * caller passes the raw `endTime` string from the BE; this helper
 * routes it through `parseApiDateTimeAsUtc` so the deadline math
 * matches what the rest of the FE renders as "the seminar end time".
 */
export function getSeminarFeedbackWindow(
  endTime: string | null | undefined,
  now: number = Date.now(),
): SeminarFeedbackWindowInfo {
  const base: SeminarFeedbackWindowInfo = {
    state: 'not-applicable',
    deadline: null,
    remainingMs: null,
    windowHours: SEMINAR_FEEDBACK_WINDOW_HOURS,
  };

  const end = parseApiDateTimeAsUtc(endTime);
  if (!end) return base;

  const deadline = new Date(end.getTime() + SEMINAR_FEEDBACK_WINDOW_MS);
  const remainingMs = deadline.getTime() - now;

  let state: SeminarFeedbackWindowState;
  if (now < end.getTime()) {
    state = 'not-started';
  } else if (remainingMs <= 0) {
    state = 'closed';
  } else {
    state = 'open';
  }

  return { state, deadline, remainingMs, windowHours: SEMINAR_FEEDBACK_WINDOW_HOURS };
}
