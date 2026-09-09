/**
 * RawFeedbackViewModal
 *
 * Owner-only pop-up that shows the full structured feedback a single
 * participant submitted for a seminar. Reached from the "View" button next
 * to the participant's display name inside `SeminarFeedbackPanel`'s raw
 * feedback list.
 *
 * The button-on-the-card UI in the panel keeps every row to one line of
 * headers (avatar + name + status pill + View button), and the actual
 * answers pop into this modal only when the host asks for them. That keeps
 * the lecturer's eye on the list-level signal (who submitted, who didn't)
 * rather than every long-form answer.
 *
 * The modal renders two things per answer:
 *
 *   • `text`  — `FeedbackQuoteSection`-style block with the question text
 *               as the label and the answer in a `<blockquote>`.
 *   • `rating` — same block but the body is a filled/empty star string
 *                (`★ ☆`) with `"<rating> / <max>"` appended to the label.
 */

import { useEffect, useMemo, useRef } from 'react';
import {
  Calendar,
  Eye,
  Inbox,
  Mail,
  MessageSquareText,
  Quote,
  ThumbsUp,
  X,
} from 'lucide-react';
import type { SeminarParticipantFeedback } from '../../services/seminar.service';
import {
  parseParticipantAnswers,
  type FeedbackAnswer,
  type FeedbackQuestion,
} from '../../types/seminarFeedback';
import styles from './RawFeedbackViewModal.module.css';

interface RawFeedbackViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** The participant row whose feedback should be shown. */
  entry: SeminarParticipantFeedback | null;
  /** Seminar's dynamic questions so answers can show their question text. */
  questions?: FeedbackQuestion[];
}

const initialsOf = (
  name: string | null | undefined,
  fallback: string,
): string => {
  if (!name) return fallback.slice(0, 2).toUpperCase();
  return (
    name
      .split(/\s+/)
      .map((s) => s[0] ?? '')
      .join('')
      .toUpperCase()
      .slice(0, 2) || fallback.slice(0, 2).toUpperCase()
  );
};

const renderStars = (rating: number, max: number): string => {
  const filled = '★'.repeat(Math.max(0, Math.min(max, Math.round(rating))));
  const empty = '☆'.repeat(Math.max(0, max - Math.round(rating)));
  return `${filled}${empty}`.trim();
};

const formatTime = (iso?: string | null): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString();
};

export const RawFeedbackViewModal: React.FC<RawFeedbackViewModalProps> = ({
  isOpen,
  onClose,
  entry,
  questions,
}) => {
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);

  // Escape closes the modal — convention shared across all seminar modals.
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  // Lock body scroll while open.
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  // Auto-focus the close button on open for keyboard users.
  useEffect(() => {
    if (isOpen) closeBtnRef.current?.focus();
  }, [isOpen]);

  // Build a lookup map questionId → question so each answer can show the
  // human-readable question text instead of the raw id.
  const questionById = useMemo(() => {
    const map = new Map<string, FeedbackQuestion>();
    for (const q of questions ?? []) {
      if (q.id) map.set(q.id, q);
    }
    return map;
  }, [questions]);

  // Pre-parse the answers so we only do it once per open.
  const answers = useMemo(
    () => (entry ? parseParticipantAnswers(entry.feedbackJson) : []),
    [entry],
  );

  if (!isOpen || !entry) return null;

  const displayName =
    entry.userFullName ??
    entry.invitedEmail ??
    entry.userEmail ??
    `Participant #${entry.seminarParticipantId}`;
  const initials = initialsOf(entry.userFullName, displayName);
  const hasSubmission = answers.length > 0;

  return (
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-labelledby="raw-feedback-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={styles.modal}>
        {/* ── Header ──────────────────────────────────────────── */}
        <header className={styles.header}>
          <div className={styles.headerIdentity}>
            <span className={styles.avatar} aria-hidden>
              {initials}
            </span>
            <div className={styles.headerMeta}>
              <h2 id="raw-feedback-title" className={styles.title}>
                <Eye size={18} aria-hidden /> {displayName}
              </h2>
              {entry.userEmail && entry.userEmail !== displayName && (
                <p className={styles.headerEmail}>
                  <Mail size={12} aria-hidden /> {entry.userEmail}
                </p>
              )}
              {entry.invitationStatus && (
                <span
                  className={`${styles.statusPill} ${
                    entry.invitationStatus.toLowerCase() === 'submitted' ||
                    hasSubmission
                      ? styles.statusSubmitted
                      : entry.invitationStatus.toLowerCase() === 'declined'
                        ? styles.statusDeclined
                        : styles.statusPending
                  }`}
                >
                  {entry.invitationStatus}
                </span>
              )}
            </div>
          </div>
          <button
            ref={closeBtnRef}
            type="button"
            className={styles.closeBtn}
            onClick={onClose}
            aria-label="Close feedback viewer"
          >
            <X size={18} aria-hidden />
          </button>
        </header>

        {/* ── Body ────────────────────────────────────────────── */}
        <div className={styles.body}>
          {!hasSubmission ? (
            <div className={styles.emptyState}>
              <Inbox size={20} aria-hidden />
              <div>
                <strong>No answers found in this submission.</strong>
                <span>
                  The participant either hasn't submitted yet or their
                  answers were submitted as an empty payload.
                </span>
              </div>
            </div>
          ) : (
            <>
              <header className={styles.bodyHeader}>
                <h3 className={styles.bodyTitle}>Submitted answers</h3>
                <p className={styles.bodySubtitle}>
                  Each block shows the original question and the answer the
                  participant typed in (or the star rating they chose).
                </p>
              </header>

              {/* Submitted / updated timestamps (right-aligned subtle row) */}
              {(entry.feedbackSubmittedAt || entry.feedbackUpdatedAt) && (
                <div className={styles.timestamps}>
                  {entry.feedbackSubmittedAt && (
                    <span>
                      <Calendar size={12} aria-hidden /> Submitted{' '}
                      {formatTime(entry.feedbackSubmittedAt)}
                    </span>
                  )}
                  {entry.feedbackUpdatedAt &&
                    entry.feedbackUpdatedAt !== entry.feedbackSubmittedAt && (
                      <span>
                        <Calendar size={12} aria-hidden /> Updated{' '}
                        {formatTime(entry.feedbackUpdatedAt)}
                      </span>
                    )}
                </div>
              )}

              <ul className={styles.answerList}>
                {answers.map((answer) => (
                  <AnswerBlock
                    key={`${answer.questionId ?? 'q'}-${answer.type}`}
                    answer={answer}
                    question={answer.questionId
                      ? questionById.get(answer.questionId)
                      : undefined}
                  />
                ))}
              </ul>
            </>
          )}
        </div>

        {/* ── Footer ──────────────────────────────────────────── */}
        <footer className={styles.footer}>
          <button type="button" className={styles.closeFooterBtn} onClick={onClose}>
            Close
          </button>
        </footer>
      </div>
    </div>
  );
};

/* -------------------------------------------------------------------- */
/* Single-answer block, same look as the existing inline feedback cards */
/* -------------------------------------------------------------------- */

interface AnswerBlockProps {
  answer: FeedbackAnswer;
  question?: FeedbackQuestion;
}

const AnswerBlock: React.FC<AnswerBlockProps> = ({ answer, question }) => {
  const label =
    question?.questionText ??
    `Question (${answer.questionId ?? 'unknown'})`;

  if (answer.type === 'rating' && typeof answer.rating === 'number') {
    const max = question?.maxStar ?? 5;
    return (
      <li className={styles.answerBlock}>
        <header className={styles.answerHeader}>
          <span className={styles.answerIcon}>
            <ThumbsUp size={14} aria-hidden />
          </span>
          <span className={styles.answerLabel}>
            {label} ·{' '}
            <strong>
              {answer.rating} / {max}
            </strong>
          </span>
        </header>
        <p className={styles.answerBody} aria-label={`${answer.rating} out of ${max} stars`}>
          {renderStars(answer.rating, max)}
        </p>
      </li>
    );
  }

  if (answer.type === 'text' && (answer.text ?? '').trim().length > 0) {
    return (
      <li className={styles.answerBlock}>
        <header className={styles.answerHeader}>
          <span className={styles.answerIcon}>
            <MessageSquareText size={14} aria-hidden />
          </span>
          <span className={styles.answerLabel}>{label}</span>
        </header>
        <blockquote className={styles.answerQuote}>
          {(answer.text ?? '').trim()}
        </blockquote>
      </li>
    );
  }

  // Unknown answer shape — render an empty placeholder so the question is
  // still surfaced rather than silently dropped.
  return (
    <li className={styles.answerBlock}>
      <header className={styles.answerHeader}>
        <span className={styles.answerIcon}>
          <Quote size={14} aria-hidden />
        </span>
        <span className={styles.answerLabel}>{label}</span>
      </header>
      <p className={styles.answerEmpty}>No text recorded for this answer.</p>
    </li>
  );
};

export default RawFeedbackViewModal;
