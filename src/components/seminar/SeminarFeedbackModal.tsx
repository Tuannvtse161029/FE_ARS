/**
 * SeminarFeedbackModal — participant dynamic feedback form.
 *
 * Replaces the legacy "structured" 4-section form
 * (overallComment / strengths / improvements / suggestions) with the
 * canonical dynamic feedback surface per ticket §13-17.
 *
 *   • Mounts only when `isOpen` is true.
 *   • Fetches the host-configured form via
 *     `seminarService.getFeedbackQuestions(seminarId)` (ticket §13.1).
 *   • Submits / edits answers through
 *     `seminarService.submitDynamicFeedback(seminarId, answers)`
 *     which calls `POST /api/Seminar/{id}/feedback` with the canonical
 *     `{ answers: [...] }` body (ticket §16).
 *   • Prefills on edit using the participant's stored
 *     `FeedbackJson` (ticket §20) when supplied via
 *     `existingDynamicAnswers`.
 *   • Hosts (Lecturer / Researcher) call this with `previewMode` to see
 *     exactly what participants will receive.
 *   • Required validation: rating must be ≥ 1, text answers must be
 *     non-blank — matches BE behavior (ticket §17).
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  X,
  ClipboardCheck,
  Loader,
  CheckCircle2,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import { seminarService } from '../../services/seminar.service';
import { DynamicQuestionRenderer } from './DynamicQuestionRenderer';
import {
  parseParticipantAnswers,
  type FeedbackAnswer,
  type FeedbackQuestion,
} from '../../types/seminarFeedback';
import styles from './SeminarFeedbackModal.module.css';

interface SeminarFeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  seminarId: number;
  seminarTitle?: string;
  /**
   * Raw FeedbackJson stored on the seminar participant row (ticket §20).
   * When present, the modal prefills the form for "edit" mode. Pass the
   * canonical string returned by `GET /api/Seminar/{id}` →
   * `participants[i].feedbackJson`.
   */
  existingDynamicAnswersRaw?: string | null;
  /**
   * Sets the toggle: "Submit Feedback" → "Edit Feedback" when true.
   * Driven by `participant.feedbackSubmittedAt != null` (ticket §19).
   */
  hasSubmittedBefore?: boolean;
  /** Host preview mode — disables inputs and replaces the submit button
   *  with a "Close Preview" action so the organizer can see exactly what
   *  participants receive. */
  previewMode?: boolean;
  onSuccess?: () => void;
}

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

/**
 * Build an initial `answers` map from the canonical list of
 * `FeedbackQuestion`s. Used on first open.
 */
const buildInitialAnswers = (
  questions: FeedbackQuestion[],
  prefilled: FeedbackAnswer[] = [],
): Record<string, FeedbackAnswer> => {
  const initial: Record<string, FeedbackAnswer> = {};
  for (const q of questions) {
    const existing = prefilled.find((a) => a.questionId === q.id);
    if (existing) {
      initial[q.id] = {
        questionId: q.id,
        orderIndex: existing.orderIndex ?? q.orderIndex,
        type: existing.type ?? q.type,
        rating: existing.rating,
        text: existing.text,
      };
    } else {
      initial[q.id] = {
        questionId: q.id,
        orderIndex: q.orderIndex,
        type: q.type,
        rating: q.type === 'rating' ? 0 : undefined,
        text: q.type === 'text' ? '' : undefined,
      };
    }
  }
  return initial;
};

export const SeminarFeedbackModal: React.FC<SeminarFeedbackModalProps> = ({
  isOpen,
  onClose,
  seminarId,
  seminarTitle,
  existingDynamicAnswersRaw,
  hasSubmittedBefore = false,
  previewMode = false,
  onSuccess,
}) => {
  const [questions, setQuestions] = useState<FeedbackQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, FeedbackAnswer>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const dialogRef = useDialogFocus(isOpen, isSubmitting, onClose);

  // Prefill / fetch questions whenever the modal opens.
  useEffect(() => {
    if (!isOpen) return;
    setErrorMsg(null);
    setIsSuccess(false);
    setErrors({});
    setIsLoading(true);

    const prefilled = parseParticipantAnswers(existingDynamicAnswersRaw);

    let isMounted = true;
    seminarService
      .getFeedbackQuestions(seminarId)
      .then((loaded) => {
        if (!isMounted) return;
        setQuestions(loaded);
        setAnswers(buildInitialAnswers(loaded, prefilled));
      })
      .catch(() => {
        if (!isMounted) return;
        setQuestions([]);
        setAnswers({});
        setErrorMsg(
          'Could not load the feedback form. Please try again or contact the host.',
        );
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, existingDynamicAnswersRaw, seminarId]);

  const answeredCount = useMemo(() => {
    return Object.values(answers).filter((a) => {
      if (a.type === 'rating') return typeof a.rating === 'number' && a.rating > 0;
      if (a.type === 'text') return typeof a.text === 'string' && a.text.trim().length > 0;
      return false;
    }).length;
  }, [answers]);

  const isEditing = hasSubmittedBefore || Boolean(existingDynamicAnswersRaw);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate required questions per ticket §17.
    const localErrors: Record<string, string> = {};
    for (const q of questions) {
      const ans = answers[q.id];
      if (!ans) continue;
      if (q.isRequired) {
        if (q.type === 'rating' && (!ans.rating || ans.rating <= 0)) {
          localErrors[q.id] =
            'Vui lòng chọn số sao đánh giá / Please select a star rating.';
        } else if (
          q.type === 'text' &&
          (!ans.text || !ans.text.trim())
        ) {
          localErrors[q.id] =
            'Vui lòng trả lời câu hỏi này / Please provide your answer.';
        }
      }
    }
    if (Object.keys(localErrors).length > 0) {
      setErrors(localErrors);
      setErrorMsg(
        'Vui lòng hoàn thành các câu hỏi bắt buộc / Please answer all required questions.',
      );
      return;
    }

    setErrors({});
    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      // Canonical payload per ticket §16: `{ answers: [{ questionId, type, rating? | text? }] }`
      const payload = Object.values(answers)
        .map((a) => ({
          questionId: a.questionId,
          orderIndex: a.orderIndex,
          type: a.type,
          rating: a.type === 'rating' ? a.rating : undefined,
          text: a.type === 'text' ? (a.text ?? '').trim() : undefined,
        }))
        .filter((a) => {
          if (a.type === 'rating') return typeof a.rating === 'number' && a.rating > 0;
          if (a.type === 'text') return typeof a.text === 'string' && a.text.length > 0;
          return false;
        });

      await seminarService.submitDynamicFeedback(seminarId, payload);
      setIsSuccess(true);
      onSuccess?.();
    } catch (err: unknown) {
      const ax = err as {
        response?: { status?: number; data?: { message?: string } | string };
      };
      const responseData = ax?.response?.data;
      const status = ax?.response?.status;
      const rawMsg =
        typeof responseData === 'string'
          ? responseData
          : responseData?.message ??
            (err instanceof Error ? err.message : '') ??
            '';
      const friendly =
        (status === 403
          ? rawMsg ||
            'You are not authorized to submit feedback for this seminar.'
          : rawMsg ||
            'Could not submit feedback. Please try again.') as string;
      setErrorMsg(friendly);
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

            {isLoading ? (
              <div className={styles.feedbackLoading}>
                <Loader size={16} className={styles.spinningIcon} aria-hidden />
                Loading the feedback form…
              </div>
            ) : questions.length === 0 ? (
              <div className={styles.feedbackEmpty}>
                <Sparkles size={20} aria-hidden />
                <div>
                  <strong>
                    The host has not configured a feedback form yet.
                  </strong>
                  <span>
                    You'll be able to share your feedback once the seminar
                    organizer publishes the form for this session.
                  </span>
                </div>
              </div>
            ) : (
              <DynamicQuestionRenderer
                questions={questions}
                answers={answers}
                onAnswerChange={(qId, ans) => {
                  setAnswers((prev) => ({
                    ...prev,
                    [qId]: ans,
                  }));
                  if (errors[qId]) {
                    setErrors((prev) => {
                      const next = { ...prev };
                      delete next[qId];
                      return next;
                    });
                  }
                }}
                errors={errors}
                previewMode={previewMode}
                disabled={previewMode || isSubmitting}
              />
            )}

            {!isLoading && questions.length > 0 && (
              <div className={styles.guidanceNote}>
                <Sparkles size={14} aria-hidden />
                <span>
                  {answeredCount} / {questions.length} answered — your
                  responses are private to the seminar organizer.
                </span>
              </div>
            )}
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
                disabled={
                  isSubmitting ||
                  isSuccess ||
                  questions.length === 0 ||
                  isLoading
                }
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

export default SeminarFeedbackModal;
