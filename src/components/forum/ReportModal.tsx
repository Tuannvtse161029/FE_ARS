import { useState, useEffect, useRef } from 'react';
import { Flag, X, AlertCircle, Loader2 } from 'lucide-react';
import { reportService, ReportTargetType } from '../../services/report.service';
import { ErrorBanner } from '../ErrorBanner';
import { Button } from '../Button';
import styles from './ReportModal.module.css';

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetType: ReportTargetType;
  targetPreview: string;
  targetId: number;
  reporterId: number;
}

const MIN_REASON_LENGTH = 10;

export const ReportModal = ({
  isOpen,
  onClose,
  targetType,
  targetPreview,
  targetId,
  reporterId,
}: ReportModalProps) => {
  const [reason, setReason] = useState('');
  const [violationNotes, setViolationNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const reasonTextareaRef = useRef<HTMLTextAreaElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const isSubmittingRef = useRef(false);

  const isReasonValid = reason.trim().length >= MIN_REASON_LENGTH;
  const targetLabel = targetType === 'ForumPost' ? 'Forum Post' : 'Comment';

  const closeDialog = (): void => {
    onClose();
    openerRef.current?.focus();
  };

  useEffect(() => {
    if (isOpen) {
      setReason('');
      setViolationNotes('');
      setApiError(null);
      setValidationError(null);
      setIsSubmitting(false);
      isSubmittingRef.current = false;
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;
    openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusTimer = window.setTimeout(() => reasonTextareaRef.current?.focus(), 0);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isSubmitting) {
        event.preventDefault();
        closeDialog();
        return;
      }
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), textarea:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ));
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;
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
      window.clearTimeout(focusTimer);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, isSubmitting]);

  useEffect(() => {
    if (validationError && isReasonValid) {
      setValidationError(null);
    }
  }, [reason, isReasonValid, validationError]);

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      closeDialog();
    }
  };

  const handleSubmit = async () => {
    if (isSubmittingRef.current) return;

    if (!isReasonValid) {
      setValidationError(`Please provide at least ${MIN_REASON_LENGTH} characters explaining the issue.`);
      reasonTextareaRef.current?.focus();
      return;
    }

    isSubmittingRef.current = true;
    setIsSubmitting(true);
    setApiError(null);
    setValidationError(null);

    try {
      await reportService.createReport({
        reporterId,
        targetType,
        targetId,
        reason: reason.trim(),
        violationNotes: violationNotes.trim() || undefined,
      });
      closeDialog();
    } catch (err: unknown) {
      const message =
        (err as { message?: string })?.message ||
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Failed to submit report. Please try again.';
      setApiError(message);
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={handleOverlayClick} role="dialog" aria-modal="true" aria-labelledby="report-modal-title">
      <div ref={dialogRef} className={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.header}>
          <Flag size={20} className={styles.headerIcon} />
          <h2 id="report-modal-title" className={styles.headerTitle}>Report {targetLabel}</h2>
          <button
            onClick={closeDialog}
            className={`${styles.cancelBtn} ${styles.closeBtn}`}
            aria-label="Close modal"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className={styles.body}>
          {/* Target Preview */}
          <div className={styles.targetPreview}>
            <div className={styles.targetLabel}>{targetLabel}</div>
            <div className={styles.targetContent}>{targetPreview}</div>
          </div>

          {/* Reason Field */}
          <div className={styles.fieldGroup}>
            <label htmlFor="report-reason" className={styles.fieldLabel}>
              Reason <span className={styles.requiredMark}>*</span>
            </label>
            <textarea
              id="report-reason"
              ref={reasonTextareaRef}
              className={`${styles.textarea} ${validationError ? styles.textareaError : ''}`}
              placeholder="Describe why you're reporting this content (min 10 characters)..."
              rows={4}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={isSubmitting}
            />
            <div className={`${styles.charCount} ${reason.length < MIN_REASON_LENGTH ? styles.charCountError : ''}`}>
              {reason.length}/{MIN_REASON_LENGTH} characters minimum
            </div>
            {validationError && (
              <div className={styles.validationError}>
                <AlertCircle size={14} />
                {validationError}
              </div>
            )}
          </div>

          {/* Additional Details Field */}
          <div className={styles.fieldGroup}>
            <label htmlFor="report-notes" className={styles.fieldLabel}>
              Additional Details <span className={styles.optionalLabel}>(optional)</span>
            </label>
            <textarea
              id="report-notes"
              className={styles.textarea}
              placeholder="Provide any additional context that might help administrators..."
              rows={3}
              value={violationNotes}
              onChange={(e) => setViolationNotes(e.target.value)}
              disabled={isSubmitting}
            />
          </div>

          {/* API Error — shared ErrorBanner tone="error" */}
          {apiError && (
            <ErrorBanner
              tone="error"
              title="Couldn't submit report"
              message={apiError}
            />
          )}
        </div>

        {/* Footer */}
        <div className={styles.footer}>
          <Button
            variant="outline"
            size="md"
            onClick={closeDialog}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          {/* The shared <Button isLoading> pattern shows a spinner over the
              same label; the original "Submitting…" copy is preserved here
              because the existing ReportModal integration tests assert on
              the literal text "/submitting/i" while a request is in flight. */}
          <button
            type="button"
            className={styles.submitBtn}
            onClick={handleSubmit}
            disabled={!isReasonValid || isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 size={14} className={styles.spinner} aria-hidden />
                Submitting…
              </>
            ) : (
              <>
                <Flag size={14} aria-hidden />
                Submit Report
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReportModal;
