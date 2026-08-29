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
  const isSubmittingRef = useRef(false);

  const isReasonValid = reason.trim().length >= MIN_REASON_LENGTH;
  const targetLabel = targetType === 'ForumPost' ? 'Forum Post' : 'Comment';

  useEffect(() => {
    if (isOpen) {
      setReason('');
      setViolationNotes('');
      setApiError(null);
      setValidationError(null);
      setIsSubmitting(false);
      isSubmittingRef.current = false;
      setTimeout(() => reasonTextareaRef.current?.focus(), 100);
    }
  }, [isOpen]);

  useEffect(() => {
    if (validationError && isReasonValid) {
      setValidationError(null);
    }
  }, [reason, isReasonValid, validationError]);

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
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
      onClose();
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
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.header}>
          <Flag size={20} className={styles.headerIcon} />
          <h2 id="report-modal-title" className={styles.headerTitle}>Report {targetLabel}</h2>
          <button
            onClick={onClose}
            className={styles.cancelBtn}
            style={{ marginLeft: 'auto', padding: '4px' }}
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
              Reason <span style={{ color: '#dc2626' }}>*</span>
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
              Additional Details <span style={{ color: '#94a3b8', fontWeight: 400 }}>(optional)</span>
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
            onClick={onClose}
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
