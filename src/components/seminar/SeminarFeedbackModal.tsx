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
  Star,
} from 'lucide-react';
import { seminarService } from '../../services/seminar.service';
import { useLocale } from '../../i18n/I18nContext';
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

export const SeminarFeedbackModal = ({
  isOpen,
  onClose,
  seminarId,
  seminarTitle,
  existingDynamicAnswersRaw,
  hasSubmittedBefore = false,
  previewMode = false,
  onSuccess,
}: SeminarFeedbackModalProps) => {
  const locale = useLocale();
  const isVi = locale === 'vi';
  const copy = (en: string, vi: string) => (isVi ? vi : en);

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
          copy(
            'Could not load the feedback form. Please try again or contact the host.',
            'Không thể tải biểu mẫu. Vui lòng thử lại hoặc liên hệ với người tổ chức.',
          ),
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
          localErrors[q.id] = copy(
            'Please select a star rating.',
            'Vui lòng chọn số sao đánh giá.',
          );
        } else if (
          q.type === 'text' &&
          (!ans.text || !ans.text.trim())
        ) {
          localErrors[q.id] = copy(
            'Please provide your answer.',
            'Vui lòng trả lời câu hỏi này.',
          );
        }
      }
    }
    if (Object.keys(localErrors).length > 0) {
      setErrors(localErrors);
      setErrorMsg(
        copy(
          'Please answer all required questions.',
          'Vui lòng hoàn thành các câu hỏi bắt buộc.',
        ),
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
      const friendly = (
        status === 403
          ? rawMsg ||
            copy(
              'You are not authorized to submit feedback for this seminar.',
              'Bạn không có quyền gửi đánh giá cho hội thảo này.',
            )
          : rawMsg ||
            copy(
              'Could not submit feedback. Please try again.',
              'Không thể gửi đánh giá. Vui lòng thử lại.',
            )) as string;
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
                  ? copy('Feedback Form Preview', 'Xem trước biểu mẫu đánh giá')
                  : isEditing
                    ? copy('Edit Your Feedback', 'Chỉnh sửa đánh giá của bạn')
                    : copy('Share Your Seminar Feedback', 'Chia sẻ đánh giá hội thảo')}
              </h3>
              <p className={styles.modalSubtitle}>
                {previewMode
                  ? copy(
                      `${seminarTitle ?? 'Academic seminar'} \u00b7 This is exactly what participants will see`,
                      `${seminarTitle ?? 'H\u1ed9i th\u1ea3o h\u1ecdc thu\u1eadt'} \u00b7 Ng\u01b0\u1eddi tham d\u1ef1 s\u1ebd th\u1ea5y ch\u00ednh x\u00e1c giao di\u1ec7n n\u00e0y`,
                    )
                  : seminarTitle ?? copy('Academic seminar', 'H\u1ed9i th\u1ea3o h\u1ecdc thu\u1eadt')}
              </p>
            </div>
          </div>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={onClose}
            aria-label={copy('Close', '\u0110\u00f3ng')}
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className={styles.modalBody}>
            {previewMode && (
              <div className={styles.previewBanner} role="status">
                <Star size={14} aria-hidden />
                <span>
                  {copy(
                    'Preview only \u2014 your form is read-only. Participants will receive this layout when the seminar closes.',
                    'Ch\u1ebf \u0111\u1ed9 xem tr\u01b0\u1edbc \u2014 bi\u1ec3u m\u1eabu c\u1ee7a b\u1ea1n l\u00e0 ch\u1ec9 \u0111\u1ecdc. Ng\u01b0\u1eddi tham d\u1ef1 s\u1ebd nh\u1eadn \u0111\u01b0\u1ee3c giao di\u1ec7n n\u00e0y khi h\u1ed9i th\u1ea3o k\u1ebft th\u00facc.',
                  )}
                </span>
              </div>
            )}
            {isSuccess && (
              <div className={styles.successBanner} role="status">
                <CheckCircle2 size={16} />
                <span>
                  {isEditing
                    ? copy(
                        'Feedback updated. Thank you for the revision.',
                        '\u0110\u00e3 c\u1eadp nh\u1eadt \u0111\u00e1nh gi\u00e1. C\u1ea3m \u01a1n b\u1ea1n \u0111\u00e3 ch\u1ec9nh s\u1eeda.',
                      )
                    : copy(
                        'Feedback submitted. Thank you for sharing your reflection.',
                        '\u0110\u00e3 g\u1eedi \u0111\u00e1nh gi\u00e1. C\u1ea3m \u01a1n b\u1ea1n \u0111\u00e3 chia s\u1ebb \u00fd ki\u1ebfn.',
                      )}
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
                {copy('Loading the feedback form\u2026', '\u0110ang t\u1ea3i bi\u1ec3u m\u1eabu \u0111\u00e1nh gi\u00e1\u2026')}
              </div>
            ) : questions.length === 0 ? (
              <div className={styles.feedbackEmpty}>
                <Star size={20} aria-hidden />
                <div>
                  <strong>
                    {copy(
                      'The host has not configured a feedback form yet.',
                      'Ng\u01b0\u1eddi t\u1ed5 ch\u1ee9c ch\u01b0a thi\u1ebft l\u1eadp bi\u1ec3u m\u1eabu \u0111\u00e1nh gi\u00e1.',
                    )}
                  </strong>
                  <span>
                    {copy(
                      "You'll be able to share your feedback once the seminar organizer publishes the form for this session.",
                      'B\u1ea1n c\u00f3 th\u1ec3 chia s\u1ebb \u0111\u00e1nh gi\u00e1 sau khi ng\u01b0\u1eddi t\u1ed5 ch\u1ee9c c\u00f4ng b\u1ed1 bi\u1ec3u m\u1eabu cho phi\u00ean h\u1ecdp n\u00e0y.',
                    )}
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
                <Star size={14} aria-hidden />
                <span>
                  {copy(
                    `${answeredCount} / ${questions.length} answered \u2014 your responses are private to the seminar organizer.`,
                    `${answeredCount} / ${questions.length} \u0111\u00e3 tr\u1ea3 l\u1eddi \u2014 c\u00e1c ph\u1ea3n h\u1ed3i c\u1ee7a b\u1ea1n l\u00e0 ri\u00eang t\u01b0 v\u1edbi ng\u01b0\u1eddi t\u1ed5 ch\u1ee9c h\u1ed9i th\u1ea3o.`,
                  )}
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
              {previewMode ? copy('Close Preview', '\u0110\u00f3ng xem tr\u01b0\u1edbc') : copy('Cancel', 'H\u1ee7y')}
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
                    <span>{isEditing ? copy('Saving\u2026', '\u0110ang l\u01b0u\u2026') : copy('Submitting\u2026', '\u0110ang g\u1eedi\u2026')}</span>
                  </>
                ) : isSuccess ? (
                  <>
                    <CheckCircle2 size={16} />
                    <span>{copy('Submitted', '\u0110\u00e3 g\u1eedi')}</span>
                  </>
                ) : isEditing ? (
                  copy('Save Changes', 'L\u01b0u thay \u0111\u1ed5i')
                ) : (
                  copy('Submit Feedback', 'G\u1eedi \u0111\u00e1nh gi\u00e1')
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
