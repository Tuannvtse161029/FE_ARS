import React, { useState, useEffect, useRef } from 'react';
import { X, Star, ClipboardCheck, Loader, CheckCircle2, AlertCircle } from 'lucide-react';
import { seminarService } from '../../services/seminar.service';
import styles from './SeminarFeedbackModal.module.css';

const useDialogFocus = (isOpen: boolean, isBusy: boolean, onClose: () => void) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!isOpen) {
      openerRef.current?.focus();
      return;
    }
    openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const frame = window.requestAnimationFrame(() => dialogRef.current?.querySelector<HTMLElement>('button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex="0"]')?.focus());
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isBusy) { event.preventDefault(); onClose(); return; }
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), a[href], [tabindex="0"]'));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => { window.cancelAnimationFrame(frame); document.removeEventListener('keydown', handleKeyDown); };
  }, [isOpen, isBusy, onClose]);
  return dialogRef;
};

export interface SeminarFeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  seminarId: number;
  seminarTitle?: string;
  participantId?: number | null;
  currentUserId?: number | null;
  existingEvaluation?: string | null;
  onSuccess?: () => void;
}

const RATING_LABELS = [
  'Rất không hài lòng (1/5)',
  'Chưa hài lòng (2/5)',
  'Bình thường (3/5)',
  'Hài lòng (4/5)',
  'Rất hài lòng & Xuất sắc (5/5)',
];

export const SeminarFeedbackModal: React.FC<SeminarFeedbackModalProps> = ({
  isOpen,
  onClose,
  seminarId,
  seminarTitle,
  participantId,
  currentUserId: _currentUserId,
  existingEvaluation,
  onSuccess,
}) => {
  const [rating, setRating] = useState<number>(5);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [evaluationText, setEvaluationText] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);
  const dialogRef = useDialogFocus(isOpen, isSubmitting, onClose);
  void participantId;

  useEffect(() => {
    if (isOpen) {
      setEvaluationText(existingEvaluation ?? '');
      setRating(5);
      setErrorMsg(null);
      setIsSuccess(false);
    }
  }, [isOpen, existingEvaluation]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!evaluationText.trim()) {
      setErrorMsg('Vui lòng nhập nội dung nhận xét / đánh giá của bạn.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      await seminarService.submitFeedback(seminarId, {
        rating,
        participantEvaluation: evaluationText.trim(),
        invitationStatus: 'Submitted',
      });

      setIsSuccess(true);
      onSuccess?.();
    } catch (err: unknown) {
      const responseData = (err as { response?: { data?: { message?: string } | string } })?.response?.data;
      const rawMsg =
        typeof responseData === 'string'
          ? responseData
          : responseData?.message ?? (err as Error)?.message ?? '';

      let friendlyMsg = 'Không thể gửi phản hồi. Vui lòng thử lại.';
      if (rawMsg.toLowerCase().includes('not registered') || rawMsg.toLowerCase().includes('not invited')) {
        friendlyMsg = 'Tài khoản của bạn chưa nằm trong danh sách khách mời của buổi Seminar này.';
      } else if (rawMsg) {
        friendlyMsg = rawMsg;
      }

      setErrorMsg(friendlyMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const activeRating = hoverRating ?? rating;

  return (
    <div ref={dialogRef} className={styles.modalOverlay} role="dialog" aria-modal="true" aria-labelledby="seminar-feedback-title">
      <div className={styles.modalCard}>
        {/* Header */}
        <div className={styles.modalHeader}>
          <div className={styles.headerTitleBlock}>
            <div className={styles.headerIcon}>
              <ClipboardCheck size={20} />
            </div>
            <div>
              <h3 id="seminar-feedback-title" className={styles.modalTitle}>Đánh giá & Phản hồi Seminar</h3>
              <p className={styles.modalSubtitle}>
                {seminarTitle || 'Buổi Seminar học thuật'}
              </p>
            </div>
          </div>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={onClose}
            aria-label="Đóng"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit}>
          <div className={styles.modalBody}>
            {isSuccess && (
              <div className={styles.successBanner} role="status">
                <CheckCircle2 size={16} />
                <span>Gửi đánh giá thành công! Cảm ơn bạn đã đóng góp ý kiến.</span>
              </div>
            )}

            {errorMsg && (
              <div className={styles.errorBanner} role="alert">
                <AlertCircle size={16} />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Star Rating Section */}
            <div className={styles.ratingSection}>
              <label className={styles.sectionLabel}>Mức độ hài lòng của bạn:</label>
              <div className={styles.starRow}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    className={`${styles.starBtn} ${
                      star <= activeRating ? styles.starActive : ''
                    }`}
                    onClick={() => setRating(star)}
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(null)}
                    aria-label={`${star} sao`}
                  >
                    <Star
                      size={24}
                      className={`${styles.starGlyph} ${
                        star <= activeRating ? styles.starFilled : styles.starEmpty
                      }`}
                    />
                  </button>
                ))}
                <span className={styles.ratingLabel}>
                  {RATING_LABELS[activeRating - 1]}
                </span>
              </div>
            </div>

            {/* Feedback Content Textarea */}
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>
                * Nội dung nhận xét & đóng góp ý kiến:
              </label>
              <textarea
                className={styles.textarea}
                value={evaluationText}
                onChange={(e) => setEvaluationText(e.target.value)}
                placeholder="Chia sẻ cảm nhận của bạn về nội dung, diễn giả, kiến thức tiếp thu được hoặc đề xuất cho các buổi sau..."
                disabled={isSubmitting || isSuccess}
                rows={4}
                required
              />
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
              Hủy
            </button>
            <button
              type="submit"
              className={styles.submitBtn}
              disabled={isSubmitting || isSuccess}
            >
              {isSubmitting ? (
                <>
                  <Loader size={16} className={styles.spinningIcon} />
                  <span>Đang gửi...</span>
                </>
              ) : (
                'Gửi đánh giá'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SeminarFeedbackModal;
