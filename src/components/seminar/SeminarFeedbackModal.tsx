/**
 * Structured participant feedback form (replaces the legacy star rating +
 * free-text `participantEvaluation` UI per tickets/frontend/ticket.md).
 *
 * - At least ONE of (overallComment / strengths / improvements / suggestions)
 *   must be non-empty for the submit button to enable.
 * - The form prefills from existing feedback when editing.
 * - Owners (Lecturer/Researcher who organized the seminar) MUST NOT see this
 *   modal — the workspace routes them to the owner feedback panel instead.
 * - No `rating` field. No `averageScore`. No star widget.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  X,
  ClipboardCheck,
  Loader,
  CheckCircle2,
  AlertCircle,
  Plus,
  Sparkles,
  MessageSquareText,
  ThumbsUp,
  Wrench,
  Lightbulb,
} from 'lucide-react';
import {
  seminarService,
  type SeminarFeedbackContent,
} from '../../services/seminar.service';
import styles from './SeminarFeedbackModal.module.css';

interface SeminarFeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  seminarId: number;
  seminarTitle?: string;
  /** Existing feedback payload from BE — when present, the form runs in
   *  "edit" mode and prefills every field. */
  existingFeedback?: SeminarFeedbackContent | null;
  /** When true, the form treats existing feedback as having been submitted
   *  at least once. Toggle: "Submit Feedback" → "Edit Feedback". */
  hasSubmittedBefore?: boolean;
  /** Host preview mode — renders the same form layout but disables inputs
   *  and replaces the submit button with a "Close Preview" action so the
   *  organizer can see exactly what participants receive. */
  previewMode?: boolean;
  onSuccess?: () => void;
}

interface BulletState {
  id: string;
  text: string;
}

const makeBulletId = (): string =>
  `b_${Math.random().toString(36).slice(2, 10)}`;

const bulletsFromArray = (items: string[] | undefined): BulletState[] =>
  (items ?? [])
    .filter((s) => typeof s === 'string' && s.trim().length > 0)
    .map((text) => ({ id: makeBulletId(), text }));

const useDialogFocus = (
  isOpen: boolean,
  isBusy: boolean,
  onClose: () => void,
) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) {
      openerRef.current?.focus();
      return;
    }
    openerRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const frame = window.requestAnimationFrame(() =>
      dialogRef.current
        ?.querySelector<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex="0"]',
        )
        ?.focus(),
    );
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isBusy) {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), a[href], [tabindex="0"]',
        ),
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, isBusy, onClose]);

  return dialogRef;
};

const countNonEmptyChars = (value: string): number => value.trim().length;

const isFeedbackNonEmpty = (
  overallComment: string,
  strengths: BulletState[],
  improvements: BulletState[],
  suggestions: BulletState[],
): boolean => {
  if (countNonEmptyChars(overallComment) > 0) return true;
  if (strengths.some((b) => countNonEmptyChars(b.text) > 0)) return true;
  if (improvements.some((b) => countNonEmptyChars(b.text) > 0)) return true;
  if (suggestions.some((b) => countNonEmptyChars(b.text) > 0)) return true;
  return false;
};

export const SeminarFeedbackModal: React.FC<SeminarFeedbackModalProps> = ({
  isOpen,
  onClose,
  seminarId,
  seminarTitle,
  existingFeedback,
  hasSubmittedBefore = false,
  previewMode = false,
  onSuccess,
}) => {
  const [overallComment, setOverallComment] = useState('');
  const [strengths, setStrengths] = useState<BulletState[]>([]);
  const [improvements, setImprovements] = useState<BulletState[]>([]);
  const [suggestions, setSuggestions] = useState<BulletState[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const dialogRef = useDialogFocus(isOpen, isSubmitting, onClose);

  // Prefill when opening or when the existing payload changes.
  useEffect(() => {
    if (!isOpen) return;
    setOverallComment(existingFeedback?.overallComment ?? '');
    setStrengths(bulletsFromArray(existingFeedback?.strengths));
    setImprovements(bulletsFromArray(existingFeedback?.improvements));
    setSuggestions(bulletsFromArray(existingFeedback?.suggestions));
    setErrorMsg(null);
    setIsSuccess(false);
  }, [isOpen, existingFeedback]);

  const isValid = useMemo(
    () =>
      isFeedbackNonEmpty(overallComment, strengths, improvements, suggestions),
    [overallComment, strengths, improvements, suggestions],
  );

  const isEditing = hasSubmittedBefore || Boolean(existingFeedback);

  if (!isOpen) return null;

  const addBullet = (
    setter: React.Dispatch<React.SetStateAction<BulletState[]>>,
  ) => {
    setter((prev) => [...prev, { id: makeBulletId(), text: '' }]);
  };

  const updateBullet = (
    setter: React.Dispatch<React.SetStateAction<BulletState[]>>,
    id: string,
    text: string,
  ) => {
    setter((prev) =>
      prev.map((b) => (b.id === id ? { ...b, text } : b)),
    );
  };

  const removeBullet = (
    setter: React.Dispatch<React.SetStateAction<BulletState[]>>,
    id: string,
  ) => {
    setter((prev) => prev.filter((b) => b.id !== id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) {
      setErrorMsg(
        'Please share at least one item across any of the four sections.',
      );
      return;
    }
    setIsSubmitting(true);
    setErrorMsg(null);

    const clean = (items: BulletState[]): string[] =>
      items
        .map((b) => b.text.trim())
        .filter((s) => s.length > 0);

    const payload: SeminarFeedbackContent = {
      overallComment: overallComment.trim(),
      strengths: clean(strengths),
      improvements: clean(improvements),
      suggestions: clean(suggestions),
    };

    try {
      await seminarService.submitFeedback(seminarId, {
        feedback: payload,
      });
      setIsSuccess(true);
      onSuccess?.();
    } catch (err: unknown) {
      const responseData = (
        err as {
          response?: { data?: { message?: string } | string; status?: number };
        }
      )?.response?.data;
      const status = (
        err as { response?: { status?: number } }
      )?.response?.status;
      const rawMsg =
        typeof responseData === 'string'
          ? responseData
          : responseData?.message ??
            (err instanceof Error ? err.message : '') ??
            '';

      let friendlyMsg = 'Could not submit feedback. Please try again.';
      if (status === 403) {
        friendlyMsg =
          rawMsg ||
          'You are not authorized to submit feedback for this seminar.';
      } else if (
        rawMsg.toLowerCase().includes('not registered') ||
        rawMsg.toLowerCase().includes('not invited')
      ) {
        friendlyMsg =
          'Your account is not on the invitee list for this seminar.';
      } else if (rawMsg) {
        friendlyMsg = rawMsg;
      }

      setErrorMsg(friendlyMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      ref={dialogRef}
      className={styles.modalOverlay}
      role="dialog"
      aria-modal="true"
      aria-labelledby="seminar-feedback-title"
    >
      <div className={styles.modalCard}>
        {/* Header */}
        <div className={styles.modalHeader}>
          <div className={styles.headerTitleBlock}>
            <div className={styles.headerIcon}>
              <ClipboardCheck size={20} />
            </div>
            <div>
              <h3 id="seminar-feedback-title" className={styles.modalTitle}>
                {previewMode
                  ? 'Feedback Form Preview'
                  : isEditing
                    ? 'Edit Your Feedback'
                    : 'Share Your Seminar Feedback'}
              </h3>
              <p className={styles.modalSubtitle}>
                {previewMode
                  ? `${seminarTitle || 'Academic seminar'} · This is exactly what participants will see`
                  : seminarTitle || 'Academic seminar'}
              </p>
            </div>
          </div>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={onClose}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className={styles.modalBody}>
            {previewMode && (
              <div className={styles.previewBanner} role="status">
                <Sparkles size={14} aria-hidden />
                <span>
                  Preview only — your form is read-only. Participants will
                  receive this layout when the seminar closes.
                </span>
              </div>
            )}
            {isSuccess && (
              <div className={styles.successBanner} role="status">
                <CheckCircle2 size={16} />
                <span>
                  {isEditing
                    ? 'Feedback updated. Thank you for the revision.'
                    : 'Feedback submitted. Thank you for sharing your reflection.'}
                </span>
              </div>
            )}

            {errorMsg && (
              <div className={styles.errorBanner} role="alert">
                <AlertCircle size={16} />
                <span>{errorMsg}</span>
              </div>
            )}

            <p className={styles.introHint}>
              Fill any combination of the four sections below — at least one
              needs a response before you can submit.
            </p>

            {/* Overall Comment */}
            <section className={styles.fieldSection}>
              <header className={styles.fieldHeader}>
                <span className={styles.fieldIcon}>
                  <MessageSquareText size={15} aria-hidden />
                </span>
                <label htmlFor="feedback-overall" className={styles.fieldLabel}>
                  Overall Comment
                </label>
                <span className={styles.fieldOptional}>Optional</span>
              </header>
              <p className={styles.fieldHint}>
                A short paragraph on what you took away from the seminar.
              </p>
              <textarea
                id="feedback-overall"
                className={styles.textarea}
                value={overallComment}
                onChange={(e) => setOverallComment(e.target.value)}
                placeholder="The session was clear and well-paced; I left with a working mental model of the topic."
                disabled={isSubmitting || isSuccess || previewMode}
                rows={4}
              />
            </section>

            {/* Strengths */}
            <BulletListField
              icon={<ThumbsUp size={15} aria-hidden />}
              label="Strengths"
              helperText="What worked well — content, format, delivery, examples."
              bullets={strengths}
              placeholder="Concrete examples grounded in the talk."
              disabled={isSubmitting || isSuccess || previewMode}
              variant="strength"
              onAdd={() => addBullet(setStrengths)}
              onChange={(id, text) => updateBullet(setStrengths, id, text)}
              onRemove={(id) => removeBullet(setStrengths, id)}
            />

            {/* Improvements */}
            <BulletListField
              icon={<Wrench size={15} aria-hidden />}
              label="Areas for Improvement"
              helperText="Constructive critique — pacing, depth, Q&A, slides, anything that did not land."
              bullets={improvements}
              placeholder="Pacing in the second half felt rushed."
              disabled={isSubmitting || isSuccess || previewMode}
              variant="improvement"
              onAdd={() => addBullet(setImprovements)}
              onChange={(id, text) => updateBullet(setImprovements, id, text)}
              onRemove={(id) => removeBullet(setImprovements, id)}
            />

            {/* Suggestions */}
            <BulletListField
              icon={<Lightbulb size={15} aria-hidden />}
              label="Suggestions"
              helperText="Forward-looking ideas — follow-up topics, formats, resources."
              bullets={suggestions}
              placeholder="Send the slide deck + reading list after the talk."
              disabled={isSubmitting || isSuccess || previewMode}
              variant="suggestion"
              onAdd={() => addBullet(setSuggestions)}
              onChange={(id, text) => updateBullet(setSuggestions, id, text)}
              onRemove={(id) => removeBullet(setSuggestions, id)}
            />

            <div className={styles.guidanceNote}>
              <Sparkles size={14} aria-hidden />
              <span>
                Your response is private to the seminar organizer — other
                participants will never see it.
              </span>
            </div>
          </div>

          {/* Footer */}
          <div className={styles.modalFooter}>
            <button
              type="button"
              className={styles.cancelBtn}
              onClick={onClose}
              disabled={isSubmitting}
            >
              {previewMode ? 'Close Preview' : 'Cancel'}
            </button>
            {!previewMode && (
              <button
                type="submit"
                className={styles.submitBtn}
                disabled={isSubmitting || isSuccess || !isValid}
              >
                {isSubmitting ? (
                  <>
                    <Loader size={16} className={styles.spinningIcon} />
                    <span>{isEditing ? 'Saving…' : 'Submitting…'}</span>
                  </>
                ) : isSuccess ? (
                  <>
                    <CheckCircle2 size={16} />
                    <span>Submitted</span>
                  </>
                ) : isEditing ? (
                  'Save Changes'
                ) : (
                  'Submit Feedback'
                )}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};

interface BulletListFieldProps {
  icon: React.ReactNode;
  label: string;
  helperText: string;
  bullets: BulletState[];
  placeholder: string;
  disabled: boolean;
  variant: 'strength' | 'improvement' | 'suggestion';
  onAdd: () => void;
  onChange: (id: string, text: string) => void;
  onRemove: (id: string) => void;
}

const BulletListField: React.FC<BulletListFieldProps> = ({
  icon,
  label,
  helperText,
  bullets,
  placeholder,
  disabled,
  variant,
  onAdd,
  onChange,
  onRemove,
}) => {
  const variantClass =
    variant === 'strength'
      ? styles.fieldVariantStrength
      : variant === 'improvement'
        ? styles.fieldVariantImprovement
        : styles.fieldVariantSuggestion;
  return (
    <section
      className={`${styles.fieldSection} ${styles.fieldSectionBullets} ${variantClass}`}
    >
      <header className={styles.fieldHeader}>
        <span className={styles.fieldIcon}>{icon}</span>
        <span className={styles.fieldLabel}>{label}</span>
        <span className={styles.fieldOptional}>Optional</span>
      </header>
      <p className={styles.fieldHint}>{helperText}</p>
      <ul className={styles.bulletList}>
        {bullets.map((b) => (
          <li key={b.id} className={styles.bulletRow}>
            <span className={styles.bulletDot} aria-hidden>
              •
            </span>
            <input
              type="text"
              className={styles.bulletInput}
              value={b.text}
              onChange={(e) => onChange(b.id, e.target.value)}
              placeholder={placeholder}
              disabled={disabled}
            />
            <button
              type="button"
              className={styles.bulletRemoveBtn}
              onClick={() => onRemove(b.id)}
              disabled={disabled}
              aria-label="Remove this item"
            >
              <X size={13} aria-hidden />
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        className={styles.addBulletBtn}
        onClick={onAdd}
        disabled={disabled}
      >
        <Plus size={13} aria-hidden />
        Add another {label.toLowerCase().slice(0, -1) || 'item'}
      </button>
    </section>
  );
};

export default SeminarFeedbackModal;
